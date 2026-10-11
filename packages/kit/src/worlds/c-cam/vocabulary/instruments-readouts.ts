/**
 * Grim Ink instruments (PLAN.md#14.20), part 2: readouts and banks — gauge (needle, red zone,
 * tremble on twos), toggle switch bank (one flipped), keypad (one key pressed), status lights
 * (blinking on twos). Ported from `03-apollo-11/js/lunar.js` (switches, gauge, the guidance
 * computer's keys and lights); registry and docs in instruments.ts.
 */
import { z } from 'zod';
import { C, hash, rnd, twos } from '../core.js';
import { brushStroke, type BrushEnv } from '../draw/brushes.js';
import type { Paint2D } from '../draw/paint.js';
import { rect } from '../draw/scenery.js';
import { blob, ellipseRing, tube } from '../draw/shapes.js';
import {
  coord,
  seedSchema,
  timeSchema,
  toneOf,
  toneSchema,
  unit,
  type Drawn,
  spot,
  type LabelSpot,
} from './common.js';

const PANEL = '#45463f';
const DIAL_FACE = '#c2b996';
const below = (x: number, y: number, size: number, fit: number): LabelSpot => spot(x, y, size, fit);

export const gaugeSchema = z.strictObject({
  x: coord.default(960),
  y: coord.default(540),
  r: z.number().min(10).max(900).default(80),
  value: unit.default(0.5),
  zone: z.enum(['low', 'high', 'none']).default('low'),
  tremble: unit.default(0),
  t: timeSchema,
  seed: seedSchema.default(840),
});

export function drawGauge(g: Paint2D, e: BrushEnv, o: z.output<typeof gaugeSchema>): Drawn {
  const { x, y, r } = o;
  const jitter = o.tremble * rnd(-0.08, 0.08, o.seed, Math.floor(twos(o.t) * 12));
  const a = -2.4 + 4.8 * o.value + jitter;
  blob(g, e, ellipseRing(x, y, r + 14, r + 14, 14), C.BLACK, { lw: 6, seed: o.seed });
  blob(g, e, ellipseRing(x, y, r, r, 14), DIAL_FACE, {
    lw: 4,
    seed: o.seed + 1,
    shade: ['#9a9174', -r * 0.1, r * 0.08],
  });
  if (o.zone !== 'none') {
    const z0 = o.zone === 'low' ? -2.4 : 1.6;
    const pts: number[] = [];
    for (let i = 0; i <= 6; i += 1) {
      const b = z0 + (0.8 * i) / 6;
      pts.push(x + Math.sin(b) * r * 0.86, y - Math.cos(b) * r * 0.86);
    }
    for (let i = 6; i >= 0; i -= 1) {
      const b = z0 + (0.8 * i) / 6;
      pts.push(x + Math.sin(b) * r * 0.72, y - Math.cos(b) * r * 0.72);
    }
    blob(g, e, pts, C.RED_D, { sharp: true, lw: 0, seed: o.seed + 2 });
  }
  for (let i = 0; i <= 10; i += 1) {
    const b = -2.4 + (4.8 * i) / 10;
    brushStroke(
      g,
      e,
      [
        x + Math.sin(b) * r * 0.72,
        y - Math.cos(b) * r * 0.72,
        x + Math.sin(b) * r * 0.92,
        y - Math.cos(b) * r * 0.92,
      ],
      { w: i % 5 ? 3 : 5, seed: o.seed + 3 + i, taper: false },
    );
  }
  const tip = [x + Math.sin(a) * r * 0.82, y - Math.cos(a) * r * 0.82] as const;
  tube(g, e, [x, y, tip[0], tip[1]], [r * 0.08, r * 0.03], C.INK, { lw: 0, seed: o.seed + 20 });
  blob(g, e, ellipseRing(x, y, r * 0.09, r * 0.09, 7), C.STONE, { lw: 3, seed: o.seed + 21 });
  return {
    box: [x - r - 16, y - r - 16, x + r + 16, y + r + 16],
    points: { centre: [x, y], needle: tip },
    label: below(x, y + r * 0.4, Math.max(10, r * 0.13), r * 1.1),
  };
}

export const switchSchema = z.strictObject({
  x: coord.default(900),
  y: coord.default(400),
  cols: z.number().int().min(1).max(30).default(6),
  rows: z.number().int().min(1).max(12).default(2),
  gap: z.number().min(10).max(300).default(46),
  pattern: z
    .string()
    .regex(/^[01]*$/)
    .max(360)
    .optional(),
  flip: z.number().int().min(-1).max(359).default(-1),
  press: unit.default(0),
  guards: unit.default(0.15),
  seed: seedSchema.default(850),
});

export function drawSwitches(g: Paint2D, e: BrushEnv, o: z.output<typeof switchSchema>): Drawn {
  const sp = o.gap;
  let target: readonly [number, number] = [o.x, o.y];
  for (let r = 0; r < o.rows; r += 1) {
    for (let c = 0; c < o.cols; c += 1) {
      const i = r * o.cols + c;
      const cx = o.x + c * sp;
      const cy = o.y + r * sp;
      const set = o.pattern?.[i];
      let up = set === undefined ? hash(o.seed, i) < 0.5 : set === '1';
      const flipping = i === o.flip;
      if (flipping) {
        up = o.press < 0.5 ? up : !up;
        target = [cx, cy];
      }
      const lean = flipping ? 1 - Math.abs(o.press - 0.5) * 2 : 1;
      blob(g, e, ellipseRing(cx, cy, sp * 0.2, sp * 0.2, 7), C.BLACK, { lw: 3, seed: o.seed + i });
      brushStroke(g, e, [cx, cy, cx + 2, cy + (up ? -1 : 1) * sp * 0.38 * Math.max(0.15, lean)], {
        w: 6,
        color: C.STONE,
        seed: o.seed + 40 + i,
        taper: false,
      });
      if (hash(o.seed, i, 3) < o.guards)
        brushStroke(
          g,
          e,
          [
            cx - sp * 0.32,
            cy + sp * 0.2,
            cx - sp * 0.32,
            cy - sp * 0.4,
            cx + sp * 0.32,
            cy - sp * 0.4,
            cx + sp * 0.32,
            cy + sp * 0.2,
          ],
          { w: 3, color: C.STONE_D, seed: o.seed + 80 + i, taper: false },
        );
    }
  }
  const w = (o.cols - 1) * sp;
  return {
    box: [o.x - sp * 0.5, o.y - sp * 0.5, o.x + w + sp * 0.5, o.y + (o.rows - 0.5) * sp],
    points: { target, first: [o.x, o.y] },
    label: below(o.x + w / 2, o.y + (o.rows - 0.2) * sp, sp * 0.4, w + sp),
  };
}

export const keypadSchema = z.strictObject({
  x: coord.default(900),
  y: coord.default(400),
  cols: z.number().int().min(1).max(12).default(3),
  rows: z.number().int().min(1).max(12).default(4),
  key: z.number().min(10).max(300).default(60),
  press: z.number().int().min(-1).max(143).default(-1),
  lit: z.number().int().min(-1).max(143).default(-1),
  tone: toneSchema.default('BLACK'),
  seed: seedSchema.default(860),
});

export function drawKeypad(g: Paint2D, e: BrushEnv, o: z.output<typeof keypadSchema>): Drawn {
  const [fill] = toneOf(o.tone);
  const k = o.key;
  const labels: LabelSpot[] = [];
  let target: readonly [number, number] = [o.x, o.y];
  rect(
    g,
    e,
    o.x - k * 0.25,
    o.y - k * 0.25,
    o.cols * k * 1.1 + k * 0.4,
    o.rows * k * 1.25 + k * 0.4,
    PANEL,
    {
      seed: o.seed,
      lw: 6,
      amp: 1,
      hatch: { c: 'rgba(10,10,8,0.4)', n: 3, len: 40, gap: 8, k: 3, ang: 80 },
    },
  );
  for (let i = 0; i < o.cols * o.rows; i += 1) {
    const bx = o.x + (i % o.cols) * k * 1.1;
    const by = o.y + Math.floor(i / o.cols) * k * 1.25;
    const down = o.press === i ? k * 0.07 : 0;
    rect(g, e, bx, by + down, k * 0.9, k * 1.1, i === o.lit ? C.FIRE : fill, {
      seed: o.seed + 1 + i,
      lw: 4,
      ...(down ? {} : { light: ['rgba(200,190,160,0.18)', 3, -3] as const }),
    });
    labels.push(spot(bx + k * 0.45, by + k * 0.55 + down, k * 0.36, k * 0.8));
    if (o.press === i) target = [bx + k * 0.45, by + k * 0.55 + down];
  }
  return {
    box: [
      o.x - k * 0.25,
      o.y - k * 0.25,
      o.x + o.cols * k * 1.1 + k * 0.15,
      o.y + o.rows * k * 1.25 + k * 0.15,
    ],
    points: { target },
    labels,
  };
}

export const lightsSchema = z.strictObject({
  x: coord.default(900),
  y: coord.default(300),
  n: z.number().int().min(1).max(48).default(4),
  cols: z.number().int().min(1).max(48).optional(),
  size: z.number().min(6).max(400).default(40),
  kind: z.enum(['round', 'block']).default('round'),
  lit: z
    .string()
    .regex(/^[01]*$/)
    .max(48)
    .default('1'),
  blink: z.boolean().default(false),
  rate: z.number().min(0.5).max(12).default(4),
  t: timeSchema,
  tone: toneSchema.default('RED'),
  seed: seedSchema.default(870),
});

export function drawLights(g: Paint2D, e: BrushEnv, o: z.output<typeof lightsSchema>): Drawn {
  const [on, off] = toneOf(o.tone);
  const cols = o.cols ?? o.n;
  const s = o.size;
  const flash = !o.blink || Math.floor(twos(o.t) * o.rate) % 2 === 0;
  const labels: LabelSpot[] = [];
  const w = o.kind === 'block' ? s * 2.4 : s;
  let any = false;
  for (let i = 0; i < o.n; i += 1) {
    const cx = o.x + (i % cols) * (w + s * 0.4);
    const cy = o.y + Math.floor(i / cols) * s * 1.5;
    const lit = (o.lit[i % Math.max(1, o.lit.length)] ?? '0') === '1' && flash;
    any ||= lit;
    if (o.kind === 'block')
      rect(g, e, cx - w / 2, cy - s / 2, w, s, lit ? on : '#6d6a5a', { seed: o.seed + i, lw: 4 });
    else
      blob(g, e, ellipseRing(cx, cy, s / 2, s / 2, 10), lit ? on : off, {
        lw: 4,
        seed: o.seed + i,
        ...(lit ? { light: ['rgba(255,230,190,0.4)', s * 0.12, -s * 0.12] as const } : {}),
      });
    labels.push(spot(cx, o.kind === 'block' ? cy : cy + s * 0.9, s * 0.3, w * 0.9));
  }
  const rows = Math.ceil(o.n / cols);
  const x1 = o.x + (cols - 1) * (w + s * 0.4);
  return {
    box: [o.x - w / 2, o.y - s / 2, x1 + w / 2, o.y + (rows - 0.5) * s * 1.5 + s * 0.5],
    points: { first: [o.x, o.y] },
    labels,
    ...(any
      ? {
          light: { x: (o.x + x1) / 2, y: o.y, rx: 300 + w * cols, ry: 260, color: on, alpha: 0.08 },
        }
      : {}),
  };
}
