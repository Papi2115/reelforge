/**
 * Comic effects (PLAN.md#13.15a): `art.effect` draws the marks a comic uses for what a still
 * picture cannot show - an impact star, motion lines, sweat drops, sparkles, steam, smoke, rain,
 * snow, fire, dust, bubbles, a splash, sleep Zs, hearts, a lightning bolt, emphasis lines. Placed
 * by their centre (rain and snow fill a `box`); animated on the panel clock, seeded.
 */
import { z } from 'zod';
import { rnd } from '../draw/math.js';
import type { ComicPen } from '../page/pen.js';
import { artKey, colorSchema, placeShape, timeOf } from './common.js';
import { boxSchema } from './gen-terrain.js';
import { Sketch, sketchFor } from './sketch.js';

export const EFFECTS = [
  'impact',
  'motion',
  'sweat',
  'sparkle',
  'steam',
  'smoke',
  'rain',
  'snow',
  'fire',
  'dust',
  'bubbles',
  'splash',
  'zzz',
  'hearts',
  'lightning',
  'emphasis',
] as const;

export const effectSchema = z.strictObject({
  ...placeShape,
  x: z.number().default(320),
  y: z.number().default(180),
  kind: z.enum(EFFECTS),
  size: z.number().min(0).max(1200).default(60),
  color: colorSchema.optional(),
  angle: z.number().default(0).describe('Direction (motion lines point back along it)'),
  progress: z.number().min(0).max(1).default(1).describe('Impact/splash growth'),
  box: boxSchema.describe('Rain and snow fill this box'),
  count: z.int().min(1).max(200).optional(),
});
type EffectOptions = z.output<typeof effectSchema>;

function star(r0: number, r1: number, n: number, key: string): number[] {
  const pts: number[] = [];
  for (let i = 0; i < n * 2; i += 1) {
    const a = (i / (n * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? r1 * (0.8 + rnd(key, i) * 0.4) : r0;
    pts.push(Math.cos(a) * r, Math.sin(a) * r);
  }
  return pts;
}

export function drawEffect(g: ComicPen, o: EffectOptions): void {
  const key = artKey(`effect-${o.kind}`, o.seed);
  const t = timeOf(g, o.t);
  if (o.kind === 'rain' || o.kind === 'snow') {
    weather(g, o, t, key);
    return;
  }
  const sk = sketchFor(g, { ...o, angle: o.angle }, 100, key);
  const color = o.color;
  const p = o.progress;
  switch (o.kind) {
    case 'impact':
      sk.shape(star(22 * p, 50 * p, 9, key), color ?? 'yellow', { outline: 'outer' });
      sk.shape(star(10 * p, 26 * p, 7, `${key}i`), 'red', { outline: false });
      return;
    case 'emphasis':
      for (let i = 0; i < 14; i += 1) {
        const a = (i / 14) * Math.PI * 2 + rnd(key, i) * 0.2;
        sk.stroke([Math.cos(a) * 34, Math.sin(a) * 34, Math.cos(a) * 50, Math.sin(a) * 50], {
          color: color ?? 'ink',
          w: 'outer',
        });
      }
      return;
    case 'motion':
      for (let i = 0; i < 5; i += 1) {
        const y = -24 + i * 12;
        const len = 40 + rnd(key, i) * 40;
        sk.stroke([-20 - len, y, -20, y], {
          color: color ?? 'ink',
          w: i % 2 === 0 ? 'outer' : 'inner',
        });
      }
      return;
    case 'sweat':
      for (let i = 0; i < 3; i += 1) {
        const a = -2.4 + i * 0.6;
        const d = 30 + ((t * 40 + i * 9) % 20);
        drop(sk.sub(Math.cos(a) * d, Math.sin(a) * d, 0.35, a + Math.PI / 2), color ?? 'cyan');
      }
      return;
    case 'sparkle':
      for (let i = 0; i < 4; i += 1) {
        const tw = 0.4 + Math.abs(Math.sin(t * 3 + i * 1.7)) * 0.6;
        const s = sk.sub(
          (rnd(key, i) - 0.5) * 90,
          (rnd(key, i + 4) - 0.5) * 90,
          tw * (0.5 + rnd(key, i + 8) * 0.5),
        );
        s.shape([0, -20, 4, -4, 20, 0, 4, 4, 0, 20, -4, 4, -20, 0, -4, -4], color ?? 'yellowPale', {
          outline: 'inner',
        });
      }
      return;
    case 'steam':
    case 'smoke':
      rising(sk, o.kind, color, t, key, o.count ?? (o.kind === 'steam' ? 3 : 5));
      return;
    case 'fire': {
      const f = (i: number) => Math.sin(t * 11 + i * 2.3) * 6;
      sk.shape(
        [
          -34,
          0,
          -40,
          -30,
          -22,
          -44 + f(1),
          -14,
          -70,
          0,
          -100 + f(2),
          10,
          -64,
          24,
          -76 + f(3),
          38,
          -34,
          32,
          0,
        ],
        color ?? 'yellow',
        { outline: 'outer' },
      );
      sk.shape([-18, 0, -20, -24, -6, -50 + f(4), 6, -30, 16, -44 + f(5), 18, 0], 'red', {
        outline: false,
      });
      return;
    }
    case 'dust':
      for (let i = 0; i < 5; i += 1) {
        const spread = 0.3 + (t % 1.2) * 0.6;
        sk.oval((i - 2) * 22 * spread * 2, -8 - rnd(key, i) * 10, 12 + i * 2, 8, color ?? 'shade', {
          outline: 'inner',
        });
      }
      return;
    case 'bubbles':
      for (let i = 0; i < (o.count ?? 6); i += 1) {
        const rise = (t * 30 + rnd(key, i) * 100) % 100;
        const r = 3 + rnd(key, i + 9) * 7;
        sk.oval((rnd(key, i + 5) - 0.5) * 40 + Math.sin(t * 3 + i) * 5, -rise, r, r, 'none', {
          outline: 'inner',
        });
        sk.dot(
          (rnd(key, i + 5) - 0.5) * 40 + Math.sin(t * 3 + i) * 5 - r * 0.35,
          -rise - r * 0.35,
          r * 0.2,
          'paper',
        );
      }
      return;
    case 'splash':
      for (let i = 0; i < 7; i += 1) {
        const a = -Math.PI + (i / 6) * Math.PI;
        const d = 20 + 50 * p;
        drop(
          sk.sub(Math.cos(a) * d, Math.sin(a) * d * 0.9 + 30 * p * p, 0.4, a + Math.PI / 2),
          color ?? 'cyan',
        );
      }
      return;
    case 'zzz':
      for (let i = 0; i < 3; i += 1) {
        const rise = (t * 0.7 + i / 3) % 1;
        const z0 = sk.sub(i * 14 + rise * 12, -rise * 70, 0.5 + i * 0.25);
        z0.stroke([-10, -10, 10, -10, -10, 10, 10, 10], { color: color ?? 'ink', w: 'outer' });
      }
      return;
    case 'hearts':
      for (let i = 0; i < 3; i += 1) {
        const rise = (t * 0.6 + i / 3) % 1;
        sk.sub((i - 1) * 24, -rise * 60, 0.3 + rise * 0.15).shape(
          [0, 44, -44, 0, -46, -26, -26, -46, 0, -28, 26, -46, 46, -26, 44, 0],
          color ?? 'red',
          { outline: 'inner' },
        );
      }
      return;
    case 'lightning':
      sk.shape([-10, -50, 22, -50, 6, -10, 26, -10, -16, 50, -2, 4, -22, 4], color ?? 'yellow', {
        outline: 'outer',
      });
      return;
  }
}

function drop(sk: Sketch, color: string): void {
  sk.shape([0, -30, 16, 4, 12, 18, 0, 24, -12, 18, -16, 4], color, { outline: 'inner' });
}

function rising(
  sk: Sketch,
  kind: string,
  color: string | undefined,
  t: number,
  key: string,
  count: number,
): void {
  for (let i = 0; i < count; i += 1) {
    const life = (t * 0.5 + i / count) % 1;
    const x = (rnd(key, i) - 0.5) * 20 + Math.sin(life * 6 + i) * 10;
    if (kind === 'steam') {
      sk.stroke(
        [x, -life * 40, x + 8, -life * 40 - 20, x - 4, -life * 40 - 40, x + 6, -life * 40 - 60],
        { color: color ?? 'greyLight', w: 'outer' },
      );
    } else {
      const r = 12 + life * 24;
      sk.oval(x * (1 + life), -life * 100, r, r * 0.8, color ?? 'greyMid', {
        outline: 'inner',
        shade: 0.3,
      });
    }
  }
}

function weather(g: ComicPen, o: EffectOptions, t: number, key: string): void {
  const [bx, by, bw, bh] = o.box;
  const n = o.count ?? (o.kind === 'rain' ? 60 : 50);
  const sk = new Sketch(g, { x: 0, y: 0, k: 1, flip: false, angle: 0, key });
  for (let i = 0; i < n; i += 1) {
    const speed = o.kind === 'rain' ? 420 : 30 + rnd(key, i + 7) * 30;
    const y = by + ((rnd(key, i) * bh + t * speed) % bh);
    const x =
      bx +
      ((rnd(key, i + 3) * bw + (o.kind === 'snow' ? Math.sin(t + i) * 8 : (y - by) * 0.25)) % bw);
    if (o.kind === 'rain') sk.line(x, y, x - 4, y - 14, o.color ?? 'cyanDeep', 1);
    else sk.dot(x, y, 1.6 + rnd(key, i + 11) * 1.4, o.color ?? 'paper');
  }
}
