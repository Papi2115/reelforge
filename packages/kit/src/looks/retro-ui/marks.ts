/**
 * Marked words of the retro-UI templates: `marks: [{ text, at? }]` gives each phrase an anchor
 * `mark:<text>` (centre of its first occurrence, for ctx.annotate) and, with `at`, an in-world
 * highlight that sweeps over the phrase in 0.35 s (a marker stroke on paper, inverse video in a
 * terminal). Shared schemas of the templates live here too.
 */
import { z } from 'zod';
import { progress } from '../../fx/shared.js';
import {
  blit,
  charPositions,
  createCanvas,
  drawText,
  fillRect,
  normalize,
  textHeight,
  textWidth,
  type PixelCanvas,
  type Point,
  type Rect,
  type TextStyle,
} from './canvas.js';
import { ACCENTS } from './colors.js';
import type { AnchorMap } from './surface.js';

export const MARK_SWEEP = 0.35;

export const marksParam = z
  .array(
    z.object({
      text: z.string().min(1).max(40).describe('Phrase to mark (as it appears; case-insensitive)'),
      at: z
        .number()
        .optional()
        .describe('Local time the highlight sweeps over it (omit: anchor only, no highlight)'),
    }),
  )
  .max(8)
  .default([])
  .describe("Phrases that get an anchor 'mark:<text>' and an optional timed highlight");

export type MarkSpec = z.output<typeof marksParam>[number];

export const accentParam = z
  .enum(ACCENTS)
  .default('violet')
  .describe('Accent of title bars, banners and bars: violet, teal, orange, pink, green');

export const sizeParam = (width: number, height: number, max: readonly [number, number]) =>
  z
    .tuple([
      z.int().min(48).max(max[0]).describe('Width in UI pixels'),
      z.int().min(40).max(max[1]).describe('Height in UI pixels'),
    ])
    .default([width, height])
    .describe('[width, height] in UI pixels (a 320x180 UI fills the frame at fitDistance(2))');

export const pixelParam = z
  .number()
  .positive()
  .max(1)
  .default(0.02)
  .describe('World size of one UI pixel (keep it equal for templates shown together)');

export const seedParam = z.int().default(0).describe('Variant of photos, greeked text and noise');

export interface MarkOptions {
  /** `marker` = fill under the text (paper); `inverse` = fill with the ink, text in `paper`. */
  readonly mode: 'marker' | 'inverse';
  /** Marker colour (marker) or the background used for inverse text. */
  readonly color: number;
}

/** Draws text lines and records/highlights marks while painting one frame. */
export class MarkTracker {
  private readonly found = new Map<string, Rect>();

  constructor(
    private readonly marks: readonly MarkSpec[],
    private readonly t: number,
    private readonly options: MarkOptions,
  ) {}

  /** Draws `text` at (x, y) like drawText, marking every listed phrase in it. */
  text(
    canvas: PixelCanvas,
    text: string,
    x: number,
    y: number,
    color: number,
    style: TextStyle = {},
  ): number {
    const line = normalize(text);
    const scale = Math.max(1, Math.round(style.scale ?? 1));
    const hits = this.marks.flatMap((mark) => {
      const start = line.indexOf(normalize(mark.text));
      if (start < 0) return [];
      const xs = charPositions(line, style).xs;
      const area: Rect = {
        x: Math.round(x) + (xs[start] ?? 0) * scale,
        y: Math.round(y),
        w: textWidth(line.slice(start, start + normalize(mark.text).length), style),
        h: textHeight(style),
      };
      if (!this.found.has(mark.text)) this.found.set(mark.text, area);
      const k = mark.at === undefined ? 0 : progress(this.t, mark.at, mark.at + MARK_SWEEP);
      return k > 0 ? [{ area, k, start, length: normalize(mark.text).length }] : [];
    });
    if (this.options.mode === 'marker') {
      for (const hit of hits) {
        const { area } = hit;
        fillRect(
          canvas,
          { x: area.x - 1, y: area.y - 1, w: Math.round((area.w + 2) * hit.k), h: area.h + 2 },
          this.options.color,
        );
      }
    }
    const width = drawText(canvas, line, x, y, color, style);
    if (this.options.mode === 'inverse') {
      for (const hit of hits) {
        const { area } = hit;
        const sweep = {
          x: area.x - 1,
          y: area.y - 1,
          w: Math.round((area.w + 2) * hit.k),
          h: area.h + 2,
        };
        fillRect(canvas, sweep, color);
        const segment = line.slice(hit.start, hit.start + hit.length);
        const view = createCanvas(sweep.w, sweep.h);
        drawText(view, segment, area.x - sweep.x, area.y - sweep.y, this.options.color, style);
        blit(view, canvas, sweep.x, sweep.y);
      }
    }
    return width;
  }

  /** `mark:<text>` anchors (unfound phrases sit at `fallback`). */
  anchors(fallback: Point): AnchorMap {
    const result: AnchorMap = {};
    for (const mark of this.marks) {
      const area = this.found.get(mark.text);
      result[`mark:${mark.text}`] = area ? [area.x + area.w / 2, area.y + area.h / 2] : fallback;
    }
    return result;
  }
}
