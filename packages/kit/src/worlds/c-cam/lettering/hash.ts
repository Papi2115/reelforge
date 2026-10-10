/**
 * Integer hash and value noise of the lettering. Everything is a pure function of its arguments:
 * wobble, rotation and ink swell come from `hash(seed, ...)`, never from a clock or an RNG.
 */

function mix(value: number): number {
  let h = value;
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Integers in, [0, 1) out (missing arguments count as 0). */
export function hash(a: number, b = 0, c = 0, d = 0): number {
  let h = mix((a | 0) + 0x9e3779b9);
  h = mix(h ^ ((b | 0) + 0x85ebca6b));
  h = mix(h ^ ((c | 0) + 0xc2b2ae35));
  h = mix(h ^ ((d | 0) + 0x27d4eb2f));
  return h / 4294967296;
}

/** A seeded value in [lo, hi). */
export function rnd(lo: number, hi: number, a: number, b = 0, c = 0, d = 0): number {
  return lo + (hi - lo) * hash(a, b, c, d);
}

/** Start state of an FNV-1a hash. */
export const FNV_START = 2166136261;

/** One FNV-1a step: `fnvStep(state, code)`; start from `FNV_START`. */
export function fnvStep(state: number, code: number): number {
  return Math.imul(state ^ code, 16777619) >>> 0;
}

/** Smooth 1-D value noise in [0, 1): a hash lattice with smoothstep blending. */
export function valueNoise(seed: number, x: number): number {
  const cell = Math.floor(x);
  const f = x - cell;
  const u = f * f * (3 - 2 * f);
  const a = hash(seed, cell);
  const b = hash(seed, cell + 1);
  return a + (b - a) * u;
}
