/**
 * Voxel text effects: `kit.fx.typewriterBlock` (lines typed character by character with a
 * blinking block cursor, optionally on a terminal panel) and `kit.fx.ticker` (a news-ticker
 * band scrolling text from right to left). Glyphs are per-character meshes posed from t.
 */
import type * as THREE from 'three';
import { z } from 'zod';
import { createKitObject, type KitObject } from '../object.js';
import { defineFx, type KitTools } from '../registry.js';
import { GLYPH_ROWS, GLYPH_SPACING, layoutLine, normalizeText } from './font.js';
import { asFx, timeParam } from './shared.js';
import { glyphSet, voxelSizeFor, type GlyphSet } from './text.js';

export const typewriterParams = z.object({
  lines: z.array(z.string().max(60)).min(1).max(12).describe('Lines of text, typed in order'),
  start: timeParam.default(0).describe('Local time typing starts'),
  cps: z.number().positive().default(18).describe('Characters per second'),
  lineDelay: z.number().min(0).default(0.2).describe('Pause after each line in seconds'),
  height: z.number().positive().default(0.3).describe('Character height in units'),
  color: z.string().default('accent3').describe('Text colour (palette name, unlit)'),
  prompt: z.string().max(4).default('').describe('Prefix shown when a line starts, e.g. "> "'),
  cursor: z.boolean().default(true).describe('Blinking block cursor after the last character'),
  panel: z.boolean().default(true).describe('Dark terminal panel behind the text'),
  panelColor: z.string().default('shadow').describe('Panel colour (palette name)'),
});

export type TypewriterParams = z.output<typeof typewriterParams>;

export interface LineTiming {
  /** Local time the line starts (its prompt appears). */
  readonly start: number;
  /** Reveal time of every character of the line, prompt included. */
  readonly chars: readonly number[];
  /** Local time the last character is typed. */
  readonly end: number;
}

/** When every line starts and every character appears. */
export function typewriterTimes(params: TypewriterParams): LineTiming[] {
  const prompt = Array.from(normalizeText(params.prompt));
  let clock = params.start;
  return params.lines.map((line) => {
    const body = Array.from(normalizeText(line));
    const start = clock;
    const chars = [
      ...prompt.map(() => start),
      ...body.map((_, index) => start + (index + 1) / params.cps),
    ];
    const end = start + body.length / params.cps;
    clock = end + params.lineDelay;
    return { start, chars, end };
  });
}

const CURSOR_PERIOD = 0.9;
const LINE_GAP_ROWS = 4;
const SPACE_COLUMNS = 3;

interface PlacedMesh {
  readonly mesh: THREE.Object3D | undefined;
  /** Left edge in local units. */
  readonly x: number;
  /** Where the next character (or the cursor) starts. */
  readonly next: number;
  readonly width: number;
}

function placeGlyphs(
  glyphs: GlyphSet,
  parent: THREE.Object3D,
  text: string,
  x0: number,
  y: number,
): PlacedMesh[] {
  return layoutLine(text).glyphs.map((placed) => {
    const mesh = glyphs.mesh(placed.char);
    const x = x0 + placed.x * glyphs.voxelSize;
    const columns = (placed.glyph?.width ?? SPACE_COLUMNS) + GLYPH_SPACING;
    if (mesh) {
      mesh.position.set(x, y, 0);
      parent.add(mesh);
    }
    return { mesh, x, next: x + columns * glyphs.voxelSize, width: glyphs.width(placed.char) };
  });
}

/** Dark plate with a 1-voxel light border, its front face at local z. */
export function panelMesh(
  tools: KitTools,
  size: readonly [number, number],
  color: string,
  z: number,
): KitObject {
  const voxel = Math.min(size[0], size[1]) / 24;
  const columns = Math.max(3, Math.round(size[0] / voxel));
  const rows = Math.max(3, Math.round(size[1] / voxel));
  const model = tools.voxel.generate(
    [columns, rows, 2],
    (x, y, zz) => {
      const border = x === 0 || y === 0 || x === columns - 1 || y === rows - 1;
      return border ? 2 : zz === 0 ? 1 : 0;
    },
    [color, 'textDim'],
  );
  const panel = tools.voxel.mesh(model, { voxelSize: voxel, pivot: [columns / 2, rows / 2, 2] });
  panel.position.z = z;
  return panel;
}

export const typewriterBlock = defineFx({
  name: 'typewriterBlock',
  description:
    'Terminal-style text block: voxel lines typed character by character (cps, pause per line) with a blinking block cursor, on an optional dark panel. Origin = block centre, faces +z. fx.update(t) every frame.',
  params: typewriterParams,
  build(params, tools) {
    const { three } = tools;
    const color = { color: params.color, glow: true };
    const glyphs = glyphSet(tools, { height: params.height, color, depth: 2 });
    const voxel = voxelSizeFor(params.height);
    const texts = params.lines.map((line) => normalizeText(params.prompt) + normalizeText(line));
    // Room for the cursor after the longest line.
    const width = Math.max(...texts.map((text) => layoutLine(text).width + 7)) * voxel;
    const pitch = (GLYPH_ROWS + LINE_GAP_ROWS) * voxel;
    const height = texts.length * pitch - LINE_GAP_ROWS * voxel;
    const object = createKitObject(three, { kitType: 'typewriterBlock' });
    if (params.panel) {
      const margin = params.height * 1.2;
      const size = [width + margin * 2, height + margin * 2] as const;
      object.add(panelMesh(tools, size, params.panelColor, -voxel * 1.5));
    }
    const baseline = (line: number): number => height / 2 - params.height - line * pitch;
    const lines = texts.map((text, index) =>
      placeGlyphs(glyphs, object, text, -width / 2, baseline(index)),
    );
    const timing = typewriterTimes(params);
    const cursor = tools.voxel.mesh(tools.voxel.box([5, GLYPH_ROWS, 2], color), {
      voxelSize: voxel,
      pivot: [0, 0, 1],
      ao: 0,
    });
    object.add(cursor);
    return asFx(object, (t) => {
      let cursorLine = 0;
      let cursorX = -width / 2;
      let typing = false;
      for (const [line, placed] of lines.entries()) {
        const lineTiming = timing[line];
        const started = lineTiming !== undefined && t >= lineTiming.start;
        if (started) {
          cursorLine = line;
          cursorX = -width / 2;
          typing = typing || t < lineTiming.end;
        }
        for (const [index, glyph] of placed.entries()) {
          const shown = started && t >= (lineTiming.chars[index] ?? Infinity);
          if (glyph.mesh) glyph.mesh.visible = shown;
          if (shown) cursorX = glyph.next;
        }
      }
      const blinkOn = t % CURSOR_PERIOD < CURSOR_PERIOD / 2;
      cursor.visible = params.cursor && t >= params.start && (typing || blinkOn);
      cursor.position.set(cursorX, baseline(cursorLine), 0);
    });
  },
});

export const tickerParams = z.object({
  text: z.string().min(1).max(200).describe('Ticker text (repeats endlessly)'),
  separator: z.string().max(6).default(' • ').describe('Between repeats'),
  width: z.number().positive().default(6).describe('Visible band width in units'),
  height: z.number().positive().default(0.35).describe('Character height in units'),
  speed: z.number().default(1.5).describe('Scroll speed in units/s (negative = to the right)'),
  start: timeParam.default(0).describe('Local time scrolling starts'),
  color: z.string().default('text').describe('Text colour (palette name, unlit)'),
  bandColor: z.string().default('accent4').describe('Band colour (palette name)'),
});

export type TickerParams = z.output<typeof tickerParams>;

/** Scroll offset (units, >= 0, < loop length) at time t. */
export function tickerOffset(params: TickerParams, loop: number, t: number): number {
  const travelled = Math.max(0, t - params.start) * params.speed;
  return ((travelled % loop) + loop) % loop;
}

export const ticker = defineFx({
  name: 'ticker',
  description:
    'News-ticker band: text scrolls right to left through a fixed-width band with end caps (repeats endlessly). Origin = band centre, faces +z. fx.update(t) every frame.',
  params: tickerParams,
  build(params, tools) {
    const { three } = tools;
    const color = { color: params.color, glow: true };
    const glyphs = glyphSet(tools, { height: params.height, color, depth: 2 });
    const voxel = voxelSizeFor(params.height);
    const unit = normalizeText(params.text) + normalizeText(params.separator);
    const layout = layoutLine(unit);
    const loop = (layout.glyphs.length > 0 ? layout.width + SPACE_COLUMNS + 1 : 1) * voxel;
    const copies = Math.ceil(params.width / loop) + 1;
    const object = createKitObject(three, { kitType: 'ticker' });
    // Glyphs (2 deep) stand on the band plate, behind the front of the end caps.
    const strip = new three.Group();
    strip.position.z = voxel;
    object.add(strip);
    const placed = Array.from({ length: copies }, (_, copy) =>
      placeGlyphs(glyphs, strip, unit, copy * loop, -params.height / 2),
    ).flat();
    // End caps (wider than any glyph) hide glyphs entering and leaving the band.
    const cap = 7 * voxel;
    const bandRows = GLYPH_ROWS + 6;
    const columns = Math.round((params.width + 2 * cap) / voxel);
    const band = tools.voxel.generate(
      [columns, bandRows, 4],
      (x, y, z) => {
        const end = x < 7 || x >= columns - 7;
        if (end) return 2;
        if (z === 0) return y === 0 || y === bandRows - 1 ? 2 : 1;
        return 0;
      },
      ['shadow', params.bandColor],
    );
    const bandMesh = tools.voxel.mesh(band, {
      voxelSize: voxel,
      pivot: [columns / 2, bandRows / 2, 1],
    });
    object.add(bandMesh);
    const left = -params.width / 2;
    return asFx(object, (t) => {
      const offset = tickerOffset(params, loop, t);
      strip.position.x = left - offset;
      for (const glyph of placed) {
        if (!glyph.mesh) continue;
        const x = glyph.x + strip.position.x;
        glyph.mesh.visible = x >= left - cap && x + glyph.width <= -left + cap;
      }
    });
  },
});
