/**
 * The Game B2 colours as frame pixels for the game-native transitions: every colour of the world
 * (`GAME_B2_COLOURS` of @reelforge/kit) mapped to the closest colour of the active palette (exact
 * in a game-b2 film), the woodgrain of the HUD plates, value noise and the HUD minimap's rect. A
 * transition only writes pixels of A or B or these colours, so it never leaves the palette.
 */
import { GAME_B2_COLOURS } from '@reelforge/kit';
import { hashOf, unit, type Tones } from '../pixels.js';

type ColourName = (typeof GAME_B2_COLOURS)[number][0];

const cache = new WeakMap<Tones, Readonly<Record<ColourName, number>>>();

/** The pixel of each world colour in the active palette. */
export function b2Tones(tones: Tones): Readonly<Record<ColourName, number>> {
  const cached = cache.get(tones);
  if (cached !== undefined) return cached;
  const made = Object.fromEntries(
    GAME_B2_COLOURS.map(([name, , hex]) => [
      name,
      tones.nearest(Number.parseInt(hex.slice(1), 16)),
    ]),
  ) as Record<ColourName, number>;
  cache.set(tones, made);
  return made;
}

/** Smooth value noise in [0, 1) on a lattice of `cell` px. */
export function valueNoise(x: number, y: number, cell: number, seed: number): number {
  const gx = x / cell;
  const gy = y / cell;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const fx = gx - x0;
  const fy = gy - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const corner = (i: number, j: number): number => unit(hashOf(seed, x0 + i, y0 + j));
  const a = corner(0, 0);
  const b = corner(1, 0);
  const c = corner(0, 1);
  const d = corner(1, 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** The HUD veneer at frame pixel (x, y) (one woodgrain, like the plates), `s` = frame / 640. */
export function woodAt(x: number, y: number, s: number, ink: Readonly<Record<ColourName, number>>) {
  const u = x / s;
  const v = y / s;
  const grain = Math.sin(v * 0.9 + valueNoise(u * 0.07, v * 0.22, 1, 5) * 5.5 + u * 0.015);
  return grain > 0.6 ? ink.BROWN : grain < -0.86 ? ink.TAN : ink.WOOD;
}

/** The HUD minimap's inner rect in frame pixels (x, y, w, h). */
export function minimapRect(
  width: number,
  height: number,
): readonly [number, number, number, number] {
  const sx = width / 640;
  const sy = height / 360;
  return [542 * sx, 16 * sy, 78 * sx, 58 * sy];
}

const LITTLE_ENDIAN = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
const dimCache = new WeakMap<Tones, Map<number, number>>();

/**
 * `pixel` with its light scaled by `k` (0..1), as the closest world colour that keeps its hue
 * family (never the accent): a room going dark, not a walk down a luma ladder across hues.
 */
export function dim(tones: Tones, pixel: number, k: number): number {
  let cache = dimCache.get(tones);
  if (cache === undefined) {
    cache = new Map();
    dimCache.set(tones, cache);
  }
  const level = Math.round(k * 16);
  const key = pixel * 17 + level;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const r = (LITTLE_ENDIAN ? pixel : pixel >>> 24) & 0xff;
  const g = (LITTLE_ENDIAN ? pixel >>> 8 : pixel >>> 16) & 0xff;
  const b = (LITTLE_ENDIAN ? pixel >>> 16 : pixel >>> 8) & 0xff;
  const f = level / 16;
  let best = '#08070a';
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const [name, , hex] of GAME_B2_COLOURS) {
    if (name === 'ACCENT' || name === 'ACCENT_D') continue;
    const value = Number.parseInt(hex.slice(1), 16);
    const mean = (((value >> 16) & 255) + r * f) / 2;
    const dr = ((value >> 16) & 255) - r * f;
    const dg = ((value >> 8) & 255) - g * f;
    const db = (value & 255) - b * f;
    const distance = (2 + mean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - mean) / 256) * db * db;
    if (distance < bestDistance) [best, bestDistance] = [hex, distance];
  }
  const out = tones.nearest(Number.parseInt(best.slice(1), 16));
  cache.set(key, out);
  return out;
}
