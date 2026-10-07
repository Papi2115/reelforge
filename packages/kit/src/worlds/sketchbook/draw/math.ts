/**
 * Seeded integer hash, easing and small numeric helpers of the Sketchbook renderer. Everything
 * is a pure function of its arguments: every wobble, fibre, ink skip and stagger comes from
 * `hash(seed, index, ...)`, never from a clock or Math.random.
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

/** FNV-1a of a string (seeds from ids). */
export function seedOf(text: string): number {
  let h = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    h = Math.imul(h ^ text.charCodeAt(index), 16777619);
  }
  return h >>> 0;
}

export function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

export function lerp(a: number, b: number, k: number): number {
  return a + (b - a) * k;
}

/** 0 before a, 1 after b, linear between (a step when a === b). */
export function seg(t: number, a: number, b: number): number {
  if (b <= a) return t >= a ? 1 : 0;
  return clamp01((t - a) / (b - a));
}

export const EASE_NAMES = ['lin', 'inOut', 'out', 'in', 'back', 'sine', 'hand'] as const;
export type EaseName = (typeof EASE_NAMES)[number];

/** Mixed on purpose: back for pops, in-out for travel, linear for rulers, `hand` for strokes. */
export function ease(name: EaseName, value: number, overshoot = 1.9): number {
  const x = clamp01(value);
  switch (name) {
    case 'lin':
      return x;
    case 'inOut':
      return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
    case 'out':
      return 1 - (1 - x) ** 3;
    case 'in':
      return x * x;
    case 'back':
      return 1 + (overshoot + 1) * (x - 1) ** 3 + overshoot * (x - 1) ** 2;
    case 'sine':
      return 0.5 - 0.5 * Math.cos(Math.PI * x);
    case 'hand':
      return 0.55 * x + 0.45 * x * x * (3 - 2 * x);
  }
}

/** Element i of a flat number array (0 past the end; keeps index access total). */
export function at(values: ArrayLike<number>, index: number): number {
  return values[index] ?? 0;
}
