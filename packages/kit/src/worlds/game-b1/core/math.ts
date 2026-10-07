/**
 * Seeded hashing, easing, the irregular typewriter and the decaying shake of the Game B1
 * renderer (the showcase's core.js). Nothing here reads a clock or Math.random: every frame is a
 * pure function of t.
 */

/** Hash of three integers -> [0, 1) (the showcase's hash, so seeded details match it). */
export function hash(a: number, b: number, c: number): number {
  let x = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0;
  x = (x + Math.imul(c | 0, -2048144777)) | 0;
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  x ^= x >>> 16;
  x = Math.imul(x, 0x85ebca6b);
  x ^= x >>> 13;
  return (x >>> 0) / 4294967296;
}

/** FNV-1a of a string (seeds keyed by content). */
export function sid(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h | 0;
}

/** Frame rate of the world's held cadences (shake holds, flicker parity). */
export const FPS = 30;

export function frameOf(t: number): number {
  return Math.round(t * FPS);
}

export function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
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
    const s = 1.9;
    const q = u - 1;
    return 1 + (s + 1) * q * q * q + s * q * q;
  },
} as const;

export type EaseId = keyof typeof EASES;
export const EASE_IDS = Object.keys(EASES) as readonly EaseId[];

export interface Offset {
  readonly x: number;
  readonly y: number;
}

/**
 * Screen shake started at t0 that decays; integer offsets held for 2 frames (CRT jitter is not
 * smooth per pixel).
 */
export function shake(t: number, t0: number, amp: number, decay: number, seed: number): Offset {
  if (t < t0) return { x: 0, y: 0 };
  const k = Math.exp(-(t - t0) * decay);
  if (k < 0.08) return { x: 0, y: 0 };
  const f = Math.floor(frameOf(t) / 2);
  return {
    x: Math.round((hash(seed, f, 1) - 0.5) * 2 * amp * k),
    y: Math.round((hash(seed, f, 2) - 0.5) * 2 * amp * k * 0.6),
  };
}

/** Time the irregular typewriter needs after a character (punctuation and spaces breathe). */
function stepAfter(ch: string, i: number, seed: number, cps: number): number {
  return (
    (1 / cps) * (0.55 + 0.9 * hash(seed, i, 3)) +
    (ch === ' ' ? 0.04 : 0) +
    (/[.:,?!]/.test(ch) ? 0.1 : 0)
  );
}

/** How many characters of `text` are visible at t when typing started at t0. */
export function typed(text: string, t: number, t0: number, seed: number, cps = 22): number {
  let at = t0;
  for (let i = 0; i < text.length; i += 1) {
    at += stepAfter(text[i] ?? '', i, seed, cps);
    if (t < at) return i;
  }
  return text.length;
}

/** When the last character of `text` lands (typing started at t0). */
export function typedEnd(text: string, t0: number, seed: number, cps = 22): number {
  let at = t0;
  for (let i = 0; i < text.length; i += 1) at += stepAfter(text[i] ?? '', i, seed, cps);
  return at;
}
