/**
 * `art.insect` and `art.reptile` (PLAN.md#13.15a): small creatures drawn big enough to read -
 * bee, ant, beetle, ladybug, butterfly, fly, dragonfly, spider (placed by their centre); lizard,
 * snake, turtle, crocodile, frog (placed where they touch the ground). Wings flap and legs walk
 * on the panel clock; a snake can rear up to strike.
 */
import { z } from 'zod';
import type { ComicPen } from '../page/pen.js';
import { artKey, colorSchema, placeShape, timeOf } from './common.js';
import { sketchFor, type Sketch } from './sketch.js';

export const INSECTS = [
  'bee',
  'ant',
  'beetle',
  'ladybug',
  'butterfly',
  'fly',
  'dragonfly',
  'spider',
] as const;

export const insectSchema = z.strictObject({
  ...placeShape,
  kind: z.enum(INSECTS).default('bee'),
  size: z.number().min(0).max(600).default(24).describe('Body length (butterfly: wingspan)'),
  pose: z.enum(['fly', 'crawl', 'still']).default('fly'),
  fill: colorSchema.optional(),
  speed: z.number().min(0).max(30).default(12).describe('Wing beats or steps per second'),
});

/** Side-view legs under the body, walking when `moving`. */
function legs(sk: Sketch, count: number, t: number, moving: boolean): void {
  for (let i = 0; i < count; i += 1) {
    const x = -8 + i * 8;
    const step = moving ? Math.sin(t + i * 2.1) * 3 : 0;
    sk.stroke([x, 2, x + 3 + step, 8, x + 1 + step * 1.5, 13], { color: 'ink', w: 'inner' });
  }
}

export function drawInsect(g: ComicPen, o: z.output<typeof insectSchema>): void {
  const sk = sketchFor(g, o, 40, artKey(`insect-${o.kind}`, o.seed));
  const t = timeOf(g, o.t) * o.speed;
  const beat = o.pose === 'fly' ? (Math.floor(t) % 2 === 0 ? 1 : 0.35) : 0.6;
  const wing = (x: number, len: number, w: number, fill: string, lift: number) => {
    sk.shape(
      [x, -2, x - w * 0.5, -len * lift, x + w, -len * lift - w * 0.3, x + w * 0.6, -2],
      fill,
      { outline: 'inner' },
    );
  };
  switch (o.kind) {
    case 'butterfly': {
      const open = o.pose === 'fly' ? 0.4 + 0.6 * Math.abs(Math.sin(t * 0.5)) : 1;
      const fill = o.fill ?? 'yellow';
      for (const side of [-1, 1]) {
        sk.shape([0, 0, side * 20 * open, -18, side * 24 * open, -4, side * 4, 0], fill, {
          shade: 0.3,
        });
        sk.shape([0, 0, side * 18 * open, 4, side * 12 * open, 16, side * 3, 4], fill, {
          shade: 0.3,
        });
        sk.dot(side * 13 * open, -9, 2.4, 'ink');
      }
      sk.cap(0, -8, 0, 10, 2.2, 'ink', { outline: false });
      sk.stroke([0, -8, -4, -16]);
      sk.stroke([0, -8, 4, -16]);
      return;
    }
    case 'spider':
      for (let i = 0; i < 4; i += 1) {
        for (const side of [-1, 1])
          sk.stroke([0, 0, side * 14, -10 + i * 6, side * 20, -2 + i * 8 + Math.sin(t + i) * 2], {
            color: 'ink',
            w: 'outer',
          });
      }
      sk.oval(0, 4, 9, 10, o.fill ?? 'ink');
      sk.oval(0, -8, 6, 5, o.fill ?? 'ink');
      sk.dot(-2, -9, 1, 'paper');
      sk.dot(2, -9, 1, 'paper');
      return;
    default:
      break;
  }
  const body = sk;
  if (o.kind === 'dragonfly') {
    for (const x of [-3, 3]) wing(x, 26 * beat + 6, 7, 'paper', 1);
    body.cap(-28, 0, 4, 0, 2.2, o.fill ?? 'cyan');
    body.oval(8, 0, 5, 4.5, o.fill ?? 'cyan');
    body.dot(10, -2, 1.5, 'ink');
    return;
  }
  if (o.pose !== 'fly') legs(body, 3, t, o.pose === 'crawl');
  const fills: Readonly<Record<string, string>> = {
    bee: 'yellow',
    ant: 'ink',
    beetle: 'cyanDeep',
    ladybug: 'red',
    fly: 'night',
  };
  const fill = o.fill ?? fills[o.kind] ?? 'ink';
  if (o.kind === 'ant') {
    for (const [x, r] of [
      [-12, 6],
      [0, 4],
      [10, 5],
    ] as const)
      body.oval(x, 0, r, r * 0.85, fill);
    body.stroke([12, -4, 16, -12, 20, -12]);
    return;
  }
  if (o.kind === 'bee' || o.kind === 'fly') {
    if (o.pose === 'fly') for (const x of [-4, 2]) wing(x, 18 * beat + 4, 8, 'paper', 1);
    body.oval(-2, 0, 13, 9, fill, { shade: 0.3 });
    if (o.kind === 'bee') {
      body.g.clip(body.map(body.g.ellipsePts(-2, 0, 13, 9, 18)), () => {
        for (const x of [-8, 0])
          body.shape([x, -12, x + 4, -12, x + 4, 12, x, 12], 'ink', { outline: false });
      });
      body.shape([-15, -1, -21, 0, -15, 2], 'ink', { outline: false });
    }
    body.oval(12, -1, 6, 5.5, 'ink');
    body.dot(14, -2, 1.6, o.kind === 'fly' ? 'red' : 'paper');
    return;
  }
  body.oval(-2, 0, 14, 11, fill, { shade: 0.35 });
  body.line(-2, -11, -2, 11, 'ink', body.widthOf('inner'));
  if (o.kind === 'ladybug')
    for (const [x, y] of [
      [-8, -5],
      [-7, 5],
      [3, -6],
      [4, 5],
    ] as const)
      body.dot(x, y, 2.3, 'ink');
  body.oval(13, 0, 5, 6, 'ink');
}

export const REPTILES = ['lizard', 'snake', 'turtle', 'crocodile', 'frog'] as const;

export const reptileSchema = z.strictObject({
  ...placeShape,
  kind: z.enum(REPTILES).default('lizard'),
  size: z.number().min(0).max(1200).default(50).describe('Length (frog, turtle: width)'),
  pose: z.enum(['still', 'crawl', 'strike', 'leap']).default('still'),
  fill: colorSchema.optional(),
  speed: z.number().min(0).max(6).default(1.5),
});

const REPTILE_FILL: Readonly<Record<(typeof REPTILES)[number], string>> = {
  lizard: 'phosphor',
  snake: 'aged',
  turtle: 'phosphor',
  crocodile: 'phosphor',
  frog: 'phosphor',
};

function spine(len: number, t: number, wave: number, rear: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i <= 16; i += 1) {
    const u = i / 16;
    const raise = u > 0.7 ? -rear * ((u - 0.7) / 0.3) ** 1.3 : 0;
    pts.push(
      -len / 2 + u * len * (rear > 0 ? 0.8 : 1),
      Math.sin(u * 9 + t) * wave * (1 - u * 0.3) + raise,
    );
  }
  return pts;
}

export function drawReptile(g: ComicPen, o: z.output<typeof reptileSchema>): void {
  const sk = sketchFor(g, o, 100, artKey(`reptile-${o.kind}`, o.seed));
  const t = timeOf(g, o.t) * o.speed;
  const fill = o.fill ?? REPTILE_FILL[o.kind];
  const moving = o.pose === 'crawl';
  switch (o.kind) {
    case 'snake': {
      const pts = spine(96, moving ? t * 3 : 0, 7, o.pose === 'strike' ? 34 : 0).map((v, i) =>
        i % 2 === 1 ? v - 7 : v,
      );
      const n = pts.length / 2;
      for (let i = 0; i + 1 < n; i += 1) {
        const r = 7.5 * (0.45 + 0.55 * Math.min(1, (i / n) * 3));
        sk.cap(
          pts[i * 2] ?? 0,
          pts[i * 2 + 1] ?? 0,
          pts[i * 2 + 2] ?? 0,
          pts[i * 2 + 3] ?? 0,
          r + 1.2,
          'ink',
          { outline: false },
        );
      }
      for (let i = 0; i + 1 < n; i += 1) {
        const r = 7.5 * (0.45 + 0.55 * Math.min(1, (i / n) * 3));
        sk.cap(
          pts[i * 2] ?? 0,
          pts[i * 2 + 1] ?? 0,
          pts[i * 2 + 2] ?? 0,
          pts[i * 2 + 3] ?? 0,
          r,
          i % 3 === 1 ? 'sepiaMid' : fill,
          { outline: false },
        );
      }
      // The rattle: three segments at the tail tip.
      for (let i = 0; i < 3; i += 1)
        sk.oval((pts[0] ?? 0) - 3 - i * 4, (pts[1] ?? 0) - 1, 2.6, 3.4, 'aged', {
          outline: 'inner',
        });
      const [hx, hy] = [pts[pts.length - 2] ?? 0, pts[pts.length - 1] ?? 0];
      const open = o.pose === 'strike';
      sk.shape(
        [hx - 4, hy - 6, hx + 8, hy - 7, hx + 16, hy - 2, hx + 14, hy + 1, hx - 4, hy + 5],
        fill,
        { shade: 0.3 },
      );
      if (open) {
        sk.shape([hx + 14, hy + 1, hx + 4, hy + 2, hx + 15, hy + 9, hx + 6, hy + 6], 'red', {
          outline: 'inner',
        });
        sk.shape([hx + 12, hy + 1, hx + 13, hy + 6, hx + 14, hy + 1], 'paper', { outline: false });
      }
      sk.dot(hx + 7, hy - 3, 1.5, 'ink');
      if (!open && Math.floor(t * 2) % 3 === 0)
        sk.stroke([hx + 16, hy - 1, hx + 22, hy - 1, hx + 24, hy - 3], { color: 'red' });
      return;
    }
    case 'turtle':
      for (const x of [-22, 18])
        sk.cap(x, -8, x + (moving ? Math.sin(t * 3 + x) * 4 : 0), 0, 5, fill);
      sk.cap(24, -14, 38, -18 + (moving ? Math.sin(t * 3) * 2 : 0), 6, fill);
      sk.dot(38, -20, 1.4, 'ink');
      sk.shape([-34, -8, -26, -30, 0, -38, 26, -30, 32, -8], 'sepiaMid', { shade: 0.4 });
      for (const x of [-14, 0, 14]) sk.stroke([x - 6, -12, x, -28, x + 6, -12], { color: 'ink' });
      return;
    case 'frog': {
      const up = o.pose === 'leap' ? -24 : 0;
      const f = sk.sub(0, up);
      f.blob([{ c: [-20, -6, -6, -14, 7] }, { c: [-20, -4, -8, 0, 5] }], fill);
      f.oval(0, -16, 20, 13, fill, { shade: 0.35 });
      f.cap(10, -4, 18, 0, 3.5, fill);
      for (const ex of [6, 14]) {
        f.oval(ex, -28, 5, 5, fill);
        f.dot(ex + 1, -28, 2.2, 'ink');
      }
      f.stroke([4, -12, 16, -12]);
      return;
    }
    default: {
      const croc = o.kind === 'crocodile';
      const body = spine(croc ? 70 : 60, moving ? t * 2 : 0, croc ? 1.5 : 3, 0).map((v, i) =>
        i % 2 === 1 ? v - 7 : v - 8,
      );
      for (const [lx, side] of [
        [-12, 1],
        [14, -1],
      ] as const) {
        const step = moving ? Math.sin(t * 2 + lx) * 5 : 0;
        sk.stroke([lx, -7, lx + 5 * side + step, -2, lx + 8 * side + step, 0], {
          w: 'outer',
          color: 'ink',
        });
      }
      for (let i = 0; i + 3 < body.length; i += 2) {
        const r = croc ? 7 : 5.5 * Math.min(1, 0.3 + (i / body.length) * 2);
        sk.cap(body[i] ?? 0, body[i + 1] ?? 0, body[i + 2] ?? 0, body[i + 3] ?? 0, r, fill, {
          outline: false,
        });
      }
      sk.stroke(body, { w: 'outer', color: 'cyanDeep' });
      const [hx, hy] = [body[body.length - 2] ?? 0, body[body.length - 1] ?? 0];
      if (croc) {
        for (let i = 0; i < 6; i += 1)
          sk.shape([-26 + i * 9, -13, -22 + i * 9, -19, -18 + i * 9, -13], fill, {
            outline: 'inner',
          });
        sk.shape([hx, hy - 6, hx + 30, hy - 1, hx + 30, hy + 3, hx, hy + 5], fill, { shade: 0.3 });
        for (let i = 0; i < 5; i += 1)
          sk.shape(
            [hx + 6 + i * 5, hy + 1, hx + 8 + i * 5, hy + 5, hx + 10 + i * 5, hy + 1],
            'paper',
            { outline: 'inner' },
          );
        sk.dot(hx + 4, hy - 6, 2, 'yellow');
      } else {
        sk.oval(hx + 5, hy, 8, 5, fill, { shade: 0.3 });
        sk.dot(hx + 8, hy - 2, 1.5, 'ink');
      }
      for (const [lx, side] of [
        [-10, -1],
        [16, 1],
      ] as const) {
        const step = moving ? Math.sin(t * 2 + lx + 1) * 5 : 0;
        sk.stroke([lx, -7, lx + 6 * side + step, -1, lx + 9 * side + step, 0], {
          w: 'outer',
          color: 'ink',
        });
      }
    }
  }
}
