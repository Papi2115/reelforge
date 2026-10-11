/**
 * Grim Ink acting (PLAN.md#14.20), part 1: two-body physical gags where things or hands meet —
 * clink (two held things collide by accident: the films' scabbard CLACK, `01-samurai-edo/js/shots/
 * shots-b.js` street), handshake (palms meet and pump; the coin meeting of `shots-c.js` loan),
 * hand-over (a thing travels palm to palm on an arc, the receiver sags under its weight: the bale
 * of `shots-c.js` rice), drop-and-catch (it falls; the other's palm meets it, or it lands and
 * rolls to their feet: the hat of `shots-d.js` wrongbow), push. Each returns both people's cues
 * (solved hand targets merged into their poses, bow / lean / jolt / expression) plus the
 * contact, the travelling thing and the impact for `fx.impact`. Nothing is drawn here.
 */
import { z } from 'zod';
import { twos } from '../core.js';
import type { Point2 } from '../draw/contact.js';
import { coord } from './common.js';
import {
  chest,
  cue,
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
  type ActingCue,
} from './acting-core.js';

const side = z.enum(['L', 'R']).default('R');
const dur = (d: number) => z.number().min(0.1).max(20).default(d);

/** What a gag returns (fields beyond a, b and u only where they apply). */
export interface GagResult {
  /** Phase 0..1 of the gag at t (0 before t0). */
  readonly u: number;
  readonly a: ActingCue;
  readonly b: ActingCue;
  /** Where hands / things touch (world). */
  readonly contact?: Point2;
  /** The thing in play: draw it here (world), rotated `rot` degrees. */
  readonly item?: {
    readonly x: number;
    readonly y: number;
    readonly rot: number;
    readonly held: 'a' | 'b' | 'none';
  };
  /** A collision for `fx.impact({ x, y, t, t0 })`. */
  readonly impact?: { readonly x: number; readonly y: number; readonly t0: number };
  /** Grip points and aim (deg) of the held things (clink: draw the weapon / cup there). */
  readonly gripA?: Point2;
  readonly gripB?: Point2;
  readonly rotA?: number;
  readonly rotB?: number;
}

const deg = (from: Point2, to: Point2): number =>
  (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI;

// ---------- clink ----------

export const clinkSchema = z.strictObject({
  ...gagBase,
  dur: dur(1.2),
  handA: side,
  handB: side,
  at: z.tuple([coord, coord]).optional(),
  gap: z.number().min(0).max(1200).default(0),
});

export function clink(o: z.output<typeof clinkSchema>): GagResult {
  const A = figOf(o.a);
  const B = figOf(o.b);
  const u = phase(o.t, o.t0, o.dur);
  const restA = palm(A, o.handA);
  const restB = palm(B, o.handB);
  const meet: Point2 = o.at ?? [
    (restA[0] + restB[0]) / 2,
    Math.min(restA[1], restB[1]) - 40 * A.placement.s,
  ];
  const sideA = meet[0] >= A.placement.x ? 1 : -1;
  const sideB = meet[0] >= B.placement.x ? 1 : -1;
  const k = span(u, 0, 0.35, 'out') * (1 - 0.3 * span(u, 0.35, 0.6));
  const goalA = lerp2(restA, [meet[0] - sideA * o.gap, meet[1]], k);
  const goalB = lerp2(restB, [meet[0] - sideB * o.gap, meet[1]], k);
  const hit = o.t0 + 0.35 * o.dur;
  const struck = u >= 0.35;
  const expr = struck ? (u < 0.6 ? 'shock' : 'confused') : undefined;
  const poseA = {
    [handKey(o.handA)]: reach(A, o.handA, goalA),
    [kindKey(o.handA)]: 'grip' as const,
  };
  const poseB = {
    [handKey(o.handB)]: reach(B, o.handB, goalB),
    [kindKey(o.handB)]: 'grip' as const,
  };
  const gripA = palm(moved(A, { pose: poseA }), o.handA);
  const gripB = palm(moved(B, { pose: poseB }), o.handB);
  return {
    u,
    a: cue(A, {
      pose: poseA,
      headDy: jolt(o.t, hit, -14),
      expr,
      ...(struck ? { look: [sideA * 0.7, 0] as const } : {}),
    }),
    b: cue(B, {
      pose: poseB,
      headDy: jolt(o.t, hit, -14),
      expr,
      ...(struck ? { look: [sideB * 0.7, 0] as const } : {}),
    }),
    contact: meet,
    ...(struck ? { impact: { x: meet[0], y: meet[1], t0: hit } } : {}),
    gripA,
    gripB,
    rotA: deg(gripA, meet),
    rotB: deg(gripB, meet),
  };
}

// ---------- handshake ----------

export const handshakeSchema = z.strictObject({
  ...gagBase,
  dur: dur(1.6),
  pumps: z.number().int().min(1).max(8).default(3),
});

export function handshake(o: z.output<typeof handshakeSchema>): GagResult {
  const A = figOf(o.a);
  const B = figOf(o.b);
  const u = phase(o.t, o.t0, o.dur);
  const restA = palm(A, 'R');
  const restB = palm(B, 'R');
  const cA = chest(A, B.placement.x);
  const cB = chest(B, A.placement.x);
  const meet: Point2 = [(cA[0] + cB[0]) / 2, (cA[1] + cB[1]) / 2 + 30 * A.placement.s];
  const pumping = span(u, 0.3, 0.32) * (1 - span(u, 0.83, 0.85));
  const cycle = Math.floor((twos(o.t) - o.t0 - 0.3 * o.dur) / ((0.53 * o.dur) / (o.pumps * 2)));
  const dy = pumping * (cycle % 2 === 0 ? -12 : 12) * A.placement.s;
  const k = span(u, 0, 0.3, 'out') * (1 - span(u, 0.85, 1));
  const at: Point2 = [meet[0], meet[1] + dy];
  return {
    u,
    a: cue(A, { pose: { hR: reach(A, 'R', lerp2(restA, at, k)), kR: 'grip' } }),
    b: cue(B, { pose: { hR: reach(B, 'R', lerp2(restB, at, k)), kR: 'grip' } }),
    contact: at,
  };
}

// ---------- hand-over ----------

export const handOverSchema = z.strictObject({
  a: figSchema,
  b: figSchema.optional(),
  to: z.tuple([coord, coord]).optional(),
  t: gagBase.t,
  t0: gagBase.t0,
  dur: dur(1.2),
  hands: z.enum(['one', 'both']).default('both'),
  weight: z.number().min(0).max(1).default(0.2),
  arc: z.number().min(0).max(600).default(40),
});

export function handOver(o: z.output<typeof handOverSchema>): GagResult {
  const A = figOf(o.a);
  const B = o.b ? figOf(o.b) : undefined;
  const u = phase(o.t, o.t0, o.dur);
  const both = o.hands === 'both';
  const mid = (f: typeof A): Point2 =>
    both ? lerp2(palm(f, 'L'), palm(f, 'R'), 0.5) : palm(f, 'R');
  const start = mid(A);
  const toward = B ? B.placement.x : (o.to?.[0] ?? A.placement.x + 300);
  const open = B
    ? moved(B, {
        pose: { hL: handLib(B, 'L', -0.25, 0.42, 0.5), hR: handLib(B, 'R', -0.25, 0.42, 0.5) },
      })
    : undefined;
  const end: Point2 = o.to ?? (open ? mid(open) : [toward, start[1]]);
  const travel = span(u, 0.2, 0.6, 'inOut');
  const item: Point2 = [
    start[0] + (end[0] - start[0]) * travel,
    start[1] + (end[1] - start[1]) * travel - Math.sin(travel * Math.PI) * o.arc,
  ];
  const half = (f: typeof A, p: Point2) => {
    const w = 40 * f.placement.s;
    return both
      ? {
          hL: reach(f, 'L', [p[0] - w, p[1] + 4]),
          hR: reach(f, 'R', [p[0] + w, p[1] + 4]),
          kL: 'grip' as const,
          kR: 'grip' as const,
        }
      : { hR: reach(f, 'R', [p[0], p[1] + 4]), kR: 'grip' as const };
  };
  const giving = u < 0.6;
  const aPose = giving ? half(A, item) : { kL: 'open' as const, kR: 'open' as const };
  const received = u >= 0.6;
  const sag = received ? o.weight : 0;
  const away = B ? (B.placement.x >= A.placement.x ? 1 : -1) : 0;
  // b with open hands, sagging and leaning back under the weight once it has the thing
  const Bs =
    open && B
      ? moved(open, { lean: tilt(B, away * 8 * sag), pose: { bob: 0.07 * sag } })
      : undefined;
  const held: Point2 = received && Bs && !o.to ? mid(Bs) : item;
  const bCue =
    B && Bs
      ? cue(Bs, {
          pose: received
            ? { kL: 'grip', kR: 'grip' }
            : u >= 0.1
              ? half(Bs, lerp2(mid(Bs), item, span(u, 0.1, 0.6)))
              : B.pose,
          headDy: jolt(o.t, o.t0 + 0.6 * o.dur, Math.round(16 * o.weight)),
          ...(received && o.weight > 0.5 ? { expr: 'shock' as const } : {}),
        })
      : cue(A);
  return {
    u,
    a: cue(A, { pose: aPose }),
    b: bCue,
    contact: end,
    item: { x: held[0], y: held[1], rot: 0, held: received ? (B && !o.to ? 'b' : 'none') : 'a' },
  };
}

// ---------- drop and catch ----------

export const dropCatchSchema = z.strictObject({
  a: figSchema,
  b: figSchema.optional(),
  t: gagBase.t,
  t0: gagBase.t0,
  dur: dur(1.0),
  hand: side,
  catch: z.boolean().default(true),
  floor: coord.optional(),
  rollTo: coord.optional(),
});

export function dropCatch(o: z.output<typeof dropCatchSchema>): GagResult {
  const A = figOf(o.a);
  const B = o.b ? figOf(o.b) : undefined;
  const u = phase(o.t, o.t0, o.dur);
  const start = palm(A, o.hand);
  const floor = o.floor ?? A.placement.y - 10;
  const caught = o.catch && B !== undefined;
  const toA = B && A.placement.x < B.placement.x ? -1 : 1;
  const lunge = caught ? span(u, 0.1, 0.4) : 0;
  const Bl = B ? moved(B, { lean: tilt(B, toA * 10 * lunge) }) : undefined;
  const reachLen = B ? (B.character.D.l1a + B.character.D.l2a) * B.placement.s : 0;
  const rest = B ? palm(B, 'R') : start;
  const catchAt: Point2 = B
    ? [B.placement.x + toA * reachLen * 0.75, Math.max(start[1] + 20, rest[1] + reachLen * 0.1)]
    : start;
  const fall = span(u, 0, 0.4, 'lin');
  const land: Point2 = caught ? catchAt : [start[0], floor];
  let item: Point2 = [
    start[0] + (land[0] - start[0]) * fall,
    start[1] + (land[1] - start[1]) * fall * fall,
  ];
  let rot = fall * 540;
  if (!caught && u > 0.4) {
    const roll = span(u, 0.4, 1, 'out');
    const to =
      o.rollTo ??
      (B ? B.placement.x - (B.placement.x >= start[0] ? 60 : -60) * B.placement.s : start[0] + 200);
    item = [
      start[0] + (to - start[0]) * roll,
      floor - Math.abs(Math.sin(roll * Math.PI * 3)) * 14 * (1 - roll),
    ];
    rot = 540 + roll * 360 + Math.sin(roll * Math.PI * 4) * (1 - roll) * 28;
  }
  const bCue = B
    ? cue(B, {
        pose:
          caught && u >= 0.1
            ? {
                hR: reach(Bl ?? B, 'R', lerp2(rest, catchAt, span(u, 0.1, 0.4, 'out'))),
                kR: u >= 0.4 ? 'grip' : 'open',
              }
            : {},
        lean: Bl?.placement.lean ?? B.placement.lean,
        headDy: jolt(o.t, o.t0, -12),
        ...(u > 0 ? { expr: caught && u >= 0.4 ? ('grin' as const) : ('shock' as const) } : {}),
      })
    : cue(A);
  return {
    u,
    a: cue(A, {
      pose: u > 0 ? { [kindKey(o.hand)]: 'open' } : {},
      headDy: jolt(o.t, o.t0, -14),
      ...(u > 0 ? { expr: 'shock' as const, look: [0, 0.8] as const } : {}),
    }),
    b: bCue,
    contact: caught ? catchAt : item,
    item: { x: item[0], y: item[1], rot, held: u === 0 ? 'a' : caught && u >= 0.4 ? 'b' : 'none' },
  };
}

// ---------- push ----------

export const pushSchema = z.strictObject({
  ...gagBase,
  dur: dur(0.9),
  force: z.number().min(0).max(2).default(1),
});

export function push(o: z.output<typeof pushSchema>): GagResult {
  const A = figOf(o.a);
  const B = figOf(o.b);
  const u = phase(o.t, o.t0, o.dur);
  const dir = B.placement.x >= A.placement.x ? 1 : -1;
  const shove = span(u, 0.3, 0.6, 'out');
  const bx = B.placement.x + dir * 70 * o.force * shove * B.placement.s;
  const Bm = moved(B, { x: bx, lean: tilt(B, dir * 10 * o.force * shove) });
  const target = chest(Bm, A.placement.x);
  const k = span(u, 0, 0.3, 'out') * (1 - 0.6 * span(u, 0.6, 1));
  const ax = A.placement.x + (bx - B.placement.x) * 0.85;
  const Am = moved(A, { x: ax, lean: tilt(A, dir * 8 * k) });
  const w = 26 * A.placement.s;
  const goalL: Point2 = lerp2(palm(Am, 'L'), [target[0], target[1] - w], k);
  const goalR: Point2 = lerp2(palm(Am, 'R'), [target[0], target[1] + w], k);
  return {
    u,
    a: cue(Am, {
      x: ax,
      pose: { hL: reach(Am, 'L', goalL), hR: reach(Am, 'R', goalR), kL: 'flat', kR: 'flat' },
      lean: Am.placement.lean,
      ...(u > 0 ? { expr: 'rage' as const } : {}),
    }),
    b: cue(Bm, {
      x: bx,
      lean: Bm.placement.lean,
      headDy: jolt(o.t, o.t0 + 0.3 * o.dur, -14),
      ...(u >= 0.3 ? { expr: 'shock' as const } : {}),
    }),
    contact: target,
  };
}
