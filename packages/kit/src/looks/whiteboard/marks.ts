/**
 * The stroke model of the whiteboard look. A drawing is a list of marks; a mark is one thing the
 * hand draws in one colour (a line, an arrow, a doodle, a written word): pen paths of integer
 * raster pixels in pen order. Drawing progress is a pure function of t: the pen walks the paths
 * along their arc length (each path eases in and out like a hand stroke, lifts between paths take
 * time by distance), so a half-drawn mark is a prefix of its pixels with the pen at its head.
 */
import type { Pixel, Raster } from '../blueprint/raster.js';
import type { Box, Point } from './geometry.js';

/** How a mark's points are inked. */
export type Nib =
  /** Marker: a round-ish pen of `size` px centred on each path pixel. */
  | { readonly kind: 'pen'; readonly size: number }
  /** Pixel-font cells: a `size` x `size` block whose top-left corner is the point. */
  | { readonly kind: 'cell'; readonly size: number };

export interface MarkShape {
  /** Pen paths (raster pixels), drawn in order. */
  readonly paths: readonly (readonly Point[])[];
  readonly color: Pixel;
  readonly nib: Nib;
}

interface Segment {
  /** Path index, or -1 for a pen lift to the next path. */
  readonly path: number;
  readonly from: number;
  readonly cost: number;
}

export interface Mark extends MarkShape {
  readonly start: number;
  readonly duration: number;
  readonly segments: readonly Segment[];
  readonly cost: number;
  /** Raster bounds of the ink. */
  readonly bounds: Box;
}

/** Share of the straight-line distance a pen lift costs (lifting is faster than drawing). */
const LIFT_COST = 0.35;

/** Drawing cost (px of pen travel) of a shape: path lengths plus pen lifts. */
export function shapeCost(shape: MarkShape): number {
  return buildSegments(shape).cost;
}

function step(nib: Nib): number {
  // Big letters are written faster per pixel than small ones (a hand writes letters, not cells).
  return nib.kind === 'cell' ? Math.min(nib.size, 3) : 1;
}

function buildSegments(shape: MarkShape): { segments: Segment[]; cost: number } {
  const segments: Segment[] = [];
  let cost = 0;
  shape.paths.forEach((path, index) => {
    const previous = shape.paths[index - 1]?.at(-1);
    const first = path[0];
    if (previous && first) {
      const lift = Math.hypot(first[0] - previous[0], first[1] - previous[1]) * LIFT_COST;
      segments.push({ path: -1, from: cost, cost: lift });
      cost += lift;
    }
    const length = Math.max(1, path.length) * step(shape.nib);
    segments.push({ path: index, from: cost, cost: length });
    cost += length;
  });
  return { segments, cost };
}

function inkBounds(shape: MarkShape): Box {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const size = shape.nib.size;
  const before = shape.nib.kind === 'cell' ? 0 : Math.floor(size / 2);
  for (const path of shape.paths) {
    for (const [x, y] of path) {
      x0 = Math.min(x0, x - before);
      y0 = Math.min(y0, y - before);
      x1 = Math.max(x1, x - before + size);
      y1 = Math.max(y1, y - before + size);
    }
  }
  if (!Number.isFinite(x0)) return { x: 0, y: 0, width: 0, height: 0 };
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

export function createMark(shape: MarkShape, start: number, duration: number): Mark {
  const { segments, cost } = buildSegments(shape);
  return {
    ...shape,
    start,
    duration: Math.max(0.01, duration),
    segments,
    cost,
    bounds: inkBounds(shape),
  };
}

/** A hand stroke: slow start, fast middle, slow end, never stalling completely. */
export function strokeEase(k: number): number {
  const clamped = k <= 0 ? 0 : k >= 1 ? 1 : k;
  return 0.3 * clamped + 0.7 * ((1 - Math.cos(clamped * Math.PI)) / 2);
}

/** Linear progress 0..1 of a mark at time t. */
export function markProgress(mark: Mark, t: number): number {
  if (t <= mark.start) return 0;
  if (t >= mark.start + mark.duration) return 1;
  return (t - mark.start) / mark.duration;
}

interface PenState {
  /** Pixels shown per path (the last partial). */
  readonly shown: readonly number[];
  /** Pen position (raster px). */
  readonly head: Point | undefined;
}

/** How much of every path is inked at linear progress k, and where the pen is. */
export function penState(mark: Mark, k: number): PenState {
  const shown = mark.paths.map(() => 0);
  if (k <= 0) return { shown, head: mark.paths[0]?.[0] };
  const travelled = Math.min(1, k) * mark.cost;
  let head: Point | undefined;
  for (const segment of mark.segments) {
    if (travelled <= segment.from) break;
    const local = Math.min(1, (travelled - segment.from) / segment.cost);
    if (segment.path < 0) {
      const index = mark.segments.indexOf(segment);
      const from = mark.paths[mark.segments[index - 1]?.path ?? 0]?.at(-1);
      const to = mark.paths[mark.segments[index + 1]?.path ?? 0]?.[0];
      if (from && to)
        head = [from[0] + (to[0] - from[0]) * local, from[1] + (to[1] - from[1]) * local];
      continue;
    }
    const path = mark.paths[segment.path] ?? [];
    const count =
      local >= 1 ? path.length : Math.max(1, Math.round(strokeEase(local) * path.length));
    shown[segment.path] = count;
    head = path[count - 1];
  }
  return { shown, head };
}

/** Inks one point of a mark. */
export function stamp(raster: Raster, point: Point, nib: Nib, color: Pixel): void {
  const [x, y] = point;
  const size = nib.size;
  if (nib.kind === 'cell') {
    raster.rect(x, y, size, size, color);
    return;
  }
  if (size <= 2) {
    raster.dot(x, y, size, color);
    return;
  }
  if (size === 3) {
    raster.rect(x - 1, y, 3, 1, color);
    raster.rect(x, y - 1, 1, 3, color);
    raster.set(x - 1, y - 1, color);
    return;
  }
  raster.disc(x, y, size / 2 - 0.25, color);
}

/** Inks the part of a mark drawn at time t; returns the pen head while it draws. */
export function drawMark(raster: Raster, mark: Mark, t: number): Point | undefined {
  const k = markProgress(mark, t);
  if (k <= 0) return undefined;
  const state = penState(mark, k);
  mark.paths.forEach((path, index) => {
    const count = state.shown[index] ?? 0;
    for (let pixel = 0; pixel < count; pixel += 1) {
      const point = path[pixel];
      if (point) stamp(raster, point, mark.nib, mark.color);
    }
  });
  return k < 1 ? state.head : undefined;
}

/** Where the pen is when a mark starts and when it ends. */
export function markEnds(mark: Mark): { readonly first: Point; readonly last: Point } {
  const first = mark.paths[0]?.[0] ?? [0, 0];
  const last = mark.paths.at(-1)?.at(-1) ?? first;
  return { first, last };
}
