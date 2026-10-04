/**
 * Deterministic math of the character pack (ADR-024): easing, the damped-spring step response
 * that gives poses their overshoot, and seeded hashes (no Math.random anywhere in the pack).
 */

export const TAU = Math.PI * 2;

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Smoothstep from a to b. */
export function smooth(a: number, b: number, value: number): number {
  const k = clamp01((value - a) / (b - a));
  return k * k * (3 - 2 * k);
}

/** Rises a -> b, falls c -> d (a plateau of 1 between b and c). */
export function bump(a: number, b: number, c: number, d: number, value: number): number {
  return smooth(a, b, value) - smooth(c, d, value);
}

export function lerp(a: number, b: number, k: number): number {
  return a + (b - a) * k;
}

/** Step response of a damped spring: 0 at t <= 0, overshoots, settles at 1. */
export function spring(t: number, frequency: number, damping: number): number {
  return t <= 0 ? 0 : 1 - Math.exp(-damping * t) * Math.cos(TAU * frequency * t);
}

/** Seeded hash of a number into [0, 1). */
export function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Small stable hash of a string (0..9972). */
export function stringHash(text: string): number {
  let h = 7;
  for (const char of text) h = (h * 31 + (char.codePointAt(0) ?? 0)) % 9973;
  return h;
}

/** Modulo with a non-negative result. */
export function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}
