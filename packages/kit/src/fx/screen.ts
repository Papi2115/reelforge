/**
 * Screen glitch. The core is a pure pixel function - `glitchPixels(base, t, level, seed)` over a
 * minimal `ScreenPixels` buffer (palette indices) - that any screen can use (props paint their
 * own screens from it); `kit.fx.screenGlitch` is a standalone voxel panel showing it: text or a
 * blank screen, torn rows, corrupt blocks, static and colour swaps in bursts.
 */
import { z } from 'zod';
import { colorOf } from '../env/shared.js';
import { createKitObject } from '../object.js';
import { defineFx } from '../registry.js';
import { GLYPH_ROWS, layoutLine, normalizeText } from './font.js';
import { glitchLevel } from './glitch.js';
import { asLevelFx, noise1, seedOf, timeParam } from './shared.js';

/**
 * Minimal screen image: `columns x rows` palette indices, row 0 = top. Index 0 is the screen
 * background; indices >= 1 select the screen's colours in order.
 */
export interface ScreenPixels {
  readonly columns: number;
  readonly rows: number;
  readonly data: Uint8Array;
}

/** Centred lines of kit-font text (index 1 ink on index 0), clipped to the screen. */
export function textPixels(lines: readonly string[], columns: number, rows: number): ScreenPixels {
  const data = new Uint8Array(columns * rows);
  const gap = 2;
  const height = lines.length * GLYPH_ROWS + Math.max(0, lines.length - 1) * gap;
  const top = Math.floor((rows - height) / 2);
  lines.forEach((line, index) => {
    const layout = layoutLine(normalizeText(line));
    const left = Math.floor((columns - layout.width) / 2);
    const y0 = top + index * (GLYPH_ROWS + gap);
    for (const placed of layout.glyphs) {
      const glyph = placed.glyph;
      if (!glyph) continue;
      for (let y = 0; y < GLYPH_ROWS; y += 1) {
        for (let x = 0; x < glyph.width; x += 1) {
          const px = left + placed.x + x;
          const py = y0 + y;
          const inside = px >= 0 && py >= 0 && px < columns && py < rows;
          if (inside && glyph.bits[y * glyph.width + x] === 1) data[py * columns + px] = 1;
        }
      }
    }
  });
  return { columns, rows, data };
}

/** Pattern changes per second inside a glitch (independent of the video frame rate). */
const GLITCH_FPS = 24;

/**
 * Glitched copy of `base` at time t with strength `level` (0 = unchanged copy): torn row bands,
 * corrupt blocks, static, dropped scanlines and a colour swap. Pure in (base, t, level, seed);
 * `colors` = number of colours including the background (indices 0..colors-1).
 */
export function glitchPixels(
  base: ScreenPixels,
  t: number,
  level: number,
  seed: number,
  colors = 4,
): ScreenPixels {
  const { columns, rows } = base;
  const data = new Uint8Array(base.data);
  if (level <= 0) return { columns, rows, data };
  const frame = Math.floor(t * GLITCH_FPS);
  const hash = (a: number, b: number): number => noise1(a, frame * 131 + b, seed);
  const swap = hash(0, 1) < 0.35 * level && colors > 2;
  // Torn bands: rows shifted sideways together.
  for (let row = 0; row < rows;) {
    const band = 1 + Math.floor(hash(row, 2) * 4);
    if (hash(row, 3) < 0.45 * level) {
      const shift = Math.round((hash(row, 4) - 0.5) * columns * 0.5 * level);
      for (let y = row; y < Math.min(rows, row + band); y += 1) {
        for (let x = 0; x < columns; x += 1) {
          const source = (((x - shift) % columns) + columns) % columns;
          data[y * columns + x] = base.data[y * columns + source] ?? 0;
        }
      }
    }
    row += band;
  }
  // Corrupt blocks.
  const blocks = Math.round(level * 5 * hash(1, 5));
  for (let block = 0; block < blocks; block += 1) {
    const w = 2 + Math.floor(hash(block, 6) * columns * 0.3);
    const h = 1 + Math.floor(hash(block, 7) * 4);
    const x0 = Math.floor(hash(block, 8) * columns);
    const y0 = Math.floor(hash(block, 9) * rows);
    const value = 1 + Math.floor(hash(block, 10) * (colors - 1));
    for (let y = y0; y < Math.min(rows, y0 + h); y += 1) {
      for (let x = x0; x < Math.min(columns, x0 + w); x += 1) data[y * columns + x] = value;
    }
  }
  for (let index = 0; index < data.length; index += 1) {
    const roll = noise1(index, frame, seed);
    if (roll < 0.06 * level) data[index] = 1 + Math.floor((roll / (0.06 * level)) * (colors - 1));
    else if (swap && data[index] === 1) data[index] = 2;
  }
  // Dropped scanlines.
  for (let row = 0; row < rows; row += 1) {
    if (hash(row, 12) < 0.04 * level) data.fill(0, row * columns, (row + 1) * columns);
  }
  return { columns, rows, data };
}

export const screenGlitchParams = z.object({
  columns: z.number().int().min(4).max(96).default(40).describe('Screen pixels across'),
  rows: z.number().int().min(4).max(64).default(24).describe('Screen pixels down'),
  size: z
    .tuple([z.number().positive(), z.number().positive()])
    .default([1.6, 0.96])
    .describe('[width, height] of the panel in units'),
  text: z.array(z.string().max(16)).max(3).default(['ERROR']).describe('Lines shown on screen'),
  colors: z
    .array(z.string())
    .min(2)
    .max(8)
    .default(['shadow', 'accent3', 'accent2', 'accent1'])
    .describe('Background, ink, then glitch colours (palette names, unlit)'),
  start: timeParam.default(0).describe('Local time glitching starts'),
  end: z.number().optional().describe('Local time it stops (default: never)'),
  intensity: z.number().min(0).max(1).default(0.9).describe('Strength of the bursts'),
  rate: z.number().positive().default(6).describe('Burst slots per second'),
  density: z.number().min(0).max(1).default(0.5).describe('Share of slots that glitch'),
  seed: z.number().int().default(0).describe('Variant of the pattern'),
});

export const screenGlitch = defineFx({
  name: 'screenGlitch',
  description:
    'Glitching screen panel (pixel grid of unlit voxels): text or blank screen torn by bursts of row shifts, corrupt blocks, static and colour swaps. Mount it on a prop screen or use alone. fx.update(t) / fx.update(t, level); fx.pixels(t, level?) returns the frame as { columns, rows, data } palette indices (same as kit glitchPixels).',
  params: screenGlitchParams,
  anchors: { screen: 'centre of the pixel plane (= origin)' },
  build(params, tools) {
    const { three } = tools;
    const seed = seedOf(tools.rng.fork(`seed:${String(params.seed)}`));
    const base = textPixels(params.text, params.columns, params.rows);
    const cellX = params.size[0] / params.columns;
    const cellY = params.size[1] / params.rows;
    const geometry = tools.track(new three.BoxGeometry(cellX, cellY, Math.min(cellX, cellY) * 0.4));
    const count = params.columns * params.rows;
    const mesh = new three.InstancedMesh(geometry, tools.materials().instancedGlow, count);
    mesh.frustumCulled = false;
    mesh.name = 'pixels';
    const matrix = new three.Matrix4();
    for (let index = 0; index < count; index += 1) {
      const x = (index % params.columns) + 0.5 - params.columns / 2;
      const y = params.rows / 2 - Math.floor(index / params.columns) - 0.5;
      mesh.setMatrixAt(index, matrix.makeTranslation(x * cellX, y * cellY, 0));
    }
    const palette = params.colors.map((name) => colorOf(tools, name));
    const object = createKitObject(three, {
      kitType: 'screenGlitch',
      anchors: { screen: [0, 0, 0] },
    });
    object.add(mesh);
    const shown = new Int16Array(count).fill(-1);
    const pixels = (t: number, level?: number): ScreenPixels =>
      glitchPixels(base, t, level ?? glitchLevel(t, params, seed), seed, palette.length);
    const fx = asLevelFx(object, (t, level) => {
      const frame = pixels(t, level);
      let changed = false;
      for (const [index, value] of frame.data.entries()) {
        if (shown[index] === value) continue;
        shown[index] = value;
        const color = palette[Math.min(value, palette.length - 1)];
        if (color) mesh.setColorAt(index, color);
        changed = true;
      }
      if (changed && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });
    return Object.assign(fx, { pixels });
  },
});
