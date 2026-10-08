/**
 * People of the Game B2 world (never faces of real people: a worker from behind, a clerk with a
 * cap) and the first-person hand, drawn at world resolution bottom-right like a Doom weapon.
 * Crude on purpose; frames for talking and a head-shake.
 */
import { Bmp } from '../core/bitmap.js';
import { clamp01, hash3 } from '../core/rand.js';
import { C, T } from '../palette.js';
import { sprite, thing, type ItemLook, type Sprite } from './sprites-props.js';

/** A desk with a CRT; with `person` a worker at it, seen from behind (frame 1 = typing). */
export function desk(person: boolean, frame: 0 | 1): Sprite {
  const b = new Bmp(96, 72);
  b.rect(4, 49, 6, 23, C.BROWN);
  b.rect(82, 49, 8, 23, C.BROWN);
  b.rect(4, 42, 88, 4, C.TAN);
  b.rect(4, 46, 88, 3, C.WOOD);
  b.rect(4, 42, 88, 1, C.SAND_L);
  b.rect(54, 13, 29, 29, C.PUTTY);
  b.rect(79, 13, 4, 29, C.GREY);
  b.rect(54, 40, 29, 2, C.GREY);
  b.rect(58, 17, 19, 16, C.VOID);
  b.rect(59, 18, 17, 14, C.GREEN);
  [9, 13, 6, 11, 4].forEach((length, i) => {
    b.rect(61 + (i === 3 ? 2 : 0), 20 + i * 2 + (i > 2 ? 1 : 0), length, 1, C.FLUO);
  });
  b.rect(50, 39, 30, 3, C.PUTTY);
  for (let k = 0; k < 9; k += 1) b.px(52 + k * 3, 40, C.GREY);
  b.rect(9, 36, 22, 6, C.PAPER);
  b.rect(10, 35, 20, 1, C.SAND_L);
  b.rect(12, 38, 14, 1, C.SAND);
  b.rect(35, 33, 7, 9, C.PUTTY);
  b.rect(42, 35, 2, 4, C.PUTTY);
  b.rect(36, 33, 5, 1, C.BROWN);
  if (person) {
    const dx = frame;
    b.ellipse(23 + dx, 41, 4, 7, C.DUSK);
    b.ellipse(55 - dx, 41, 4, 7, C.DUSK);
    b.poly([24, 26, 54, 26, 57, 52, 21, 52], C.DUSK);
    b.poly([26, 27, 38, 26, 37, 50, 24, 50], C.HAZE);
    b.rect(35, 22, 7, 6, C.WOOD);
    b.ellipse(38 + frame * 0.5, 15, 8, 9.5, C.BROWN);
    for (let i = 0; i < 14; i += 1)
      b.px(32 + hash3(i, 3, 3) * 12, 8 + hash3(i, 4, 3) * 13, i % 3 ? C.UMBER : C.WOOD);
    b.px(29, 16, C.TAN);
    b.px(47, 16, C.TAN);
    b.poly([25, 44, 53, 44, 52, 66, 26, 66], C.CHAR);
    b.rect(37, 66, 4, 4, C.CHAR);
    b.rect(27, 70, 24, 2, C.SLATE);
  }
  return sprite(b.outline(C.VOID), [C.GREEN, C.FLUO]);
}

/** Clerk frames: 0 rest, 1 talking, 2/3 head-shake left/right. */
export function clerk(frame: 0 | 1 | 2 | 3): Sprite {
  const talk = frame === 1;
  const tilt = frame === 2 ? -1 : frame === 3 ? 1 : 0;
  const b = new Bmp(44, 60);
  b.ellipse(22, 44, 17, 22, C.PUTTY);
  b.rect(5, 44, 34, 16, C.PUTTY);
  b.poly([12, 30, 32, 30, 34, 60, 10, 60], C.CLAY);
  b.rect(26, 34, 5, 3, C.PAPER);
  b.rect(18 + tilt, 20, 8, 6, C.WOOD);
  b.ellipse(22 + tilt, 15, 7, 8, C.TAN);
  b.rect(15 + tilt, 12, 14, 3, C.WOOD);
  b.rect(19 + tilt, 19, 6, talk ? 2 : 1, C.BROWN);
  b.ellipse(22 + tilt, 7, 8, 5, C.DUSK);
  b.rect(12 + tilt, 9, 20, 2, C.NIGHT);
  b.rect(7, 36, 30, 7, C.PUTTY);
  b.rect(7, 42, 30, 1, C.GREY);
  b.ellipse(8, 39, 3, 3, C.TAN);
  b.ellipse(36, 39, 3, 3, C.TAN);
  return sprite(b.outline(C.VOID));
}

// ---------------- the hand ----------------

type Shade = 0 | 1 | 2 | 3 | 4;
const SKIN = [T, C.BROWN, C.WOOD, C.TAN, C.TUNGSTEN];

function skin(b: Bmp, shade: (x: number, y: number) => Shade): void {
  for (let y = 0; y < b.h; y += 1)
    for (let x = 0; x < b.w; x += 1) {
      const s = shade(x, y);
      if (s !== 0) b.px(x, y, SKIN[s] ?? T);
    }
}

/** Inside a capsule from (ax, ay) to (bx, by) of radius r. */
function capsule(
  x: number,
  y: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  r: number,
): boolean {
  const vx = bx - ax;
  const vy = by - ay;
  const u = clamp01(((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy));
  return Math.hypot(x - ax - vx * u, y - ay - vy * u) <= r;
}

function sleeve(b: Bmp, x0: number, y0: number): void {
  b.poly([x0, y0 + 4, x0 + 40, y0, x0 + 52, b.h, x0 + 2, b.h], C.DUSK);
  b.poly([x0 + 2, y0 + 4, x0 + 40, y0, x0 + 41, y0 + 5, x0 + 3, y0 + 9], C.HAZE);
  b.rect(x0 + 10, y0 + 12, 2, b.h - y0 - 12, C.NIGHT);
}

export interface HandSprite extends Sprite {
  /** Where the cuff leaves the bitmap: the forearm is extended from here to the frame edge. */
  readonly cuff: readonly [number, number];
}

/** The hand holding an item (fingertips behind the shell, thumb over the label corner). */
export function handHold(look: ItemLook): HandSprite {
  const b = new Bmp(84, 96);
  skin(b, (x, y) =>
    capsule(x, y, 52, 22, 58, 22, 4) ||
    capsule(x, y, 52, 31, 59, 31, 4) ||
    capsule(x, y, 52, 40, 58, 41, 4)
      ? x > 57
        ? 2
        : 3
      : 0,
  );
  const held = thing(46, 54, look, 11);
  b.blit(held, 10, 2 + Math.round((54 - held.h) / 2));
  skin(b, (x, y) => {
    if (capsule(x, y, 24, 66, 52, 62, 13)) return y > 70 ? 2 : 3;
    if (capsule(x, y, 16, 64, 20, 46, 5.5)) return x < 15 ? 2 : y < 50 ? 4 : 3;
    if (capsule(x, y, 52, 50, 56, 60, 6)) return 2;
    return 0;
  });
  b.line(19, 50, 22, 50, C.WOOD);
  sleeve(b, 22, 72);
  return { ...sprite(b.outline(C.UMBER)), cuff: [24, 76] };
}

const FINGERS = [
  [29, 41, 17, 17, 4.3],
  [36, 37, 27, 9, 4.4],
  [43, 38, 37, 10, 4.2],
  [49, 43, 46, 18, 3.8],
] as const;

/** The open hand reaching for something. */
export function handOpen(): HandSprite {
  const b = new Bmp(78, 84);
  skin(b, (x, y) => {
    for (const [ax, ay, bx, by, r] of FINGERS)
      if (capsule(x, y, ax, ay, bx, by, r)) return x - bx > r * 0.4 ? 2 : y < (ay + by) / 2 ? 4 : 3;
    if (capsule(x, y, 24, 58, 14, 46, 5.2)) return x < 16 ? 2 : 3;
    if (capsule(x, y, 31, 56, 48, 54, 14)) return y > 62 || x > 54 ? 2 : 3;
    return 0;
  });
  for (const [ax, ay, bx, by] of FINGERS) {
    b.rect(bx - 1, by - 1, 3, 3, C.SAND_L);
    b.px(ax, ay + 2, C.TUNGSTEN);
  }
  b.line(30, 50, 46, 47, C.WOOD);
  b.line(34, 60, 47, 57, C.WOOD);
  sleeve(b, 26, 64);
  return { ...sprite(b.outline(C.UMBER)), cuff: [28, 80] };
}
