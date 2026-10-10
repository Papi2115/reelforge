/**
 * C-CAM core (PLAN.md#14.3): frame constants, the seeded hash, easing/keyframes, the acting clocks
 * (talk, blink) and the gritty palette. Pure: nothing here reads a clock or a global.
 *
 * Port of `docs/concepts/c-cam-style/films/03-apollo-11/js/core.js` (identical in films 1 and 2).
 * Divergences from the original:
 *  - no `window.ST` global and no module-level mutable state; everything is a named export;
 *  - the shot/cast registries (`SHOT_DEFS`, `CAST`, `defineShot`) are dropped: ReelForge scenes and
 *    project modules replace them;
 *  - `W`, `H`, `FPS`, `ANIM` are exported constants;
 *  - hash arguments after `a` default to 0 (the original coerced `undefined` with `| 0`: same result);
 *  - `ease` names are typed (`EaseName`); an empty keyframe list throws instead of a TypeError;
 *  - `shadeOf` is new: typed access to the `<TOKEN>_D` shade of a palette token.
 */

export const W = 1920;
export const H = 1080;
/** Playback / export rate. */
export const FPS = 24;
/** Characters hold every pose for two frames ("on twos"). */
export const ANIM = 12;

function mix(value: number): number {
  let h = value;
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Seeded hash: integers in (anything else is truncated with `| 0`), a number in [0, 1) out. */
export function hash(a: number, b = 0, c = 0, d = 0): number {
  let h = mix((a | 0) + 0x9e3779b9);
  h = mix(h ^ ((b | 0) + 0x85ebca6b));
  h = mix(h ^ ((c | 0) + 0xc2b2ae35));
  h = mix(h ^ ((d | 0) + 0x27d4eb2f));
  return h / 4294967296;
}

/** Seeded number in [lo, hi). */
export function rnd(lo: number, hi: number, a: number, b = 0, c = 0, d = 0): number {
  return lo + (hi - lo) * hash(a, b, c, d);
}

/** Smooth 1-D value noise in [0, 1). */
export function noise1(seed: number, x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const k = f * f * (3 - 2 * f);
  return hash(seed, i) * (1 - k) + hash(seed, i + 1) * k;
}

export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
export const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;
export const seg = (t: number, a: number, b: number): number => clamp01((t - a) / (b - a));

export type EaseName = 'lin' | 'inOut' | 'out' | 'back';

export const ease: Readonly<Record<EaseName, (x: number) => number>> = {
  lin: (x) => clamp01(x),
  inOut: (x) => {
    const t = clamp01(x);
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  },
  out: (x) => 1 - Math.pow(1 - clamp01(x), 3),
  back: (x) => {
    const t = clamp01(x);
    const s = 2.2;
    return 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
  },
};

/** Characters animate on twos: every pose holds for 1/12 s. */
export function twos(t: number): number {
  return Math.floor(t * ANIM + 1e-6) / ANIM;
}

/** `[time, value, easeName?]`: the value is reached at `time`, easing in with `easeName`. */
export type Keyframe = readonly [time: number, value: number, ease?: EaseName];

function firstKey(keys: readonly Keyframe[]): Keyframe {
  const first = keys[0];
  if (first === undefined) throw new RangeError('keyframe list is empty');
  return first;
}

/** Keyframed number: eases into each key (default ease `inOut`); holds before the first and after the last. */
export function key(t: number, keys: readonly Keyframe[]): number {
  const first = firstKey(keys);
  if (t <= first[0]) return first[1];
  for (let i = 1; i < keys.length; i += 1) {
    const next = keys[i];
    const prev = keys[i - 1];
    if (next === undefined || prev === undefined) continue;
    if (t < next[0]) {
      return lerp(prev[1], next[1], ease[next[2] ?? 'inOut']((t - prev[0]) / (next[0] - prev[0])));
    }
  }
  return keys[keys.length - 1]?.[1] ?? first[1];
}

/** Snapped value: the last key whose time has passed (pose swaps, expression changes). */
export function step<T>(t: number, keys: readonly (readonly [time: number, value: T])[]): T {
  const first = keys[0];
  if (first === undefined) throw new RangeError('keyframe list is empty');
  let value = first[1];
  for (const k of keys) if (t >= k[0]) value = k[1];
  return value;
}

/** Jaw flap while talking: spans `[from, to]`; syllables on twos, mouth shut between words. */
export function talk(
  t: number,
  seed: number,
  spans: readonly (readonly [number, number])[],
): number {
  const tt = twos(t);
  for (const [a, b] of spans) {
    if (tt < a || tt >= b) continue;
    const f = Math.floor((tt - a) * ANIM);
    if (hash(seed, f, 7) < 0.22) return 0.05;
    return 0.25 + 0.7 * hash(seed, f, 3);
  }
  return 0;
}

/** Slow blinks: one per ~3.4 s at a hashed moment, lids close for 3 frames at 12 fps. */
export function blink(t: number, seed: number): number {
  const period = 3.4;
  const k = Math.floor(t / period);
  const blinkAt = k * period + 0.4 + hash(seed, k, 11) * 2.4;
  const d = twos(t) - blinkAt;
  if (d < 0 || d >= 0.25) return 0;
  return d < 0.17 ? 1 : 0.6;
}

/** Palette: olive, clay, grey-blue, mustard, rust. Nothing pastel; whites are dirty. */
export const C = {
  INK: '#16120e',
  EYE: '#d9d0b4',
  MOUTH: '#2c110d',
  TONGUE: '#7f3b33',
  TOOTH: '#cdbd8c',
  TOOTH_D: '#a08f5c',
  SKIN_RUDDY: '#b07a62',
  SKIN_RUDDY_D: '#86533f',
  SKIN_SALLOW: '#b4a17a',
  SKIN_SALLOW_D: '#8a7954',
  SKIN_CLAY: '#a26c52',
  SKIN_CLAY_D: '#784a36',
  SKIN_OLIVE: '#9b8a62',
  SKIN_OLIVE_D: '#71633f',
  SKIN_GREY: '#a39880',
  SKIN_GREY_D: '#7a705b',
  OLIVE: '#646238',
  OLIVE_D: '#46452a',
  CLAY: '#8a5a40',
  CLAY_D: '#65402d',
  GREYBLUE: '#526068',
  GREYBLUE_D: '#3a454c',
  MUSTARD: '#9b8236',
  MUSTARD_D: '#735f26',
  RUST: '#83402a',
  RUST_D: '#5f2c1c',
  BROWN: '#5a4736',
  BROWN_D: '#3f3125',
  LINEN: '#ada385',
  LINEN_D: '#867d62',
  BLACK: '#2a2623',
  BLACK_D: '#1b1816',
  PLUM: '#55404a',
  PLUM_D: '#3c2c34',
  FUR: '#6e5640',
  FUR_D: '#4e3c2c',
  STONE: '#7d7766',
  STONE_D: '#5d584a',
  TIMBER: '#3d2e22',
  PLASTER: '#9c9273',
  RED: '#b02e26',
  RED_D: '#7c1f19',
  GOLD: '#c29632',
  GOLD_D: '#8e6c22',
  FIRE: '#e0a443',
  FIRE_D: '#b9722c',
} as const;

export type PaletteToken = keyof typeof C;

/** Tokens that have a shade, i.e. a `<TOKEN>_D` sibling. */
export type ShadedToken = {
  [K in PaletteToken]: `${K}_D` extends PaletteToken ? K : never;
}[PaletteToken];

/** The darker shade (`<TOKEN>_D`) of a palette token. */
export function shadeOf(token: ShadedToken): string {
  return C[`${token}_D` as PaletteToken];
}
