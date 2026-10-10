/**
 * Grim Ink crowd (PLAN.md#14.20), part 1: one background person — simplified on purpose (flat
 * plane colour, no hatching, dot eyes) so the hand-built people read in front, but still on the
 * real rig (2-bone arms projected through the view, the far arm behind the body), with a body
 * kind, a head kind and a reaction acted on twos. Port of the three films' `cast/crowd.js`
 * (`ST.crowdFigure`: the shared small `D`, the body polygons, the hats, modes stand / point /
 * mutter / vote / sit / cover / work), generalised: period-neutral body and head kinds, more
 * reactions (cheer, gasp, hush, wave, lean), each figure's phase from its seed.
 */
import { z } from 'zod';
import { C, hash, twos } from '../core.js';
import { brushStroke, figure, type BrushEnv } from '../draw/brushes.js';
import type { RigDims } from '../draw/character.js';
import { resolveView } from '../draw/figure.js';
import type { Paint2D } from '../draw/paint.js';
import { footAt, handAt, pose, type Pose } from '../draw/poses.js';
import { solve, type LimbRig } from '../draw/rig-layers.js';
import { blob, ellipseRing, tube } from '../draw/shapes.js';
import { coord, seedSchema, timeSchema } from './common.js';
import { CROWD_PALETTES, type CrowdPalette } from './crowd-palettes.js';

/** The films' shared background body (`crowd.js`: `sw 30, sy -250 …`). */
export const CROWD_D: RigDims = {
  sw: 30,
  sy: -250,
  sz: 0,
  l1a: 64,
  l2a: 60,
  hw: 16,
  hy: -120,
  l1l: 64,
  l2l: 58,
  elbowOut: 0.8,
  waist: [34, -160],
  hsz: 20,
};

export const BODY_KINDS = [
  'tunic',
  'robe',
  'coat',
  'dress',
  'stout',
  'suit',
  'coverall',
  'child',
] as const;
export const HEAD_KINDS = [
  'bare',
  'cap',
  'hood',
  'brim',
  'bun',
  'scarf',
  'helmet',
  'headset',
  'cone',
  'knot',
] as const;
export const REACTIONS = [
  'stand',
  'cheer',
  'gasp',
  'hush',
  'wave',
  'point',
  'lean',
  'mutter',
  'work',
  'hold',
  'sit',
  'cover',
] as const;
export type Reaction = (typeof REACTIONS)[number];

/** Body silhouettes in figure space (feet at 0), from the films' `BODY` tables. */
// prettier-ignore
const BODY: Readonly<Record<(typeof BODY_KINDS)[number], readonly number[]>> = {
  tunic: [-30, -262, 30, -262, 36, -110, -36, -110],
  robe: [-26, -262, 26, -262, 34, -20, -34, -20],
  coat: [-30, -262, 30, -262, 40, -60, -40, -60],
  dress: [-30, -262, 30, -262, 64, -40, -64, -40],
  stout: [-38, -262, 38, -262, 52, -150, 0, -120, -52, -150],
  suit: [-30, -262, 30, -262, 34, -140, -34, -140],
  coverall: [-32, -262, 32, -262, 36, -130, -36, -130],
  child: [-22, -250, 22, -250, 26, -140, -26, -140],
};

const PALETTE_NAMES = Object.keys(CROWD_PALETTES) as [CrowdPalette, ...CrowdPalette[]];

export const crowdFigureSchema = z.strictObject({
  x: coord.default(960),
  y: coord.default(900),
  s: z.number().min(0.1).max(8).default(1),
  view: z
    .union([z.enum(['front', 'three-quarter', 'profile', 'back']), z.number().int().min(-3).max(3)])
    .default(0),
  body: z.enum(BODY_KINDS).optional(),
  head: z.enum(HEAD_KINDS).optional(),
  reaction: z.enum(REACTIONS).default('stand'),
  t: timeSchema,
  t0: timeSchema,
  palette: z.enum(PALETTE_NAMES).default('town'),
  tone: z.number().int().min(0).max(63).optional(),
  colors: z.tuple([z.string(), z.string(), z.string()]).optional(),
  lean: z.number().min(-30).max(30).default(0),
  far: z.boolean().default(false),
  seed: seedSchema.default(1000),
});

export type CrowdFigureOptions = z.output<typeof crowdFigureSchema>;

/** The pose of a reaction at acting time tt (phase from the seed so a crowd is never in sync). */
function reactionPose(
  reaction: Reaction,
  tt: number,
  seed: number,
): { readonly P: Pose; readonly lean: number; readonly jolt: number } {
  const D = CROWD_D;
  const beat = Math.floor(tt * 4 + hash(seed, 3) * 4) % 2 === 0;
  const stand = pose('stand', D);
  switch (reaction) {
    case 'cheer':
      return {
        P: {
          ...pose('armsUp', D),
          hL: handAt(D, 1, 0.3, beat ? -0.85 : -0.6, 0.12),
          hR: handAt(D, -1, 0.3, beat ? -0.6 : -0.85, 0.12),
        },
        lean: 0,
        jolt: beat ? -6 : 0,
      };
    case 'gasp':
      return {
        P: {
          ...stand,
          hL: handAt(D, 1, 0.42, -0.18, 0.3),
          hR: handAt(D, -1, 0.42, -0.18, 0.3),
          kL: 'open',
          kR: 'open',
        },
        lean: -6,
        jolt: -8,
      };
    case 'hush':
      return {
        P: { ...stand, hR: handAt(D, -1, 0.3, -0.25, 0.3), kR: 'point', poleR: [-1, 0.3, -0.4] },
        lean: 3,
        jolt: 0,
      };
    case 'wave':
      return {
        P: {
          ...stand,
          hR: handAt(D, -1, beat ? 0.45 : 0.15, -0.8, 0.1),
          kR: 'open',
          poleR: [-1, 0.2, -0.3],
        },
        lean: 0,
        jolt: 0,
      };
    case 'point':
      return { P: { ...stand, hR: handAt(D, -1, 0.1, -0.1, 0.9), kR: 'point' }, lean: 4, jolt: 0 };
    case 'lean':
      return {
        P: { ...stand, hL: handAt(D, 1, -0.05, 0.62, 0.4), hR: handAt(D, -1, -0.05, 0.62, 0.4) },
        lean: 12,
        jolt: 0,
      };
    case 'mutter':
      return {
        P: {
          ...stand,
          hR: handAt(D, -1, 0.15, beat ? -0.1 : 0.15, 0.4),
          kR: 'fist',
          poleR: [-1, 0.4, -0.3],
        },
        lean: 2,
        jolt: 0,
      };
    case 'work': {
      const s = Math.sin((tt + hash(seed, 4)) * 6.28 * 1.5);
      return {
        P: {
          ...stand,
          hL: handAt(D, 1, -0.1, 0.55, 0.75 + 0.06 * s),
          hR: handAt(D, -1, -0.1, 0.6, 0.75 - 0.06 * s),
        },
        lean: 4,
        jolt: 0,
      };
    }
    case 'hold':
      return {
        P: { ...stand, hR: handAt(D, -1, 0.35, -0.45, 0.35), kR: 'grip', poleR: [-1, 0.3, -0.3] },
        lean: 0,
        jolt: 0,
      };
    case 'sit':
      return {
        P: {
          ...stand,
          hL: handAt(D, 1, -0.15, 0.48, 0.62),
          hR: handAt(D, -1, -0.15, 0.5, 0.6),
          fL: footAt(D, 1, 0.06, 0, 0.42),
          fR: footAt(D, -1, 0.06, 0, 0.38),
          bob: 0.4,
        },
        lean: 0,
        jolt: 0,
      };
    case 'cover':
      return {
        P: {
          ...pose('armsUp', D),
          hL: handAt(D, 1, 0.1, -0.75, 0.25),
          hR: handAt(D, -1, 0.1, -0.75, 0.25),
        },
        lean: 0,
        jolt: 0,
      };
    case 'stand':
      return { P: stand, lean: 0, jolt: 0 };
  }
}

function hat(
  g: Paint2D,
  e: BrushEnv,
  head: (typeof HEAD_KINDS)[number],
  hy: number,
  colD: string,
  seed: number,
): void {
  const o = { lw: 4, seed };
  // prettier-ignore
  const shapes: Partial<Record<(typeof HEAD_KINDS)[number], readonly [readonly number[], string]>> = {
    cap: [[-20, hy - 12, -14, hy - 32, 20, hy - 34, 26, hy - 14], colD],
    hood: [[-26, hy + 20, -24, hy - 26, 6, hy - 38, 30, hy - 18, 28, hy + 18], colD],
    brim: [[-30, hy - 18, 34, hy - 18, 18, hy - 46, 0, hy - 44], colD],
    bun: [[-24, hy - 4, -20, hy - 30, 0, hy - 50, 20, hy - 30, 24, hy - 4], '#24201c'],
    scarf: [[-28, hy + 24, -24, hy - 20, 8, hy - 34, 28, hy - 14, 30, hy + 26], colD],
    helmet: [[-26, hy - 4, -24, hy - 30, 0, hy - 38, 24, hy - 30, 26, hy - 4], C.STONE_D],
    cone: [[-50, hy - 6, 0, hy - 54, 50, hy - 6, 0, hy - 14], '#8f7c4e'],
  };
  const shape = shapes[head];
  if (shape) blob(g, e, shape[0], shape[1], o);
  if (head === 'knot') tube(g, e, [-6, hy - 26, 4, hy - 40, 14, hy - 40], [10, 8, 6], '#cfc7b0', o);
  if (head === 'headset')
    brushStroke(g, e, [-22, hy, -20, hy - 32, 22, hy - 32, 22, hy], {
      w: 5,
      color: C.BLACK,
      seed,
      taper: false,
    });
}

/** Draws one crowd person; returns where its head is (world). */
export function drawCrowdFigure(
  g: Paint2D,
  e: BrushEnv,
  o: CrowdFigureOptions,
): readonly [number, number] {
  const V = resolveView(o.view);
  const active = o.t >= o.t0;
  const tt = twos(o.t);
  const act = reactionPose(active ? o.reaction : 'stand', tt, o.seed);
  const palette = CROWD_PALETTES[o.palette];
  const [col, colD, skin] =
    o.colors ??
    palette[(o.tone ?? Math.floor(hash(o.seed, 1) * palette.length)) % palette.length] ??
    palette[0];
  const body = o.body ?? BODY_KINDS[Math.floor(hash(o.seed, 2) * 6)] ?? 'tunic';
  const head = o.head ?? HEAD_KINDS[Math.floor(hash(o.seed, 5) * HEAD_KINDS.length)] ?? 'bare';
  const k = body === 'child' ? 0.82 : 1;
  const J = solve(V, CROWD_D, act.P);
  const onset = active && o.t - o.t0 < 0.2 ? act.jolt : 0;
  const lean = o.lean + act.lean;
  const arm = (fe: BrushEnv, j: LimbRig, kind: string | undefined): void => {
    tube(g, fe, [j.s[0], j.s[1], j.e[0], j.e[1], j.h[0], j.h[1]], [20, 16, 14], col, {
      lw: 5,
      seed: o.seed + 1,
    });
    if (!o.far)
      blob(g, fe, ellipseRing(j.h[0], j.h[1] + 6, 10, 11, 6), skin, { lw: 4, seed: o.seed + 2 });
    if (kind === 'point' && !o.far)
      brushStroke(
        g,
        fe,
        [
          j.h[0],
          j.h[1] + 8,
          j.h[0] + Math.sin((j.ang * Math.PI) / 180) * 22,
          j.h[1] + 8 + Math.cos((j.ang * Math.PI) / 180) * 22,
        ],
        { w: 6, color: skin, seed: o.seed + 3 },
      );
  };
  figure(g, e, { x: o.x, y: o.y, s: o.s * k, lean }, V.mir, (fe) => {
    const arms: readonly [LimbRig, string | undefined][] = [
      [J.aL, act.P.kL],
      [J.aR, act.P.kR],
    ];
    for (const [j, kind] of arms) if (j.behind) arm(fe, j, kind);
    for (const j of [J.lL, J.lR])
      tube(g, fe, [j.s[0], j.s[1], j.e[0], j.e[1], j.h[0], j.h[1]], [20, 16, 14], colD, {
        lw: 5,
        seed: o.seed + 4,
      });
    for (const j of [J.lL, J.lR])
      blob(
        g,
        fe,
        ellipseRing(j.h[0] + (V.v === 2 ? 8 : 0), j.h[1] + 4, V.v === 2 ? 18 : 12, 8, 6),
        C.INK,
        { lw: 0, seed: o.seed + 5 },
      );
    g.save();
    g.translate(0, J.bob);
    const outline = BODY[body].map((v, i) => (i % 2 === 0 && V.v === 2 ? v * 0.7 : v));
    blob(g, fe, outline, col, { lw: 5, seed: o.seed + 6, shade: [colD, -10, 4] });
    if (body === 'suit' && V.v < 3)
      brushStroke(g, fe, [[0, 12, 22][V.v] ?? 0, -258, ([0, 12, 22][V.v] ?? 0) + 2, -190], {
        w: 5,
        color: C.BLACK,
        seed: o.seed + 7,
        taper: false,
      });
    const hy = -290 + onset;
    const fx = [0, 10, 18, 0][V.v] ?? 0;
    blob(g, fe, ellipseRing(fx * 0.3, hy, 22, 28, 8), skin, { lw: 5, seed: o.seed + 8 });
    if (V.v < 3 && !o.far) {
      g.fillStyle = C.INK;
      if (V.v < 2) g.fillRect(fx - 10, hy - 6, 4, 5);
      g.fillRect(fx + 6, hy - 6, 4, 5);
      brushStroke(g, fe, [fx + 2, hy - 2, fx + 4 + V.v * 4, hy + 8], { w: 3, seed: o.seed + 9 });
      const r = active ? o.reaction : 'stand';
      if (r === 'gasp' || r === 'cheer')
        blob(g, fe, ellipseRing(fx + 2, hy + 15, 5, r === 'gasp' ? 7 : 5, 6), C.MOUTH, {
          lw: 0,
          seed: o.seed + 10,
        });
      else if (r === 'mutter' && Math.floor(tt * 6 + o.seed) % 2)
        brushStroke(g, fe, [fx - 4, hy + 14, fx + 8, hy + 12], {
          w: 4,
          seed: o.seed + 11,
          taper: false,
        });
      else
        brushStroke(g, fe, [fx - 5, hy + 14, fx + 7, hy + 15], {
          w: 2.5,
          seed: o.seed + 12,
          taper: false,
        });
    }
    hat(g, fe, head, hy, colD, o.seed + 13);
    g.restore();
    for (const [j, kind] of arms) if (!j.behind) arm(fe, j, kind);
    if (active && o.reaction === 'cover') {
      const mx = (J.aL.h[0] + J.aR.h[0]) / 2;
      const top = Math.min(J.aL.h[1], J.aR.h[1]) - 24;
      // prettier-ignore
      blob(g, fe, [mx - 110, top + 40, mx - 70, top, mx + 70, top, mx + 110, top + 40, mx + 84, top + 60, mx - 84, top + 60], '#8f8a74', { lw: 4, seed: o.seed + 14, shade: ['#6f6a56', 0, 6] });
    }
    if (active && o.reaction === 'hold')
      blob(
        g,
        fe,
        [
          J.aR.h[0] - 22,
          J.aR.h[1] - 40,
          J.aR.h[0] + 22,
          J.aR.h[1] - 42,
          J.aR.h[0] + 24,
          J.aR.h[1] - 8,
          J.aR.h[0] - 20,
          J.aR.h[1] - 6,
        ],
        '#b8ad8a',
        { sharp: true, lw: 4, seed: o.seed + 15 },
      );
  });
  return [o.x, o.y - 290 * o.s * k];
}
