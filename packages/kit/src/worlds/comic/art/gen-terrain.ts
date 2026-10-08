/**
 * Terrain and skies in the comic grammar (PLAN.md#13.15a): `art.sky` (day, dawn, dusk, night,
 * storm, overcast, underwater, space; sun, moon, stars, drifting clouds), `art.land` (the ground
 * under a horizon: meadow, dirt, sand, snow, rock, seabed, road, cobbles), `art.hills`,
 * `art.sea`. Each fills a `box` [x, y, w, h] (default the page) with halftone screens of whole
 * inks; farther layers are paler (aerial perspective in at most three value steps). Dunes, forest
 * rows and skylines: gen-terrain-rows.ts.
 */
import { z } from 'zod';
import { clamp01, noise2, rnd } from '../draw/math.js';
import type { ComicPen } from '../page/pen.js';
import { artKey, colorSchema, seedSchema } from './common.js';
import { Sketch } from './sketch.js';

export const boxSchema = z
  .tuple([z.number(), z.number(), z.number().positive(), z.number().positive()])
  .default([0, 0, 640, 360]);
export const horizonSchema = z
  .number()
  .min(0)
  .max(1)
  .default(0.62)
  .describe('Horizon height as a share of the box');
export const timeSchema = z.number().optional();

export type Box = readonly [number, number, number, number];

export function sketchAt(g: ComicPen, key: string): Sketch {
  return new Sketch(g, { x: 0, y: 0, k: 1, flip: false, angle: 0, key });
}

export const SKIES = [
  'day',
  'dawn',
  'dusk',
  'night',
  'storm',
  'overcast',
  'underwater',
  'space',
] as const;

export const skySchema = z.strictObject({
  box: boxSchema,
  kind: z.enum(SKIES).default('day'),
  horizon: horizonSchema,
  sun: z
    .union([z.boolean(), z.tuple([z.number(), z.number()])])
    .default(false)
    .describe('true or [x, y]'),
  moon: z.union([z.boolean(), z.tuple([z.number(), z.number()])]).default(false),
  stars: z.int().min(0).max(300).optional(),
  clouds: z.int().min(0).max(12).optional(),
  seed: seedSchema,
  t: timeSchema,
});

const SKY_INKS: Readonly<
  Record<(typeof SKIES)[number], readonly [dots: string, on: string, top: number, bottom: number]>
> = {
  day: ['cyan', 'paper', 0.42, 0.08],
  dawn: ['yellow', 'yellowPale', 0.05, 0.4],
  dusk: ['magenta', 'yellow', 0.55, 0.1],
  night: ['cyanDeep', 'night', 0.5, 0.15],
  storm: ['greyDark', 'greyMid', 0.6, 0.2],
  overcast: ['greyMid', 'greyLight', 0.3, 0.12],
  underwater: ['night', 'cyanDeep', 0.1, 0.65],
  space: ['night', 'ink', 0.4, 0.1],
};

export function drawSky(g: ComicPen, o: z.output<typeof skySchema>): void {
  const [bx, by, bw, bh] = o.box;
  const key = artKey(`sky-${o.kind}`, o.seed);
  const t = o.t ?? g.t;
  const [dots, on, top, bottom] = SKY_INKS[o.kind];
  const hy = by + bh * o.horizon;
  const level = (_lx: number, ly: number) =>
    top + (bottom - top) * clamp01((ly - by) / (hy - by || 1));
  g.plate.rect(bx - 4, by - 4, bw + 8, bh + 8, g.tone(dots, level, { cell: 4, angle: 0.26, on }));
  const sk = sketchAt(g, key);
  const dark = o.kind === 'night' || o.kind === 'space';
  const starCount = o.stars ?? (dark ? 40 : 0);
  for (let i = 0; i < starCount; i += 1) {
    const [x, y] = [bx + rnd(key, i) * bw, by + rnd(key, i + 400) * (hy - by)];
    const twinkle = rnd(key, i * 3 + Math.floor(t * 4)) < 0.15;
    if (i % 9 === 0) {
      sk.line(x - 3, y, x + 3, y, 'paper', 1);
      sk.line(x, y - 3, x, y + 3, 'paper', 1);
    } else if (!twinkle) g.rect(x, y, 1, 1, i % 4 === 0 ? 'yellowPale' : 'paper');
  }
  if (o.kind === 'underwater') {
    for (let i = 0; i < 5; i += 1) {
      const x = bx + bw * (0.1 + i * 0.2) + Math.sin(t * 0.4 + i) * 10;
      g.plate.poly(
        [x, by, x + 18, by, x + 60, by + bh, x + 30, by + bh],
        g.tone('cyan', 0.45, { cell: 3, angle: 0.9 }),
      );
    }
  }
  const at = (
    value: boolean | readonly [number, number],
    fx: number,
    fy: number,
  ): [number, number] | undefined =>
    value === false
      ? undefined
      : value === true
        ? [bx + bw * fx, by + (hy - by) * fy]
        : [value[0], value[1]];
  const sun = at(o.sun, 0.78, 0.32);
  if (sun !== undefined) {
    const r = Math.min(bw, bh) * 0.09;
    const s = sk.sub(sun[0], sun[1]);
    for (let i = 0; i < 10; i += 1) {
      const a = (i / 10) * Math.PI * 2 + t * 0.1;
      s.stroke(
        [
          Math.cos(a) * r * 1.3,
          Math.sin(a) * r * 1.3,
          Math.cos(a) * r * 1.7,
          Math.sin(a) * r * 1.7,
        ],
        { w: 'outer', color: 'yellow' },
      );
    }
    s.oval(0, 0, r, r, 'yellow', { shade: 0.25, outline: 'inner' });
  }
  const moon = at(o.moon, 0.22, 0.28);
  if (moon !== undefined) {
    const r = Math.min(bw, bh) * 0.07;
    const m = sk.sub(moon[0], moon[1]);
    m.oval(0, 0, r, r, 'yellowPale', { outline: 'inner' });
    m.flat(
      g.ellipsePts(r * 0.45, -r * 0.2, r * 0.85, r * 0.85, 18),
      g.tone(dots, top, { cell: 4, angle: 0.26, on }),
    );
  }
  const cloudCount =
    o.clouds ??
    (o.kind === 'day' || o.kind === 'storm' || o.kind === 'overcast'
      ? 3
      : o.kind === 'dawn' || o.kind === 'dusk'
        ? 2
        : 0);
  for (let i = 0; i < cloudCount; i += 1) {
    const w = bw * (0.14 + rnd(key, i + 900) * 0.1);
    const x = bx + ((rnd(key, i + 800) * bw + t * (3 + i)) % (bw + w)) - w / 2;
    const y = by + (hy - by) * (0.15 + rnd(key, i + 700) * 0.45);
    cloud(
      sk.sub(x, y, w / 100),
      o.kind === 'storm' ? 'greyMid' : o.kind === 'dusk' ? 'yellowPale' : 'paper',
      `${key}c${String(i)}`,
    );
  }
}

function cloud(sk: Sketch, fill: string, key: string): void {
  const parts: { e: [number, number, number, number] }[] = [];
  for (let i = 0; i < 5; i += 1)
    parts.push({
      e: [
        -38 + i * 19,
        -8 - Math.sin((i / 4) * Math.PI) * 12 + rnd(key, i) * 4,
        18 + rnd(key, i + 5) * 6,
        13,
      ],
    });
  parts.push({ e: [0, 0, 50, 10] });
  sk.blob(parts, sk.shadePaint(fill, 0.35, undefined, sk.map([-60, -30, 60, 12])));
}

export const LANDS = [
  'meadow',
  'dirt',
  'sand',
  'snow',
  'rock',
  'seabed',
  'road',
  'cobbles',
  'floor',
  'deck',
] as const;
const LAND_INKS: Readonly<Record<(typeof LANDS)[number], readonly [dots: string, on: string]>> = {
  meadow: ['cyanDeep', 'phosphor'],
  dirt: ['sepiaMid', 'aged'],
  sand: ['magenta', 'yellowPale'],
  snow: ['greyLight', 'paper'],
  rock: ['greyDark', 'greyMid'],
  seabed: ['sepiaTan', 'shade'],
  road: ['ink', 'greyDark'],
  cobbles: ['greyDark', 'greyLight'],
  floor: ['sepiaMid', 'sepiaTan'],
  deck: ['greyMid', 'greyLight'],
};

export const landSchema = z.strictObject({
  box: boxSchema,
  kind: z.enum(LANDS).default('meadow'),
  horizon: horizonSchema,
  fill: colorSchema.optional(),
  tilt: z.number().min(-0.3).max(0.3).default(0),
  seed: seedSchema,
});

export function drawLand(g: ComicPen, o: z.output<typeof landSchema>): number {
  const [bx, by, bw, bh] = o.box;
  const key = artKey(`land-${o.kind}`, o.seed);
  const [dots, base] = LAND_INKS[o.kind];
  const on = o.fill ?? base;
  const hy = by + bh * o.horizon;
  const edge: number[] = [];
  for (let i = 0; i <= 16; i += 1) {
    const x = bx - 4 + ((bw + 8) * i) / 16;
    edge.push(x, hy + (x - bx - bw / 2) * o.tilt + (noise2(key, x, 0, 60) - 0.5) * 4);
  }
  const tone = (_lx: number, ly: number) => 0.1 + 0.4 * clamp01((ly - hy) / (by + bh - hy || 1));
  const ground = [...edge, bx + bw + 4, by + bh + 4, bx - 4, by + bh + 4];
  g.plate.poly(ground, g.tone(dots, tone, { cell: 4, angle: 0.78, on }));
  const sk = sketchAt(g, key);
  const marks = o.kind === 'road' || o.kind === 'floor' || o.kind === 'deck' ? 0 : 26;
  for (let i = 0; i < marks; i += 1) {
    const d = rnd(key, i + 50);
    const x = bx + rnd(key, i) * bw;
    const y = hy + 4 + d * d * (by + bh - hy - 4);
    const s = 2 + d * 8;
    if (o.kind === 'meadow')
      sk.stroke([x - s * 0.4, y, x, y - s, x + s * 0.4, y], { color: 'cyanDeep' });
    else if (o.kind === 'cobbles' || o.kind === 'rock' || o.kind === 'seabed')
      sk.oval(x, y, s, s * 0.45, o.kind === 'seabed' ? 'aged' : 'greyMid', { outline: 'inner' });
    else sk.line(x - s, y, x + s, y, dots, 1);
  }
  if (o.kind === 'road') {
    for (let i = 0; i < 6; i += 1) {
      const y = hy + (by + bh - hy) * (0.15 + i * 0.16);
      const w = 6 + i * 6;
      sk.flat(
        [
          bx + bw / 2 - w / 2,
          y,
          bx + bw / 2 + w / 2,
          y,
          bx + bw / 2 + w * 0.55,
          y + 3 + i,
          bx + bw / 2 - w * 0.55,
          y + 3 + i,
        ],
        'yellowPale',
      );
    }
  }
  if (o.kind === 'floor' || o.kind === 'deck') {
    for (let i = -8; i <= 8; i += 1)
      sk.line(bx + bw / 2 + i * 12, hy, bx + bw / 2 + i * 60, by + bh + 4, dots, 1);
  }
  g.ink(edge, { closed: false, boil: 0.5, key: `${key}edge` });
  return hy;
}

export const hillsSchema = z.strictObject({
  box: boxSchema,
  horizon: horizonSchema,
  layers: z.int().min(1).max(3).default(2),
  fill: colorSchema.default('phosphor'),
  height: z.number().min(0.02).max(0.9).default(0.22).describe('Hill height as a share of the box'),
  snow: z.boolean().default(false).describe('Snow caps (mountains)'),
  peaks: z.boolean().default(false).describe('Jagged mountains instead of rolling hills'),
  seed: seedSchema,
});

export function drawHills(g: ComicPen, o: z.output<typeof hillsSchema>): void {
  const [bx, by, bw, bh] = o.box;
  const key = artKey('hills', o.seed);
  const hy = by + bh * o.horizon;
  for (let layer = o.layers - 1; layer >= 0; layer -= 1) {
    const amp = bh * o.height * (1 - layer * 0.25);
    const pts: number[] = [];
    const n = o.peaks ? 9 : 24;
    for (let i = 0; i <= n; i += 1) {
      const x = bx - 6 + ((bw + 12) * i) / n;
      const h = o.peaks
        ? i % 2 === 0
          ? 0.25
          : 0.7 + rnd(key, layer * 50 + i) * 0.3
        : noise2(`${key}${String(layer)}`, x, 0, bw / 3);
      pts.push(x, hy - amp * h + layer * -amp * 0.35);
    }
    const shape = [...pts, bx + bw + 6, hy + 2, bx - 6, hy + 2];
    const far = layer > 0;
    const paint = far
      ? g.tone(o.fill === 'phosphor' ? 'cyan' : 'greyLight', 0.4, {
          cell: 4,
          angle: 0.5,
          on: 'greyLight',
        })
      : g.tone(o.fill === 'phosphor' ? 'cyanDeep' : 'greyDark', 0.35, {
          cell: 3,
          angle: 0.78,
          on: o.fill,
        });
    g.plate.poly(shape, paint);
    if (o.snow) {
      for (let i = 1; i < pts.length - 2; i += 4) {
        const [x, y] = [pts[i - 1] ?? 0, pts[i] ?? 0];
        if (y < hy - amp * 0.75)
          g.plate.poly(
            [x, y, x + amp * 0.18, y + amp * 0.22, x - amp * 0.18, y + amp * 0.22],
            'paper',
          );
      }
    }
    g.ink(pts, { closed: false, boil: 0.5, key: `${key}l${String(layer)}`, w: far ? 1 : g.w(1.5) });
  }
}

export const seaSchema = z.strictObject({
  box: boxSchema,
  horizon: horizonSchema,
  fill: colorSchema.default('cyan'),
  waves: z.int().min(0).max(60).default(16),
  rough: z.number().min(0).max(1).default(0.3),
  seed: seedSchema,
  t: timeSchema,
});

export function drawSea(g: ComicPen, o: z.output<typeof seaSchema>): void {
  const [bx, by, bw, bh] = o.box;
  const key = artKey('sea', o.seed);
  const t = o.t ?? g.t;
  const hy = by + bh * o.horizon;
  const level = (_lx: number, ly: number) => 0.15 + 0.45 * clamp01((ly - hy) / (by + bh - hy || 1));
  g.plate.rect(
    bx - 4,
    hy,
    bw + 8,
    by + bh - hy + 4,
    g.tone('cyanDeep', level, { cell: 4, angle: 0.26, on: o.fill }),
  );
  const sk = sketchAt(g, key);
  for (let i = 0; i < o.waves; i += 1) {
    const d = (i + 0.5) / o.waves;
    const y = hy + 3 + d * d * (by + bh - hy - 6);
    const w = 8 + d * 34;
    const x = bx + ((rnd(key, i) * bw + t * (6 + d * 20)) % (bw + w)) - w / 2;
    const lift = (1 + o.rough * 3) * (1 + d * 2);
    sk.stroke([x - w / 2, y, x - w * 0.15, y - lift, x + w * 0.15, y - lift * 0.6, x + w / 2, y], {
      color: d > 0.5 ? 'paper' : 'cyanDeep',
      w: d > 0.5 ? 'outer' : 'inner',
    });
  }
  g.ink([bx - 4, hy, bx + bw + 4, hy], { closed: false, boil: 0.3, key: `${key}h` });
}
