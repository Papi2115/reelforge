/**
 * Breaking pictures into pieces (ADR-028: `shatter`, `cube-smash`): a piece map (piece id per
 * pixel of the outgoing frame) with per-piece bounds and centres, seam detection for cracks, and
 * the inverse-mapped drawing of a falling piece (translate, rotate by a rational angle, shrink;
 * nearest neighbour). No trigonometry: rotations use the half-angle tangent.
 */
import { bayerThreshold, type Composition } from './pixels.js';

/**
 * A one-entry cache: a transition renders many frames with the same geometry (frame size, seed,
 * focus), so its piece map is built once. Pure: the value depends only on the key.
 */
export function lastValueCache<T>(): (key: string, build: () => T) => T {
  let last: { readonly key: string; readonly value: T } | undefined;
  return (key, build) => {
    if (last?.key === key) return last.value;
    const value = build();
    last = { key, value };
    return value;
  };
}

export interface PieceMap {
  readonly ids: Int32Array;
  readonly count: number;
  readonly minX: Int32Array;
  readonly minY: Int32Array;
  readonly maxX: Int32Array;
  readonly maxY: Int32Array;
  /** Centre of mass of each piece (px). */
  readonly centreX: Float64Array;
  readonly centreY: Float64Array;
}

/** Bounds and centres of the pieces of `ids` (values 0..count-1). */
export function measurePieces(
  ids: Int32Array,
  width: number,
  height: number,
  count: number,
): PieceMap {
  const minX = new Int32Array(count).fill(width);
  const minY = new Int32Array(count).fill(height);
  const maxX = new Int32Array(count).fill(-1);
  const maxY = new Int32Array(count).fill(-1);
  const sumX = new Float64Array(count);
  const sumY = new Float64Array(count);
  const area = new Float64Array(count);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const id = ids[y * width + x] ?? 0;
      if (x < (minX[id] ?? 0)) minX[id] = x;
      if (x > (maxX[id] ?? 0)) maxX[id] = x;
      if (y < (minY[id] ?? 0)) minY[id] = y;
      if (y > (maxY[id] ?? 0)) maxY[id] = y;
      sumX[id] = (sumX[id] ?? 0) + x;
      sumY[id] = (sumY[id] ?? 0) + y;
      area[id] = (area[id] ?? 0) + 1;
    }
  }
  const centreX = new Float64Array(count);
  const centreY = new Float64Array(count);
  for (let id = 0; id < count; id += 1) {
    const size = Math.max(1, area[id] ?? 0);
    centreX[id] = (sumX[id] ?? 0) / size;
    centreY[id] = (sumY[id] ?? 0) / size;
  }
  return { ids, count, minX, minY, maxX, maxY, centreX, centreY };
}

/** 1 = the piece ends right or below this pixel, 2 = it starts here (left / top neighbour). */
export function seamAt(
  ids: Int32Array,
  width: number,
  height: number,
  x: number,
  y: number,
): number {
  const index = y * width + x;
  const id = ids[index];
  if ((x + 1 < width && ids[index + 1] !== id) || (y + 1 < height && ids[index + width] !== id)) {
    return 1;
  }
  if ((x > 0 && ids[index - 1] !== id) || (y > 0 && ids[index - width] !== id)) return 2;
  return 0;
}

/** Where a falling piece is: offset of its centre, rotation (tan of half the angle), scale. */
export interface PieceMotion {
  readonly dx: number;
  readonly dy: number;
  readonly turn: number;
  readonly scale: number;
  /** Ordered-dither darkening toward the depth (0..1). */
  readonly dim: number;
  /** Side faces toward the lower right (px, voxel thickness); 0 = flat glass. */
  readonly thickness: number;
}

export interface PieceColours {
  /** Colour of the piece's own edge pixels. */
  readonly edge: number;
  readonly side: number;
}

/** Draws piece `id` of A moved by `motion` over `out` (inverse mapping, nearest neighbour). */
export function drawPiece(
  c: Composition,
  map: PieceMap,
  id: number,
  motion: PieceMotion,
  colours: PieceColours,
): void {
  const { width, height, a, out, tones } = c;
  const pivotX = map.centreX[id] ?? 0;
  const pivotY = map.centreY[id] ?? 0;
  const t = motion.turn;
  const cos = (1 - t * t) / (1 + t * t);
  const sin = (2 * t) / (1 + t * t);
  const scale = Math.max(0.05, motion.scale);
  const centreX = pivotX + motion.dx;
  const centreY = pivotY + motion.dy;
  // Bounds of the moved piece: the rotated, scaled box around the pivot, plus the side faces.
  const halfW = Math.max(pivotX - (map.minX[id] ?? 0), (map.maxX[id] ?? 0) - pivotX) + 1;
  const halfH = Math.max(pivotY - (map.minY[id] ?? 0), (map.maxY[id] ?? 0) - pivotY) + 1;
  const reach = Math.sqrt(halfW * halfW + halfH * halfH) * scale + motion.thickness + 1;
  const x0 = Math.max(0, Math.floor(centreX - reach));
  const x1 = Math.min(width - 1, Math.ceil(centreX + reach));
  const y0 = Math.max(0, Math.floor(centreY - reach));
  const y1 = Math.min(height - 1, Math.ceil(centreY + reach));
  const sourceOf = (x: number, y: number): number => {
    const rx = (x + 0.5 - centreX) / scale;
    const ry = (y + 0.5 - centreY) / scale;
    const sx = Math.floor(pivotX + 0.5 + cos * rx + sin * ry);
    const sy = Math.floor(pivotY + 0.5 - sin * rx + cos * ry);
    if (sx < 0 || sy < 0 || sx >= width || sy >= height) return -1;
    const index = sy * width + sx;
    return map.ids[index] === id ? index : -1;
  };
  const steps = Math.round(motion.thickness);
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const index = sourceOf(x, y);
      const target = y * width + x;
      if (index >= 0) {
        const sx = index % width;
        const sy = (index - sx) / width;
        const edge = seamAt(map.ids, width, height, sx, sy) !== 0;
        const pixel = edge ? colours.edge : (a[index] ?? 0);
        out[target] =
          motion.dim > 0 && bayerThreshold(x >> 1, y >> 1) < motion.dim ? tones.darkest : pixel;
        continue;
      }
      for (let step = 1; step <= steps; step += 1) {
        if (sourceOf(x - step, y - step) >= 0) {
          out[target] = step === steps ? tones.darkest : colours.side;
          break;
        }
      }
    }
  }
}
