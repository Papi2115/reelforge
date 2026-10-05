/**
 * The eight poses of the character pack (ADR-024), ported 1:1 from the concept page: pure clips
 * (local time since the pose started, global time, energy 0..1) -> joint angles + the expression
 * the pose suggests. Energy scales personality: anticipation, squash & stretch, head tilts and
 * spring overshoot. Angle conventions as in props/character-poses.ts: the rig faces +z, the left
 * arm is on +x, armLZ > 0 / armRZ < 0 raise the arms sideways, negative armX/legX/elbow swing
 * forward, knee > 0 bends back.
 */
import { bump, hash, lerp, mod, smooth, spring, TAU } from './math.js';

export const POSE_KEYS = [
  'hipY',
  'pelvisX',
  'pelvisY',
  'pelvisZ',
  'spineX',
  'spineY',
  'spineZ',
  'headX',
  'headY',
  'headZ',
  'shrug',
  'armLX',
  'armLY',
  'armLZ',
  'elbowL',
  'armRX',
  'armRY',
  'armRZ',
  'elbowR',
  'legLX',
  'legLZ',
  'kneeL',
  'legRX',
  'legRZ',
  'kneeR',
  'squash',
  'glow',
] as const;

export type PoseKey = (typeof POSE_KEYS)[number];
/** Joint angles (radians), hip offset (voxels), shrug (voxels), squash and glow (0..1). */
export type Pose = Readonly<Record<PoseKey, number>>;

/** Pose ids, in the page's order (keys 1-8). */
export const POSES = ['calm', 'wave', 'think', 'point', 'shrug', 'joy', 'walk', 'eureka'] as const;
export type PoseName = (typeof POSES)[number];

/**
 * Mascot expressions (keys W-I of the page; `auto` = the one the pose suggests), then the
 * reaction faces of 2.3.7 (also used by `reaction(...)`, reactions.ts).
 */
export const EXPRESSIONS = [
  'neutral',
  'joy',
  'curious',
  'surprised',
  'thinking',
  'sceptical',
  'alarm',
  'brow-raise',
  'jaw-drop',
  'wink',
  'smug',
] as const;
export type Expression = (typeof EXPRESSIONS)[number];

export interface ClipFrame {
  readonly pose: Pose;
  readonly expression: Expression;
}

export type Clip = (local: number, global: number, energy: number) => ClipFrame;

const ZERO: Pose = Object.fromEntries(POSE_KEYS.map((key) => [key, 0])) as Record<PoseKey, number>;

export function makePose(values: Partial<Record<PoseKey, number>>): Pose {
  return { ...ZERO, ...values };
}

export function blendPose(a: Pose, b: Pose, k: number): Pose {
  const result = {} as Record<PoseKey, number>;
  for (const key of POSE_KEYS) result[key] = a[key] + (b[key] - a[key]) * k;
  return result;
}

function frame(pose: Pose, expression: Expression): ClipFrame {
  return { pose, expression };
}

function calm(_local: number, global: number, energy: number): ClipFrame {
  const breath = Math.sin((TAU * global) / 3.2);
  const cycle = 6.5;
  const n = Math.floor(global / cycle);
  const side = hash(n * 3.1) > 0.5 ? 1 : -1;
  const glance = side * bump(2.2, 2.6, 3.8, 4.3, global - n * cycle);
  const shift = Math.sin((TAU * global) / 5.3);
  return frame(
    makePose({
      spineX: 0.015 * breath,
      shrug: 0.12 * (breath + 1),
      squash: 0.03 * energy * breath,
      headY: 0.06 * Math.sin((TAU * global) / 7.3) + 0.45 * energy * glance,
      headZ: -0.12 * energy * glance,
      headX: -0.04 * energy * Math.abs(glance),
      pelvisZ: 0.025 * energy * shift,
      spineZ: -0.03 * energy * shift,
      armLZ: 0.1 + 0.02 * breath,
      armRZ: -0.1 - 0.02 * breath,
      elbowL: -0.15,
      elbowR: -0.15,
    }),
    Math.abs(glance) > 0.5 ? 'curious' : 'neutral',
  );
}

function wave(local: number, global: number, energy: number): ClipFrame {
  const base = calm(local, global, energy * 0.5).pose;
  const dip = bump(0, 0.1, 0.12, 0.28, local) * energy;
  const raise = local < 0.1 ? 0 : spring(local - 0.1, 1.6, 5 + 3 * (1 - energy));
  const swing = Math.sin(TAU * 1.8 * (local - 0.3)) * smooth(0.25, 0.5, local);
  return frame(
    makePose({
      ...base,
      hipY: -0.9 * dip + 0.3 * energy * Math.abs(swing),
      squash: base.squash - 0.08 * dip + 0.035 * energy * Math.abs(swing),
      spineZ: 0.06 * raise + 0.04 * energy * swing,
      spineX: -0.03 * raise,
      headZ: (0.05 + 0.14 * energy) * raise,
      headX: -0.06 * raise,
      headY: base.headY * 0.3,
      armRX: -0.45 * raise,
      armRZ: lerp(base.armRZ, -2.1 + 0.35 * swing, raise),
      elbowR: lerp(-0.15, -0.7 - 0.35 * swing, raise),
      armLZ: base.armLZ + 0.12 * raise * energy,
    }),
    'joy',
  );
}

function think(local: number, global: number, energy: number): ClipFrame {
  const base = calm(local, global, 0.3 * energy).pose;
  const k = spring(local, 1.1, 6);
  const sway = Math.sin((TAU * global) / 4.5);
  const tap = Math.max(0, Math.sin(TAU * 2.4 * local)) * bump(1.2, 1.4, 2.6, 2.8, mod(local, 4));
  const target = makePose({
    ...base,
    spineX: 0.05,
    spineZ: -0.04,
    pelvisZ: 0.04 * energy,
    headX: -0.16 + 0.04 * sway,
    headY: 0.18 * sway,
    headZ: 0.05 + 0.14 * energy,
    armRX: -1.15,
    armRY: 0.45,
    armRZ: 0.25,
    elbowR: -2.0 + 0.3 * tap,
    armLX: -0.75,
    armLY: -0.6,
    armLZ: -0.1,
    elbowL: -1.5,
  });
  return frame(blendPose(base, target, k), 'thinking');
}

function point(local: number, global: number, energy: number): ClipFrame {
  const base = calm(local, global, 0.5 * energy).pose;
  const wind = bump(0, 0.12, 0.14, 0.3, local) * energy;
  const snap = local < 0.14 ? 0 : spring(local - 0.14, 1.8, 7);
  const jab = local > 0.9 ? bump(0, 0.06, 0.1, 0.3, mod(local - 0.9, 2.2)) : 0;
  return frame(
    makePose({
      ...base,
      spineY: -0.28 * wind + 0.22 * snap,
      spineX: 0.06 * snap - 0.05 * wind,
      pelvisY: 0.06 * snap,
      headY: 0.14 * snap,
      headX: 0.04 * snap,
      headZ: -0.08 * snap * energy,
      armRX: lerp(0, -Math.PI / 2 + 0.08 - 0.12 * jab, snap) + 0.5 * wind,
      armRY: -0.2 * snap,
      armRZ: lerp(base.armRZ, 0, snap),
      elbowR: lerp(-0.15, -0.04, snap),
      armLZ: base.armLZ + 0.15 * snap * energy,
      elbowL: -0.35 * snap,
      hipY: -0.6 * wind,
      squash: base.squash - 0.07 * wind + 0.04 * energy * jab,
    }),
    'curious',
  );
}

function shrug(local: number, global: number, energy: number): ClipFrame {
  const base = calm(local, global, 0.4 * energy).pose;
  const c = mod(local, 2.8);
  const up = (c < 0.05 ? 0 : spring(c - 0.05, 1.5, 6)) * (1 - smooth(1.8, 2.4, c));
  const top = makePose({
    ...base,
    shrug: 1.3,
    headX: -0.05,
    headZ: 0.24,
    spineX: -0.04,
    spineZ: -0.06 * energy,
    armLX: -0.25,
    armRX: -0.25,
    armLZ: 0.6,
    armRZ: -0.6,
    elbowL: -1.4,
    elbowR: -1.4,
    squash: -0.05 * energy,
    hipY: -0.2,
  });
  return frame(blendPose(base, top, up), 'sceptical');
}

function joy(local: number, _global: number, energy: number): ClipFrame {
  const c = mod(local, 1.1);
  const crouch = bump(0, 0.18, 0.22, 0.3, c);
  const air = c > 0.28 && c < 0.72 ? Math.sin((Math.PI * (c - 0.28)) / 0.44) : 0;
  const land = bump(0.7, 0.75, 0.8, 0.98, c);
  const beat = Math.sin((TAU * c) / 1.1);
  const bend = 0.5 + 0.5 * energy;
  const knee = (0.9 * crouch + 0.7 * land) * bend + 0.3 * air * energy;
  const leg = -(0.45 * crouch + 0.35 * land) * bend;
  return frame(
    makePose({
      hipY: (-1.6 * crouch - 1.1 * land) * bend + (0.6 + 4 * energy) * air,
      squash:
        (-0.12 * crouch - 0.1 * land) * energy + 0.1 * energy * bump(0.28, 0.33, 0.4, 0.55, c),
      kneeL: knee,
      kneeR: knee,
      legLX: leg,
      legRX: leg,
      spineX: 0.2 * crouch + 0.15 * land - 0.08 * air,
      headX: -0.25 * air - 0.05 + 0.15 * crouch,
      armLZ: 2.5 + 0.25 * beat - 1.2 * crouch,
      armRZ: -2.5 - 0.25 * beat + 1.2 * crouch,
      armLX: -0.25,
      armRX: -0.25,
      elbowL: -0.3 - 0.4 * crouch,
      elbowR: -0.3 - 0.4 * crouch,
    }),
    'joy',
  );
}

function walk(local: number, _global: number, energy: number): ClipFrame {
  const phase = TAU * 0.85 * local;
  const s = Math.sin(phase);
  const c = Math.cos(phase);
  const swing = 0.45 + 0.1 * energy;
  return frame(
    makePose({
      hipY: -0.5 * s * s * (1 + energy) + 0.3 * energy,
      squash: 0.05 * energy * (1 - 2 * s * s),
      pelvisY: 0.1 * s,
      spineY: -0.08 * s,
      spineX: 0.05,
      headX: -0.03 + 0.04 * energy * s * s,
      headZ: 0.06 * energy * s,
      armLX: 1.1 * swing * s,
      armRX: -1.1 * swing * s,
      armLZ: 0.12,
      armRZ: -0.12,
      elbowL: -0.35,
      elbowR: -0.35,
      legLX: -swing * s,
      legRX: swing * s,
      kneeL: 0.1 + 0.9 * Math.max(0, c),
      kneeR: 0.1 + 0.9 * Math.max(0, -c),
    }),
    'neutral',
  );
}

/** Seconds of one eureka loop: think, freeze, pop (finger up, jump, glow), settle. */
export const EUREKA_LOOP = 4.6;

/** Glow of the eureka pop: flicker while it ignites, then a steady light that fades out. */
export function eurekaGlow(c: number): number {
  if (c >= 1.55 && c < 2.15) return hash(Math.floor(c * 22)) > 0.38 ? 1 : 0.15;
  if (c >= 2.15) return 1 - smooth(3.8, 4.4, c);
  return 0;
}

function eureka(local: number, global: number, energy: number): ClipFrame {
  const c = mod(local, EUREKA_LOOP);
  const thought = think(c, global, energy).pose;
  const crouch = bump(1.35, 1.5, 1.55, 1.65, c);
  const pop = (c < 1.55 ? 0 : spring(c - 1.55, 1.4, 5)) * (1 - smooth(3.9, 4.5, c));
  const air = c > 1.6 && c < 2.0 ? Math.sin((Math.PI * (c - 1.6)) / 0.4) : 0;
  const up = makePose({
    hipY: 3.5 * energy * air,
    squash: 0.1 * energy * air - 0.08 * energy * bump(2.0, 2.05, 2.1, 2.3, c),
    headX: -0.3,
    headZ: 0.08,
    spineX: -0.08,
    armRZ: -2.95,
    armRX: -0.1,
    elbowR: -0.05,
    armLZ: 0.35,
    armLX: -0.3,
    elbowL: -0.9,
    kneeL: 0.3 * air,
    kneeR: 0.3 * air,
  });
  const blended = blendPose(thought, up, pop);
  const expression: Expression =
    c < 1.45 ? 'thinking' : c < 2.2 ? 'surprised' : c < 4.2 ? 'joy' : 'neutral';
  return frame(
    makePose({
      ...blended,
      hipY: blended.hipY - 1.2 * crouch,
      squash: blended.squash - 0.1 * crouch * energy,
      glow: eurekaGlow(c),
    }),
    expression,
  );
}

export const CLIPS: Readonly<Record<PoseName, Clip>> = {
  calm,
  wave,
  think,
  point,
  shrug,
  joy,
  walk,
  eureka,
};

export function isPoseName(value: unknown): value is PoseName {
  return typeof value === 'string' && (POSES as readonly string[]).includes(value);
}

export function isExpression(value: unknown): value is Expression {
  return typeof value === 'string' && (EXPRESSIONS as readonly string[]).includes(value);
}
