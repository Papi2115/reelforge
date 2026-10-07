/**
 * The Comic inks as frame pixels for the panel-native transitions: every print ink of the world
 * (`COMIC_INKS` of @reelforge/kit) mapped to the closest colour of the active palette (exact in a
 * comic film) and which of them are paper-like. A transition only writes pixels of A or B or these
 * inks, so it never leaves the palette. Plus the small integer helpers the transitions share.
 */
import { COMIC_INKS } from '@reelforge/kit';
import type { Tones } from '../pixels.js';

type InkName = (typeof COMIC_INKS.table)[number][0];

export interface ComicInks {
  /** The pixel of an ink. */
  readonly ink: Readonly<Record<InkName, number>>;
  /** Paper-like pixel (paper, shade, aged, caption yellow, sepia stock). */
  paperlike(pixel: number): boolean;
  /** Dark ink that shows through the back of a turned page (key, night, sepia key). */
  inky(pixel: number): boolean;
}

const cache = new WeakMap<Tones, ComicInks>();

export function comicInks(tones: Tones): ComicInks {
  const cached = cache.get(tones);
  if (cached !== undefined) return cached;
  const { table, paperlike } = COMIC_INKS;
  const pixels = table.map(([, , hex]) => tones.nearest(Number.parseInt(hex.slice(1), 16)));
  const ink = Object.fromEntries(table.map(([name], index) => [name, pixels[index] ?? 0]));
  const paper = new Set(pixels.filter((_, index) => paperlike[index] === 1));
  const named = ink as Record<InkName, number>;
  const dark = new Set([named.INK, named.NIGHT, named.SEP_INK]);
  const inks: ComicInks = {
    ink: named,
    paperlike: (pixel) => paper.has(pixel),
    inky: (pixel) => dark.has(pixel),
  };
  cache.set(tones, inks);
  return inks;
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5] as const;

/** 4x4 ordered-dither threshold in [0, 1) (the page renderer's screen). */
export function bayer4(x: number, y: number): number {
  return (BAYER4[(y & 3) * 4 + (x & 3)] ?? 0) / 16;
}

/** Sine ease in-out (the showcase's page ease). */
export function inOutSine(q: number): number {
  return -(Math.cos(Math.PI * q) - 1) / 2;
}

export function inOutCubic(q: number): number {
  return q < 0.5 ? 4 * q * q * q : 1 - (-2 * q + 2) ** 3 / 2;
}

/** Smooth seeded value noise in [0, 1) over a lattice of `cell` px (integer hash, no state). */
export function noise(seed: number, x: number, y: number, cell: number): number {
  const hash = (i: number, j: number): number => {
    let h =
      Math.imul(i | 0, 0x27d4eb2d) ^ Math.imul(j | 0, 0x165667b1) ^ Math.imul(seed, 0x9e3779b9);
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    return ((h ^ (h >>> 16)) >>> 0) / 4_294_967_296;
  };
  const gx = x / cell;
  const gy = y / cell;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const sx = (gx - x0) * (gx - x0) * (3 - 2 * (gx - x0));
  const sy = (gy - y0) * (gy - y0) * (3 - 2 * (gy - y0));
  const top = hash(x0, y0) + (hash(x0 + 1, y0) - hash(x0, y0)) * sx;
  const bottom = hash(x0, y0 + 1) + (hash(x0 + 1, y0 + 1) - hash(x0, y0 + 1)) * sx;
  return top + (bottom - top) * sy;
}
