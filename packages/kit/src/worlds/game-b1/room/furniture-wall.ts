/**
 * Wall props of the room DSL in room units: a window with its own sky and view (trees, a city, the
 * sea, hills, desert, snow, stars), a poster that prints one of the film's own sprites, a shelf of
 * whatever the film needs, a wall clock at a given time, a blackboard with chalk words from the
 * narration, a pegboard with tools. Crooked tape, an uneven sill, chalk smudges: the hand shows.
 */
import { hand } from '../core/hand.js';
import { hash } from '../core/math.js';
import { C, colorOfSwatch, SCAN } from '../palette.js';
import type { B1Sprite } from '../vocab/sprite.js';
import type { RoomProp } from './interior-schema.js';
import type { RoomPen } from './view.js';

type Prop<K extends RoomProp['kind']> = Extract<RoomProp, { kind: K }>;

export function ink(name: string): number {
  return colorOfSwatch(name) ?? C.GREY;
}

const SKY = {
  day: [C.BLUE, C.AQUA],
  dusk: [C.DUSK, C.MAUVE, C.ORANGE],
  night: [C.TUBE, C.NIGHT],
} as const;

function view(p: RoomPen, w: Prop<'window'>, t: number, seed: number): void {
  const [x0, y0, ww, hh] = [w.x + 3, w.y + 3, w.w - 6, w.h - 6];
  const ground = y0 + hh * 0.72;
  const dark = w.sky === 'night';
  const far = dark ? C.TUBE : w.sky === 'dusk' ? C.NIGHT : C.OLIVE_D;
  if (w.view === 'stars' || dark)
    for (let i = 0; i < 9; i += 1) {
      const on = hash(seed, i, Math.floor(t * (0.7 + hash(seed, i, 3)))) > 0.25;
      if (on) p.rr(x0 + hash(seed, i, 1) * ww, y0 + hash(seed, i, 2) * hh * 0.6, 1, 1, C.CREAM);
    }
  if (w.view === 'trees')
    for (let i = 0; i < ww; i += 5)
      p.rpoly(
        [
          Math.max(x0, x0 + i - 3),
          ground + 6,
          x0 + i + 2,
          ground - 8 - hash(seed, i, 4) * 6,
          Math.min(x0 + ww, x0 + i + 7),
          ground + 6,
        ],
        far,
      );
  if (w.view === 'trees') p.rr(x0, ground + 6, ww, y0 + hh - ground - 6, far);
  if (w.view === 'city')
    for (let i = 0; i < ww; i += 7) {
      const top = ground - 6 - hash(seed, i, 5) * 16;
      p.rr(x0 + i, top, Math.min(6, ww - i), y0 + hh - top, dark ? C.GREY_D : C.GREY);
      for (let wy = top + 2; wy < y0 + hh - 2; wy += 4)
        if (hash(seed, i, wy) > (dark ? 0.55 : 0.8))
          p.rr(x0 + i + 2, wy, 1, 1, dark ? C.GOLD : C.AQUA);
    }
  if (w.view === 'sea') {
    p.rr(x0, ground, ww, y0 + hh - ground, dark ? C.NIGHT : C.BLUE);
    for (let i = 0; i < 6; i += 1)
      p.rr(x0 + hash(seed, i, 6) * ww, ground + 2 + hash(seed, i, 7) * 8, 4, 1, C.AQUA);
  }
  if (w.view === 'hills' || w.view === 'desert' || w.view === 'snow') {
    const c = w.view === 'hills' ? far : w.view === 'desert' ? C.TAN : C.CREAM;
    const pts = [x0, y0 + hh];
    for (let i = 0; i <= ww; i += 4) pts.push(x0 + i, ground - Math.sin(i * 0.12 + seed) * 4);
    pts.push(x0 + ww, y0 + hh);
    p.rpoly(pts, c);
  }
}

export function windowProp(p: RoomPen, w: Prop<'window'>, t: number, seed: number): void {
  p.rr(w.x, w.y, w.w, w.h, C.TEAK);
  const sky = SKY[w.sky];
  const inner = w.h - 6;
  sky.forEach((c, i) => {
    p.rr(w.x + 3, w.y + 3 + (inner * i) / sky.length, w.w - 6, inner / sky.length + 1, c);
  });
  view(p, w, t, seed);
  p.rr(w.x + w.w / 2 - 1, w.y + 3, 2, w.h - 6, C.TEAK);
  p.rr(w.x + 3, w.y + w.h / 2 - 1, w.w - 6, 2, C.TEAK);
  p.rr(w.x - 2, w.y + w.h, w.w + 4, 3, C.TAN);
  p.rr(w.x - 2, w.y + w.h + 2, w.w + 5, 1, C.WALNUT_D);
}

/** The film's sprite printed big on paper (square pixels, one ink per row as on the TV). */
export function posterProp(p: RoomPen, o: Prop<'poster'>, sprite: B1Sprite | undefined): void {
  if (o.frame === 'frame') p.rr(o.x - 2, o.y - 2, o.w + 4, o.h + 4, C.WALNUT_D);
  p.rr(o.x, o.y, o.w, o.h, ink(o.colour));
  p.rr(o.x + 1, o.y + o.h - 1, o.w - 1, 1, C.WALNUT_D);
  if (sprite !== undefined) {
    const rows = sprite.frames[0] ?? [];
    const k = Math.max(
      1,
      Math.floor(Math.min((o.w - 6) / sprite.width, (o.h - 6) / (rows.length * sprite.rowH))),
    );
    const sx = o.x + Math.round((o.w - sprite.width * k) / 2);
    const sy = o.y + Math.round((o.h - rows.length * sprite.rowH * k) / 2);
    rows.forEach((row, r) => {
      const name = sprite.colours[r];
      if (name === null || name === undefined) return;
      for (let b = 0; b < row.length; b += 1)
        if (row[b] === '#')
          p.rr(sx + b * k, sy + r * sprite.rowH * k, k, sprite.rowH * k, ink(name));
    });
  }
  if (o.frame === 'poster') {
    p.rr(o.x - 1, o.y - 1, 4, 2, C.CREAM);
    p.rr(o.x + o.w - 2, o.y, 3, 2, C.CREAM); // the second strip of tape sits lower
  }
}

const SHELF_INKS = [C.ORANGE, C.TEAL, C.AVOCADO, C.MAUVE, C.BLUE, C.GOLD, C.RUST];

function shelfItem(
  p: RoomPen,
  kind: Prop<'shelf'>['items'],
  x: number,
  base: number,
  i: number,
  seed: number,
): number {
  const r = (salt: number) => hash(seed, i, salt);
  const c = SHELF_INKS[Math.floor(r(1) * SHELF_INKS.length)] ?? C.TEAL;
  switch (kind) {
    case 'books': {
      const h = 8 + Math.floor(r(2) * 5);
      p.rr(x, base - h, 2 + Math.floor(r(3) * 2), h, c);
      return 3 + Math.floor(r(3) * 2);
    }
    case 'cartridges':
      p.rr(x, base - 9, 5, 9, C.GREY_D);
      p.rr(x + 1, base - 6, 3, 2, c);
      return 6;
    case 'boxes':
      p.rr(x, base - 8, 9, 8, r(4) > 0.5 ? C.TAN : C.TEAK);
      p.rr(x, base - 5, 9, 1, C.WALNUT);
      return 10;
    case 'papers':
      for (let k = 0; k < 3; k += 1)
        p.rr(x + Math.round(r(5 + k) * 2), base - 2 - k * 2, 9, 2, k % 2 ? C.CREAM : C.WHITE);
      return 12;
    case 'tools':
      p.rr(x, base - 2, 8, 2, C.GREY);
      p.rr(x + (r(6) > 0.5 ? 0 : 5), base - 5, 3, 3, C.GREY_D);
      return 10;
    case 'jars':
      p.rr(x, base - 7, 5, 7, r(7) > 0.5 ? C.AQUA : C.TAN);
      p.rr(x, base - 8, 5, 1, C.GREY_D);
      return 7;
    case 'trophies':
      p.rr(x + 1, base - 8, 4, 4, C.GOLD);
      p.rr(x + 2, base - 4, 2, 2, C.GOLD);
      p.rr(x, base - 2, 6, 2, C.WALNUT);
      return 8;
    case 'records':
      p.rr(x, base - 10, 1, 10, r(8) > 0.3 ? C.TUBE : c);
      return 2;
  }
}

export function shelfProp(p: RoomPen, o: Prop<'shelf'>, seed: number): void {
  for (let row = 0; row < o.rows; row += 1) {
    const base = o.y + row * 16;
    let x = o.x + 1;
    let i = row * 40;
    while (x < o.x + o.w - 4) {
      x += shelfItem(p, o.items, x, base, i, seed) + (hash(seed, i, 9) > 0.8 ? 3 : 0);
      i += 1;
    }
    p.rr(o.x, base, o.w, 2, C.TEAK);
    p.rr(o.x, base + 2, o.w, 1, C.WALNUT_D);
  }
}

export function clockProp(p: RoomPen, o: Prop<'clock'>): void {
  const [hh, mm] = o.time.split(':').map(Number);
  p.rell(o.x + 7, o.y + 7, 8, 8, C.WALNUT);
  p.rell(o.x + 7, o.y + 7, 6.5, 6.5, C.CREAM);
  const minute = ((mm ?? 0) / 60) * Math.PI * 2 - Math.PI / 2;
  const hour = ((((hh ?? 0) % 12) + (mm ?? 0) / 60) / 12) * Math.PI * 2 - Math.PI / 2;
  p.rline(
    o.x + 7,
    o.y + 7,
    o.x + 7 + Math.cos(minute) * 5.5,
    o.y + 7 + Math.sin(minute) * 5.5,
    C.WALNUT_D,
    1,
  );
  p.rline(
    o.x + 7,
    o.y + 7,
    o.x + 7 + Math.cos(hour) * 3.5,
    o.y + 7 + Math.sin(hour) * 3.5,
    C.WALNUT_D,
    2,
  );
}

export function blackboardProp(p: RoomPen, o: Prop<'blackboard'>, seed: number): void {
  p.rr(o.x - 3, o.y - 3, o.w + 6, o.h + 6, C.TEAK);
  p.rr(o.x, o.y, o.w, o.h, C.OLIVE_D);
  for (let i = 0; i < 4; i += 1)
    // smudges of old chalk
    p.rd(
      o.x + hash(seed, i, 1) * (o.w - 20),
      o.y + hash(seed, i, 2) * (o.h - 8),
      20,
      6,
      C.GREY_D,
      0.25,
    );
  o.lines.forEach((line, i) => {
    hand(p.cv, line, {
      x: p.X(o.x + 5),
      y: p.Y(o.y + 5 + i * 13),
      size: p.s * 1.2,
      seed: seed + i * 7,
      colour: C.CREAM,
      slant: 0.12,
      brush: Math.max(1, Math.round(p.s / 2)),
    });
  });
  p.rr(o.x - 3, o.y + o.h + 3, o.w + 6, 2, C.WALNUT);
  p.rr(o.x + o.w - 16, o.y + o.h + 2, 4, 1, C.WHITE);
}

export function pegboardProp(p: RoomPen, o: Prop<'pegboard'>, seed: number): void {
  p.rr(o.x, o.y, o.w, o.h, C.TAN);
  for (let y = o.y + 3; y < o.y + o.h; y += 5)
    for (let x = o.x + 3; x < o.x + o.w; x += 5) p.rr(x, y, 1, 1, C.TEAK);
  let x = o.x + 5;
  let i = 0;
  while (x < o.x + o.w - 8) {
    const kind = Math.floor(hash(seed, i, 3) * 3);
    if (kind === 0) {
      p.rr(x + 2, o.y + 6, 2, 16, C.WALNUT); // hammer
      p.rr(x, o.y + 5, 6, 3, C.GREY_D);
    } else if (kind === 1) {
      p.rr(x + 1, o.y + 6, 2, 18, C.GREY); // wrench
      p.rr(x, o.y + 5, 4, 3, C.GREY);
    } else {
      p.rpoly([x, o.y + 6, x + 8, o.y + 6, x + 8, o.y + 10, x, o.y + 22], C.GREY); // saw
      p.rr(x + 6, o.y + 4, 3, 5, C.RUST);
    }
    x += 11 + Math.floor(hash(seed, i, 4) * 4);
    i += 1;
  }
  p.rmap(o.x, o.y + o.h - 2, o.w, 2, SCAN);
}
