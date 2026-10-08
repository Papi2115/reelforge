/**
 * Walls and floors of the room DSL in room units (square pixels): panelling and shag (the living
 * room's own), wallpaper, paint with a chair rail, brick, concrete and tiles; carpet, boards,
 * checker linoleum and concrete. Each is uneven on purpose (a patch painted over, a darker brick,
 * a plank seam that wanders), seeded, and a pure function of its inputs.
 */
import { hash } from '../core/math.js';
import { C, SCAN } from '../palette.js';
import type { FLOORS, WALLS } from './interior-schema.js';
import { panelling, shag } from './props.js';
import type { RoomPen } from './view.js';

export type WallKind = (typeof WALLS)[number];
export type FloorKind = (typeof FLOORS)[number];

/** The wall's bottom (the skirting starts here) and the floor's top, in room units. */
export const WALL_BOTTOM = 118;
export const FLOOR_TOP = 123;
const FLOOR_BOTTOM = 181;

function wallpaper(p: RoomPen, inks: readonly number[], seed: number): void {
  const [base, stripe, dot] = [inks[0] ?? C.DUSK, inks[1] ?? C.MAUVE, inks[2] ?? C.TAN];
  p.rr(-40, 0, 400, WALL_BOTTOM, base);
  for (let x = -36; x < 340; x += 12) {
    p.rr(x, 0, 2, WALL_BOTTOM, stripe);
    for (let y = 6 + (Math.floor(x / 12) % 2) * 7; y < WALL_BOTTOM; y += 14)
      p.rr(x + 6 + Math.round(hash(seed, x, y) - 0.4), y, 1, 1, dot);
  }
  // a seam that does not quite line up
  p.rr(198, 0, 1, WALL_BOTTOM, stripe);
  p.rmap(199, 40, 1, 30, SCAN);
}

function paint(p: RoomPen, inks: readonly number[], seed: number): void {
  const [upper, lower] = [inks[0] ?? C.GREY_D, inks[1] ?? inks[0] ?? C.GREY];
  p.rr(-40, 0, 400, WALL_BOTTOM, upper);
  p.rr(-40, 78, 400, WALL_BOTTOM - 78, lower);
  p.rr(-40, 76, 400, 2, C.TEAK);
  p.rr(-40, 76, 400, 1, C.TAN);
  // patches painted over in a slightly different mix
  for (let i = 0; i < 3; i += 1)
    p.rd(150 + hash(seed, i, 1) * 150, 10 + hash(seed, i, 2) * 50, 14, 9, lower, 0.18);
}

function brick(p: RoomPen, inks: readonly number[], seed: number): void {
  const [face, mortar] = [inks[0] ?? C.RUST, inks[1] ?? C.WALNUT];
  p.rr(-40, 0, 400, WALL_BOTTOM, mortar);
  for (let row = 0; row * 6 < WALL_BOTTOM; row += 1) {
    const shift = row % 2 === 0 ? 0 : 7;
    for (let x = -40 + shift; x < 340; x += 14) {
      const dark = hash(seed, row, x) > 0.86;
      p.rr(x, row * 6, 13, 5, dark ? C.WALNUT : face);
    }
  }
}

function concrete(p: RoomPen, inks: readonly number[], seed: number): void {
  const [base, speck] = [inks[0] ?? C.GREY_D, inks[1] ?? C.GREY];
  p.rr(-40, 0, 400, WALL_BOTTOM, base);
  for (let i = 0; i < 160; i += 1)
    p.rr(-20 + hash(seed, i, 1) * 350, hash(seed, i, 2) * WALL_BOTTOM, 1, 1, speck);
  for (let k = 0; k < 9; k += 1)
    p.rr(250 + k * 2 + Math.round(hash(seed, k, 3)), 30 + k * 4, 1, 4, C.TUBE);
}

function tiles(p: RoomPen, inks: readonly number[], seed: number): void {
  const [tile, grout] = [inks[0] ?? C.AQUA, inks[1] ?? C.GREY];
  p.rr(-40, 0, 400, WALL_BOTTOM, grout);
  for (let y = 0; y < WALL_BOTTOM; y += 10)
    for (let x = -40; x < 340; x += 10) p.rr(x, y, 9, 9, hash(seed, x, y) > 0.95 ? C.CREAM : tile);
}

export function drawWall(p: RoomPen, kind: WallKind, inks: readonly number[], seed: number): void {
  if (kind === 'panelling') panelling(p, 0, 121, 41);
  else if (kind === 'wallpaper') wallpaper(p, inks, seed);
  else if (kind === 'paint') paint(p, inks, seed);
  else if (kind === 'brick') brick(p, inks, seed);
  else if (kind === 'concrete') concrete(p, inks, seed);
  else tiles(p, inks, seed);
  p.rr(-40, WALL_BOTTOM, 400, 5, C.TEAK);
  p.rr(-40, WALL_BOTTOM, 400, 1, C.TAN);
}

/**
 * The floor between y0 and y1 (default: the room's floor band). A taller band (the console
 * close-up, seen low) keeps the same density of specks; the room's band draws exactly as before.
 */
export function drawFloor(
  p: RoomPen,
  kind: FloorKind,
  inks: readonly number[],
  seed: number,
  band: readonly [number, number] = [FLOOR_TOP, FLOOR_BOTTOM],
): void {
  const [y0, y1] = band;
  const h = y1 - y0;
  const density = h / (FLOOR_BOTTOM - FLOOR_TOP);
  if (kind === 'shag') {
    shag(p, y0, y1, 77, Math.round(1500 * density));
    return;
  }
  const [a, b] = [inks[0] ?? C.TEAK, inks[1] ?? C.WALNUT];
  p.rr(-40, y0, 400, h, a);
  if (kind === 'carpet') {
    p.rd(-40, y0, 400, h, b, 0.25);
    for (let i = 0; i < Math.round(300 * density); i += 1)
      p.rr(-20 + hash(seed, i, 4) * 350, y0 + hash(seed, i, 5) * h, 1, 1, b);
  } else if (kind === 'boards') {
    for (let row = 0; row * 7 < h; row += 1) {
      p.rr(-40, y0 + row * 7, 400, 1, b);
      for (let x = -40 + hash(seed, row, 6) * 40; x < 340; x += 30 + hash(seed, row, x) * 40)
        p.rr(x, y0 + row * 7, 1, 7, b);
    }
  } else if (kind === 'checker') {
    for (let row = 0; row * 8 < h; row += 1)
      for (let col = -4; col < 34; col += 1)
        if ((row + col) % 2 === 0) p.rr(col * 10, y0 + row * 8, 10, 8, b);
    p.rd(150, y0 + 10, 40, 18, C.WALNUT_D, 0.2); // a worn patch where people stand
  } else {
    for (let i = 0; i < Math.round(200 * density); i += 1)
      p.rr(-20 + hash(seed, i, 7) * 350, y0 + hash(seed, i, 8) * h, 1, 1, b);
    p.rd(230, y0 + 20, 30, 12, C.TUBE, 0.35); // an oil stain
  }
}

/** Evening: the upper wall falls off; night: the whole room one step down, dithered. */
export function drawLight(p: RoomPen, light: 'day' | 'evening' | 'night'): void {
  if (light === 'day') return;
  for (let i = 0; i < 4; i += 1) p.rmap(-40, i * 5, 400, 5, SCAN, 0.5 - i * 0.12);
  if (light === 'night') p.rmap(-40, 0, 400, FLOOR_BOTTOM, SCAN, 0.5);
}
