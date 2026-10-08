/**
 * Seamless (64-periodic) noise and fills for the texture generators: the raycaster repeats every
 * texture per cell, so the lattice wraps at the tile edge and a forest floor never shows a seam.
 */
import { hash3 } from '../core/rand.js';
import { TEX } from '../ray/texture.js';
import type { Bmp } from '../core/bitmap.js';
import { rampAt, type Ramp } from './ramps.js';

/** Value noise in [0, 1) that tiles every 64 px (`cell` divides 64). */
export function tnoise(x: number, y: number, cell: number, seed: number): number {
  const n = Math.max(1, Math.round(TEX / cell));
  const gx = x / cell;
  const gy = y / cell;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const fx = gx - x0;
  const fy = gy - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const at = (i: number, j: number): number => hash3(((i % n) + n) % n, ((j % n) + n) % n, seed);
  const a = at(x0, y0);
  const b = at(x0 + 1, y0);
  const c = at(x0, y0 + 1);
  const d = at(x0 + 1, y0 + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** Two octaves of seamless noise (0..1). */
export function fbm(x: number, y: number, cell: number, seed: number): number {
  return tnoise(x, y, cell, seed) * 0.65 + tnoise(x, y, Math.max(2, cell / 4), seed + 17) * 0.35;
}

/** Fills the whole tile with a ramp range by seamless noise, dithered between steps. */
export function noiseFill(
  b: Bmp,
  ramp: Ramp,
  cell: number,
  seed: number,
  lo = 0,
  hi?: number,
): void {
  for (let y = 0; y < TEX; y += 1)
    for (let x = 0; x < TEX; x += 1) b.px(x, y, rampAt(ramp, fbm(x, y, cell, seed), x, y, lo, hi));
}

/** Wrapped pixel write (strokes that cross the tile edge continue on the other side). */
export function wpx(b: Bmp, x: number, y: number, c: number): void {
  const xi = ((Math.floor(x) % TEX) + TEX) % TEX;
  const yi = ((Math.floor(y) % TEX) + TEX) % TEX;
  b.d[yi * TEX + xi] = c;
}
