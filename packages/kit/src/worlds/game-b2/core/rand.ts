/**
 * Seeded hashing, PRNG, value noise, easing and the Bayer matrix of the Game B2 renderer. Integer
 * maths only: nothing here reads a clock or Math.random, so every frame is a pure function of t.
 */

/** Hash of three integers -> [0, 1). */
export function hash3(a: number, b: number, c: number): number {
  let h =
    (Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663) ^ Math.imul(c | 0, 83492791)) | 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Mulberry32 stream from a seed. */
export function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth value noise in [0, 1) on an integer lattice of size `cell`. */
export function vnoise(x: number, y: number, cell: number, seed: number): number {
  const gx = x / cell;
  const gy = y / cell;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const fx = gx - x0;
  const fy = gy - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash3(x0, y0, seed);
  const b = hash3(x0 + 1, y0, seed);
  const c = hash3(x0, y0 + 1, seed);
  const d = hash3(x0 + 1, y0 + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

export function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

export function clamp(value: number, low: number, high: number): number {
  return value < low ? low : value > high ? high : value;
}

export function lerp(a: number, b: number, u: number): number {
  return a + (b - a) * u;
}

/** Progress 0..1 of t through [a, b]. */
export function seg(t: number, a: number, b: number): number {
  return b <= a ? (t >= b ? 1 : 0) : clamp01((t - a) / (b - a));
}

export const EASES = {
  lin: (u: number) => u,
  in: (u: number) => u * u * u,
  out: (u: number) => 1 - (1 - u) ** 3,
  inOut: (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2),
  sine: (u: number) => 0.5 - 0.5 * Math.cos(Math.PI * u),
  outBack: (u: number) => {
    const c1 = 1.9;
    return 1 + (c1 + 1) * (u - 1) ** 3 + c1 * (u - 1) ** 2;
  },
} as const;

export type EaseId = keyof typeof EASES;
export const EASE_IDS = Object.keys(EASES) as readonly EaseId[];

/** 4x4 ordered-dither thresholds in (0, 1). */
export const BAYER = new Float32Array(
  [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16),
);

export function bayer(x: number, y: number): number {
  return BAYER[((y & 3) << 2) | (x & 3)] ?? 0;
}
