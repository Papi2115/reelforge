/**
 * Where the writing hand may be (the "hand rests here" rule, docs/worlds/DECISIONS.md): the
 * silhouette test of palm and pen against the subject boxes, the rest spots in the page margins
 * (the hand hangs off the bottom or right edge there) and the sideways bend that routes a glide
 * around a subject the hand is not drawing. Pure geometry in screen px.
 */
import { lerp } from './math.js';
import type { Point } from './paths.js';

/** A screen rectangle [x, y, w, h]. */
export type Box = readonly [number, number, number, number];

/** How fast the hand travels between marks (page px per second): the speed limit of lifts. */
export const HAND_SPEED = 1600;

/** Sample points of the hand silhouette (pen body + palm) in pen space (u along the pen). */
const SILHOUETTE: readonly Point[] = (() => {
  const points: Point[] = [];
  for (let u = 20; u <= 250; u += 23) points.push([u, 0]);
  for (let u = 100; u <= 220; u += 20) for (let v = -6; v <= 62; v += 17) points.push([u, v]);
  return points;
})();

/** Margin rest spots (page px): along the bottom edge, then down the right edge. */
const MARGIN_SPOTS: readonly Point[] = [
  ...[120, 215, 310, 405, 500, 595, 690, 785, 880].map((x): Point => [x, 522]),
  ...[70, 150, 230, 310, 390, 470].map((y): Point => [932, y]),
];

/** The pen's resting angle at screen x (degrees from the tip, drifting across the frame). */
export function naturalAngle(x: number, width: number): number {
  return 50 + (x / width) * 14;
}

/** How many silhouette points of the hand (tip at `tip`, pen at `angle`) fall in the boxes. */
export function cover(tip: Point, angle: number, boxes: readonly Box[], scale: number): number {
  if (boxes.length === 0) return 0;
  const a = (angle * Math.PI) / 180;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  let count = 0;
  for (const [u, v] of SILHOUETTE) {
    const x = tip[0] + (u * ca - v * sa) * scale;
    const y = tip[1] + (u * sa + v * ca) * scale;
    for (const [bx, by, bw, bh] of boxes) {
      if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) count += 1;
    }
  }
  return count;
}

export function inside(p: Point, [x, y, w, h]: Box): boolean {
  return p[0] >= x && p[0] <= x + w && p[1] >= y && p[1] <= y + h;
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

export interface Room {
  /** Subject boxes (screen px). */
  readonly boxes: readonly Box[];
  /** Screen px per page px. */
  readonly scale: number;
  /** Frame width (screen px). */
  readonly width: number;
}

/**
 * Where a hand at `from` rests: `preferred` (the scene's rest spot, screen px) when the hand
 * there keeps off every box, else the nearest clear margin spot; null = none is clear.
 */
export function restSpot(from: Point, preferred: Point | null, room: Room): Point | null {
  const clear = (p: Point): boolean =>
    cover(p, naturalAngle(p[0], room.width), room.boxes, room.scale) === 0;
  if (preferred && clear(preferred)) return preferred;
  const spots = MARGIN_SPOTS.map((p): Point => [p[0] * room.scale, p[1] * room.scale])
    .map((p) => ({ p, d: distance(from, p) }))
    .sort((a, b) => a.d - b.d);
  return spots.find((spot) => clear(spot.p))?.p ?? null;
}

/** The point at k of the glide from a to b, bent sideways by `bend` px at its middle. */
export function bentPoint(a: Point, b: Point, bend: number, k: number): Point {
  const x = lerp(a[0], b[0], k);
  const y = lerp(a[1], b[1], k);
  if (bend === 0) return [x, y];
  const length = distance(a, b) || 1;
  const offset = 4 * k * (1 - k) * bend;
  return [x - ((b[1] - a[1]) / length) * offset, y + ((b[0] - a[0]) / length) * offset];
}

const BEND_SAMPLES = [0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85] as const;
const BENDS = [0.35, -0.35, 0.6, -0.6] as const;

/**
 * The bend (px) of a glide from a to b over `gap` s that keeps the hand off the subject boxes it
 * is not drawing (boxes holding a or b are its targets): 0 when the straight line is clear, too
 * short to matter, or no bend both clears more and fits the speed limit.
 */
export function glideBend(
  a: Point,
  b: Point,
  angle: (p: Point, k: number) => number,
  gap: number,
  room: Room,
): number {
  const boxes = room.boxes.filter((box) => !inside(a, box) && !inside(b, box));
  const length = distance(a, b);
  if (boxes.length === 0 || length < 40 * room.scale) return 0;
  const covered = (bend: number): number =>
    BEND_SAMPLES.reduce((sum, k) => {
      const p = bentPoint(a, b, bend, k);
      return sum + cover(p, angle(p, k), boxes, room.scale);
    }, 0);
  const straight = covered(0);
  if (straight === 0) return 0;
  let best = 0;
  let bestCover = straight;
  for (const k of BENDS) {
    const bend = k * length;
    // A bent glide is about this much longer; it must still fit the gap at hand speed.
    const travelled = length + ((8 / 3) * (bend * bend)) / length;
    if (travelled > gap * HAND_SPEED * room.scale) continue;
    const score = covered(bend);
    if (score < bestCover) {
      best = bend;
      bestCover = score;
    }
    if (score === 0) break;
  }
  return best;
}
