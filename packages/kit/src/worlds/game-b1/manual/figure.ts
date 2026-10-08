/**
 * FIG. 1 of the instruction manual: a bad-print diagram built from the world's own shapes (the
 * cartridge, its retail box, a person, a house), set out as a shelf, a pile or a queue. Drawn into
 * two printing buffers: the key plate (values 1..250 = a halftone tone, 255 = solid ink, 0 =
 * knocked out to paper) and the colour plate (only the `hit` item is printed in colour). The
 * copies are never quite the same: each leans, its marks sit off, its tone differs (seeded).
 */
import type { IndexCanvas } from '../core/canvas.js';
import { hash } from '../core/math.js';

export const SHAPES = ['cartridge', 'box', 'person', 'house'] as const;
export type Shape = (typeof SHAPES)[number];
export const LAYOUTS = ['shelf', 'pile', 'queue'] as const;
export type Layout = (typeof LAYOUTS)[number];

/** A halftone tone 0..1 as a key-buffer value. */
export const tone = (v: number): number => Math.max(1, Math.round(v * 250));
export const SOLID = 255;

/** The figure panel on the left page (print space px). */
export const PANEL = { x1: 278, y0: 70, y1: 240 } as const;

export interface Item {
  readonly x: number;
  /** Bottom edge (where it stands). */
  readonly base: number;
  readonly lean: number;
  readonly s: number;
  readonly tone: number;
  /** Mark offset and size variation of a copy. */
  readonly mark: readonly [number, number, number];
  readonly bar: number;
  readonly hit: boolean;
}

/** Local -> print space: lean about the bottom centre, dropped so the lowest corner rests. */
function placer(o: Item, halfWidth: number) {
  const co = Math.cos(o.lean);
  const si = Math.sin(o.lean);
  const drop = Math.abs(halfWidth * o.s * si);
  const P = (lx: number, ly: number): [number, number] => [
    o.x + (lx * co - ly * si) * o.s,
    o.base + (lx * si + ly * co) * o.s - drop,
  ];
  const box = (x0: number, y0: number, x1: number, y1: number): number[] => [
    ...P(x0, y0),
    ...P(x1, y0),
    ...P(x1, y1),
    ...P(x0, y1),
  ];
  return { P, box };
}

function outline(cv: IndexCanvas, pts: readonly number[]): void {
  for (let k = 0; k < 4; k += 1) {
    const j = (k + 1) % 4;
    cv.line(pts[k * 2] ?? 0, pts[k * 2 + 1] ?? 0, pts[j * 2] ?? 0, pts[j * 2 + 1] ?? 0, SOLID);
  }
}

function star(
  cv: IndexCanvas,
  P: (x: number, y: number) => number[],
  at: readonly number[],
  c: number,
) {
  const [sx = 0, sy = 0, r = 6] = at;
  const pts: number[] = [];
  for (let k = 0; k < 10; k += 1) {
    const rr = k % 2 === 1 ? r * 0.45 : r;
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    pts.push(...P(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr));
  }
  cv.poly(pts, c);
}

/** Half widths of the shapes in local units (layout spacing). */
export const HALF_WIDTH: Readonly<Record<Shape, number>> = {
  cartridge: 20,
  box: 18,
  person: 11,
  house: 22,
};
export const HEIGHT: Readonly<Record<Shape, number>> = {
  cartridge: 48,
  box: 50,
  person: 52,
  house: 46,
};

function cartridge(cv: IndexCanvas, o: Item, plate: boolean): void {
  const { P, box } = placer(o, 20);
  const [mx, my, mr] = o.mark;
  const markAt = [mx, -20.5 + my, 6 + mr];
  if (plate) {
    if (!o.hit) return;
    cv.poly(box(-16, -31, 16, -3), tone(0.5));
    star(cv, P, markAt, SOLID);
    return;
  }
  cv.poly(box(-20, -48, 20, 0), tone(o.tone));
  cv.poly(box(-20, -48, 20, -33), SOLID);
  for (let k = 0; k < 4; k += 1) {
    const [ax, ay] = P(-16, -45 + k * 3);
    const [bx, by] = P(16, -45 + k * 3);
    cv.line(ax, ay, bx, by, 0);
  }
  const label = box(-16, -31, 16, -3);
  cv.poly(label, o.hit ? 0 : tone(0.09));
  outline(cv, label);
  cv.poly(box(-13, -28, 13, -13), SOLID);
  star(cv, P, markAt, 0);
  cv.poly(box(-12, -10, -12 + o.bar, -7), SOLID);
  outline(cv, box(-20, -48, 20, 0));
}

function retailBox(cv: IndexCanvas, o: Item, plate: boolean): void {
  const { P, box } = placer(o, 18);
  const [mx, my, mr] = o.mark;
  if (plate) {
    if (!o.hit) return;
    cv.poly(box(-14, -37, 14, -12), tone(0.5));
    star(cv, P, [mx, -25 + my, 7 + mr], SOLID);
    return;
  }
  cv.poly(box(-18, -50, 18, 0), tone(o.tone));
  cv.poly(box(-18, -50, 18, -41), SOLID);
  const art = box(-14, -37, 14, -12);
  cv.poly(art, o.hit ? 0 : tone(0.12));
  outline(cv, art);
  star(cv, P, [mx, -25 + my, 7 + mr], SOLID);
  cv.poly(box(-14, -8, -14 + o.bar * 1.4, -5), SOLID);
  outline(cv, box(-18, -50, 18, 0));
}

function person(cv: IndexCanvas, o: Item, plate: boolean): void {
  const { P, box } = placer(o, 11);
  const body = [...P(-9, -37), ...P(9, -37), ...P(7, -15), ...P(-7, -15)];
  if (plate) {
    if (o.hit) cv.poly(body, tone(0.55));
    return;
  }
  const [hx, hy] = P(o.mark[0] * 0.3, -45);
  cv.ellipse(hx, hy, 6 * o.s, 6.5 * o.s, SOLID);
  cv.poly(body, o.hit ? tone(0.15) : tone(o.tone));
  outline(cv, body);
  cv.poly(box(-6, -15, -1.5, 0), tone(Math.min(0.95, o.tone + 0.12)));
  cv.poly(box(1.5, -15, 6, 0), tone(Math.min(0.95, o.tone + 0.12)));
  const [ax, ay] = P(-9, -35);
  const [bx, by] = P(-12, -20 + o.mark[1]);
  cv.line(ax, ay, bx, by, SOLID, 2);
  const [cx, cy] = P(9, -35);
  const [dx, dy] = P(12, -21 - o.mark[1]);
  cv.line(cx, cy, dx, dy, SOLID, 2);
}

function house(cv: IndexCanvas, o: Item, plate: boolean): void {
  const { P, box } = placer(o, 22);
  const body = box(-18, -28, 18, 0);
  if (plate) {
    if (o.hit) cv.poly(body, tone(0.5));
    return;
  }
  cv.poly(body, tone(o.tone));
  outline(cv, body);
  cv.poly([...P(-22, -27), ...P(o.mark[0] * 0.4, -46), ...P(22, -27)], SOLID);
  cv.poly(box(-4, -14, 4, 0), 0);
  cv.poly(box(8, -22, 8 + 5 + o.mark[2], -16), 0);
}

const DRAW: Readonly<Record<Shape, (cv: IndexCanvas, o: Item, plate: boolean) => void>> = {
  cartridge,
  box: retailBox,
  person,
  house,
};

export function drawItem(cv: IndexCanvas, shape: Shape, o: Item, plate: boolean): void {
  DRAW[shape](cv, o, plate);
}

/** A copy's variation (seeded per item). */
export function variation(seed: number, i: number, hit: boolean) {
  const lean = hit ? 0 : (hash(seed, i, 1) - 0.5) * 0.3;
  const mark = [
    Math.round((hash(seed, i, 2) - 0.5) * 8),
    Math.round((hash(seed, i, 3) - 0.5) * 3),
    Math.round((hash(seed, i, 4) - 0.5) * 3),
  ] as const;
  return {
    lean,
    mark,
    bar: 6 + Math.floor(hash(seed, i, 5) * 12),
    tone: hit ? 0.66 : 0.7 + hash(seed, i, 6) * 0.12,
  };
}
