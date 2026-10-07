/**
 * Floor props of the room DSL in room units, standing on the floor against the wall (feet at
 * y = 142): a plant, a floor or desk lamp with its warm pool on the wall, a rug, a desk with what
 * is on it, a bed, a sofa, a filing / arcade / locker cabinet, a workbench, a stack of boxes, a
 * guitar or a drum. Seeded leaves and dents; pure functions of their inputs and t.
 */
import { hash } from '../core/math.js';
import { C } from '../palette.js';
import { ink } from './furniture-wall.js';
import type { RoomProp } from './interior-schema.js';
import type { RoomPen } from './view.js';

type Prop<K extends RoomProp['kind']> = Extract<RoomProp, { kind: K }>;

export const FEET = 142;

export function plantProp(p: RoomPen, o: Prop<'plant'>, seed: number): void {
  const tall = o.size === 'tall';
  const top = tall ? FEET - 44 : FEET - 22;
  for (let i = 0; i < (tall ? 9 : 5); i += 1) {
    const lean = (hash(seed, i, 1) - 0.5) * (tall ? 26 : 16);
    const tipY = top + hash(seed, i, 2) * (tall ? 20 : 8);
    const c = i % 3 === 0 ? C.OLIVE_D : C.AVOCADO;
    p.rpoly(
      [
        o.x + 8,
        FEET - 12,
        o.x + 8 + lean,
        tipY,
        o.x + 11 + lean * 0.8,
        tipY + 4,
        o.x + 10,
        FEET - 12,
      ],
      c,
    );
  }
  p.rpoly([o.x + 2, FEET - 13, o.x + 16, FEET - 13, o.x + 14, FEET, o.x + 4, FEET], ink(o.pot));
  p.rr(o.x + 2, FEET - 13, 14, 1, C.TAN);
}

export function lampProp(p: RoomPen, o: Prop<'lamp'>): void {
  const floor = o.type === 'floor';
  const shadeY = floor ? FEET - 62 : FEET - 34;
  if (o.on) {
    // the warm pool on the wall: sparse, brighter toward the shade
    p.rd(o.x - 6, shadeY - 8, 24, 8, C.TEAK, 0.12);
    p.rd(o.x - 2, shadeY - 4, 16, 4, C.TAN, 0.12);
  }
  if (floor) {
    p.rr(o.x + 5, shadeY + 8, 1, FEET - shadeY - 10, C.GREY);
    p.rr(o.x + 1, FEET - 2, 9, 2, C.GREY_D);
  } else {
    p.rr(o.x + 2, FEET - 22, 12, 2, C.TEAK); // the desk it stands on is the surface below
    p.rline(o.x + 5, FEET - 22, o.x + 9, shadeY + 6, C.GREY, 1);
  }
  p.rpoly([o.x - 2, shadeY + 9, o.x + 13, shadeY + 9, o.x + 10, shadeY, o.x + 1, shadeY], C.CREAM);
  p.rr(o.x - 2, shadeY + 9, 15, 1, C.TAN);
  if (o.on) p.rr(o.x + 3, shadeY + 10, 5, 1, C.GOLD);
}

export function rugProp(p: RoomPen, o: Prop<'rug'>): void {
  const y = 150;
  p.rpoly([o.x + 8, y, o.x + o.w - 4, y, o.x + o.w + 4, y + 18, o.x, y + 18], ink(o.colour));
  p.rpoly(
    [o.x + 12, y + 3, o.x + o.w - 8, y + 3, o.x + o.w - 2, y + 15, o.x + 5, y + 15],
    C.WALNUT,
  );
  p.rpoly(
    [o.x + 14, y + 5, o.x + o.w - 10, y + 5, o.x + o.w - 4, y + 13, o.x + 7, y + 13],
    ink(o.colour),
  );
  for (let k = 0; k < o.w; k += 3) p.rr(o.x + k, y + 18, 1, 2, C.CREAM);
}

export function deskProp(p: RoomPen, o: Prop<'desk'>, t: number, seed: number): void {
  const top = FEET - 22;
  p.rr(o.x + 2, top + 3, 3, 19, C.WALNUT);
  p.rr(o.x + o.w - 16, top + 3, 14, 19, C.TEAK);
  for (let k = 0; k < 3; k += 1) p.rr(o.x + o.w - 11, top + 6 + k * 6, 4, 1, C.TAN);
  p.rr(o.x, top, o.w, 3, C.TEAK);
  p.rr(o.x, top, o.w, 1, C.TAN);
  const cx = o.x + 6;
  if (o.on === 'papers')
    for (let k = 0; k < 4; k += 1)
      p.rr(cx + hash(seed, k, 1) * 6, top - 1 - k, 12, 1, k % 2 ? C.CREAM : C.WHITE);
  if (o.on === 'typewriter') {
    p.rr(cx, top - 6, 18, 6, C.GREY_D);
    p.rr(cx + 3, top - 11, 12, 6, C.CREAM);
    p.rr(cx + 2, top - 3, 14, 1, C.GREY);
  }
  if (o.on === 'computer') {
    p.rr(cx, top - 16, 20, 15, C.CREAM);
    p.rr(cx + 3, top - 13, 14, 9, C.TUBE);
    const blink = Math.floor(t * 2.2 + hash(seed, 2, 2)) % 2 === 0;
    for (let k = 0; k < 3; k += 1) p.rr(cx + 5, top - 11 + k * 2, 4 + k * 2, 1, C.TEAL);
    if (blink) p.rr(cx + 13, top - 7, 2, 1, C.AQUA);
    p.rr(cx - 2, top - 1, 24, 1, C.TAN);
  }
  if (o.on === 'phone') {
    p.rr(cx, top - 4, 10, 4, C.RUST);
    p.rr(cx - 1, top - 6, 12, 2, C.RUST);
  }
}

export function bedProp(p: RoomPen, o: Prop<'bed'>): void {
  p.rr(o.x, FEET - 34, 6, 34, C.WALNUT);
  p.rr(o.x + 6, FEET - 16, 66, 10, C.CREAM);
  p.rr(o.x + 8, FEET - 21, 16, 6, C.WHITE);
  p.rpoly(
    [o.x + 22, FEET - 17, o.x + 72, FEET - 18, o.x + 74, FEET - 4, o.x + 22, FEET - 4],
    ink(o.colour),
  );
  p.rr(o.x + 6, FEET - 6, 68, 6, C.WALNUT_D);
}

export function sofaProp(p: RoomPen, o: Prop<'sofa'>): void {
  const c = ink(o.colour);
  p.rr(o.x + 4, FEET - 30, 64, 16, c);
  p.rr(o.x, FEET - 20, 72, 16, c);
  p.rr(o.x + 6, FEET - 20, 60, 1, C.WALNUT);
  p.rr(o.x + 36, FEET - 19, 1, 9, C.WALNUT);
  p.rr(o.x + 3, FEET - 4, 3, 4, C.WALNUT_D);
  p.rr(o.x + 66, FEET - 4, 3, 4, C.WALNUT_D);
}

export function cabinetProp(p: RoomPen, o: Prop<'cabinet'>, t: number, seed: number): void {
  if (o.type === 'arcade') {
    const c = ink(o.colour ?? 'blue');
    p.rpoly([o.x, FEET, o.x, FEET - 66, o.x + 26, FEET - 66, o.x + 26, FEET], c);
    p.rr(o.x + 2, FEET - 64, 22, 7, C.GOLD);
    p.rr(o.x + 3, FEET - 54, 20, 18, C.TUBE);
    const lit = [C.AQUA, C.ORANGE, C.MAUVE];
    for (let k = 0; k < 3; k += 1)
      p.rr(
        o.x + 6 + k * 5,
        FEET - 50 + hash(seed, k, Math.floor(t * 3)) * 10,
        2,
        2,
        lit[k] ?? C.AQUA,
      );
    p.rr(o.x - 2, FEET - 34, 30, 4, C.GREY_D);
    p.rr(o.x + 6, FEET - 38, 2, 4, C.GREY);
    p.rr(o.x + 5, FEET - 39, 4, 2, C.ORANGE);
    return;
  }
  const c = ink(o.colour ?? (o.type === 'locker' ? 'tealDark' : 'grey'));
  const h = o.type === 'locker' ? 60 : 40;
  p.rr(o.x, FEET - h, 22, h, c);
  if (o.type === 'filing')
    for (let k = 0; k < 3; k += 1) {
      p.rr(o.x + 1, FEET - h + 1 + k * 13, 20, 1, C.GREY_D);
      p.rr(o.x + 8, FEET - h + 6 + k * 13, 6, 2, C.CREAM);
    }
  else for (let k = 0; k < 4; k += 1) p.rr(o.x + 6, FEET - h + 5 + k * 3, 10, 1, C.TUBE);
}

export function workbenchProp(p: RoomPen, o: Prop<'workbench'>, seed: number): void {
  const top = FEET - 24;
  p.rr(o.x + 2, top, 4, 24, C.WALNUT);
  p.rr(o.x + o.w - 6, top, 4, 24, C.WALNUT);
  p.rr(o.x + 4, FEET - 8, o.w - 8, 2, C.WALNUT_D);
  p.rr(o.x, top - 4, o.w, 4, C.TEAK);
  p.rr(o.x, top - 4, o.w, 1, C.TAN);
  p.rr(o.x + 4, top - 9, 8, 5, C.GREY_D); // the vise
  p.rr(o.x + 6, top - 11, 4, 2, C.GREY);
  for (let k = 0; k < 3; k += 1) {
    const x = o.x + 18 + k * 12 + hash(seed, k, 1) * 4;
    p.rr(x, top - 6, 7, 2, k === 1 ? C.RUST : C.GREY);
  }
}

export function boxesProp(p: RoomPen, o: Prop<'boxes'>, seed: number): void {
  let y = FEET;
  for (let k = 0; k < o.count; k += 1) {
    const w = 20 - (k % 2) * 4 + Math.round(hash(seed, k, 1) * 3);
    const h = 12 + Math.round(hash(seed, k, 2) * 4);
    const x = o.x + (k % 2) * 3 + Math.round(hash(seed, k, 3) * 2);
    y -= h;
    p.rr(x, y, w, h, k % 2 ? C.TEAK : C.TAN);
    p.rr(x, y + 3, w, 1, C.WALNUT);
    p.rr(x + w / 2 - 1, y, 2, 3, C.CREAM);
  }
}

export function instrumentProp(p: RoomPen, o: Prop<'instrument'>): void {
  if (o.type === 'drum') {
    p.rr(o.x, FEET - 18, 22, 18, C.RUST);
    p.rr(o.x, FEET - 18, 22, 2, C.CREAM);
    for (let k = 0; k < 4; k += 1)
      p.rline(o.x + 2 + k * 6, FEET - 16, o.x + 5 + k * 6, FEET - 2, C.GREY, 1);
    return;
  }
  p.rline(o.x + 10, FEET - 18, o.x + 18, FEET - 58, C.WALNUT, 3);
  p.rr(o.x + 16, FEET - 62, 4, 5, C.WALNUT_D);
  p.rell(o.x + 8, FEET - 9, 8, 9, C.TEAK);
  p.rell(o.x + 10, FEET - 19, 6, 6, C.TEAK);
  p.rell(o.x + 9, FEET - 13, 2.2, 2.2, C.WALNUT_D);
}
