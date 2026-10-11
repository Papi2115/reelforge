/**
 * C-CAM acting beats (PLAN.md#14.17, quality lab): the lab's people stood in `stand` through whole
 * shots because changing a pose on a beat took a hand-written key per joint. `poseAt(person, cues,
 * t)` is the pose track `exprAt` is for faces: cues `[t, pose, over?]` (a library pose name or a
 * pose from `person.pose(…)`, plus overrides), evaluated on twos; on each cue the body moves to the
 * new pose in a two-drawing in-between with a small overshoot (a jolt, then a hold), never a slow
 * blend. Hand shapes snap halfway. Pure: same cues and t -> the same pose.
 *
 * Public API: `PoseCue`, `PoseSource`, `POSE_IN_S`, `poseAt`.
 */
import { KitError } from '../../../errors.js';
import { ease, twos } from '../core.js';
import { POSE_NAMES, type Pose, type PoseName, type Vec3 } from './poses.js';

/** A cue of the track: from shot time `t` on, this pose (name or object) with these overrides. */
export type PoseCue = readonly [t: number, pose: PoseName | Pose, over?: Partial<Pose>];

/** What resolves a pose name (a person handle: `ctx.kit.people.<id>`). */
export interface PoseSource {
  pose(name: PoseName, ph?: number, over?: Partial<Pose>): Pose;
}

/** Seconds of the in-between after each cue (two drawings on twos). */
export const POSE_IN_S = 2 / 12;

const mix = (a: number, b: number, k: number): number => a + (b - a) * k;
const mixVec = (a: Vec3, b: Vec3, k: number): Vec3 => [
  mix(a[0], b[0], k),
  mix(a[1], b[1], k),
  mix(a[2], b[2], k),
];

function isPose(value: unknown): value is Pose {
  return typeof value === 'object' && value !== null && 'hL' in value && 'fL' in value;
}

function resolve(person: PoseSource, cue: PoseCue): Pose {
  const [, pose, over = {}] = cue;
  if (isPose(pose)) return { ...pose, ...over };
  if (!(POSE_NAMES as readonly string[]).includes(pose)) {
    throw new KitError(
      'invalid-params',
      `env.ink.poseAt: unknown pose ${JSON.stringify(pose)} (poses: ${POSE_NAMES.join(', ')})`,
    );
  }
  return person.pose(pose, 0, over);
}

/** `from` -> `to` at k (k may overshoot 1 a little: ease.back). */
function between(from: Pose, to: Pose, k: number): Pose {
  const late = k >= 0.5;
  const pole = (a: Vec3 | undefined, b: Vec3 | undefined): Vec3 | undefined =>
    a !== undefined && b !== undefined ? mixVec(a, b, Math.min(1, k)) : late ? b : a;
  const poleL = pole(from.poleL, to.poleL);
  const poleR = pole(from.poleR, to.poleR);
  const kL = late ? to.kL : from.kL;
  const kR = late ? to.kR : from.kR;
  return {
    hL: mixVec(from.hL, to.hL, k),
    hR: mixVec(from.hR, to.hR, k),
    fL: mixVec(from.fL, to.fL, Math.min(1, k)),
    fR: mixVec(from.fR, to.fR, Math.min(1, k)),
    ...(poleL === undefined ? {} : { poleL }),
    ...(poleR === undefined ? {} : { poleR }),
    ...(kL === undefined ? {} : { kL }),
    ...(kR === undefined ? {} : { kR }),
    bob: mix(from.bob ?? 0, to.bob ?? 0, k),
    lean: mix(from.lean ?? 0, to.lean ?? 0, k),
  };
}

/**
 * The pose at shot time t from cues sorted by time: before the first cue its pose holds; after a
 * cue the body reaches the new pose in `POSE_IN_S` with a small overshoot, then holds.
 */
export function poseAt(person: PoseSource, cues: readonly PoseCue[], t: number): Pose {
  if (typeof person.pose !== 'function') {
    throw new KitError(
      'invalid-params',
      'env.ink.poseAt(person, cues, t): person must be a film person (ctx.kit.people.<id>)',
    );
  }
  const [first] = cues;
  if (first === undefined) return person.pose('stand');
  const now = twos(t);
  let index = 0;
  for (let i = 0; i < cues.length; i += 1) if ((cues[i]?.[0] ?? Infinity) <= now) index = i;
  const current = cues[index] ?? first;
  const target = resolve(person, current);
  const previous = cues[index - 1];
  if (previous === undefined || now < current[0]) return target;
  const k = (now - current[0]) / POSE_IN_S;
  return k >= 1 ? target : between(resolve(person, previous), target, ease.back(k));
}
