/**
 * The printed spread of the instruction manual, built once per page (it does not depend on t;
 * the marks that do are drawn per frame in marks.ts). Two plates on cream paper: the key ink
 * (WALNUT_D: the drawing as a 45-degree halftone, the type set in Rough Print on a sheet fed a
 * hair crooked) and the TEAL plate printed 3 / 2 px off-register and rotated differently (the hit,
 * the badges, the header rule). Then the paper (paper.ts): yellowed edges and turning corner, the crease
 * with its fold shadow and two staples, two coffee rings (the mug set down twice, one drip) and a
 * thumbprint at the corner pages get turned from.
 */
import { IndexCanvas } from '../core/canvas.js';
import { hash } from '../core/math.js';
import { C } from '../palette.js';
import { PANEL, SOLID, tone, variation, type Item } from './figure.js';
import { drawThing, thingSize } from './figure-thing.js';
import { LINE_PITCH, STEP_X, strikeIndex, strikeLine, type ManualPlan } from './manual-plan.js';
import { paper } from './paper.js';
import { print, printWidth, type Skew } from './print-font.js';

const W = 640;
const H = 360;
const ROT = -0.0065;
const PIV = { x: 320, y: 180 } as const;
const SKEW: Skew = { angle: ROT, px: PIV.x, py: PIV.y };
const PLATE = { dx: 3, dy: 2, rot: -0.0042 } as const;
const BADGE_X = 334;
const SHELF = 212;
const GROUND = 222;

/** Print space -> frame (the crooked feed). */
export function toFrame(u: number, v: number): [number, number] {
  const co = Math.cos(ROT);
  const si = Math.sin(ROT);
  return [PIV.x + (u - PIV.x) * co - (v - PIV.y) * si, PIV.y + (u - PIV.x) * si + (v - PIV.y) * co];
}

export interface PageMarks {
  /** Where each rule's pencil tick goes (frame px). */
  readonly ticks: readonly (readonly [number, number])[];
  /** The struck word's left / right x and baseline-ish y (frame px). */
  readonly strike:
    | {
        readonly x0: number;
        readonly x1: number;
        readonly y: number;
        /** The end of the struck line (a correction written after it). */
        readonly end: number;
        readonly endY: number;
      }
    | undefined;
}

export interface Page {
  readonly pixels: Uint8Array;
  readonly marks: PageMarks;
}

function items(plan: ManualPlan): Item[] {
  const { thing, layout, count, hit } = plan.figure;
  const { half, height } = thingSize(thing);
  const out: Item[] = [];
  const make = (i: number, x: number, base: number, s: number, lean?: number): Item => {
    const v = variation(plan.seed, i, i === hit);
    return {
      x,
      base,
      s,
      lean: lean ?? v.lean,
      tone: v.tone,
      mark: v.mark,
      bar: v.bar,
      hit: i === hit,
    };
  };
  if (layout === 'shelf') {
    const step = 238 / Math.max(1, count - 1);
    const s = Math.min(1.2, (step * 0.95) / (2 * half));
    for (let i = 0; i < count; i += 1) out.push(make(i, 16 + i * step, SHELF, s));
    return out;
  }
  if (layout === 'queue') {
    const step = 210 / Math.max(1, count - 1);
    const s = Math.min(1.3, (step * 0.8) / (2 * half));
    for (let i = 0; i < count; i += 1) {
      const lean = i === hit ? 0 : (hash(plan.seed, i, 21) - 0.5) * 0.12;
      out.push(make(i, 246 - i * step, GROUND, s, lean));
    }
    return out;
  }
  // a pile: rows of 1, 2, 3, ... from the top, each row standing on the one below
  let rows = 1;
  while ((rows * (rows + 1)) / 2 < count) rows += 1;
  const width = Math.max(2 * half, 26);
  const s = Math.min(1.15, 250 / (rows * width * 1.15), 148 / (height * (1 + (rows - 1) * 0.82)));
  const pitch = width * s * 1.15;
  for (let i = 0; i < count; i += 1) {
    let row = 0;
    while (((row + 1) * (row + 2)) / 2 <= i) row += 1;
    const k = i - (row * (row + 1)) / 2;
    const base = GROUND - (rows - 1 - row) * height * s * 0.82;
    const lean = i === hit ? 0 : (hash(plan.seed, i, 21) - 0.5) * 0.08;
    out.push(make(i, 139 + (k - row / 2) * pitch, base, s, lean));
  }
  return out;
}

function backdrop(key: IndexCanvas, plan: ManualPlan): void {
  const { x1, y0, y1 } = PANEL;
  const floor = plan.figure.layout === 'shelf' ? SHELF : GROUND;
  for (let y = y0 + 2; y < floor; y += 1)
    key.rect(0, y, x1, 1, tone(0.03 + 0.17 * ((y - y0) / (floor - y0)) ** 1.6));
  if (plan.figure.layout === 'shelf') {
    key.rect(0, SHELF, x1, 10, tone(0.4));
    key.rect(0, SHELF, x1, 1, SOLID);
    key.rect(0, SHELF + 9, x1, 1, SOLID);
    [30, 128, 222].forEach((tx, k) => {
      key.rect(tx, SHELF + 2, 15 + k * 3, 6, 0);
      key.rect(tx, SHELF + 2, 15 + k * 3, 1, SOLID);
    });
    for (let y = SHELF + 10; y < y1; y += 1)
      key.rect(0, y, x1, 1, tone(0.24 * (1 - (y - SHELF - 10) / (y1 - SHELF - 10)) + 0.03));
  } else {
    key.rect(0, GROUND, x1, 1, SOLID);
    for (let y = GROUND + 1; y < y1; y += 1)
      key.rect(0, y, x1, 1, tone(0.12 + (y - GROUND) * 0.004));
  }
}

function badge(
  cv: IndexCanvas,
  at: readonly [number, number],
  n: number,
  plate: boolean,
  seed: number,
) {
  const [cx, cy] = [Math.round(at[0]), Math.round(at[1])];
  if (plate) {
    cv.ellipse(cx, cy, 10, 10, SOLID);
    return;
  }
  cv.ellipse(cx, cy, 11.5, 11.5, 0);
  for (let a = 0; a < 64; a += 1) {
    const ang = (a / 64) * Math.PI * 2;
    cv.rect(
      Math.round(cx + Math.cos(ang) * 10.5) - 1,
      Math.round(cy + Math.sin(ang) * 10.5) - 1,
      2,
      2,
      SOLID,
    );
  }
  print(cv, String(n), { x: cx - (n === 1 ? 3 : 4), y: cy - 7, s: 2 }, SOLID, seed + n);
}

/**
 * A callout badge's centre: above its item when there is room (a shelf, a queue), else beside
 * its row, outside the pile, on the item's side of the figure.
 */
function callout(
  list: readonly Item[],
  item: Item,
  size: { half: number; height: number },
  layout: string,
  k: number,
) {
  const top = item.base - size.height * item.s;
  if (layout !== 'pile' && top - 54 >= PANEL.y0 + 16)
    return [Math.min(PANEL.x1 - 14, Math.max(14, item.x + 11)), top - 54 + k * 4] as [
      number,
      number,
    ];
  const row = list.filter((other) => Math.abs(other.base - item.base) < 1);
  const reach = size.half * item.s + 20;
  const right = item.x >= 139;
  const x = right
    ? Math.max(...row.map((other) => other.x)) + reach
    : Math.min(...row.map((other) => other.x)) - reach;
  return [Math.min(PANEL.x1 - 14, Math.max(14, x)), top + 12] as [number, number];
}

function figure(key: IndexCanvas, plate: IndexCanvas, plan: ManualPlan): void {
  const list = items(plan);
  backdrop(key, plan);
  const { thing } = plan.figure;
  const size = thingSize(thing);
  const behind = plan.figure.layout === 'pile' ? [...list].reverse() : list;
  for (const item of behind) drawThing(key, thing, item, false);
  for (const item of list) drawThing(plate, thing, item, true);
  const placed: [number, number][] = [];
  plan.figure.callouts.forEach((c, k) => {
    const item = list[c.item];
    if (item === undefined) return;
    const [bx, first] = callout(list, item, size, plan.figure.layout, k);
    let by = first;
    for (const [px, py] of placed) if (Math.hypot(px - bx, py - by) < 26) by += 26;
    placed.push([bx, by]);
    const top = item.base - size.height * item.s + 6;
    const [tx, ty] = [item.x + 3, top];
    const d = Math.hypot(tx - bx, ty - by) || 1;
    key.line(bx + ((tx - bx) / d) * 11, by + ((ty - by) / d) * 11, tx, ty, SOLID);
    key.rect(tx - 1, ty - 1, 3, 3, SOLID);
    badge(key, [bx, by], c.step, false, plan.seed);
    badge(plate, [bx, by], c.step, true, plan.seed);
  });
  const { x1, y0, y1 } = PANEL;
  key.rect(0, y0, x1, 2, SOLID);
  key.rect(x1, y0, 2, y1 - y0 + 2, SOLID);
  key.rect(0, y1, x1 + 2, 2, SOLID);
}

function typePlate(type: IndexCanvas, plate: IndexCanvas, plan: ManualPlan): PageMarks {
  const seed = plan.seed;
  const fig = print(type, 'FIG. 1', { x: 34, y: 250, s: 2 }, SOLID, seed + 40, SKEW);
  print(
    type,
    plan.figure.caption,
    { x: (fig.at(-1) ?? 34) + 14, y: 250, s: 2 },
    SOLID,
    seed + 41,
    SKEW,
  );
  print(type, plan.title, { x: 323, y: 44, s: 3 }, SOLID, seed + 50, SKEW);
  const [r0x, r0y] = toFrame(323, 73);
  const [r1x, r1y] = toFrame(323 + Math.max(200, printWidth(plan.title, 3) + 60), 73);
  type.line(r0x, r0y, r1x, r1y, SOLID);
  plate.rect(323, 70, Math.max(200, printWidth(plan.title, 3) + 60), 6, SOLID);
  let strike: PageMarks['strike'];
  const c = plan.correction;
  const ticks = plan.steps.map((step, i) => {
    badge(type, toFrame(BADGE_X, step.y + 7), i + 1, false, seed);
    badge(plate, [BADGE_X, step.y + 7], i + 1, true, seed);
    const struck = c !== undefined && c.step === i + 1 ? strikeLine(step, c.strike) : -1;
    step.lines.forEach((line, j) => {
      const y = step.y + j * LINE_PITCH;
      const x = STEP_X + (j > 0 && i % 2 === 1 ? 1 : 0);
      const xs = print(type, line, { x, y, s: 2 }, SOLID, seed + 60 + i * 7 + j, SKEW);
      if (j !== struck || c === undefined) return;
      const at = strikeIndex(line, c.strike);
      const x0 = xs[at] ?? x;
      const end = xs.at(-1) ?? x0;
      const lift = (px: number) => y + Math.round((px - PIV.x) * Math.sin(ROT));
      strike = { x0, x1: (xs[at + c.strike.length] ?? x0) - 2, y: lift(x0), end, endY: lift(end) };
    });
    return toFrame(306 + hash(seed, i, 31) * 3, step.y + 9);
  });
  return { ticks, strike };
}

/** Sigma-free halftone dot: is (u, v) inked at `level` on a screen of `period` px at `angle`? */
function dot(
  u: number,
  v: number,
  level: number,
  screen: readonly [number, number],
  seed: number,
  starve: number,
) {
  const [period, angle] = screen;
  const co = Math.cos(angle);
  const si = Math.sin(angle);
  const a = (u * co + v * si) / period;
  const b = (v * co - u * si) / period;
  const ia = Math.floor(a);
  const ib = Math.floor(b);
  const fa = a - ia - 0.5;
  const fb = b - ib - 0.5;
  const r = Math.sqrt(level / Math.PI) * (0.8 + 0.42 * hash(seed, ia * 1013 + ib, 3)) * starve;
  return fa * fa + fb * fb < r * r;
}

/** Ink starved on one pass of the roller: a soft band where the halftone prints thin. */
function starveAt(v: number): number {
  const d = Math.abs(v - 163) / 7;
  return d >= 1 ? 1 : 0.55 + 0.45 * d * d;
}

function composite(
  key: IndexCanvas,
  type: IndexCanvas,
  plate: IndexCanvas,
  seed: number,
): Uint8Array {
  const out = new Uint8Array(W * H);
  const kc = Math.cos(ROT);
  const ks = Math.sin(ROT);
  const pc = Math.cos(PLATE.rot);
  const ps = Math.sin(PLATE.rot);
  for (let y = 0; y < H; y += 1)
    for (let x = 0; x < W; x += 1) {
      let c: number = C.CREAM;
      const prx = x + 0.5 - PIV.x - PLATE.dx;
      const pry = y + 0.5 - PIV.y - PLATE.dy;
      const pu = Math.floor(PIV.x + prx * pc + pry * ps);
      const pv = Math.floor(PIV.y - prx * ps + pry * pc);
      const pval = pu >= 0 && pv >= 0 && pu < W && pv < H ? (plate.d[pv * W + pu] ?? 0) : 0;
      if (pval === SOLID || (pval > 0 && dot(pu, pv, pval / 250, [3.4, 0.26], seed + 2, 1)))
        c = C.TEAL;
      const krx = x + 0.5 - PIV.x;
      const kry = y + 0.5 - PIV.y;
      const ku = Math.floor(PIV.x + krx * kc + kry * ks);
      const kv = Math.floor(PIV.y - krx * ks + kry * kc);
      const kval = ku >= 0 && kv >= 0 && ku < W && kv < H ? (key.d[kv * W + ku] ?? 0) : 0;
      const inked =
        type.d[y * W + x] === SOLID ||
        kval === SOLID ||
        (kval > 0 && dot(ku, kv, kval / 250, [4.6, Math.PI / 4], seed + 1, starveAt(kv)));
      out[y * W + x] = inked ? C.WALNUT_D : c;
    }
  return out;
}

export function buildPage(plan: ManualPlan): Page {
  const key = new IndexCanvas(W, H);
  const type = new IndexCanvas(W, H);
  const plate = new IndexCanvas(W, H);
  figure(key, plate, plan);
  const marks = typePlate(type, plate, plan);
  const pixels = composite(key, type, plate, plan.seed);
  const sheet = new IndexCanvas(W, H);
  sheet.d.set(pixels);
  paper(sheet, plan.seed);
  return { pixels: sheet.d, marks };
}
