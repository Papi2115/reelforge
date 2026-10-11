/**
 * Grim Ink crowd (PLAN.md#14.20), part 2: the registry of `env.ink.crowd.*` — one background
 * person (`figure`, crowd-body.ts), rows and tiers of them with density, palette, deterministic
 * jitter and a reaction that ripples through the crowd (`rows`), and flat ink foreground pieces at
 * the lens (`foreground`: a huge back, a row of heads, an accusing arm). Port of the films' crowd
 * lines (`02-papal-conclave/js/shots/shots-a.js` death: 9 figures in alternating depth, `shots-b.js`
 * patience: staggered mutter), the huge backs at the lens (P death, nopope; A control) and
 * `ST.fgArm` (P refuse).
 */
import { z } from 'zod';
import { hash, rnd, twos } from '../core.js';
import type { BrushEnv } from '../draw/brushes.js';
import { FG_INK } from '../draw/camera.js';
import type { Paint2D } from '../draw/paint.js';
import { rough } from '../draw/scenery.js';
import { blob, ellipseRing, tube } from '../draw/shapes.js';
import {
  checkedDraws,
  coord,
  seedSchema,
  timeSchema,
  toneOf,
  toneSchema,
  type Drawn,
} from './common.js';
import {
  BODY_KINDS,
  HEAD_KINDS,
  REACTIONS,
  crowdFigureSchema,
  drawCrowdFigure,
} from './crowd-body.js';
import { CROWD_PALETTES, type CrowdPalette } from './crowd-palettes.js';

const PALETTES = Object.keys(CROWD_PALETTES) as [CrowdPalette, ...CrowdPalette[]];

const rowsSchema = z.strictObject({
  x0: coord.default(-100),
  x1: coord.default(2020),
  y: coord.default(1000),
  rows: z.number().int().min(1).max(8).default(3),
  density: z.number().min(0.1).max(4).default(0.8),
  s: z.number().min(0.1).max(6).default(1.1),
  shrink: z.number().min(0.4).max(1).default(0.82),
  step: z.number().min(0).max(400).default(70),
  view: z
    .union([z.enum(['front', 'three-quarter', 'profile', 'back']), z.number().int().min(-3).max(3)])
    .default(0),
  turn: z.number().min(0).max(1).default(0.3),
  reaction: z.enum(REACTIONS).default('stand'),
  mix: z.number().min(0).max(1).default(1),
  t: timeSchema,
  t0: timeSchema,
  stagger: z.number().min(0).max(2).default(0.06),
  palette: z.enum(PALETTES).default('town'),
  tiers: z.boolean().default(false),
  tierTone: toneSchema.default('wood'),
  seed: seedSchema.default(1100),
});

function drawRows(
  g: Paint2D,
  e: BrushEnv,
  o: z.output<typeof rowsSchema>,
): Drawn & { readonly count: number } {
  let count = 0;
  const width = o.x1 - o.x0;
  const baseYaw =
    typeof o.view === 'number'
      ? o.view
      : ['front', 'three-quarter', 'profile', 'back'].indexOf(o.view);
  for (let r = o.rows - 1; r >= 0; r -= 1) {
    const s = o.s * Math.pow(o.shrink, r);
    const y = o.y - r * o.step;
    if (o.tiers) {
      const [fill, shade] = toneOf(o.tierTone);
      rough(
        g,
        e,
        [
          o.x0 - 40,
          y - 8,
          o.x1 + 40,
          y - 8,
          o.x1 + 40,
          y + o.step * 0.55,
          o.x0 - 40,
          y + o.step * 0.55,
        ],
        fill,
        {
          seed: o.seed + 500 + r,
          lw: 5,
          shade: [shade, 0, 8],
          hatch: { c: 'rgba(14,10,6,0.45)', n: 4, len: 90, gap: 7, k: 2, ang: 0, bend: 0 },
        },
      );
    }
    const n = Math.max(1, Math.round((width / 100) * o.density * (1 + r * 0.25)));
    const gap = width / n;
    for (let i = 0; i < n; i += 1) {
      const seed = o.seed + r * 97 + i * 13;
      const x = o.x0 + gap * (i + 0.5) + rnd(-0.3, 0.3, seed, 1) * gap + (r % 2) * gap * 0.5;
      const turned = hash(seed, 2) < o.turn ? (hash(seed, 3) < 0.5 ? -1 : 1) : 0;
      const yaw = Math.max(-3, Math.min(3, baseYaw === 3 ? 3 : baseYaw + turned));
      const reacts = hash(seed, 4) < o.mix;
      const delay =
        (Math.abs(x - (o.x0 + o.x1) / 2) / Math.max(1, width)) * o.stagger * n +
        hash(seed, 5) * o.stagger * 2;
      drawCrowdFigure(
        g,
        e,
        crowdFigureSchema.parse({
          x,
          y: y + rnd(-6, 6, seed, 6),
          s: s * rnd(0.93, 1.07, seed, 7),
          view: yaw,
          reaction: reacts ? o.reaction : 'stand',
          t: o.t,
          t0: o.t0 + delay,
          palette: o.palette,
          far: r >= 1 && s < 0.9,
          seed,
        }),
      );
      count += 1;
    }
  }
  const top = o.y - (o.rows - 1) * o.step - 320 * o.s;
  return {
    box: [o.x0 - 60, top, o.x1 + 60, o.y + 10],
    points: {
      front: [(o.x0 + o.x1) / 2, o.y],
      back: [(o.x0 + o.x1) / 2, o.y - (o.rows - 1) * o.step],
    },
    count,
  };
}

const foregroundSchema = z.strictObject({
  kind: z.enum(['back', 'heads', 'arm']).default('back'),
  x: coord.default(300),
  y: coord.default(1080),
  s: z.number().min(0.2).max(10).default(1),
  n: z.number().int().min(1).max(12).default(4),
  w: z.number().min(40).max(4000).default(900),
  toward: z.tuple([coord, coord]).default([960, 540]),
  bob: z.boolean().default(false),
  t: timeSchema,
  fill: z.string().default(FG_INK.screen),
  seed: seedSchema.default(1200),
});

function backShape(
  g: Paint2D,
  e: BrushEnv,
  x: number,
  y: number,
  s: number,
  fill: string,
  seed: number,
): void {
  // prettier-ignore
  blob(g, e, [x - 320 * s, y + 40, x - 300 * s, y - 180 * s, x - 150 * s, y - 280 * s, x + 150 * s, y - 280 * s, x + 300 * s, y - 180 * s, x + 320 * s, y + 40], fill, { lw: 0, seed });
  blob(g, e, ellipseRing(x + rnd(-10, 10, seed, 1) * s, y - 400 * s, 120 * s, 140 * s, 12), fill, {
    lw: 0,
    seed: seed + 1,
  });
}

function drawForeground(g: Paint2D, e: BrushEnv, o: z.output<typeof foregroundSchema>): Drawn {
  const tt = twos(o.t);
  if (o.kind === 'back') {
    backShape(g, e, o.x, o.y, o.s, o.fill, o.seed);
    return {
      box: [o.x - 320 * o.s, o.y - 540 * o.s, o.x + 320 * o.s, o.y + 40],
      points: { head: [o.x, o.y - 400 * o.s] },
    };
  }
  if (o.kind === 'heads') {
    for (let i = 0; i < o.n; i += 1) {
      const hx = o.x + (o.n === 1 ? 0 : (i / (o.n - 1) - 0.5) * o.w) + rnd(-30, 30, o.seed, i);
      const bob = o.bob && Math.floor(tt * 4 + hash(o.seed, i) * 4) % 2 === 0 ? -14 * o.s : 0;
      const k = o.s * rnd(0.85, 1.15, o.seed, i, 1);
      backShape(g, e, hx, o.y + bob + 120 * k, k * 0.55, o.fill, o.seed + 10 + i);
    }
    return {
      box: [o.x - o.w / 2 - 200 * o.s, o.y - 260 * o.s, o.x + o.w / 2 + 200 * o.s, o.y + 120 * o.s],
      points: { centre: [o.x, o.y] },
    };
  }
  const [tx, ty] = o.toward;
  const len = Math.hypot(tx - o.x, ty - o.y) || 1;
  const ux = (tx - o.x) / len;
  const uy = (ty - o.y) / len;
  const end = [o.x + ux * len * 0.82, o.y + uy * len * 0.82] as const;
  tube(
    g,
    e,
    [o.x, o.y, (o.x + end[0]) / 2, (o.y + end[1]) / 2 + 20 * o.s, end[0], end[1]],
    [150 * o.s, 120 * o.s, 90 * o.s],
    o.fill,
    { lw: 0, seed: o.seed },
  );
  blob(
    g,
    e,
    ellipseRing(end[0] + ux * 40 * o.s, end[1] + uy * 40 * o.s, 70 * o.s, 55 * o.s, 10),
    o.fill,
    { lw: 0, seed: o.seed + 1 },
  );
  tube(
    g,
    e,
    [
      end[0] + ux * 60 * o.s,
      end[1] + uy * 60 * o.s,
      end[0] + ux * 170 * o.s,
      end[1] + uy * 170 * o.s,
    ],
    [36 * o.s, 28 * o.s],
    o.fill,
    { lw: 0, seed: o.seed + 2 },
  );
  return {
    box: [
      Math.min(o.x, tx) - 160 * o.s,
      Math.min(o.y, ty) - 160 * o.s,
      Math.max(o.x, tx) + 160 * o.s,
      Math.max(o.y, ty) + 160 * o.s,
    ],
    points: { fingertip: [end[0] + ux * 170 * o.s, end[1] + uy * 170 * o.s] },
  };
}

export const CROWD_ITEMS = {
  figure: {
    doc: 'one background person: flat plane colour, dot eyes, no hatching, on the real rig; reacts on twos from t0',
    params: `x, y = feet; s = 1; view (name or ring yaw -3..3); body ${BODY_KINDS.join('|')}; head ${HEAD_KINDS.join('|')} (else from the seed); reaction ${REACTIONS.join('|')}; t, t0 (reaction start); palette ${PALETTES.join('|')}; tone (index) or colors [cloth, shade, skin]; lean; far (no face, no hands); seed`,
    returns: 'the head point [x, y] (world)',
    schema: crowdFigureSchema,
    draw: drawCrowdFigure,
  },
  rows: {
    doc: 'rows or tiers of background people, back row first: density, scale falling off with depth, deterministic jitter, some turned, a reaction that ripples out from the centre (stagger)',
    params: `x0, x1, y = the front row's feet; rows = 3; density = 0.8 (people per 100 px); s = 1.1 (front scale); shrink = 0.82 per row; step = 70 (row rise px); view; turn 0-1 (share turned); reaction; mix 0-1 (share reacting); t, t0; stagger (s); palette; tiers (benches); tierTone; seed`,
    returns: 'points front, back; count',
    schema: rowsSchema,
    draw: drawRows,
  },
  foreground: {
    doc: 'flat ink pieces at the lens (call inside env.ink.fgScreen for screen space): a huge back seen from behind, a row of heads (bobbing on twos when cheering), an accusing arm pointing in',
    params:
      'kind back|heads|arm; x, y = anchor (bottom centre; arm = where it enters the frame); s; n, w (heads); toward [x, y] (arm); bob; t; fill; seed',
    returns: 'points head / centre / fingertip',
    schema: foregroundSchema,
    draw: drawForeground,
  },
} as const;

/** `env.ink.crowd`: `(g, e, opts)` per entry, options checked. */
export const CROWD = checkedDraws('crowd', CROWD_ITEMS);
