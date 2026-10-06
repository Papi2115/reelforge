/**
 * The Sketchbook inks as frame pixels for the page-native transitions: every ink of the world
 * (`SKETCHBOOK_INKS` of @reelforge/kit) mapped to the closest colour of the active palette (exact
 * in a sketchbook film), plus the world's paper-like set and soft-shadow remap over those pixels.
 * A transition only writes pixels of A or B or these inks, so it never leaves the palette.
 */
import { SKETCHBOOK_INKS } from '@reelforge/kit';
import type { Tones } from '../pixels.js';

type InkName = (typeof SKETCHBOOK_INKS.table)[number][0];

export interface SketchInks {
  /** The pixel of an ink. */
  readonly ink: Readonly<Record<InkName, number>>;
  /** Paper-like pixel (paper, rules, kraft, sticky...): shadows and the highlighter touch these. */
  paperlike(pixel: number): boolean;
  /** The pixel under a soft cast shadow (unchanged for ink). */
  soft(pixel: number): number;
}

const cache = new WeakMap<Tones, SketchInks>();

export function sketchInks(tones: Tones): SketchInks {
  const cached = cache.get(tones);
  if (cached !== undefined) return cached;
  const { table, paperlike, soft } = SKETCHBOOK_INKS;
  const pixels = table.map(([, , hex]) => tones.nearest(Number.parseInt(hex.slice(1), 16)));
  const ink = Object.fromEntries(table.map(([name], index) => [name, pixels[index] ?? 0]));
  const paper = new Set<number>();
  const shadow = new Map<number, number>();
  pixels.forEach((pixel, index) => {
    if (paperlike[index] === 1) paper.add(pixel);
    const to = pixels[soft[index] ?? index];
    if (to !== undefined && to !== pixel && !shadow.has(pixel)) shadow.set(pixel, to);
  });
  const inks: SketchInks = {
    ink: ink as Record<InkName, number>,
    paperlike: (pixel) => paper.has(pixel),
    soft: (pixel) => shadow.get(pixel) ?? pixel,
  };
  cache.set(tones, inks);
  return inks;
}

/** 32-bit hash of up to three integers as a float in [0, 1) (seeded wobble of torn edges). */
export function hashUnit(a: number, b = 0, c = 0): number {
  let h =
    Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b9);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4_294_967_296;
}

/** Cubic ease in-out of a value in [0, 1] (the showcase's page ease). */
export function inOut(q: number): number {
  return q < 0.5 ? 4 * q * q * q : 1 - (-2 * q + 2) ** 3 / 2;
}

/**
 * x (screen px) of a jagged tear near the spiral at row y: the page was torn out along it, so
 * left of it the frame keeps the incoming page (the stubs stay in the spiral).
 */
export function tearX(y: number, seed: number, scale: number): number {
  const row = Math.round(y / scale);
  return (
    (46 +
      Math.round(
        hashUnit(Math.floor(row / 4), seed) * 5 + hashUnit(Math.floor(row / 11), seed, 2) * 4,
      )) *
    scale
  );
}
