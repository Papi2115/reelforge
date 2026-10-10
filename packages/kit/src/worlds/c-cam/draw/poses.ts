/**
 * C-CAM pose library (PLAN.md#14.4): body-space targets for hands and feet, scaled by each
 * character's own dimensions `D` (arm length l1a + l2a, leg length l1l + l2l). A pose never draws
 * anything; the rig (14.5) projects it through the character's views. Phase-driven poses take
 * `ph` in [0, 1) and should be fed twos time so the acting stays on twos.
 *
 * Body space: x = the character's LEFT, y down (feet at 0), z forward.
 *
 * Port of `docs/concepts/c-cam-style/films/03-apollo-11/js/poses.js` (md5-identical in films 1-3).
 * Divergences:
 *  - no `window.ST`; `POSE`, `pose`, `handAt`, `footAt` are named exports, typed (`Pose`,
 *    `BodyDims`, `PoseName`), with a zod schema for `D` (`bodyDimsSchema`, for kit-ext/people);
 *  - `point` builds a new object instead of mutating the `stand` result (same values);
 *  - `pose(name, D, ph, over)` defaults `ph` to 0 (the original passed `null`/`undefined`, which
 *    every pose reads as 0: `sin(0)`, `0 > 0` is false);
 *  - the original has no pose blending (expressions and poses snap); none is added here.
 *    `over` (per-key overrides) is the only composition, as in the original.
 * Engine leftovers kept (08-KNOWN_ISSUES #16: `jig`, `stomp`, `flail` come from the Dancing
 * Plague film).
 */
import { z } from 'zod';
import type { HandKind } from './hand.js';

const TAU = Math.PI * 2;

/**
 * The part of a character's dimension record `D` the poses read (body-space px). The rig (14.5)
 * reads more fields (`hy`, `elbowOut`, `head`, ...) and extends this schema.
 */
export const bodyDimsSchema = z
  .object({
    /** Shoulder half-width. */
    sw: z.number(),
    /** Shoulder height (negative: above the feet). */
    sy: z.number(),
    /** Shoulder depth (default 0). */
    sz: z.number().optional(),
    /** Hip half-width. */
    hw: z.number(),
    /** Hand-on-hip point `[x, y]` (akimbo). */
    waist: z.tuple([z.number(), z.number()]).readonly(),
    /** Upper arm / forearm / thigh / shin lengths. */
    l1a: z.number().positive(),
    l2a: z.number().positive(),
    l1l: z.number().positive(),
    l2l: z.number().positive(),
  })
  .readonly();

export type BodyDims = z.infer<typeof bodyDimsSchema>;

/** A body-space point `[x, y, z]`. */
export type Vec3 = readonly [x: number, y: number, z: number];

/** Hand and foot targets, elbow poles, hand kinds, hip bob (share of leg length), lean (deg). */
export interface Pose {
  readonly hL: Vec3;
  readonly hR: Vec3;
  readonly fL: Vec3;
  readonly fR: Vec3;
  readonly poleL?: Vec3;
  readonly poleR?: Vec3;
  readonly kL?: HandKind;
  readonly kR?: HandKind;
  readonly bob?: number;
  readonly lean?: number;
}

const armLength = (D: BodyDims): number => D.l1a + D.l2a;
const legLength = (D: BodyDims): number => D.l1l + D.l2l;

/** Hand target for side sgn (+1 = the character's left, -1 = right): out = sideways beyond the shoulder, down from it, fwd (arm lengths). */
export function handAt(D: BodyDims, sgn: number, out: number, down: number, fwd: number): Vec3 {
  const A = armLength(D);
  return [sgn * (D.sw + out * A), D.sy + down * A, (D.sz || 0) + fwd * A];
}

/** Foot target for side sgn (+1 left, -1 right): out = sideways beyond the hip, lift off the ground, fwd (leg lengths). */
export function footAt(D: BodyDims, sgn: number, out: number, lift: number, fwd: number): Vec3 {
  const L = legLength(D);
  return [sgn * (D.hw + out * L), -lift * L, fwd * L];
}

const hand = handAt;
const foot = footAt;

export const POSE_NAMES = [
  'stand',
  'akimbo',
  'clasp',
  'point',
  'armsUp',
  'jig',
  'stomp',
  'flail',
  'slump',
  'walk',
] as const;

export type PoseName = (typeof POSE_NAMES)[number];

/** `ph` = phase in [0, 1) for the cyclic poses; for `point` it is the pointing side (+1 / -1). */
export type PoseFn = (D: BodyDims, ph: number) => Pose;

function stand(D: BodyDims): Pose {
  // prettier-ignore
  return { hL: hand(D, 1, 0.1, 0.9, 0.1), hR: hand(D, -1, 0.1, 0.9, 0.12), fL: foot(D, 1, 0.04, 0, 0.04), fR: foot(D, -1, 0.04, 0, -0.03) };
}

/** The pose library. */
// prettier-ignore
export const POSE: Readonly<Record<PoseName, PoseFn>> = {
  stand,
  // hands on the hips, elbows out
  akimbo: (D) => ({
    hL: [D.waist[0], D.waist[1], 0.04 * armLength(D)], hR: [-D.waist[0], D.waist[1], 0.04 * armLength(D)],
    poleL: [1, 0, -0.35], poleR: [-1, 0, -0.35], kL: 'flat', kR: 'flat', fL: foot(D, 1, 0.08, 0, 0.02), fR: foot(D, -1, 0.08, 0, 0),
  }),
  // both hands together in front of the belly (waiting, praying, holding a small thing)
  clasp: (D) => ({ hL: [D.sw * 0.12, D.sy + 0.62 * armLength(D), 0.42 * armLength(D)], hR: [-D.sw * 0.12, D.sy + 0.64 * armLength(D), 0.42 * armLength(D)], poleL: [1, 0.3, -0.6], poleR: [-1, 0.3, -0.6], fL: foot(D, 1, 0.02, 0, 0.02), fR: foot(D, -1, 0.02, 0, 0) }),
  // one arm pointing straight ahead at eye level (sgn = which hand), the other hanging
  point: (D, sgn) => {
    const target = hand(D, sgn, -0.12, -0.05, 0.95);
    return sgn > 0 ? { ...stand(D), hL: target, kL: 'point' } : { ...stand(D), hR: target, kR: 'point' };
  },
  // both arms up, wide: the shock pose
  armsUp: (D) => ({ hL: hand(D, 1, 0.3, -0.85, 0.12), hR: hand(D, -1, 0.3, -0.85, 0.12), kL: 'open', kR: 'open', poleL: [1, 0.2, -0.3], poleR: [-1, 0.2, -0.3], fL: foot(D, 1, 0.08, 0, 0), fR: foot(D, -1, 0.08, 0, 0) }),
  // the joyless jig: arms flap up and down in opposition, one knee lifts per beat, hips bob, body rocks
  jig: (D, ph) => {
    const s = Math.sin(ph * TAU), c = Math.cos(ph * TAU), dl = -0.18 - 0.62 * s, dr = -0.18 + 0.62 * s;
    const out = (d: number): number => 0.4 + 0.15 * Math.max(0, -d); // a raised hand also swings wider, so it clears the skull in 3/4
    return {
      hL: hand(D, 1, out(dl) + 0.08 * c, dl, 0.24), hR: hand(D, -1, out(dr) - 0.08 * c, dr, 0.24),
      poleL: [1, 0.3, -0.25], poleR: [-1, 0.3, -0.25], kL: 'open', kR: 'open',
      fL: foot(D, 1, 0.06, Math.max(0, s) * 0.32, Math.max(0, s) * 0.22), fR: foot(D, -1, 0.06, Math.max(0, -s) * 0.32, Math.max(0, -s) * 0.22),
      bob: 0.05 + 0.035 * Math.abs(c), lean: 5 * s,
    };
  },
  // heavy stomp: fists low and swinging fore and aft, knees bent, feet slapping the ground
  stomp: (D, ph) => {
    const s = Math.sin(ph * TAU);
    return {
      hL: hand(D, 1, 0.22, 0.62, 0.35 * s), hR: hand(D, -1, 0.22, 0.62, -0.35 * s),
      fL: foot(D, 1, 0.1, Math.max(0, s) * 0.22, 0.12 * s), fR: foot(D, -1, 0.1, Math.max(0, -s) * 0.22, -0.12 * s),
      bob: 0.09 - 0.04 * Math.abs(s), lean: -3 * s,
    };
  },
  // wild, exhausted flailing: one arm high, one out, alternating every half beat
  flail: (D, ph) => {
    const up = Math.floor(ph * 2) % 2 === 0, s = Math.sin(ph * TAU);
    return {
      hL: up ? hand(D, 1, 0.25, -0.8, 0.15) : hand(D, 1, 0.65, 0.15, 0.2), hR: up ? hand(D, -1, 0.65, 0.15, 0.2) : hand(D, -1, 0.25, -0.8, 0.15),
      poleL: [1, 0.2, -0.3], poleR: [-1, 0.2, -0.3], kL: 'open', kR: 'open',
      fL: foot(D, 1, 0.12, up ? 0.25 : 0, up ? 0.15 : 0), fR: foot(D, -1, 0.12, up ? 0 : 0.25, up ? 0 : 0.15), bob: 0.07, lean: 7 * s,
    };
  },
  // spent: arms dangling forward, knees bent, leaning
  slump: (D) => ({ hL: hand(D, 1, -0.02, 0.92, 0.32), hR: hand(D, -1, 0.0, 0.94, 0.28), kL: 'open', kR: 'open', fL: foot(D, 1, 0.1, 0, 0.1), fR: foot(D, -1, 0.1, 0, -0.06), bob: 0.12, lean: 9 }),
  // walking: opposite arm and leg swing, the swinging foot lifts
  walk: (D, ph) => {
    const s = Math.sin(ph * TAU), c = Math.cos(ph * TAU);
    return {
      hL: hand(D, 1, 0.08, 0.88, -0.3 * s), hR: hand(D, -1, 0.08, 0.88, 0.3 * s),
      fL: foot(D, 1, 0.02, Math.max(0, c) * 0.12, 0.28 * s), fR: foot(D, -1, 0.02, Math.max(0, -c) * 0.12, -0.28 * s), bob: 0.025 * Math.abs(c),
    };
  },
};

/** A pose with per-key overrides: `pose('stand', D, 0, { hR: handAt(D, -1, ...), kR: 'grip' })`. */
export function pose(name: PoseName, D: BodyDims, ph = 0, over: Partial<Pose> = {}): Pose {
  return { ...POSE[name](D, ph), ...over };
}
