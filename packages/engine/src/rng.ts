/**
 * Seeded PRNG for scenes (mulberry32). Scenes must use `ctx.rng` instead of Math.random so
 * the same seed always yields the same sequence (CLAUDE.md §3.2).
 */

/** Callable generator: `rng()` returns a float in [0, 1). */
export interface Rng {
  (): number;
  /** Float in [min, max). */
  range(min: number, max: number): number;
  /** Integer in [min, max] (both inclusive). */
  int(min: number, max: number): number;
  /** Uniformly chosen element; throws on an empty list. */
  pick<T>(items: readonly T[]): T;
  /** Independent generator derived from this generator's seed and `label` (does not advance this one). */
  fork(label: string): Rng;
}

/** Raw mulberry32 step function over a uint32 seed. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

/** 32-bit FNV-1a over the UTF-16 code units of `text`, mixed into `seed`. */
export function hashString(text: string, seed = 0): number {
  let hash = (0x811c9dc5 ^ seed) >>> 0;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function createRng(seed: number): Rng {
  const baseSeed = seed >>> 0;
  const next = mulberry32(baseSeed);
  const rng = (() => next()) as Rng;
  rng.range = (min, max) => min + (max - min) * next();
  rng.int = (min, max) => Math.floor(min + (max - min + 1) * next());
  rng.pick = <T>(items: readonly T[]): T => {
    if (items.length === 0) throw new RangeError('rng.pick: empty list');
    return items[Math.floor(items.length * next())] as T;
  };
  rng.fork = (label) => createRng(hashString(label, baseSeed));
  return rng;
}

/** Seed of a shot's RNG stream: depends only on the project seed and the shot id. */
export function shotSeed(projectSeed: number, shotId: string): number {
  return hashString(`shot:${shotId}`, projectSeed >>> 0);
}
