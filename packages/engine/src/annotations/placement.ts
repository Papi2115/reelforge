/**
 * Automatic placement of annotation labels: candidate spots around a target are scored by how far
 * they leave the safe area and how much they cover other cards or the target itself; the first
 * best candidate wins (deterministic preference order), then it is clamped into the safe area.
 */
import type { PixelRect } from '../text/types.js';
import type { Point } from './raster.js';

export interface Direction {
  readonly dx: number;
  readonly dy: number;
}

export const SIDE_DIRECTIONS: Readonly<Record<string, Direction>> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
  'up-left': { dx: -Math.SQRT1_2, dy: -Math.SQRT1_2 },
  'up-right': { dx: Math.SQRT1_2, dy: -Math.SQRT1_2 },
  'down-left': { dx: -Math.SQRT1_2, dy: Math.SQRT1_2 },
  'down-right': { dx: Math.SQRT1_2, dy: Math.SQRT1_2 },
};

/** Auto order: diagonals above first (labels read best above things), then the rest. */
export const AUTO_SIDES = [
  'up-right',
  'up-left',
  'right',
  'left',
  'up',
  'down-right',
  'down-left',
  'down',
] as const;

function overlapArea(first: PixelRect, second: PixelRect): number {
  const w = Math.min(first.x + first.w, second.x + second.w) - Math.max(first.x, second.x);
  const h = Math.min(first.y + first.h, second.y + second.h) - Math.max(first.y, second.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/** Pixels of `rect` outside `area` (sum over the four sides, weighted by the other extent). */
export function outsideArea(rect: PixelRect, area: PixelRect): number {
  const left = Math.max(0, area.x - rect.x);
  const right = Math.max(0, rect.x + rect.w - (area.x + area.w));
  const top = Math.max(0, area.y - rect.y);
  const bottom = Math.max(0, rect.y + rect.h - (area.y + area.h));
  return (left + right) * rect.h + (top + bottom) * rect.w;
}

export interface SpotScore {
  readonly index: number;
  readonly score: number;
}

/** Index of the best candidate: least outside the safe area, then least covering `avoid`. */
export function bestSpot(
  candidates: readonly PixelRect[],
  area: PixelRect,
  avoid: readonly PixelRect[],
): number {
  let best: SpotScore = { index: 0, score: Infinity };
  candidates.forEach((candidate, index) => {
    const covered = avoid.reduce((sum, rect) => sum + overlapArea(candidate, rect), 0);
    const score = outsideArea(candidate, area) * 4 + covered;
    if (score < best.score) best = { index, score };
  });
  return best.index;
}

/** Moves `rect` the least distance so it lies inside `area` (top-left wins when too big). */
export function clampInto(rect: PixelRect, area: PixelRect): PixelRect {
  const x = Math.max(area.x, Math.min(rect.x, area.x + area.w - rect.w));
  const y = Math.max(area.y, Math.min(rect.y, area.y + area.h - rect.h));
  return { ...rect, x, y };
}

/** A w x h rect centred on a point. */
export function centredRect(center: Point, w: number, h: number): PixelRect {
  return { x: Math.round(center.x - w / 2), y: Math.round(center.y - h / 2), w, h };
}

/**
 * Where a w x h label goes when its near edge sits `distance` px from `point` in direction `dir`
 * (horizontal directions attach the label by its side, vertical ones by its top/bottom).
 */
export function labelAt(
  point: Point,
  dir: Direction,
  distance: number,
  w: number,
  h: number,
): PixelRect {
  const end = { x: point.x + dir.dx * distance, y: point.y + dir.dy * distance };
  const x = dir.dx > 0.3 ? end.x : dir.dx < -0.3 ? end.x - w : end.x - w / 2;
  const y = dir.dy > 0.3 ? end.y : dir.dy < -0.3 ? end.y - h : end.y - h / 2;
  return { x: Math.round(x), y: Math.round(y), w, h };
}

/** The point on the border of `rect` closest to `point` (for tails and leader lines). */
export function nearestEdgePoint(rect: PixelRect, point: Point): Point {
  const x = Math.max(rect.x, Math.min(point.x, rect.x + rect.w - 1));
  const y = Math.max(rect.y, Math.min(point.y, rect.y + rect.h - 1));
  const inside = x === point.x && y === point.y;
  if (!inside) return { x, y };
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h - 1 };
}

/** Unit direction from `from` towards `to` snapped to 45°, `fallback` when they coincide. */
export function snappedDirection(from: Point, to: Point, fallback: Direction): Direction {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.hypot(dx, dy) < 1) return fallback;
  const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
  return { dx: Math.cos(angle), dy: Math.sin(angle) };
}
