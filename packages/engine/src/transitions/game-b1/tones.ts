/**
 * The Game B1 colours as frame pixels for the game-native transitions: every ink of the world
 * (`GAME_B1_COLOURS` of @reelforge/kit) mapped to the closest colour of the active palette (exact
 * in a game-b1 film), and the world's whole-frame LUTs (`GAME_B1_LUTS`: the scanline shadow, the
 * hit flash, the attract-mode colour cycle) as pixel -> pixel maps. A transition only writes
 * pixels of A or B or these, so it never leaves the palette.
 */
import { GAME_B1_COLOURS, GAME_B1_LUTS } from '@reelforge/kit';
import type { Tones } from '../pixels.js';

type InkName = (typeof GAME_B1_COLOURS)[number][0];

const inkCache = new WeakMap<Tones, readonly number[]>();

/** The pixel of each world ink, in the world's index order. */
function inkPixels(tones: Tones): readonly number[] {
  const cached = inkCache.get(tones);
  if (cached !== undefined) return cached;
  const made = GAME_B1_COLOURS.map(([, , hex]) => tones.nearest(Number.parseInt(hex.slice(1), 16)));
  inkCache.set(tones, made);
  return made;
}

/** The pixel of each world ink by name. */
export function b1Tones(tones: Tones): Readonly<Record<InkName, number>> {
  const pixels = inkPixels(tones);
  return Object.fromEntries(
    GAME_B1_COLOURS.map(([name], i) => [name, pixels[i] ?? tones.darkest]),
  ) as Record<InkName, number>;
}

export type LutName = 'scan' | 'flash' | 'cycle0' | 'cycle1' | 'cycle2';

function lutOf(name: LutName): Uint8Array {
  if (name === 'scan') return GAME_B1_LUTS.scan;
  if (name === 'flash') return GAME_B1_LUTS.flash;
  return GAME_B1_LUTS.cycle[Number(name.slice(-1))] ?? GAME_B1_LUTS.scan;
}

const mapCache = new WeakMap<Tones, Map<LutName, ReadonlyMap<number, number>>>();

/**
 * A world LUT as pixel -> pixel; pixels that are no world ink map to themselves (`apply`). In a
 * palette where two inks share a pixel the first ink wins.
 */
export function lutMap(tones: Tones, name: LutName): ReadonlyMap<number, number> {
  let perTones = mapCache.get(tones);
  if (perTones === undefined) {
    perTones = new Map();
    mapCache.set(tones, perTones);
  }
  const cached = perTones.get(name);
  if (cached !== undefined) return cached;
  const pixels = inkPixels(tones);
  const table = lutOf(name);
  const map = new Map<number, number>();
  pixels.forEach((pixel, i) => {
    if (!map.has(pixel)) map.set(pixel, pixels[table[i] ?? i] ?? pixel);
  });
  perTones.set(name, map);
  return map;
}

/** `pixel` through a LUT map (unchanged when it is no world ink). */
export function apply(map: ReadonlyMap<number, number>, pixel: number): number {
  return map.get(pixel) ?? pixel;
}

/** Scale of the frame against the world's 640x360. */
export function scaleOf(width: number): number {
  return width / 640;
}
