/**
 * Grim Ink small effects (PLAN.md#14.20): flat-shape marks the films draw for a beat — dust puffs
 * (`03-apollo-11/js/shots/shots-c.js` touchdown), an impact burst (`01-samurai-edo/js/shots/
 * shots-b.js` CLACK strokes), a gleam or sparks (`props.js` rackSword), sweat drops, steam and a
 * smoke curl (`props.js` mug, `sets-c.js` cigSmoke), groan / sniff marks (`02-papal-conclave/js/
 * shots/shots-c.js` ST.marks), slam / clang / click lines, a ripple of rings (`lunar.js` dent) and
 * a camera / object shake offset. Every one takes `t`, `t0`, `dur`, `seed`: nothing outside
 * [t0, t0 + dur], moving on twos, never a texture or a gradient.
 */
import { z } from 'zod';
import { hash, rnd, twos } from '../core.js';
import { brushStroke, curve, inkLine, type BrushEnv } from '../draw/brushes.js';
import type { Paint2D } from '../draw/paint.js';
import { wobble } from '../draw/scenery.js';
import { blob, ellipseRing } from '../draw/shapes.js';
import {
  checkedDraws,
  checkedRuns,
  coord,
  local,
  seedSchema,
  sizeSchema,
  timeSchema,
  type Drawn,
} from './common.js';

const base = (d: number) => ({
  x: coord.default(960),
  y: coord.default(540),
  t: timeSchema,
  t0: timeSchema,
  dur: z.number().min(0.05).max(1e4).default(d),
  size: sizeSchema,
});

/** Phase in [0, 1) on twos, or undefined outside [t0, t0 + dur). */
function live(t: number, t0: number, dur: number): number | undefined {
  const d = twos(t) - t0;
  return d < 0 || d >= dur ? undefined : d / dur;
}

/** A tapered dash: three points, so the ink line swells in the middle (two-point lines taper to a hair). */
function dash(
  g: Paint2D,
  e: BrushEnv,
  pts: readonly [number, number, number, number],
  w: number,
  seed: number,
  color?: string,
): void {
  const [x0, y0, x1, y1] = pts;
  brushStroke(g, e, [x0, y0, (x0 + x1) / 2, (y0 + y1) / 2, x1, y1], {
    w,
    seed,
    ...(color === undefined ? {} : { color }),
  });
}

const none = (x: number, y: number): Drawn => ({ box: [x, y, x, y], points: { centre: [x, y] } });
const around = (x: number, y: number, r: number): Drawn => ({
  box: [x - r, y - r, x + r, y + r],
  points: { centre: [x, y] },
});

const dustSchema = z.strictObject({
  ...base(1.0),
  spread: z.number().min(0.2).max(4).default(1),
  seed: seedSchema.default(1300),
});

function dust(g: Paint2D, e: BrushEnv, o: z.output<typeof dustSchema>): Drawn {
  const k = live(o.t, o.t0, o.dur);
  if (k === undefined) return none(o.x, o.y);
  const grow = Math.min(1, k * 1.8);
  for (let i = 0; i < 11; i += 1) {
    const s = (i - 5) / 5;
    const r = (40 + 40 * hash(o.seed, i)) * (0.4 + grow) * (1.1 - Math.abs(s) * 0.4) * o.size;
    const px = o.x + s * (120 + 360 * grow) * o.spread * o.size;
    const py = o.y - r * 0.45 - (1 - Math.abs(s)) * 60 * grow * o.size;
    // prettier-ignore
    blob(g, e, ellipseRing(px, py, r * 1.25, r * 0.8, 10), i % 2 ? '#8f8a7e' : '#a7a295', { lw: 5, seed: o.seed + 1 + i, shade: ['#6c695f', r * 0.15, r * 0.2], light: ['rgba(230,225,205,0.35)', -r * 0.2, -r * 0.25], hatch: { c: 'rgba(50,48,40,0.35)', n: 2, len: r * 0.5, gap: 6, k: 3, ang: 20 } });
  }
  return around(o.x, o.y, 520 * o.spread * o.size);
}

const impactSchema = z.strictObject({
  ...base(0.4),
  kind: z.enum(['lines', 'star']).default('lines'),
  seed: seedSchema.default(1320),
});

function impact(g: Paint2D, e: BrushEnv, o: z.output<typeof impactSchema>): Drawn {
  if (live(o.t, o.t0, o.dur) === undefined) return none(o.x, o.y);
  const n = Math.floor(twos(o.t) * 12) % 2;
  if (o.kind === 'star') {
    const pts: number[] = [];
    for (let i = 0; i < 16; i += 1) {
      const a = (i / 16) * Math.PI * 2 + n * 0.2;
      const r = (i % 2 ? 22 : 58 + 22 * hash(o.seed, i, n)) * o.size;
      pts.push(o.x + Math.cos(a) * r, o.y + Math.sin(a) * r);
    }
    blob(g, e, pts, '#e2d8b8', { sharp: true, lw: 6, seed: o.seed });
  }
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2 + n * 0.4;
    const r = (30 + 26 * hash(o.seed + 20, i, n)) * o.size * (o.kind === 'star' ? 1.3 : 1);
    const r0 = 14 * o.size * (o.kind === 'star' ? 5.2 : 1);
    const c = Math.cos(a);
    const s = Math.sin(a);
    dash(
      g,
      e,
      [o.x + c * r0, o.y + s * r0, o.x + c * (r0 + r), o.y + s * (r0 + r)],
      7,
      o.seed + 1 + i,
    );
  }
  return around(o.x, o.y, 140 * o.size);
}

const sparkSchema = z.strictObject({
  ...base(0.35),
  kind: z.enum(['gleam', 'sparks']).default('gleam'),
  seed: seedSchema.default(1340),
});

function spark(g: Paint2D, e: BrushEnv, o: z.output<typeof sparkSchema>): Drawn {
  const k = live(o.t, o.t0, o.dur);
  if (k === undefined) return none(o.x, o.y);
  if (o.kind === 'gleam') {
    const r = (24 + 44 * Math.sin(k * Math.PI)) * o.size;
    const tilt = rnd(-12, 12, o.seed, 9);
    // a flat four-point star (the films' sword gleam), tilted a little by the seed
    local(g, o.x, o.y, tilt, 1, () => {
      // prettier-ignore
      blob(g, e, [-r, 0, -5, -5, 0, -r, 5, -5, r, 0, 5, 5, 0, r, -5, 5], '#efe7c8', { sharp: true, lw: 0, seed: o.seed });
    });
    return around(o.x, o.y, 70 * o.size);
  }
  for (let i = 0; i < 7; i += 1) {
    const a = rnd(-Math.PI, 0, o.seed, i);
    const d = (20 + 120 * k) * o.size * rnd(0.6, 1.2, o.seed, i, 1);
    const sx = o.x + Math.cos(a) * d;
    const sy = o.y + Math.sin(a) * d + 60 * k * k * o.size;
    const tail: readonly [number, number, number, number] = [
      sx,
      sy,
      sx + Math.cos(a) * 18 * o.size,
      sy + Math.sin(a) * 18 * o.size,
    ];
    dash(g, e, tail, 6, o.seed + i, '#e0a443');
  }
  return around(o.x, o.y, 160 * o.size);
}

const sweatSchema = z.strictObject({
  ...base(1e4),
  n: z.number().int().min(1).max(12).default(3),
  spread: z.number().min(0).max(600).default(40),
  seed: seedSchema.default(1360),
});

function sweat(g: Paint2D, e: BrushEnv, o: z.output<typeof sweatSchema>): Drawn {
  if (live(o.t, o.t0, o.dur) === undefined) return none(o.x, o.y);
  const tt = twos(o.t);
  for (let i = 0; i < o.n; i += 1) {
    const sx = o.x + rnd(-1, 1, o.seed, i) * o.spread;
    const sy = o.y + rnd(-0.4, 0.4, o.seed, i, 1) * o.spread;
    const dy = ((tt * 0.9 + hash(o.seed, i)) % 1) * 24 * o.size;
    const r = (4 + 1.5 * hash(o.seed, i, 2)) * o.size;
    // prettier-ignore
    blob(g, e, [sx, sy + dy - r * 2.2, sx + r, sy + dy, sx, sy + dy + r, sx - r, sy + dy], '#c4c6b4', { lw: 3, seed: o.seed + i, light: ['rgba(255,255,240,0.5)', 2, -2] });
  }
  return around(o.x, o.y, o.spread + 30 * o.size);
}

const curlSchema = z.strictObject({
  ...base(1e4),
  n: z.number().int().min(1).max(6).default(2),
  seed: seedSchema.default(1380),
});

function curls(
  g: Paint2D,
  e: BrushEnv,
  o: z.output<typeof curlSchema>,
  colour: string,
  w: number,
): Drawn {
  if (live(o.t, o.t0, o.dur) === undefined) return none(o.x, o.y);
  const f = Math.floor(twos(o.t) * 3) % 3;
  const k = o.size;
  for (let i = 0; i < o.n; i += 1) {
    const x = o.x + (i - (o.n - 1) / 2) * 16 * k;
    // prettier-ignore
    brushStroke(g, e, [x, o.y, x + (10 + f * 4) * k, o.y - 40 * k, x - (6 + f * 3) * k, o.y - 90 * k, x + 12 * k, o.y - 150 * k], { w, color: colour, seed: o.seed + i * 3 + f, taper: false });
  }
  return around(o.x, o.y - 75 * k, 90 * k);
}

const marksSchema = z.strictObject({
  ...base(1e4),
  dir: z.union([z.literal(1), z.literal(-1)]).default(1),
  seed: seedSchema.default(1400),
});

function marks(g: Paint2D, e: BrushEnv, o: z.output<typeof marksSchema>): Drawn {
  if (live(o.t, o.t0, o.dur) === undefined) return none(o.x, o.y);
  const k = o.size;
  for (let i = 0; i < 3; i += 1)
    brushStroke(
      g,
      e,
      [
        o.x + o.dir * 10 * k,
        o.y - (20 - i * 20) * k,
        o.x + o.dir * 40 * k,
        o.y - (30 - i * 30) * k,
      ],
      { w: 5, seed: o.seed + i, taper: false },
    );
  return around(o.x, o.y, 50 * k);
}

const linesSchema = z.strictObject({
  ...base(0.3),
  kind: z.enum(['slam', 'clang', 'click']).default('slam'),
  dir: z.union([z.literal(1), z.literal(-1)]).default(1),
  n: z.number().int().min(1).max(8).default(3),
  seed: seedSchema.default(1420),
});

function shakeLines(g: Paint2D, e: BrushEnv, o: z.output<typeof linesSchema>): Drawn {
  if (live(o.t, o.t0, o.dur) === undefined) return none(o.x, o.y);
  const k = o.size;
  for (let i = 0; i < o.n; i += 1) {
    if (o.kind === 'slam')
      brushStroke(
        g,
        e,
        [
          o.x - o.dir * i * 40 * k,
          o.y + i * 80 * k,
          o.x - o.dir * (i * 40 + 60) * k,
          o.y + (i * 80 - 20) * k,
        ],
        { w: 7, seed: o.seed + i, taper: false },
      );
    if (o.kind === 'clang')
      brushStroke(
        g,
        e,
        [
          o.x + o.dir * (i * 16) * k,
          o.y + i * 6 * k,
          o.x + o.dir * (12 + i * 16) * k,
          o.y + (40 + i * 2) * k,
        ],
        { w: 5, seed: o.seed + i, taper: false },
      );
    if (o.kind === 'click') {
      dash(
        g,
        e,
        [o.x - i * 30 * k, o.y + i * 26 * k, o.x - (40 + i * 40) * k, o.y + (i * 30 - 10) * k],
        7,
        o.seed + i,
      );
    }
  }
  return around(o.x, o.y, 200 * k);
}

const rippleSchema = z.strictObject({
  ...base(0.9),
  r: z.number().min(4).max(800).default(30),
  seed: seedSchema.default(1440),
});

function ripple(g: Paint2D, e: BrushEnv, o: z.output<typeof rippleSchema>): Drawn {
  const k = live(o.t, o.t0, o.dur);
  if (k === undefined) return none(o.x, o.y);
  const wob = 1 - k;
  for (let i = 1; i <= 2; i += 1) {
    const rr = o.r * (1 + i * 0.5 + wob * 0.3);
    const ring = wobble(
      ellipseRing(o.x, o.y, rr, rr * 0.8, 10),
      3 * wob,
      o.seed + i + Math.floor(wob * 6),
      30,
    );
    inkLine(g, e, curve(ring, true, 6), { w: 3, closed: true, seed: o.seed + 5 + i });
  }
  return around(o.x, o.y, o.r * 2.2);
}

const shakeSchema = z.strictObject({
  t: timeSchema,
  t0: timeSchema,
  dur: z.number().min(0.05).max(1e4).default(0.2),
  px: z.number().min(0).max(80).default(8),
  axis: z.enum(['x', 'y', 'both']).default('x'),
});

/** Offset `[dx, dy]` (px) that jitters +-px on twos inside [t0, t0 + dur]: add it to a camera or a thing. */
function shake(o: z.output<typeof shakeSchema>): readonly [number, number] {
  if (live(o.t, o.t0, o.dur) === undefined) return [0, 0];
  const s = Math.floor(twos(o.t) * 12) % 2 ? o.px : -o.px;
  return [o.axis === 'y' ? 0 : s, o.axis === 'x' ? 0 : -s];
}

const FX_TIME = 't, t0 (start), dur';

export const FX_DRAW_ITEMS = {
  dust: {
    doc: 'grey dust puffs billowing out and up from a landing, a fall or a slammed sack',
    params: `x, y = ground point; ${FX_TIME} = 1.0; size; spread; seed`,
    schema: dustSchema,
    draw: dust,
  },
  impact: {
    doc: 'a collision: radial ink strokes alternating on twos (lines) or a bone star burst with strokes (star)',
    params: `x, y = the contact; ${FX_TIME} = 0.4; kind lines|star; size; seed`,
    schema: impactSchema,
    draw: impact,
  },
  spark: {
    doc: 'a flat four-point gleam on metal (grows and shrinks) or sparks flying up and falling',
    params: `x, y; ${FX_TIME} = 0.35; kind gleam|sparks; size; seed`,
    schema: sparkSchema,
    draw: spark,
  },
  sweat: {
    doc: 'sweat drops that drip and restart on twos around a point (a brow in world space)',
    params: `x, y; ${FX_TIME} (default: forever); n = 3; spread px; size; seed`,
    schema: sweatSchema,
    draw: sweat,
  },
  steam: {
    doc: 'pale steam curls rising from a cup, a pot, a wet coat, cycling on twos',
    params: `x, y = the source; ${FX_TIME}; n = 2; size; seed`,
    schema: curlSchema,
    draw: (g: Paint2D, e: BrushEnv, o: z.output<typeof curlSchema>) =>
      curls(g, e, o, 'rgba(200,195,170,0.6)', 3),
  },
  smoke: {
    doc: 'a thin smoke curl (a cigarette, a fuse, a snuffed candle), cycling on twos',
    params: `x, y = the source; ${FX_TIME}; n = 2; size; seed`,
    schema: curlSchema,
    draw: (g: Paint2D, e: BrushEnv, o: z.output<typeof curlSchema>) =>
      curls(g, e, o, 'rgba(190,185,160,0.5)', 4),
  },
  marks: {
    doc: 'three short strokes fanning from a point: a groan, a sniff, a sigh beside a face',
    params: `x, y; ${FX_TIME}; dir 1|-1; size; seed`,
    schema: marksSchema,
    draw: marks,
  },
  shakeLines: {
    doc: 'motion lines of a beat: a slammed door (slam), a ringing bell (clang), a helmet or latch (click)',
    params: `x, y; ${FX_TIME} = 0.3; kind slam|clang|click; dir; n = 3; size; seed`,
    schema: linesSchema,
    draw: shakeLines,
  },
  ripple: {
    doc: 'wobbling rings round a poke, a dent or a drop in water, dying out',
    params: `x, y; ${FX_TIME} = 0.9; r = 30; size; seed`,
    schema: rippleSchema,
    draw: ripple,
  },
} as const;

export const FX_RUN_ITEMS = {
  shake: {
    doc: 'an offset that jitters +-px on twos for an impact: add it to the cut framing or to a thing (draws nothing)',
    params: 't, t0, dur = 0.2; px = 8; axis x|y|both',
    returns: '[dx, dy]',
    schema: shakeSchema,
    run: shake,
  },
} as const;

export const FX_DRAWS = checkedDraws('fx', FX_DRAW_ITEMS);
export const FX_RUNS = checkedRuns('fx', FX_RUN_ITEMS);

/** `env.ink.fx`: draw entries `(g, e, opts)` plus `shake(opts)`. */
export const FX = Object.freeze({ ...FX_DRAWS, ...FX_RUNS });
