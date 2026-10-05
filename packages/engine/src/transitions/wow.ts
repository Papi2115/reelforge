/**
 * Helpers of the wow transitions (ADR-028: enter-*, texture, dive-*): phases and easing of the
 * progress, nearest-neighbour zoom sampling, the ordered-dither shade (a palette colour every
 * other pixel, never a blended colour) and the focus point in pixels. Plain arithmetic only.
 */
import { bayerThreshold, clamp01, smooth, type Composition } from './pixels.js';

/** Progress of a phase from `from` to `to` (0 before, 1 after). */
export function phase(p: number, from: number, to: number): number {
  return clamp01((p - from) / (to - from));
}

export function easeIn(q: number): number {
  return q * q;
}

export function easeOut(q: number): number {
  return 1 - (1 - q) * (1 - q);
}

/** Ease-out with a small overshoot (pop-in), 0 -> 1. */
export function popOut(q: number): number {
  const t = q - 1;
  return 1 + 2.4 * t * t * t + 1.4 * t * t;
}

export function lerp(from: number, to: number, q: number): number {
  return from + (to - from) * q;
}

/** Interpolates scales in log space: a zoom at a steady speed. */
export function scaleLerp(from: number, to: number, q: number): number {
  return from * (to / from) ** q;
}

/**
 * Copies A at p <= 0 and B at p >= 1 (exact end frames) and returns true; false otherwise. Every
 * wow compositor starts with it.
 */
export function endFrames({ a, b, out, p }: Composition): boolean {
  if (p <= 0) out.set(a);
  else if (p >= 1) out.set(b);
  else return false;
  return true;
}

/** The focus point in pixels (clamped to the frame). */
export function focusPixels({ focus, width, height }: Composition): readonly [number, number] {
  return [clamp01(focus.x) * width, clamp01(focus.y) * height];
}

/**
 * Nearest-neighbour sample of `source` zoomed by `zoom` so that the source point (`fx`, `fy`)
 * lands on the screen point (`cx`, `cy`). Out-of-frame samples clamp to the edge.
 */
export function zoomSample(
  source: Uint32Array,
  width: number,
  height: number,
  x: number,
  y: number,
  view: ZoomView,
): number {
  const sx = Math.floor(view.fx + (x + 0.5 - view.cx) / view.zoom);
  const sy = Math.floor(view.fy + (y + 0.5 - view.cy) / view.zoom);
  const cx = sx < 0 ? 0 : sx >= width ? width - 1 : sx;
  const cy = sy < 0 ? 0 : sy >= height ? height - 1 : sy;
  return source[cy * width + cx] ?? 0;
}

/** A zoom of a frame: source point (fx, fy) on screen at (cx, cy), magnified `zoom` times. */
export interface ZoomView {
  readonly fx: number;
  readonly fy: number;
  readonly cx: number;
  readonly cy: number;
  readonly zoom: number;
}

/** Ordered-dither shade: `colour` on the pixels whose 2x2-cell Bayer threshold is below `amount`. */
export function shade(pixel: number, colour: number, amount: number, x: number, y: number): number {
  return amount > 0 && bayerThreshold(x >> 1, y >> 1) < amount ? colour : pixel;
}

/** Ordered-dither choice between two pixels per 2x2 cell: `second` where `amount` passes. */
export function dither(
  first: number,
  second: number,
  amount: number,
  x: number,
  y: number,
): number {
  return amount > 0 && bayerThreshold(x >> 1, y >> 1) < amount ? second : first;
}

/** Ease used by the wow zooms (cubic smoothstep). */
export const smoothstep = smooth;

/**
 * "Diamond" angle of a direction in [0, 4): monotonic in the true angle, without trigonometry
 * (0 = +x, 1 = +y, 2 = -x, 3 = -y).
 */
export function diamondAngle(dx: number, dy: number): number {
  if (dx === 0 && dy === 0) return 0;
  if (dy >= 0) return dx >= 0 ? dy / (dx + dy) : 1 - dx / (-dx + dy);
  return dx < 0 ? 2 - dy / (-dx - dy) : 3 + dx / (dx - dy);
}

/** Mosaic: the centre of the `block`-pixel cell of a coordinate (block <= 1: the coordinate). */
export function mosaic(value: number, block: number): number {
  return block <= 1 ? value : value - (value % block) + (block >> 1);
}
