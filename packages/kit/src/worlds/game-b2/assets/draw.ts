/**
 * Drawing helpers of the Game B2 generators, in the showcase's grammar: forms shaded by ramp
 * steps with the light from the upper left, Bayer dither between steps, ragged seeded edges
 * (leaves, fur, rock) and a 1 px dark outline at the end. Crude on purpose (docs/worlds/
 * DECISIONS.md "deliberate roughness"): uneven, slightly asymmetric, never polished.
 */
import { Bmp, type Pts } from '../core/bitmap.js';
import { hash3, rng, vnoise } from '../core/rand.js';
import { C, T } from '../palette.js';
import { sprite, type Sprite } from '../ray/sprites-props.js';
import { rampAt, type Ramp } from './ramps.js';

/** Light direction (upper left, towards the viewer). */
const LX = -0.55;
const LY = -0.7;

/**
 * A shaded ellipse (a ball, a crown, a body): ramp steps by the normal against the light,
 * dithered; `rough` frays the edge with seeded noise (leaves, fur), 0 = clean.
 */
export function blob(
  b: Bmp,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  ramp: Ramp,
  seed: number,
  rough = 0,
  lo = 0,
  hi?: number,
): void {
  const pad = Math.ceil(rough * Math.max(rx, ry)) + 1;
  for (let y = Math.floor(cy - ry - pad); y <= Math.ceil(cy + ry + pad); y += 1)
    for (let x = Math.floor(cx - rx - pad); x <= Math.ceil(cx + rx + pad); x += 1) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      const r2 = nx * nx + ny * ny;
      const edge = rough > 0 ? 1 + (vnoise(x, y, 3, seed) - 0.5) * rough * 2 : 1;
      if (r2 > edge * edge) continue;
      const nz = Math.sqrt(Math.max(0, 1 - Math.min(1, r2)));
      const lit = 0.5 + 0.5 * (nx * LX + ny * LY + nz * 0.45);
      const speck = rough > 0 ? (hash3(x, y, seed + 7) - 0.5) * 0.35 : 0;
      b.px(x, y, rampAt(ramp, lit + speck, x, y, lo, hi));
    }
}

/** A box seen from the front: lit face, a darker right side strip and a light top edge. */
export function slab(
  b: Bmp,
  x: number,
  y: number,
  w: number,
  h: number,
  ramp: Ramp,
  step = 2,
): void {
  const at = (k: number): number => ramp[Math.max(0, Math.min(ramp.length - 1, k))] ?? C.VOID;
  b.rect(x, y, w, h, at(step));
  b.rect(
    x + w - Math.max(1, Math.round(w * 0.18)),
    y,
    Math.max(1, Math.round(w * 0.18)),
    h,
    at(step - 1),
  );
  b.rect(x, y, w, 1, at(step + 1));
  b.rect(x, y + h - 1, w, 1, at(step - 1));
}

/** A polygon shaded top (light) to bottom (dark) through ramp steps lo..hi. */
export function gradientPoly(
  b: Bmp,
  pts: Pts,
  ramp: Ramp,
  lo = 0,
  hi?: number,
  flip = false,
): void {
  const mask = new Bmp(b.w, b.h);
  mask.poly(pts, 1);
  let top = b.h;
  let bottom = 0;
  for (let y = 0; y < b.h; y += 1)
    for (let x = 0; x < b.w; x += 1)
      if (mask.d[y * b.w + x] === 1) {
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
  const span = Math.max(1, bottom - top);
  for (let y = top; y <= bottom; y += 1)
    for (let x = 0; x < b.w; x += 1) {
      if (mask.d[y * b.w + x] !== 1) continue;
      const v = (y - top) / span;
      b.px(x, y, rampAt(ramp, flip ? v : 1 - v, x, y, lo, hi));
    }
}

/** A thick line (limbs, branches, poles) of width `w` in one colour. */
export function stroke(
  b: Bmp,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  w: number,
  c: number,
): void {
  const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay)));
  const r = w / 2;
  for (let s = 0; s <= steps; s += 1) {
    const u = s / steps;
    const x = ax + (bx - ax) * u;
    const y = ay + (by - ay) * u;
    if (w <= 1) b.px(x, y, c);
    else
      b.rect(
        Math.round(x - r),
        Math.round(y - r),
        Math.max(1, Math.round(w)),
        Math.max(1, Math.round(w)),
        c,
      );
  }
}

/** Seeded specks of colour c inside the opaque pixels (dirt, spots, highlights). */
export function speckle(b: Bmp, share: number, c: number, seed: number): void {
  for (let y = 0; y < b.h; y += 1)
    for (let x = 0; x < b.w; x += 1)
      if (b.d[y * b.w + x] !== T && hash3(x, y, seed) < share) b.d[y * b.w + x] = c;
}

/** Finishes a drawing as a sprite: 1 px outline (VOID by default), glowing colours. */
export function finish(
  b: Bmp,
  outline: number | null = C.VOID,
  glow: readonly number[] = [],
): Sprite {
  if (outline !== null) b.outline(outline);
  return sprite(b, glow);
}

/** A mirrored copy (a creature walking the other way). */
export function mirror(src: Bmp): Bmp {
  const out = new Bmp(src.w, src.h);
  out.blit(src, 0, 0, undefined, true);
  return out;
}

/** A seeded stream for a generator call (its kind, seed and a salt). */
export function stream(seed: number, salt: number): () => number {
  return rng((Math.imul(seed + 1, 2654435761) ^ salt) >>> 0);
}

/** Uneven jitter in [-amp, amp] (hand-made offsets). */
export function jitter(random: () => number, amp: number): number {
  return (random() - 0.5) * 2 * amp;
}
