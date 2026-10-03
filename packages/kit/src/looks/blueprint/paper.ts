/**
 * The blueprint sheet every template draws on: paper colour, a two-level grid that drifts a few
 * pixels per second (the shot never freezes), border, ruler ticks, corner marks, an optional
 * heading and an optional title block. Returns the content area the template lays out in.
 */
import { z } from 'zod';
import type { Raster } from './raster.js';
import { drawText, textWidth } from './text.js';
import type { Theme } from './theme.js';

export const titleBlockParam = z
  .object({
    title: z.string().max(28).describe('Drawing name'),
    code: z.string().max(12).default('RF-01').describe('Drawing number'),
    scale: z.string().max(8).default('1:1').describe('Scale note'),
  })
  .optional()
  .describe('Title block in the bottom-right corner (omit for none)');

export type TitleBlock = z.output<typeof titleBlockParam>;

export interface PaperOptions {
  /** Reference scale: raster pixels per 640x360-frame pixel. */
  readonly s: number;
  readonly drift: readonly [number, number];
  readonly heading: string;
  readonly titleBlock: TitleBlock;
  /** Whether the sheet (fill, grid, border) is drawn; false = transparent overlay. */
  readonly paper: boolean;
}

export interface Area {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Grid pitches (reference px): minor dotted lines, major solid lines. */
const MINOR = 10;
const MAJOR = 50;
/** Border inset and width (reference px). */
const BORDER = 8;

function modulo(value: number, base: number): number {
  return ((value % base) + base) % base;
}

function paintGrid(
  raster: Raster,
  theme: Theme,
  s: number,
  t: number,
  drift: PaperOptions['drift'],
): void {
  const minor = Math.max(4, Math.round(MINOR * s));
  const major = minor * (MAJOR / MINOR);
  const offsetX = Math.floor(t * drift[0] * s);
  const offsetY = Math.floor(t * drift[1] * s);
  for (let x = 0; x < raster.width; x += 1) {
    const phase = modulo(x - offsetX, major);
    if (phase === 0) raster.rect(x, 0, 1, raster.height, theme.grid);
    else if (phase % minor === 0) {
      for (let y = modulo(offsetY, 2); y < raster.height; y += 2) raster.set(x, y, theme.grid);
    }
  }
  for (let y = 0; y < raster.height; y += 1) {
    const phase = modulo(y - offsetY, major);
    if (phase === 0) raster.rect(0, y, raster.width, 1, theme.grid);
    else if (phase % minor === 0) {
      for (let x = modulo(offsetX, 2); x < raster.width; x += 2) raster.set(x, y, theme.grid);
    }
  }
}

function paintRulers(raster: Raster, theme: Theme, s: number, inset: number): void {
  const minor = Math.max(4, Math.round(MINOR * s));
  const right = raster.width - inset;
  const bottom = raster.height - inset;
  for (let x = inset + minor; x < right; x += minor) {
    const long = (x - inset) % (minor * 5) === 0;
    raster.rect(x, inset + 2, 1, long ? 4 : 2, theme.dim);
  }
  for (let y = inset + minor; y < bottom; y += minor) {
    const long = (y - inset) % (minor * 5) === 0;
    raster.rect(inset + 2, y, long ? 4 : 2, 1, theme.dim);
  }
}

function paintCorners(raster: Raster, theme: Theme, inset: number, arm: number): void {
  const corners = [
    [inset, inset, 1, 1],
    [raster.width - 1 - inset, inset, -1, 1],
    [inset, raster.height - 1 - inset, 1, -1],
    [raster.width - 1 - inset, raster.height - 1 - inset, -1, -1],
  ] as const;
  for (const [x, y, dx, dy] of corners) {
    raster.line(x - dx * 3, y, x + dx * arm, y, theme.ink);
    raster.line(x, y - dy * 3, x, y + dy * arm, theme.ink);
  }
}

/** Title block box (reference size 196 x 34), bottom-right inside the border. */
function paintTitleBlock(
  raster: Raster,
  theme: Theme,
  s: number,
  block: NonNullable<TitleBlock>,
): number {
  const width = Math.round(196 * s);
  const height = Math.round(34 * s);
  const inset = Math.round(BORDER * s) + 1;
  const x = raster.width - inset - width;
  const y = raster.height - inset - height;
  const small = Math.max(1, Math.round(s));
  const cell = Math.max(
    Math.round(64 * s),
    textWidth(`NO. ${block.code}`, small) + Math.round(10 * s),
    textWidth(`SCALE ${block.scale}`, small) + Math.round(10 * s),
  );
  const split = x + width - cell;
  raster.rect(x, y, width, height, theme.paper);
  raster.frame(x, y, width, height, theme.ink);
  raster.rect(split, y, 1, height, theme.ink);
  raster.rect(split, y + (height >> 1), width - (split - x), 1, theme.ink);
  const big = Math.max(1, Math.round(2 * s));
  const titleScale = textWidth(block.title, big) <= split - x - 8 ? big : small;
  drawText(raster, [block.title], x + 6, y + (height >> 1), {
    scale: titleScale,
    color: theme.ink,
    valign: 'middle',
  });
  const cellX = split + Math.round(5 * s);
  drawText(raster, [`NO. ${block.code}`], cellX, y + (height >> 2), {
    scale: small,
    color: theme.dim,
    valign: 'middle',
  });
  drawText(raster, [`SCALE ${block.scale}`], cellX, y + ((3 * height) >> 2), {
    scale: small,
    color: theme.dim,
    valign: 'middle',
  });
  return height;
}

/** Paints the sheet for time t; returns the area left for the template's content. */
export function paintPaper(raster: Raster, theme: Theme, options: PaperOptions, t: number): Area {
  const { s } = options;
  const margin = Math.round(20 * s);
  let top = margin;
  let bottom = margin;
  if (options.paper) {
    raster.rect(0, 0, raster.width, raster.height, theme.paper);
    paintGrid(raster, theme, s, t, options.drift);
    const inset = Math.round(BORDER * s);
    const thickness = Math.max(1, Math.round(2 * s));
    raster.frame(
      inset,
      inset,
      raster.width - inset * 2,
      raster.height - inset * 2,
      theme.ink,
      thickness,
    );
    paintRulers(raster, theme, s, inset + thickness - 1);
    paintCorners(raster, theme, Math.max(2, Math.round(3 * s)), Math.round(6 * s));
    if (options.titleBlock) bottom = paintTitleBlock(raster, theme, s, options.titleBlock) + margin;
  } else {
    top = Math.round(6 * s);
    bottom = top;
  }
  if (options.heading.length > 0) {
    const scale = Math.max(1, Math.round(2 * s));
    const box = drawText(raster, [options.heading], margin, top, {
      scale,
      color: theme.ink,
      plate: options.paper ? theme.paper : undefined,
      pad: Math.max(1, Math.round(2 * s)),
    });
    raster.rect(margin, box.y + box.height + 1, Math.round(box.width - 2 * s), 1, theme.ink);
    top = box.y + box.height + Math.round(12 * s);
  }
  const side = options.paper ? margin : top;
  return {
    x: side,
    y: top,
    width: raster.width - side * 2,
    height: raster.height - top - bottom,
  };
}
