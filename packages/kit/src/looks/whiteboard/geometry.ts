/**
 * Stroke geometry of the whiteboard look: shapes are polylines in 640x360-frame pixels (curves
 * flattened deterministically), turned into integer pixel paths (Bresenham, blueprint raster)
 * after an optional hand wobble: smooth seeded noise along the arc length, rounded to whole
 * pixels, so a line drawn by hand stays on the pixel grid and is identical for every seek.
 */
import { hashCell } from '../../env/shared.js';
import { pathPixels, type Point } from '../blueprint/raster.js';

export type { Point };

/** A pen path: a polyline the marker follows in one go. */
export type Polyline = readonly Point[];

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const TAU = Math.PI * 2;

/** Quadratic (3 points) or cubic (4 points) Bezier, flattened to ~`step`-px segments. */
export function bezier(controls: readonly Point[], step = 4): Point[] {
  const [a, b, c, d] = controls;
  if (!a || !b || !c) return [...controls];
  const length = polylineLength(controls);
  const segments = Math.max(4, Math.ceil(length / step));
  return Array.from({ length: segments + 1 }, (_, index) => {
    const k = index / segments;
    const j = 1 - k;
    if (!d) {
      return [
        j * j * a[0] + 2 * j * k * b[0] + k * k * c[0],
        j * j * a[1] + 2 * j * k * b[1] + k * k * c[1],
      ] as const;
    }
    return [
      j * j * j * a[0] + 3 * j * j * k * b[0] + 3 * j * k * k * c[0] + k * k * k * d[0],
      j * j * j * a[1] + 3 * j * j * k * b[1] + 3 * j * k * k * c[1] + k * k * k * d[1],
    ] as const;
  });
}

/** Ellipse arc (radians, clockwise on screen from +x), flattened to ~`step`-px segments. */
export function ellipse(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  from = 0,
  to = TAU,
  step = 4,
): Point[] {
  const segments = Math.max(8, Math.ceil((Math.abs(to - from) * Math.max(rx, ry)) / step));
  return Array.from({ length: segments + 1 }, (_, index) => {
    const angle = from + ((to - from) * index) / segments;
    return [cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry] as const;
  });
}

export function polylineLength(points: readonly Point[]): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const [ax, ay] = points[index - 1] ?? [0, 0];
    const [bx, by] = points[index] ?? [0, 0];
    total += Math.hypot(bx - ax, by - ay);
  }
  return total;
}

/** Splits long segments so no piece is longer than `step` (wobble needs vertices). */
export function resample(points: readonly Point[], step: number): Point[] {
  const result: Point[] = [];
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    if (!point) continue;
    const previous = points[index - 1];
    if (previous) {
      const pieces = Math.ceil(Math.hypot(point[0] - previous[0], point[1] - previous[1]) / step);
      for (let piece = 1; piece < pieces; piece += 1) {
        const k = piece / pieces;
        result.push([
          previous[0] + (point[0] - previous[0]) * k,
          previous[1] + (point[1] - previous[1]) * k,
        ]);
      }
    }
    result.push(point);
  }
  return result;
}

/** Smooth seeded 1D noise in -1..1 (cosine-interpolated lattice values). */
export function noise1(seed: number, channel: number, x: number): number {
  const cell = Math.floor(x);
  const k = x - cell;
  const a = hashCell(cell, channel, 7, seed) * 2 - 1;
  const b = hashCell(cell + 1, channel, 7, seed) * 2 - 1;
  const smooth = (1 - Math.cos(k * Math.PI)) / 2;
  return a + (b - a) * smooth;
}

/** Wavelength (px) of the hand wobble along a stroke. */
const WOBBLE_WAVE = 46;

/**
 * Moves the vertices of a polyline sideways by smooth noise along its arc length (`amplitude`
 * px), both ends included, so the path keeps its shape but no longer looks ruled.
 */
export function wobble(points: readonly Point[], amplitude: number, seed: number): Point[] {
  if (amplitude <= 0 || points.length < 2) return [...points];
  const dense = resample(points, WOBBLE_WAVE / 4);
  let travelled = 0;
  return dense.map((point, index) => {
    const previous = dense[index - 1];
    if (previous) travelled += Math.hypot(point[0] - previous[0], point[1] - previous[1]);
    const u = travelled / WOBBLE_WAVE;
    return [
      point[0] + noise1(seed, 0, u) * amplitude,
      point[1] + noise1(seed, 1, u) * amplitude,
    ] as const;
  });
}

/** Integer pixels of a polyline (8-connected, no repeats at joints). */
export function strokePixels(points: readonly Point[]): Point[] {
  const pixels = pathPixels(points);
  const result: Point[] = [];
  for (const pixel of pixels) {
    const last = result.at(-1);
    if (!last || last[0] !== pixel[0] || last[1] !== pixel[1]) result.push(pixel);
  }
  return result;
}

export function boundsOf(paths: readonly (readonly Point[])[], pad = 0): Box {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const path of paths) {
    for (const [x, y] of path) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  }
  if (!Number.isFinite(x0)) return { x: 0, y: 0, width: 0, height: 0 };
  return { x: x0 - pad, y: y0 - pad, width: x1 - x0 + pad * 2, height: y1 - y0 + pad * 2 };
}

export function centerOf(box: Box): Point {
  return [box.x + box.width / 2, box.y + box.height / 2];
}

/** Maps polylines through `scale` about the origin, then `offset`. */
export function transform(paths: readonly Polyline[], scale: number, offset: Point): Point[][] {
  return paths.map((path) =>
    path.map(([x, y]) => [x * scale + offset[0], y * scale + offset[1]] as const),
  );
}

/** Two barbs of an arrow head at `tip`, pointing along `from -> tip`, as one pen path. */
export function arrowHead(from: Point, tip: Point, size: number): Point[] {
  const angle = Math.atan2(tip[1] - from[1], tip[0] - from[0]);
  const spread = 0.5;
  const barb = (side: number): Point => [
    tip[0] - Math.cos(angle + side * spread) * size,
    tip[1] - Math.sin(angle + side * spread) * size,
  ];
  return [barb(-1), tip, barb(1)];
}

/**
 * Curly bracket from `a` to `b`, its tip pointing along the normal (-dy, dx) of a -> b (down for a
 * left-to-right bracket, left for a top-to-bottom one), `depth` px deep.
 */
export function curlyBracket(a: Point, b: Point, depth: number): Point[] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const nx = -uy;
  const ny = ux;
  const at = (along: number, out: number): Point => [
    a[0] + ux * along * length + nx * out * depth,
    a[1] + uy * along * length + ny * out * depth,
  ];
  return [
    ...bezier([at(0, 0), at(0, 0.5), at(0.08, 0.5)]),
    ...bezier([at(0.42, 0.5), at(0.5, 0.5), at(0.5, 1)]),
    ...bezier([at(0.5, 1), at(0.5, 0.5), at(0.58, 0.5)]).slice(1),
    ...bezier([at(0.92, 0.5), at(1, 0.5), at(1, 0)]),
  ];
}

/** Zigzag from `a` to `b` with `teeth` peaks of `amplitude` px. */
export function zigzag(a: Point, b: Point, teeth: number, amplitude: number): Point[] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length;
  const ny = dx / length;
  const count = Math.max(1, Math.round(teeth)) * 2;
  return Array.from({ length: count + 1 }, (_, index) => {
    const k = index / count;
    const out = index === 0 || index === count ? 0 : index % 2 === 1 ? amplitude : -amplitude;
    return [a[0] + dx * k + nx * out, a[1] + dy * k + ny * out] as const;
  });
}
