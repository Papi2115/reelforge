/**
 * Ordered-dither bokeh (PLAN.md#12.28, ADR-013): the CPU reference of the depth-of-field step of
 * the post pass (gl/bokeh-shader.ts). A pixel's circle of confusion (CoC) is an integer radius in
 * low-res pixels from its view depth, the focus distance and the aperture. An out-of-focus pixel
 * takes the colour of ONE neighbour inside its CoC, picked by its rank in the 4x4 Bayer matrix:
 * a 4x4 block samples 16 points spread over the disk, so edges dissolve into an ordered dither
 * of the neighbouring colours (pixel-art blur) and flat areas stay flat. No colour is averaged,
 * so the frame stays on the palette; a pixel with CoC 0 is untouched.
 */
import { BAYER_4X4 } from '../palette.js';

/** Largest CoC radius in low-res pixels (near foreground objects reach it). */
export const MAX_BOKEH_RADIUS = 6;
/** Default aperture: CoC radius at twice (or half) the focus distance, in low-res pixels. */
export const DEFAULT_BOKEH = 3;
/** Taps per CoC radius: one per cell of the 4x4 Bayer matrix. */
export const BOKEH_TAPS_PER_RADIUS = BAYER_4X4.length;
/**
 * A tap that is clearly nearer than the pixel (depth below this share of the pixel's depth) and
 * sharp enough not to reach it is rejected: in-focus silhouettes stay crisp over a blurred
 * background instead of bleeding into it.
 */
export const BOKEH_DEPTH_TOLERANCE = 0.97;

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** Focus of a shot for one frame: distance along the view axis and aperture (0 = off). */
export interface FocusState {
  readonly distance: number;
  readonly aperture: number;
}

/**
 * Integer CoC radius (0..MAX_BOKEH_RADIUS) of a pixel at view depth `depth`: the aperture times
 * the depth difference relative to the nearer of depth and focus, so things at twice or at half
 * the focus distance get `aperture` pixels (a stronger falloff than a thin lens, which reads
 * better in compact voxel sets).
 */
export function bokehRadius(depth: number, focus: FocusState): number {
  if (!(focus.aperture > 0) || !(depth > 0)) return 0;
  const coc = (focus.aperture * Math.abs(depth - focus.distance)) / Math.min(depth, focus.distance);
  return Math.floor(Math.min(MAX_BOKEH_RADIUS, coc));
}

/**
 * Tap offsets for radius 1..MAX_BOKEH_RADIUS, `BOKEH_TAPS_PER_RADIUS` per radius, indexed by
 * Bayer rank: rank i sits at sqrt((i + 0.5) / 16) of the radius on a golden-angle spiral (an even
 * cover of the disk), rounded to whole pixels.
 */
export function bokehTapTable(): readonly (readonly [number, number])[] {
  const taps: (readonly [number, number])[] = [];
  for (let radius = 1; radius <= MAX_BOKEH_RADIUS; radius += 1) {
    for (let rank = 0; rank < BOKEH_TAPS_PER_RADIUS; rank += 1) {
      const distance = radius * Math.sqrt((rank + 0.5) / BOKEH_TAPS_PER_RADIUS);
      const angle = rank * GOLDEN_ANGLE;
      taps.push([Math.round(distance * Math.cos(angle)), Math.round(distance * Math.sin(angle))]);
    }
  }
  return taps;
}

const TAPS = bokehTapTable();

/** Tap offset of pixel (x, y) at CoC `radius` (>= 1); [0, 0] when sharp. */
export function bokehTap(x: number, y: number, radius: number): readonly [number, number] {
  if (radius < 1) return [0, 0];
  const rank = BAYER_4X4[(y % 4) * 4 + (x % 4)] ?? 0;
  return TAPS[(radius - 1) * BOKEH_TAPS_PER_RADIUS + rank] ?? [0, 0];
}
