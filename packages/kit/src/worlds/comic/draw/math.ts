/**
 * Seeded hashing, easing and keyframe tracks of the Comic page (a port of the showcase's
 * engine.js helpers). Every "random" value is `rnd(key, i)`, a hash of a string and an index, so a
 * frame is a pure function of t, seeds and what the scene drew.
 */

const hashCache = new Map<string, number>();

/** FNV-1a of a string (cached: keys repeat every frame). */
export function hashString(text: string): number {
  const cached = hashCache.get(text);
  if (cached !== undefined) return cached;
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  if (hashCache.size > 4096) hashCache.clear();
  hashCache.set(text, hash);
  return hash;
}

/** Deterministic [0, 1) from a string key and an integer index. */
export function rnd(key: string, index: number): number {
  let x = (hashString(key) ^ Math.imul((index | 0) + 0x9e3779b9, 0x85ebca6b)) >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b) >>> 0;
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

export function rndRange(key: string, index: number, min: number, max: number): number {
  return min + (max - min) * rnd(key, index);
}

export function rndInt(key: string, index: number, min: number, max: number): number {
  return Math.floor(rndRange(key, index, min, max + 1));
}

export function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

export function lerp(a: number, b: number, p: number): number {
  return a + (b - a) * p;
}

export type Ease = (p: number) => number;

function back(strength: number): Ease {
  return (p) => {
    const q = p - 1;
    return 1 + (strength + 1) * q * q * q + strength * q * q;
  };
}

export const EASES = {
  linear: (p: number) => p,
  inQuad: (p: number) => p * p,
  outQuad: (p: number) => 1 - (1 - p) * (1 - p),
  inCubic: (p: number) => p * p * p,
  outCubic: (p: number) => 1 - (1 - p) ** 3,
  outQuart: (p: number) => 1 - (1 - p) ** 4,
  inOutCubic: (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2),
  inOutSine: (p: number) => -(Math.cos(Math.PI * p) - 1) / 2,
  outBack: back(1.9),
  outBackSoft: back(0.9),
} as const satisfies Readonly<Record<string, Ease>>;

export type EaseName = keyof typeof EASES;
export const EASE_NAMES = Object.keys(EASES) as [EaseName, ...EaseName[]];

/** An ease by name or function (default linear). */
export function easeOf(ease: EaseName | Ease | undefined): Ease {
  if (ease === undefined) return EASES.linear;
  return typeof ease === 'function' ? ease : EASES[ease];
}

/** Progress of t through [a, b], eased. */
export function seg(t: number, a: number, b: number, ease?: EaseName | Ease): number {
  const p = b <= a ? (t >= b ? 1 : 0) : clamp01((t - a) / (b - a));
  return easeOf(ease)(p);
}

/** One key of a track: [time, value, ease into this key (default inOutCubic)]. */
export type TrackKey = readonly [number, number, (EaseName | Ease)?];

/** Keyframe track: value at t, holding the first and last values outside. */
export function track(keys: readonly TrackKey[], t: number): number {
  const first = keys[0];
  if (first === undefined) return 0;
  if (t <= first[0]) return first[1];
  for (let i = 1; i < keys.length; i += 1) {
    const key = keys[i];
    const previous = keys[i - 1];
    if (key === undefined || previous === undefined) continue;
    if (t <= key[0]) {
      const span = key[0] - previous[0];
      const p = span <= 0 ? 1 : (t - previous[0]) / span;
      return lerp(previous[1], key[1], easeOf(key[2] ?? 'inOutCubic')(p));
    }
  }
  return keys[keys.length - 1]?.[1] ?? 0;
}

/** Pop-in scale with an overshoot (0 -> 1.1 -> 1) over `dur` from `at`. */
export function pop(t: number, at: number, dur: number): number {
  return track(
    [
      [at, 0],
      [at + dur * 0.62, 1.1, 'outQuad'],
      [at + dur, 1, 'inOutSine'],
    ],
    t,
  );
}

/** Decaying camera hit, stepped at 30 fps so it reads as a hit, not noise: [dx, dy] px. */
export function shake(
  t: number,
  at: number,
  amp: number,
  decay: number,
  key: string,
): [number, number] {
  if (t < at) return [0, 0];
  const a = amp * Math.exp(-(t - at) / decay);
  if (a < 0.5) return [0, 0];
  const frame = Math.floor(t * 30);
  return [
    Math.round((rnd(key, frame * 2) * 2 - 1) * a),
    Math.round((rnd(key, frame * 2 + 1) * 2 - 1) * a),
  ];
}

/** Smooth seeded value noise in [0, 1) over a lattice of `cell` px. */
export function noise2(key: string, x: number, y: number, cell: number): number {
  const gx = x / cell;
  const gy = y / cell;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const fx = gx - x0;
  const fy = gy - y0;
  const v = (i: number, j: number) => rnd(key, ((i + 4096) * 7919 + (j + 4096) * 104729) | 0);
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  return lerp(lerp(v(x0, y0), v(x0 + 1, y0), sx), lerp(v(x0, y0 + 1), v(x0 + 1, y0 + 1), sx), sy);
}
