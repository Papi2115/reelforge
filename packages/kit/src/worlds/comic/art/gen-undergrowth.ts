/**
 * Small plants in the comic grammar (PLAN.md#13.15a): `art.bush`, `art.grass`, `art.flowers`,
 * `art.cactus` (saguaro, barrel, prickly) and `art.seaweed` (kelp, sea grass, coral); seeded so
 * two of a kind differ, swaying on the panel clock.
 */
import { z } from 'zod';
import { rnd } from '../draw/math.js';
import type { ComicPen } from '../page/pen.js';
import { artKey, colorSchema, placeShape, seedSchema, timeOf } from './common.js';
import { sketchFor, type Sketch } from './sketch.js';

export const bushSchema = z.strictObject({
  ...placeShape,
  size: z.number().min(0).max(600).default(40).describe('Height'),
  width: z.number().min(0.4).max(4).default(1.6).describe('Width / height'),
  fill: colorSchema.default('phosphor'),
  dots: colorSchema.optional().describe('Berries or blossoms'),
});

export function drawBush(g: ComicPen, o: z.output<typeof bushSchema>): void {
  const key = artKey('bush', o.seed);
  const sk = sketchFor(g, o, 100, key);
  const n = Math.max(3, Math.round(o.width * 3));
  const parts: { e: [number, number, number, number] }[] = [];
  for (let i = 0; i < n; i += 1) {
    const x = (i / (n - 1) - 0.5) * o.width * 70;
    const r = 26 + rnd(key, i) * 18;
    parts.push({ e: [x, -r * 0.9 - rnd(key, i + 9) * 18, r, r * 0.85] });
  }
  sk.blob(
    parts,
    sk.shadePaint(
      o.fill,
      0.5,
      o.fill === 'phosphor' ? 'cyanDeep' : undefined,
      sk.map([-o.width * 60, -100, o.width * 60, 0]),
    ),
  );
  if (o.dots !== undefined)
    for (let i = 0; i < 7; i += 1)
      sk.dot((rnd(key, i + 40) - 0.5) * o.width * 70, -20 - rnd(key, i + 50) * 60, 4, o.dots);
}

export const grassSchema = z.strictObject({
  x0: z.number(),
  x1: z.number(),
  y: z.number(),
  height: z.number().min(2).max(200).default(14),
  density: z.number().min(0.02).max(2).default(0.25).describe('Tufts per pen unit'),
  color: colorSchema.default('cyanDeep'),
  seed: seedSchema,
  t: placeShape.t,
});

export function drawGrass(g: ComicPen, o: z.output<typeof grassSchema>): void {
  const key = artKey('grass', o.seed);
  const n = Math.min(400, Math.max(1, Math.round(Math.abs(o.x1 - o.x0) * o.density)));
  const sway = Math.sin(timeOf(g, o.t) * 1.7) * o.height * 0.12;
  const w = Math.max(1, Math.round(g.s));
  for (let i = 0; i < n; i += 1) {
    const x = o.x0 + (o.x1 - o.x0) * ((i + rnd(key, i)) / n);
    const h = o.height * (0.6 + rnd(key, i + 500) * 0.6);
    for (const dx of [-0.35, 0, 0.3])
      g.line(x, o.y, x + dx * h + sway, o.y - h * (dx === 0 ? 1 : 0.75), o.color, w);
  }
}

export const flowersSchema = z.strictObject({
  x0: z.number(),
  x1: z.number(),
  y: z.number(),
  count: z.int().min(1).max(80).default(7),
  height: z.number().min(3).max(300).default(26),
  kind: z.enum(['daisy', 'tulip', 'sunflower', 'poppy', 'bell']).default('daisy'),
  colors: z.array(colorSchema).min(1).max(4).optional(),
  seed: seedSchema,
  t: placeShape.t,
});

export function drawFlowers(g: ComicPen, o: z.output<typeof flowersSchema>): void {
  const key = artKey('flowers', o.seed);
  const colors =
    o.colors ??
    {
      daisy: ['paper'],
      tulip: ['red', 'magenta', 'yellow'],
      sunflower: ['yellow'],
      poppy: ['red'],
      bell: ['cyan', 'magenta'],
    }[o.kind];
  const sway = Math.sin(timeOf(g, o.t) * 1.5);
  for (let i = 0; i < o.count; i += 1) {
    const x = o.x0 + (o.x1 - o.x0) * ((i + 0.5 + (rnd(key, i) - 0.5) * 0.8) / o.count);
    const h = o.height * (0.75 + rnd(key, i + 9) * 0.5);
    const sk = sketchFor(g, { x, y: o.y, size: h }, 100, `${key}${String(i)}`);
    const tip = sway * 4 + (rnd(key, i + 20) - 0.5) * 10;
    sk.stroke([0, 0, tip * 0.5, -50, tip, -92], { color: 'cyanDeep', w: 'outer' });
    sk.shape([tip * 0.3, -40, tip * 0.3 + 14, -52, tip * 0.3 + 4, -38], 'phosphor', {
      outline: 'inner',
    });
    const head = sk.sub(tip, -94);
    const color = colors[i % colors.length] ?? 'paper';
    if (o.kind === 'tulip')
      head.shape([-9, 0, -10, -14, -4, -8, 0, -16, 4, -8, 10, -14, 9, 0, 0, 6], color, {
        shade: 0.3,
      });
    else if (o.kind === 'bell')
      head.shape([-7, -8, 7, -8, 10, 8, 3, 5, 0, 9, -3, 5, -10, 8], color, { shade: 0.3 });
    else {
      const petals = o.kind === 'sunflower' ? 11 : o.kind === 'poppy' ? 4 : 8;
      const r = o.kind === 'sunflower' ? 20 : 12;
      for (let p = 0; p < petals; p += 1) {
        const a = (p / petals) * Math.PI * 2;
        head.oval(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6, r * 0.42, r * 0.42, color, {
          outline: 'inner',
        });
      }
      head.oval(0, 0, r * 0.4, r * 0.4, o.kind === 'daisy' ? 'yellow' : 'ink', {
        outline: 'inner',
      });
    }
  }
}

export const cactusSchema = z.strictObject({
  ...placeShape,
  kind: z.enum(['saguaro', 'barrel', 'prickly']).default('saguaro'),
  size: z.number().min(0).max(800).default(120),
  fill: colorSchema.default('phosphor'),
  bloom: colorSchema.optional(),
});

export function drawCactus(g: ComicPen, o: z.output<typeof cactusSchema>): void {
  const key = artKey(`cactus-${o.kind}`, o.seed);
  const sk = sketchFor(g, o, 100, key);
  const look = { shade: 0.5, shadeInk: 'cyanDeep' };
  if (o.kind === 'saguaro') {
    const arm = (side: number, y: number, h: number) => {
      sk.blob(
        [{ c: [0, y, side * 24, y, 7] }, { c: [side * 24, y, side * 24, y - h, 7] }],
        sk.shadePaint(o.fill, 0.5, 'cyanDeep', sk.map([-30, -100, 30, 0])),
      );
    };
    arm(-1, -42 - rnd(key, 1) * 10, 24 + rnd(key, 2) * 12);
    arm(1, -56 - rnd(key, 3) * 10, 18 + rnd(key, 4) * 14);
    sk.cap(0, -2, 0, -92, 11, o.fill, look);
    for (const x of [-5, 0, 5]) sk.line(x, -6, x, -96 + Math.abs(x) * 0.8, 'cyanDeep');
  } else if (o.kind === 'barrel') {
    sk.oval(0, -26, 26, 27, o.fill, look);
    for (const x of [-14, -5, 5, 14])
      sk.stroke([x * 0.8, -50, x, -26, x * 0.8, -2], { color: 'cyanDeep' });
  } else {
    for (const [x, y, r] of [
      [0, -22, 16],
      [-16, -50, 13],
      [14, -56, 12],
      [0, -80, 10],
    ] as const)
      sk.oval(x, y, r * 0.8, r, o.fill, look);
  }
  for (let i = 0; i < 10; i += 1)
    sk.dot((rnd(key, i + 30) - 0.5) * 30, -10 - rnd(key, i + 40) * 80, 0.9, 'paper');
  if (o.bloom !== undefined)
    sk.oval(0, o.kind === 'saguaro' ? -96 : -52, 6, 4, o.bloom, { outline: 'inner' });
}

export const seaweedSchema = z.strictObject({
  ...placeShape,
  kind: z.enum(['kelp', 'grass', 'coral']).default('kelp'),
  size: z.number().min(0).max(800).default(120),
  fill: colorSchema.optional(),
});

export function drawSeaweed(g: ComicPen, o: z.output<typeof seaweedSchema>): void {
  const key = artKey(`seaweed-${o.kind}`, o.seed);
  const sk = sketchFor(g, o, 100, key);
  const t = timeOf(g, o.t);
  if (o.kind === 'coral') {
    const fill = o.fill ?? 'magenta';
    coral(sk, 0, 0, -Math.PI / 2, 34, 3, key, fill);
    return;
  }
  const strands = o.kind === 'kelp' ? 3 : 7;
  for (let i = 0; i < strands; i += 1) {
    const x0 = (i - (strands - 1) / 2) * (o.kind === 'kelp' ? 12 : 6);
    const pts: number[] = [];
    for (let j = 0; j <= 8; j += 1)
      pts.push(x0 + Math.sin(t * 1.2 + j * 0.6 + i) * j * 1.6, -j * 12 * (0.7 + rnd(key, i) * 0.4));
    sk.stroke(pts, { color: o.fill ?? 'phosphor', w: 'outer' });
    if (o.kind === 'kelp') {
      for (let j = 2; j < 8; j += 2) {
        const [x, y] = [pts[j * 2] ?? 0, pts[j * 2 + 1] ?? 0];
        sk.shape([x, y, x + 10, y - 6, x + 3, y + 2], o.fill ?? 'phosphor', {
          outline: 'inner',
          shade: 0.3,
          shadeInk: 'cyanDeep',
        });
      }
    }
  }
}

function coral(
  sk: Sketch,
  x: number,
  y: number,
  a: number,
  len: number,
  depth: number,
  key: string,
  fill: string,
): void {
  if (depth === 0) return;
  for (let i = 0; i < 2; i += 1) {
    const turn = (i === 0 ? -1 : 1) * (0.3 + rnd(key, depth * 5 + i) * 0.4);
    const [ex, ey] = [x + Math.cos(a + turn) * len, y + Math.sin(a + turn) * len];
    sk.cap(x, y, ex, ey, 2 + depth * 1.6, fill, { shade: 0.3, outline: 'inner' });
    coral(sk, ex, ey, a + turn * 0.6, len * 0.68, depth - 1, `${key}${String(i)}`, fill);
  }
}
