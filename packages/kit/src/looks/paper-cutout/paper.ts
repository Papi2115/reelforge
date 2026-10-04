/**
 * What makes a flat shape read as paper: deterministic torn / scalloped silhouettes, a light rim
 * where the paper was torn or cut (the fibres catch the light), and a sparse paper grain of the
 * neighbouring tones. All seeded by integer hashes of sprite coordinates, so a piece looks the
 * same at every t and on every machine.
 */
import { hashCell } from '../../env/shared.js';
import { CLEAR, type PaperColors } from './colors.js';
import type { Point, Sprite } from './sprite.js';

/** Smooth value noise in [-1, 1] along one axis, cells `period` px wide. */
export function noise1(x: number, period: number, seed: number): number {
  const cell = Math.floor(x / period);
  const fraction = x / period - cell;
  const a = hashCell(cell, 0, 7, seed) * 2 - 1;
  const b = hashCell(cell + 1, 0, 7, seed) * 2 - 1;
  const k = fraction * fraction * (3 - 2 * fraction);
  return a + (b - a) * k;
}

/** Torn edge offset at x: a slow wave plus fine fibres, about +-`amplitude` px. */
export function tornOffset(x: number, amplitude: number, seed: number): number {
  return amplitude * (0.65 * noise1(x, 9, seed) + 0.35 * noise1(x, 3, seed + 11));
}

/**
 * The polygon with every edge cut into ~`step`-px segments, each inner point pushed sideways by
 * a torn offset (closed polygons; corners stay put).
 */
export function tearPolygon(
  points: readonly Point[],
  amplitude: number,
  seed: number,
  step = 4,
): Point[] {
  const result: Point[] = [];
  let travelled = 0;
  points.forEach((a, index) => {
    const b = points[(index + 1) % points.length] ?? a;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const length = Math.hypot(dx, dy);
    const segments = Math.max(1, Math.round(length / step));
    const nx = length === 0 ? 0 : -dy / length;
    const ny = length === 0 ? 0 : dx / length;
    result.push(a);
    for (let segment = 1; segment < segments; segment += 1) {
      const k = segment / segments;
      const offset = tornOffset(travelled + k * length, amplitude, seed);
      result.push([a[0] + dx * k + nx * offset, a[1] + dy * k + ny * offset]);
    }
    travelled += length;
  });
  return result;
}

/** Grain fibre density that reads as paper without turning into noise. */
export const PAPER_GRAIN = 0.004;

export type RimStyle = 'torn' | 'cut' | 'none';

export interface FinishOptions {
  /** `torn`: an irregular light rim on top and left edges; `cut`: a crisp 1-px top highlight. */
  readonly rim: RimStyle;
  /** Share of interior pixels that start a grain fibre (0..0.02; 0.004 reads as paper). */
  readonly grain: number;
  readonly seed: number;
}

function isEdge(sprite: Sprite, x: number, y: number, dx: number, dy: number): boolean {
  const nx = x + dx;
  const ny = y + dy;
  if (nx < 0 || ny < 0 || nx >= sprite.width || ny >= sprite.height) return true;
  return sprite.data[ny * sprite.width + nx] === CLEAR;
}

/**
 * Paper rim and grain, in place. Rims only touch silhouette pixels (next to clear ones); grain
 * fibres (1-3 px, horizontal) only touch pixels inside a flat area of one colour.
 */
export function finishPaper(sprite: Sprite, colors: PaperColors, options: FinishOptions): void {
  const { width, height, data } = sprite;
  const source = Uint8Array.from(data);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = y * width + x;
      const color = source[offset] ?? CLEAR;
      if (color === CLEAR) continue;
      const top = isEdge(sprite, x, y, 0, -1);
      const left = isEdge(sprite, x, y, -1, 0);
      if (options.rim === 'torn' && (top || left)) {
        data[offset] = colors.rim[color] ?? color;
        const below = offset + width;
        // Fibres: the rim is 2 px thick in places.
        if (top && y + 1 < height && hashCell(x, y, 3, options.seed) < 0.3) {
          if ((source[below] ?? CLEAR) === color) data[below] = colors.rim[color] ?? color;
        }
        continue;
      }
      if (options.rim === 'cut' && top) {
        data[offset] = colors.rim[color] ?? color;
        continue;
      }
      if (options.grain <= 0 || hashCell(x, y, 5, options.seed) >= options.grain) continue;
      const length = 2 + Math.floor(hashCell(x, y, 9, options.seed) * 2);
      const tone = colors.shade;
      for (let step = 0; step < length && x + step < width; step += 1) {
        const at = offset + step;
        if (source[at] !== color || source[at - width] !== color || source[at + width] !== color) {
          break;
        }
        data[at] = tone[color] ?? color;
      }
    }
  }
}
