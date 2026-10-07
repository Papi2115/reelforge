/**
 * The living room's surfaces and props in room units (the showcase's room.js, split): avocado
 * shag carpet, uneven wood panelling, the wall calendar with an unclosed pen circle, the
 * Christmas tree with bulbs blinking on their own cadences, presents, the missing gift's dashed
 * slot with Dad's swinging tag, a table lamp and loose cartridges. Pure functions of t.
 */
import { quad } from '../core/canvas.js';
import { joy } from '../core/fonts.js';
import { hand } from '../core/hand.js';
import { hash } from '../core/math.js';
import { C, SCAN } from '../palette.js';
import type { RoomPen } from './view.js';

/** Avocado shag, tufts bigger toward the camera. */
export function shag(p: RoomPen, y0: number, y1: number, seed: number, n: number): void {
  p.rr(-40, y0, 400, y1 - y0, C.OLIVE_D);
  for (let i = 0; i < n; i += 1) {
    const x = -20 + hash(seed, i, 1) * 360;
    const y = y0 + hash(seed, i, 2) * (y1 - y0);
    const depth = (y - y0) / (y1 - y0);
    const h = 1 + Math.round(depth * 2.5 + hash(seed, i, 3));
    p.rr(x, y, 1, h, C.AVOCADO);
    if (hash(seed, i, 4) > 0.5 && h > 1) p.rr(x + 1, y - 1, 1, 1, C.AVOCADO);
    if (hash(seed, i, 5) > 0.93) p.rr(x + 1, y + 1, 1, h, C.TEAK);
  }
}

/** Wood panelling: planks of uneven width, broken grain lines, a knot here and there. */
export function panelling(p: RoomPen, y0: number, y1: number, seed: number): void {
  p.rr(-40, y0, 400, y1 - y0, C.WALNUT);
  let x = -20;
  let i = 0;
  while (x < 340) {
    const w = 15 + Math.floor(hash(seed, i, 1) * 9);
    p.rr(x, y0, 1, y1 - y0, C.WALNUT_D);
    for (let g = 0; g < 3; g += 1) {
      const gx = x + 3 + Math.floor(hash(seed, i, 10 + g) * (w - 5));
      let gy = y0 + Math.floor(hash(seed, i, 20 + g) * 10);
      while (gy < y1) {
        const len = 6 + Math.floor(hash(seed, i * 7 + g, gy) * 14);
        p.rr(gx + (Math.floor(gy / 23) % 2), gy, 1, Math.min(len, y1 - gy), C.WALNUT_D);
        gy += len + 4 + Math.floor(hash(seed, gy, g) * 9);
      }
    }
    if (hash(seed, i, 30) > 0.6)
      p.rell(x + w / 2, y0 + 20 + hash(seed, i, 31) * 70, 1.6, 1, C.TEAK);
    x += w;
    i += 1;
  }
}

export interface CalendarSpec {
  readonly month: string;
  /** Day ringed by hand (1..28), 0 = none. */
  readonly mark: number;
  /** 0..1 of the ring drawn (the pen circle overshoots its start, never closes clean). */
  readonly ring: number;
}

/** The wall calendar (also the first frame of a calendar boss after the push-in). */
export function calendar(p: RoomPen, x0: number, y0: number, spec: CalendarSpec): void {
  p.rr(x0 + 16, y0 - 3, 2, 3, C.GREY);
  p.rr(x0 + 1, y0 + 1, 34, 48, C.WALNUT_D);
  p.rr(x0, y0, 34, 48, C.CREAM);
  p.rr(x0, y0, 34, 3, C.TEAK);
  p.rr(x0 + 3, y0 + 5, 28, 14, C.NIGHT);
  p.rr(x0 + 3, y0 + 15, 28, 4, C.CREAM);
  p.rpoly([x0 + 6, y0 + 15, x0 + 11, y0 + 9, x0 + 16, y0 + 15], C.OLIVE_D);
  p.rpoly([x0 + 14, y0 + 15, x0 + 21, y0 + 7, x0 + 28, y0 + 15], C.OLIVE_D);
  joy(p.cv, spec.month, p.X(x0 + 3), p.Y(y0 + 21), Math.max(1, Math.round(p.s / 2)), C.RUST);
  for (let r = 0; r < 4; r += 1)
    for (let d = 0; d < 7; d += 1) p.rr(x0 + 4 + d * 4, y0 + 30 + r * 4.3, 1.4, 1.4, C.TEAK);
  if (spec.mark < 1 || spec.ring <= 0) return;
  const index = spec.mark - 1;
  const cx = p.X(x0 + 4.7 + (index % 7) * 4);
  const cy = p.Y(y0 + 30.7 + Math.floor(index / 7) * 4.3);
  const rad = 2.6 * p.s;
  let prev: readonly [number, number] | undefined;
  for (let a = 0; a <= 7 * spec.ring; a += 0.25) {
    const r = rad * (1 + 0.12 * Math.sin(a * 1.7));
    const pt = [cx + Math.cos(a - 2.2) * r * 1.25, cy + Math.sin(a - 2.2) * r] as const;
    if (prev !== undefined)
      p.cv.line(prev[0], prev[1], pt[0], pt[1], C.RUST, Math.max(1, Math.round(p.s / 2)));
    prev = pt;
  }
}

const BULBS = [
  [-6, 24], [7, 30], [-15, 41], [3, 47], [18, 52], [-24, 58], [-6, 63], [12, 70],
  [30, 76], [-30, 78], [-12, 86], [22, 92], [-40, 99], [5, 100], [38, 101],
] as const; // prettier-ignore
const TIERS = [
  [14, 22, 18],
  [30, 40, 28],
  [48, 58, 38],
  [66, 80, 47],
  [86, 104, 56],
] as const;

/** The Christmas tree at the right edge, cropped by the frame; bulbs blink on their own cadences. */
export function tree(p: RoomPen, t: number): void {
  const tx = 264;
  const ty = 21;
  TIERS.forEach(([top, bottom, half], i) => {
    p.rpoly([tx, ty + top - 6, tx + half, ty + bottom, tx - half, ty + bottom], C.AVOCADO);
    p.rpoly(
      [tx + 2, ty + top - 4, tx + half, ty + bottom, tx + half * 0.25, ty + bottom],
      C.OLIVE_D,
    );
    p.rr(tx - half + 3, ty + bottom - 1, half * 2 - 6, 1, i % 2 === 1 ? C.TEAL_D : C.OLIVE_D);
  });
  p.rr(tx - 5, ty + 104, 10, 8, C.WALNUT_D);
  // prettier-ignore
  p.rpoly([tx, ty + 3, tx + 2, ty + 8, tx + 6, ty + 8, tx + 3, ty + 11, tx + 4, ty + 15, tx, ty + 12,
    tx - 4, ty + 15, tx - 3, ty + 11, tx - 6, ty + 8, tx - 2, ty + 8], C.GOLD);
  const lit = [C.ORANGE, C.GOLD, C.AQUA, C.CREAM];
  const dim = [C.RUST, C.TEAK, C.TEAL_D, C.TAN];
  BULBS.forEach(([bx, by], i) => {
    const rate = 0.55 + hash(9, i, 1) * 1.1;
    const on = hash(9, i, Math.floor(t * rate + hash(9, i, 2) * 3)) > 0.3;
    p.rr(tx + bx, ty + by, 2, 2, (on ? lit[i % 4] : dim[i % 4]) ?? C.TAN);
  });
}

/** Two wrapped presents on the carpet; the gap between them is where a missing gift goes. */
export function presents(p: RoomPen): void {
  p.rr(203, 126, 32, 19, C.ORANGE);
  p.rr(203, 126, 32, 1, C.GOLD);
  p.rr(216, 126, 4, 19, C.CREAM);
  p.rr(203, 133, 32, 3, C.CREAM);
  p.rr(235, 128, 1, 17, C.RUST);
  p.rr(288, 124, 34, 21, C.TEAL);
  p.rr(301, 124, 4, 21, C.GOLD);
  p.rr(288, 124, 34, 1, C.AQUA);
  p.rr(287, 126, 1, 19, C.TEAL_D);
}

export interface GiftState {
  /** 0..1 of the dashed outline drawn. */
  readonly slot: number;
  /** 0..1 of the tag's drop; it swings to rest. */
  readonly tag: number;
  readonly lines: readonly string[];
  /** The outline blinks off (seconds since the blink began), undefined = steady. */
  readonly blink: number | undefined;
}

/** The missing gift: a hand-dashed placeholder outline and Dad's tag, dropping and swinging. */
export function giftSlot(p: RoomPen, g: GiftState): void {
  const [x, y, w, h] = [243, 120, 38, 25];
  if (g.slot > 0) p.rmap(x + 1, y + 1, w - 2, h - 2, SCAN, 0.5);
  const perimeter = 2 * (w + h);
  const show = perimeter * Math.min(1, g.slot);
  const blinkOff = g.blink !== undefined && Math.floor(g.blink * 6) % 2 === 1;
  if (!blinkOff)
    for (let d = 0; d < show; d += 5) {
      if (d === 45) continue; // the pen lifted: one longer gap
      for (let q = d; q < Math.min(d + 3, show); q += 1) {
        const [px, py] =
          q < w ? [x + q, y]
          : q < w + h ? [x + w, y + q - w]
          : q < 2 * w + h ? [x + w - (q - w - h), y + h]
          : [x, y + h - (q - 2 * w - h)]; // prettier-ignore
        p.rr(px, py, 1, 1, C.CREAM);
      }
    }
  if (g.tag <= 0 || g.lines.length === 0) return;
  const swing = g.tag < 1 ? (1 - g.tag) * 0.9 : 0;
  const angle = -0.13 + Math.sin(g.tag * 9) * swing * 0.5;
  const tcx = 254;
  const tcy = 162 - (1 - Math.min(1, g.tag * 1.6)) * 14;
  const corners = quad(p.X(tcx), p.Y(tcy), 48 * p.s, 23 * p.s, angle);
  p.cv.poly(
    corners.map((v, i) => v + (i % 2 === 1 ? 4 : 3)),
    0,
    SCAN,
  );
  p.cv.poly(corners, C.CREAM);
  const co = Math.cos(angle);
  const si = Math.sin(angle);
  const at = (lx: number, ly: number) =>
    [p.X(tcx) + (lx * co - ly * si) * p.s, p.Y(tcy) + (lx * si + ly * co) * p.s] as const;
  const hole = at(-20, 0);
  p.cv.ellipse(hole[0], hole[1], 1.6 * p.s, 1.6 * p.s, C.OLIVE_D);
  p.cv.line(hole[0], hole[1], p.X(246), p.Y(146), C.TAN, Math.round(p.s / 2));
  g.lines.slice(0, 2).forEach((line, i) => {
    const [lx, ly] = at(-15, i === 0 ? -8 : 1);
    hand(p.cv, line, {
      x: lx,
      y: ly,
      size: p.s * 0.95,
      angle,
      seed: i === 0 ? 13 : 82,
      colour: C.WALNUT_D,
      slant: i === 0 ? 0.2 : 0.22,
    });
  });
}

/** A table lamp on the right of the TV cabinet: ceramic base, a cream shade, warm light on the wall. */
export function lamp(p: RoomPen): void {
  p.rd(118, 6, 38, 14, C.TEAK, 0.3);
  p.rd(124, 30, 26, 12, C.TEAK, 0.18);
  p.rell(137, 40, 5, 4.2, C.ORANGE);
  p.rr(134, 39, 2, 2, C.GOLD);
  p.rr(136.5, 29, 1, 8, C.GREY);
  p.rpoly([128, 30, 146, 29, 142.5, 18, 132, 19], C.CREAM);
  p.rr(128, 29, 18, 1, C.TAN);
  p.rr(132, 19, 10, 1, C.TAN);
}

/** Loose cartridges on the carpet right of the joystick (1..4), each a little off true. */
export function looseCarts(p: RoomPen, count: number, seed: number): void {
  const stripes = [C.ORANGE, C.TEAL, C.AVOCADO, C.MAUVE];
  for (let i = 0; i < Math.min(4, count); i += 1) {
    const x = 138 + i * 15 + Math.round(hash(seed, i, 1) * 3);
    const y = 150 + Math.round(hash(seed, i, 2) * 4);
    p.rr(x + 1, y + 1, 13, 7, C.WALNUT_D);
    p.rr(x, y, 13, 7, C.GREY_D);
    p.rr(x, y, 13, 1, C.GREY);
    p.rr(x + 2, y + 2, 9, 4, C.CREAM);
    p.rr(x + 2, y + 3, 9, 2, stripes[i] ?? C.ORANGE);
  }
}
