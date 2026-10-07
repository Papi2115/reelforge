/**
 * A raycaster texture: a 64x64 indexed bitmap plus which of its colours glow (tubes, bulbs,
 * screens) and how bright. A `flicker` texture follows the level's faulty-tube cadence. Textures
 * are pure functions of (kind, seed, options) and cached by that key.
 */
import { Bmp } from '../core/bitmap.js';
import { rng, vnoise, hash3 } from '../core/rand.js';
import { C } from '../palette.js';

export const TEX = 64;

export interface Texture {
  readonly bmp: Bmp;
  /** emissive[c] = 1 when colour c glows (not lit by the room, barely fogged). */
  readonly emissive: Uint8Array;
  /** Light level of the glowing colours (0 = they do not glow). */
  readonly glow: number;
  /** Glows only while the level's faulty tube is on. */
  readonly flicker: boolean;
}

export function texture(
  bmp: Bmp,
  glowing: readonly number[] = [],
  glow = 1.25,
  flicker = false,
): Texture {
  const emissive = new Uint8Array(256);
  for (const c of glowing) emissive[c] = 1;
  return { bmp, emissive, glow: glowing.length > 0 ? glow : 0, flicker };
}

export function blank(fill: number = C.SLATE): Bmp {
  return new Bmp(TEX, TEX, fill);
}

/** Value noise with a little salt (0..1). */
export function grain(x: number, y: number, cell: number, seed: number): number {
  return vnoise(x, y, cell, seed) * 0.75 + hash3(x, y, seed + 99) * 0.25;
}

/** Fills a region with a ramp picked by noise. */
export function noisy(
  b: Bmp,
  ramp: readonly number[],
  cell: number,
  seed: number,
  area: readonly [number, number, number, number] = [0, 0, TEX, TEX],
): void {
  const [x0, y0, w, h] = area;
  for (let y = y0; y < y0 + h; y += 1)
    for (let x = x0; x < x0 + w; x += 1) {
      const v = grain(x, y, cell, seed);
      b.px(x, y, ramp[Math.min(ramp.length - 1, Math.floor(v * ramp.length))] ?? C.SLATE);
    }
}

/** Scatters `count` seeded specks of colour c (dirt, rust, stains). */
export function specks(b: Bmp, count: number, c: number, seed: number): void {
  const random = rng(seed);
  for (let i = 0; i < count; i += 1) b.px(random() * TEX, random() * TEX, c);
}

const cache = new Map<string, Texture>();

/** Memo of a pure texture generator. */
export function cached(key: string, make: () => Texture): Texture {
  const hit = cache.get(key);
  if (hit) return hit;
  const made = make();
  cache.set(key, made);
  return made;
}
