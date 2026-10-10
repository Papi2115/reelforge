/**
 * Grim Ink props (PLAN.md#14.20): lights and cloth — lamps (candle, iron stand, torch, lantern,
 * oil lamp, paper floor lamp, hanging work lamp, bulb) whose flame flickers on twos and whose light
 * pool the scene draws behind the people; flags, pennants, banners, split curtains and hanging
 * signs that sway on twos. Ported from `02-papal-conclave/js/sets/sets-b.js` (candleStand),
 * `01-samurai-edo/js/sets/sets-c.js` (paper lamp), `edo.js` (noren), `03-apollo-11/js/sets/
 * sets-a.js` (work lamp); docs in props.ts.
 */
import { z } from 'zod';
import { C, hash, rnd, twos } from '../core.js';
import { brushStroke, type BrushEnv } from '../draw/brushes.js';
import type { Paint2D } from '../draw/paint.js';
import { pool, rect, rough } from '../draw/scenery.js';
import { blob, ellipseRing, tube } from '../draw/shapes.js';
import {
  coord,
  local,
  seedSchema,
  sizeSchema,
  timeSchema,
  toneOf,
  toneSchema,
  unit,
  type Drawn,
  type LightSpec,
  spot,
  type LabelSpot,
} from './common.js';

// ---------- lamp ----------

export const lampSchema = z.strictObject({
  x: coord.default(960),
  y: coord.default(600),
  kind: z
    .enum(['candle', 'stand', 'torch', 'lantern', 'oil', 'paper', 'hanging', 'bulb'])
    .default('candle'),
  state: z.enum(['lit', 'out']).default('lit'),
  level: unit.default(1),
  size: sizeSchema,
  t: timeSchema,
  pool: z.boolean().default(false),
  rot: z.number().min(-90).max(90).default(0),
  seed: seedSchema.default(500),
});

function flame(
  g: Paint2D,
  e: BrushEnv,
  x: number,
  y: number,
  r: number,
  t: number,
  seed: number,
): void {
  const fl = hash(seed, Math.floor(twos(t) * 12)) * r * 0.35;
  const lean = rnd(-0.25, 0.25, seed, Math.floor(twos(t) * 12), 1) * r;
  // prettier-ignore
  blob(g, e, [x + lean, y - r * 1.8 - fl, x + r * 0.5, y - r * 0.55, x, y, x - r * 0.5, y - r * 0.55], C.FIRE, { lw: 4, seed, patch: ['#f0d08a', 0, r * 0.3, 0.45] });
}

export function drawLamp(g: Paint2D, e: BrushEnv, o: z.output<typeof lampSchema>): Drawn {
  const k = o.size;
  const lit = o.state === 'lit';
  // the flame point in the local frame (y up = negative), by kind
  const wax = 20 + 90 * o.level;
  const flameAt: Readonly<Record<typeof o.kind, readonly [number, number]>> = {
    candle: [0, -wax],
    stand: [0, -312 - wax],
    torch: [0, -150],
    lantern: [0, 70],
    oil: [34, -26],
    paper: [0, -90],
    hanging: [0, 50],
    bulb: [0, 60],
  };
  const [fx, fy] = flameAt[o.kind];
  const a = (o.rot * Math.PI) / 180;
  const wx = o.x + (fx * Math.cos(a) - fy * Math.sin(a)) * k;
  const wy = o.y + (fx * Math.sin(a) + fy * Math.cos(a)) * k;
  const light: LightSpec = {
    x: wx,
    y: wy + 60 * k,
    rx: 420 * k,
    ry: 300 * k,
    color: o.kind === 'bulb' ? '#e8d8a0' : C.FIRE,
    alpha: 0.09,
  };
  if (lit && o.pool) pool(g, light.x, light.y, light.rx, light.ry, light.color, light.alpha);
  local(g, o.x, o.y, o.rot, k, () => {
    const metal = C.BLACK;
    if (o.kind === 'candle' || o.kind === 'stand') {
      const base = o.kind === 'stand' ? -312 : 0;
      if (o.kind === 'stand') {
        brushStroke(g, e, [0, 0, 4, -300], { w: 10, color: '#2a2622', seed: o.seed, taper: false });
        brushStroke(g, e, [-40, 0, 0, -30, 40, 0], {
          w: 8,
          color: '#2a2622',
          seed: o.seed + 1,
          taper: false,
        });
      }
      rect(g, e, -40, base, 88, 14, '#2a2622', { seed: o.seed + 2, lw: 4 });
      rect(g, e, -11, base - wax, 22, wax, '#c2b48a', {
        seed: o.seed + 3,
        lw: 5,
        shade: ['#9c8f68', -4, 0],
      });
      blob(
        g,
        e,
        [-18, base + 12 - wax * 0.1, -12, base - 2, 14, base - 2, 22, base + 16, 18, base + 30],
        '#c2b48a',
        { lw: 4, seed: o.seed + 4 },
      );
    }
    if (o.kind === 'torch') {
      tube(g, e, [0, 60, 0, -110], [22, 26], C.TIMBER, { lw: 5, seed: o.seed });
      blob(g, e, ellipseRing(0, -120, 22, 26, 8), '#4a3a2a', {
        lw: 5,
        seed: o.seed + 1,
        hatch: { c: 'rgba(10,6,2,0.6)', n: 2, len: 20, gap: 5, k: 3, ang: 20 },
      });
    }
    if (o.kind === 'lantern' || o.kind === 'hanging' || o.kind === 'bulb') {
      brushStroke(g, e, [0, o.kind === 'lantern' ? -40 : -260, 0, 0], {
        w: 4,
        color: metal,
        seed: o.seed,
        taper: false,
      });
    }
    if (o.kind === 'lantern') {
      blob(g, e, ellipseRing(0, -20, 22, 22, 10), 'rgba(0,0,0,0)', { lw: 5, seed: o.seed + 1 });
      rect(g, e, -36, 20, 72, 90, lit ? 'rgba(224,164,67,0.55)' : 'rgba(60,60,50,0.6)', {
        seed: o.seed + 2,
        lw: 6,
      });
      for (const bx of [-36, 0, 36])
        brushStroke(g, e, [bx, 20, bx, 110], {
          w: 6,
          color: metal,
          seed: o.seed + 3,
          taper: false,
        });
      rough(g, e, [-44, 0, 44, 0, 36, 24, -36, 24], metal, { seed: o.seed + 4, lw: 5 });
      rect(g, e, -40, 106, 80, 14, metal, { seed: o.seed + 5, lw: 4 });
    }
    if (o.kind === 'oil') {
      // prettier-ignore
      blob(g, e, [-50, -10, -30, -34, 20, -36, 44, -26, 34, -6, 0, 6, -36, 4], '#8a4a32', { lw: 6, seed: o.seed, shade: ['#663523', -8, 6] });
      tube(g, e, [-50, -16, -78, -30, -70, -4], [10, 10, 10], '#663523', {
        lw: 4,
        seed: o.seed + 1,
      });
    }
    if (o.kind === 'paper') {
      rough(g, e, [-60, 0, -55, -180, 55, -180, 60, 0], lit ? C.FIRE : C.LINEN_D, {
        seed: o.seed,
        lw: 6,
        shade: [lit ? C.FIRE_D : '#6c6450', -10, 0],
        mottle: ['rgba(140,80,30,0.25)', 3, 20],
      });
      for (const bx of [-50, 0, 50])
        brushStroke(g, e, [bx, -178, bx, -2], {
          w: 6,
          color: C.BLACK,
          seed: o.seed + 1,
          taper: false,
        });
      brushStroke(g, e, [-58, -90, 58, -90], {
        w: 5,
        color: C.BLACK,
        seed: o.seed + 2,
        taper: false,
      });
      rect(g, e, -70, -190, 140, 20, C.BLACK, { seed: o.seed + 3, lw: 4 });
    }
    if (o.kind === 'hanging') {
      blob(g, e, [-60, 0, 60, 0, 40, 50, -40, 50], metal, { sharp: true, lw: 5, seed: o.seed + 1 });
      blob(g, e, ellipseRing(0, 52, 40, 9, 10), lit ? C.FIRE : C.STONE_D, {
        lw: 4,
        seed: o.seed + 2,
      });
    }
    if (o.kind === 'bulb')
      blob(g, e, ellipseRing(0, 40, 22, 28, 10), lit ? '#e8d8a0' : C.STONE, {
        lw: 5,
        seed: o.seed + 1,
      });
    if (lit && o.kind !== 'hanging' && o.kind !== 'bulb' && o.kind !== 'paper') {
      flame(g, e, fx, fy, o.kind === 'torch' ? 40 : 14, o.t, o.seed + 9);
      if (o.kind === 'torch') flame(g, e, fx + 14, fy + 10, 24, o.t + 0.25, o.seed + 11);
    }
  });
  return {
    box: [o.x - 80 * k, Math.min(o.y, wy) - 120 * k, o.x + 80 * k, Math.max(o.y, wy) + 40 * k],
    points: { flame: [wx, wy], grip: [o.x, o.y], base: [o.x, o.y] },
    ...(lit ? { light } : {}),
  };
}

// ---------- banner ----------

export const bannerSchema = z.strictObject({
  x: coord.default(600),
  y: coord.default(200),
  w: z.number().min(20).max(3000).default(260),
  h: z.number().min(20).max(3000).default(170),
  kind: z.enum(['flag', 'pennant', 'hanging', 'curtain', 'sign']).default('flag'),
  emblem: z.enum(['none', 'stripe', 'band', 'disc', 'cross', 'chevron', 'star']).default('none'),
  tone: toneSchema.default('RUST'),
  emblemTone: toneSchema.default('LINEN'),
  wind: unit.default(0.5),
  state: z.enum(['whole', 'torn']).default('whole'),
  t: timeSchema,
  seed: seedSchema.default(520),
});

function emblem(
  g: Paint2D,
  e: BrushEnv,
  o: z.output<typeof bannerSchema>,
  cx: number,
  cy: number,
  r: number,
): void {
  if (o.emblem === 'none') return;
  const [fill] = toneOf(o.emblemTone);
  const opts = { lw: 4, seed: o.seed + 30 } as const;
  if (o.emblem === 'disc') blob(g, e, ellipseRing(cx, cy, r, r, 12), fill, opts);
  if (o.emblem === 'stripe') rect(g, e, cx - r * 2.2, cy - r * 0.3, r * 4.4, r * 0.6, fill, opts);
  if (o.emblem === 'band') rect(g, e, cx - r * 0.3, cy - r * 2, r * 0.6, r * 4, fill, opts);
  if (o.emblem === 'cross') {
    rect(g, e, cx - r * 0.22, cy - r, r * 0.44, r * 2, fill, opts);
    rect(g, e, cx - r, cy - r * 0.22, r * 2, r * 0.44, fill, opts);
  }
  if (o.emblem === 'chevron')
    blob(
      g,
      e,
      [
        cx - r,
        cy - r * 0.4,
        cx,
        cy + r * 0.4,
        cx + r,
        cy - r * 0.4,
        cx + r,
        cy + r * 0.1,
        cx,
        cy + r * 0.9,
        cx - r,
        cy + r * 0.1,
      ],
      fill,
      { ...opts, sharp: true },
    );
  // prettier-ignore
  if (o.emblem === 'star') blob(g, e, [cx - r, cy, cx - r * 0.2, cy - r * 0.2, cx, cy - r, cx + r * 0.2, cy - r * 0.2, cx + r, cy, cx + r * 0.2, cy + r * 0.2, cx, cy + r, cx - r * 0.2, cy + r * 0.2], fill, { ...opts, sharp: true });
}

export function drawBanner(g: Paint2D, e: BrushEnv, o: z.output<typeof bannerSchema>): Drawn {
  const { x, y, w, h } = o;
  const [fill, shade] = toneOf(o.tone);
  const tt = twos(o.t);
  const wave = (u: number): number => Math.sin(tt * 4.2 + u * 5 + o.seed) * o.wind * h * 0.12 * u;
  const cloth = {
    lw: 6,
    seed: o.seed,
    shade: [shade, -10, 6] as const,
    hatch: {
      c: 'rgba(10,10,10,0.35)',
      n: 3,
      len: h * 0.5,
      gap: 7,
      k: 2,
      ang: o.kind === 'flag' ? 0 : 90,
      bend: 0.04,
    },
  };
  const labelSize = Math.min(h * 0.4, 70);
  let label: LabelSpot;
  let tip: readonly [number, number] = [x + w, y + h / 2];
  if (o.kind === 'flag' || o.kind === 'pennant') {
    tube(g, e, [x, y - 10, x, y + h * 3.2], [12, 12], C.TIMBER, { lw: 5, seed: o.seed + 1 });
    const top: number[] = [];
    const bottom: number[] = [];
    for (let i = 0; i <= 6; i += 1) {
      const u = i / 6;
      const narrow = o.kind === 'pennant' ? (1 - u) * 0.5 : 0;
      top.push(x + w * u, y + h * narrow + wave(u));
      bottom.unshift(x + w * u, y + h * (1 - narrow) + wave(u));
    }
    const torn =
      o.state === 'torn'
        ? [x + w * 0.9, y + h * 0.4, x + w * 0.75, y + h * 0.55, x + w * 0.92, y + h * 0.7]
        : [];
    blob(g, e, [...top, ...torn, ...bottom], fill, { ...cloth, sharp: true });
    emblem(g, e, o, x + w * 0.42, y + h / 2 + wave(0.42), h * 0.24);
    tip = [x + w, y + (o.kind === 'pennant' ? h / 2 : h) + wave(1)];
    label = spot(x + w * 0.45, y + h / 2 + wave(0.45), labelSize, w * 0.8);
  } else if (o.kind === 'curtain') {
    rect(g, e, x - 16, y - 8, w + 32, 16, C.TIMBER, { seed: o.seed + 1, lw: 5 });
    const n = Math.max(2, Math.round(w / 110));
    for (let i = 0; i < n; i += 1) {
      const sway = Math.sin(tt * 2.1 + i * 1.3) * 7 * (0.4 + o.wind);
      const px = x + (i * w) / n;
      blob(
        g,
        e,
        [px + 3, y + 4, px + w / n - 3, y + 4, px + w / n - 3 + sway, y + h, px + 3 + sway, y + h],
        fill,
        { ...cloth, seed: o.seed + i, sharp: true },
      );
    }
    emblem(g, e, o, x + w / 2, y + h * 0.42, Math.min(w / n, h) * 0.3);
    label = spot(x + w / 2, y + h * 0.42, labelSize, w * 0.8);
  } else {
    const sway = Math.sin(tt * 2.1) * 6 * o.wind;
    if (o.kind === 'sign') {
      brushStroke(g, e, [x - 30, y - 30, x + w + 30, y - 30], {
        w: 12,
        color: C.TIMBER,
        seed: o.seed + 1,
        taper: false,
      });
      for (const cx of [x + w * 0.15, x + w * 0.85])
        brushStroke(g, e, [cx, y - 30, cx + sway, y], {
          w: 3,
          color: C.BLACK,
          seed: o.seed + 2,
          taper: false,
        });
      rect(g, e, x + sway, y, w, h, fill, {
        seed: o.seed,
        lw: 6,
        shade: [shade, -8, 6],
        hatch: { c: 'rgba(10,6,2,0.4)', n: 3, len: w * 0.3, gap: 7, k: 2, ang: 0, bend: 0 },
      });
    } else {
      tube(g, e, [x - 24, y, x + w + 24, y], [14, 14], C.TIMBER, { lw: 5, seed: o.seed + 1 });
      const tail =
        o.state === 'torn'
          ? [x + w * 0.8 + sway, y + h * 0.86, x + w * 0.62 + sway, y + h * 0.98]
          : [];
      // prettier-ignore
      blob(g, e, [x, y, x + w, y, x + w + sway, y + h, ...tail, x + w / 2 + sway, y + h * 0.82, x + sway, y + h], fill, { ...cloth, sharp: true });
    }
    emblem(g, e, o, x + w / 2 + sway, y + h * 0.45, Math.min(w, h) * 0.22);
    label = spot(x + w / 2 + sway, y + h * 0.45, labelSize, w * 0.8);
    tip = [x + w / 2 + sway, y + h];
  }
  return {
    box: [
      x - 24,
      y - 30,
      x + w + 30,
      y + (o.kind === 'flag' || o.kind === 'pennant' ? h * 3.2 : h),
    ],
    points: { top: [x, y], tip },
    label,
  };
}
