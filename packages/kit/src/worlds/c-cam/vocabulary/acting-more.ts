/**
 * Grim Ink acting (PLAN.md#14.20), part 2: choreography where bodies react to each other —
 * stumble (and the other catches), flinch, bow (the second bows lower: `01-samurai-edo/js/shots/
 * shots-c.js` loan, shots-d.js payoff), point-and-turn (everyone points, he turns: `02-papal-
 * conclave/js/shots/shots-d.js` choice), shared-object tug, double take (A window, E street), hand
 * on (a palm ON the other's shoulder or arm: `03-apollo-11/js/shots/shots-c.js` payoff) and the
 * one-body slow "no" head shake (`02-papal-conclave/js/acting.js` ST.shake). Pure, on twos.
 */
import { z } from 'zod';
import { twos } from '../core.js';
import type { BodyAnchorName } from '../draw/anchors.js';
import type { Point2 } from '../draw/contact.js';
import { footAt } from '../draw/poses.js';
import { RING } from '../draw/rig-views.js';
import { turn } from '../draw/rig-views.js';
import { coord } from './common.js';
import {
  bodyPoint,
  chest,
  cue,
  faceToward,
  figOf,
  figSchema,
  gagBase,
  handKey,
  handLib,
  jolt,
  kindKey,
  lerp2,
  moved,
  palm,
  phase,
  reach,
  span,
  tilt,
  type Fig,
} from './acting-core.js';
import type { GagResult } from './acting-gags.js';

const side = z.enum(['L', 'R']).default('R');
const dur = (d: number) => z.number().min(0.1).max(20).default(d);
const oneBody = { a: figSchema, b: figSchema.optional(), t: gagBase.t, t0: gagBase.t0 } as const;

// ---------- stumble ----------

export const stumbleSchema = z.strictObject({
  ...oneBody,
  dur: dur(1.0),
  dir: z.union([z.literal(1), z.literal(-1)]).optional(),
  catch: z.boolean().default(true),
});

export function stumble(o: z.output<typeof stumbleSchema>): GagResult {
  const A = figOf(o.a);
  const B = o.b ? figOf(o.b) : undefined;
  const u = phase(o.t, o.t0, o.dur);
  const dir = o.dir ?? (B ? faceToward(A.placement.x, B.placement.x) : 1);
  const caught = o.catch && B !== undefined;
  const trip = span(u, 0, 0.3, 'out');
  const recover = span(u, 0.7, 1);
  const lean = tilt(A, dir * (caught ? 18 : 26) * trip * (1 - recover * 0.85));
  const ax = A.placement.x + dir * 40 * trip * A.placement.s;
  const D = A.character.D;
  const arms =
    u > 0 && u < 0.85
      ? {
          hL: handLib(A, 'L', 0.45, -0.3, 0.3),
          hR: handLib(A, 'R', 0.45, -0.3, 0.3),
          kL: 'open' as const,
          kR: 'open' as const,
        }
      : {};
  const foot =
    u > 0 && u < 0.5
      ? { [dir > 0 ? 'fL' : 'fR']: footAt(D, dir > 0 ? 1 : -1, 0.05, 0.12, -0.25) }
      : {};
  const Am = moved(A, { x: ax, lean, pose: { ...arms, ...foot } });
  const a = cue(Am, {
    x: ax,
    lean,
    pose: { ...arms, ...foot },
    headDy: jolt(o.t, o.t0, -16),
    ...(u > 0 ? { expr: u < 0.7 ? ('shock' as const) : ('miserable' as const) } : {}),
  });
  if (!B) return { u, a, b: a };
  const goal = chest(Am, B.placement.x);
  const k = caught ? span(u, 0.1, 0.35, 'out') * (1 - span(u, 0.8, 1)) : 0;
  const w = 30 * B.placement.s;
  const Bl = moved(B, { lean: tilt(B, -dir * 8 * k) });
  return {
    u,
    a,
    b: cue(Bl, {
      pose: caught
        ? {
            hL: reach(Bl, 'L', lerp2(palm(B, 'L'), [goal[0], goal[1] - w], k)),
            hR: reach(Bl, 'R', lerp2(palm(B, 'R'), [goal[0], goal[1] + w], k)),
            kL: 'flat',
            kR: 'flat',
          }
        : {},
      ...(u > 0 ? { expr: 'shock' as const } : {}),
    }),
    contact: goal,
  };
}

// ---------- flinch ----------

export const flinchSchema = z.strictObject({ ...gagBase, dur: dur(0.8), hand: side });

export function flinch(o: z.output<typeof flinchSchema>): GagResult {
  const A = figOf(o.a);
  const B = figOf(o.b);
  const u = phase(o.t, o.t0, o.dur);
  const dir = faceToward(A.placement.x, B.placement.x);
  const raise = span(u, 0, 0.25, 'out') * (1 - span(u, 0.7, 1));
  const head = bodyPoint(B, 'neck');
  const goal: Point2 = lerp2(
    palm(A, o.hand),
    [A.placement.x * 0.4 + B.placement.x * 0.6, head[1] - 60 * A.placement.s],
    raise,
  );
  const recoil = span(u, 0.2, 0.3, 'out') * (1 - 0.6 * span(u, 0.7, 1));
  const guard =
    recoil > 0
      ? {
          hL: handLib(B, 'L', 0.05, -0.35, 0.45),
          hR: handLib(B, 'R', 0.05, -0.35, 0.45),
          kL: 'open' as const,
          kR: 'open' as const,
        }
      : {};
  return {
    u,
    a: cue(A, { pose: { [handKey(o.hand)]: reach(A, o.hand, goal), [kindKey(o.hand)]: 'open' } }),
    b: cue(B, {
      pose: guard,
      lean: tilt(B, dir * 10 * recoil),
      headDy: jolt(o.t, o.t0 + 0.2 * o.dur, -16),
      ...(u >= 0.2 ? { expr: 'scared' as const } : {}),
    }),
  };
}

// ---------- bow ----------

export const bowSchema = z.strictObject({
  ...gagBase,
  dur: dur(1.6),
  depth: z.number().min(0).max(100).default(30),
  outdo: z.number().min(-60).max(60).default(12),
  hold: z.boolean().default(true),
});

export function bow(o: z.output<typeof bowSchema>): GagResult {
  const A = figOf(o.a);
  const B = figOf(o.b);
  const u = phase(o.t, o.t0, o.dur);
  const up = o.hold ? 0 : span(u, 0.8, 1);
  const bowA = o.depth * span(u, 0, 0.3, 'out') * (1 - up);
  const bowB = (o.depth + o.outdo) * span(u, 0.2, 0.5, 'out') * (1 - up);
  const flat = (f: Fig) => ({
    hL: handLib(f, 'L', -0.05, 0.82, 0.12),
    hR: handLib(f, 'R', -0.05, 0.82, 0.14),
    kL: 'flat' as const,
    kR: 'flat' as const,
  });
  return {
    u,
    a: cue(A, {
      pose: u > 0 ? flat(A) : {},
      bow: A.placement.bow + bowA,
      ...(u > 0 ? { look: [0, 0.6] as const } : {}),
    }),
    b: cue(B, {
      pose: u > 0.2 ? flat(B) : {},
      bow: B.placement.bow + bowB,
      ...(u > 0.5 ? { expr: 'smug' as const } : {}),
    }),
  };
}

// ---------- point and turn ----------

export const pointTurnSchema = z.strictObject({ ...gagBase, dur: dur(1.2), hand: side });

/** Ring index for `yaw` nearest to `from` (so a turn walks the short way). */
function ringNear(yaw: number, from: number): number {
  const base = RING.indexOf(yaw as (typeof RING)[number]);
  const i = base < 0 ? 0 : base;
  let best = i;
  for (const k of [-6, 0, 6]) if (Math.abs(i + k - from) < Math.abs(best - from)) best = i + k;
  return best;
}

export function pointTurn(o: z.output<typeof pointTurnSchema>): GagResult {
  const A = figOf(o.a);
  const B = figOf(o.b);
  const u = phase(o.t, o.t0, o.dur);
  const shoulder = bodyPoint(A, o.hand === 'R' ? 'sh.R' : 'sh.L');
  const head = bodyPoint(B, 'neck');
  const D = A.character.D;
  const len = (D.l1a + D.l2a) * 0.85 * A.placement.s;
  const dx = head[0] - shoulder[0];
  const dy = head[1] - 40 * B.placement.s - shoulder[1];
  const n = Math.hypot(dx, dy) || 1;
  const k = span(u, 0, 0.3, 'out');
  const goal = lerp2(
    palm(A, o.hand),
    [shoulder[0] + (dx / n) * len, shoulder[1] + (dy / n) * len],
    k,
  );
  const turnAt = o.t0 + 0.35 * o.dur;
  const fromRing = ringNear(B.placement.yaw, 0);
  const toRing = ringNear(faceToward(B.placement.x, A.placement.x), fromRing);
  const view =
    twos(o.t) >= turnAt
      ? turn(o.t, [
          [0, fromRing],
          [turnAt, toRing],
        ])
      : B.view;
  return {
    u,
    a: cue(A, { pose: { [handKey(o.hand)]: reach(A, o.hand, goal), [kindKey(o.hand)]: 'point' } }),
    b: cue(B, {
      view,
      headDy: jolt(o.t, turnAt, -12),
      ...(u >= 0.35 ? { expr: 'confused' as const } : {}),
    }),
    contact: head,
  };
}

// ---------- tug ----------

export const tugSchema = z.strictObject({
  ...gagBase,
  dur: dur(2.0),
  pull: z.number().min(0).max(2).default(1),
  len: z.number().min(40).max(1200).default(200),
  y: coord.optional(),
});

export function tug(o: z.output<typeof tugSchema>): GagResult {
  const A = figOf(o.a);
  const B = figOf(o.b);
  const u = phase(o.t, o.t0, o.dur);
  const active = u > 0 && u < 1;
  const dir = faceToward(A.placement.x, B.placement.x);
  const pa = palm(A, 'R');
  const pb = palm(B, 'R');
  const beat = Math.floor(twos(o.t) * 4) % 2 === 0 ? 1 : -1;
  const cx = (pa[0] + pb[0]) / 2 + (active ? beat * 18 * o.pull * A.placement.s : 0);
  const cy = o.y ?? (pa[1] + pb[1]) / 2 - 20 * A.placement.s;
  const half = o.len / 2;
  const endA: Point2 = [cx - dir * half, cy];
  const endB: Point2 = [cx + dir * half, cy];
  const g = 34 * A.placement.s;
  const strain = active ? 1 : 0;
  const Al = moved(A, { lean: tilt(A, -dir * (8 + (beat < 0 ? 6 : 0)) * strain * o.pull) });
  const Bl = moved(B, { lean: tilt(B, dir * (8 + (beat > 0 ? 6 : 0)) * strain * o.pull) });
  const holdA = {
    hR: reach(Al, 'R', endA),
    hL: reach(Al, 'L', [endA[0] - dir * g, cy + 4]),
    kL: 'grip' as const,
    kR: 'grip' as const,
  };
  const holdB = {
    hR: reach(Bl, 'R', endB),
    hL: reach(Bl, 'L', [endB[0] + dir * g, cy + 4]),
    kL: 'grip' as const,
    kR: 'grip' as const,
  };
  return {
    u,
    a: cue(Al, { pose: holdA, ...(active ? { expr: 'rage' as const } : {}) }),
    b: cue(Bl, { pose: holdB, ...(active ? { expr: 'rage' as const } : {}) }),
    contact: [cx, cy],
    item: { x: cx, y: cy, rot: 0, held: 'a' },
  };
}

// ---------- double take, head shake ----------

export const doubleTakeSchema = z.strictObject({
  ...oneBody,
  at: z.tuple([coord, coord]).optional(),
  dur: dur(1.0),
});

export function doubleTake(o: z.output<typeof doubleTakeSchema>): GagResult {
  const A = figOf(o.a);
  const u = phase(o.t, o.t0, o.dur);
  const target = o.at ?? (o.b ? [o.b.x, o.b.y] : [A.placement.x + 300, A.placement.y]);
  const toward = faceToward(A.placement.x, target[0]);
  const away = u >= 0.25 && u < 0.55;
  const snapped = u >= 0.55;
  const headYaw = u === 0 ? undefined : away ? -toward : toward;
  const a = cue(A, {
    ...(headYaw === undefined ? {} : { headYaw }),
    headDy: jolt(o.t, o.t0 + 0.55 * o.dur, -18),
    ...(snapped ? { expr: 'shock' as const, look: [toward * 0.8, 0] as const } : {}),
  });
  return { u, a, b: o.b ? cue(figOf(o.b)) : a };
}

export const headShakeSchema = z.strictObject({
  a: figSchema,
  t: gagBase.t,
  t0: gagBase.t0,
  dur: dur(1.5),
  period: z.number().min(0.08).max(2).default(0.25),
});

export function headShake(o: z.output<typeof headShakeSchema>): GagResult {
  const A = figOf(o.a);
  const u = phase(o.t, o.t0, o.dur);
  const k = Math.floor(Math.max(0, twos(o.t) - o.t0) / o.period) % 4;
  const headYaw = u > 0 && u < 1 ? A.placement.yaw + ([0, 1, 0, -1][k] ?? 0) : undefined;
  const a = cue(A, headYaw === undefined ? {} : { headYaw });
  return { u, a, b: a };
}

// ---------- hand on ----------

const ON = [
  'shoulder',
  'shoulderNear',
  'shoulderFar',
  'neck',
  'hipNear',
  'hipFar',
  'palm.L',
  'palm.R',
] as const satisfies readonly (BodyAnchorName | 'shoulder')[];

export const handOnSchema = z.strictObject({
  ...gagBase,
  dur: dur(0.8),
  hand: side,
  on: z.enum(ON).default('shoulder'),
  squeeze: z.boolean().default(false),
});

export function handOn(o: z.output<typeof handOnSchema>): GagResult {
  const A = figOf(o.a);
  const B = figOf(o.b);
  const u = phase(o.t, o.t0, o.dur);
  const from = bodyPoint(A, o.hand === 'R' ? 'sh.R' : 'sh.L');
  const nearest = (names: readonly BodyAnchorName[]): Point2 =>
    names
      .map((name) => bodyPoint(B, name))
      .reduce((best, p) =>
        Math.hypot(p[0] - from[0], p[1] - from[1]) <
        Math.hypot(best[0] - from[0], best[1] - from[1])
          ? p
          : best,
      );
  // 'shoulder' = whichever of b's shoulders is nearer a's reaching shoulder
  const spot = o.on === 'shoulder' ? nearest(['shoulderNear', 'shoulderFar']) : bodyPoint(B, o.on);
  const pulse = o.squeeze && u >= 0.4 ? (Math.floor(twos(o.t) * 6) % 2) * 3 * A.placement.s : 0;
  const goal = lerp2(palm(A, o.hand), [spot[0], spot[1] + pulse], span(u, 0, 0.4, 'out'));
  return {
    u,
    a: cue(A, { pose: { [handKey(o.hand)]: reach(A, o.hand, goal), [kindKey(o.hand)]: 'grip' } }),
    b: cue(B, {
      headDy: jolt(o.t, o.t0 + 0.4 * o.dur, -8),
      ...(u >= 0.4 ? { look: [faceToward(B.placement.x, A.placement.x) * 0.7, 0] as const } : {}),
    }),
    contact: spot,
  };
}
