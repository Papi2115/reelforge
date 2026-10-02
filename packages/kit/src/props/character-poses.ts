/**
 * Poses of the voxel character (PLAN.md#3.3). A pose is a flat record of joint angles (radians)
 * and hip offsets (voxels), so blending is a per-key lerp. Clips are pure functions of time
 * (local seconds since the clip started) -> pose; nothing is accumulated between frames.
 *
 * Angle conventions (the character faces +z): negative armX/legX/elbow swing a limb forward,
 * positive knee bends the shin back, positive spineX/headX lean/nod forward, armLZ > 0 and
 * armRZ < 0 raise the arms sideways (the left arm is on +x).
 */
import { KitError } from '../errors.js';

export const POSE_KEYS = [
  'hipY',
  'hipZ',
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
] as const;

export type PoseKey = (typeof POSE_KEYS)[number];
export type Pose = Readonly<Record<PoseKey, number>>;

/** Keys of the lower body (hips and legs): `mix(lower, upper)` takes them from `lower`. */
const LOWER_KEYS: ReadonlySet<PoseKey> = new Set([
  'hipY',
  'hipZ',
  'pelvisX',
  'pelvisY',
  'pelvisZ',
  'legLX',
  'legLZ',
  'kneeL',
  'legRX',
  'legRZ',
  'kneeR',
]);

export const CLIP_NAMES = [
  'stand',
  'walk',
  'sit',
  'point',
  'wave',
  'typing',
  'think',
  'shrug',
  'cheer',
] as const;

export type ClipName = (typeof CLIP_NAMES)[number];

/** Leg length (hip joint to sole) in voxels; the hips are this high when standing. */
export const LEG_VOXELS = 11;
/** Hip height in voxels in the sit pose: thighs level, their underside at 0.5625 units. */
export const SIT_HIP_VOXELS = 8.25;
/** Default walking speed (units per second) of the walk clip and crowds. */
export const WALK_SPEED = 1.2;

const TAU = Math.PI * 2;

const NEUTRAL: Pose = Object.freeze(
  Object.fromEntries(POSE_KEYS.map((key) => [key, 0])) as Record<PoseKey, number>,
);

function pose(values: Partial<Record<PoseKey, number>>): Pose {
  return { ...NEUTRAL, ...values };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Smooth 0..1 ramp between edge0 and edge1. */
export function smoothstep(edge0: number, edge1: number, value: number): number {
  const k = clamp01((value - edge0) / (edge1 - edge0));
  return k * k * (3 - 2 * k);
}

export function blendPoses(a: Pose, b: Pose, k: number): Pose {
  const amount = clamp01(k);
  const result = {} as Record<PoseKey, number>;
  for (const key of POSE_KEYS) result[key] = a[key] + (b[key] - a[key]) * amount;
  return result;
}

/** Hips and legs of `lower`, torso, head and arms of `upper` (e.g. sit + wave). */
export function mixPoses(lower: Pose, upper: Pose): Pose {
  const result = {} as Record<PoseKey, number>;
  for (const key of POSE_KEYS) result[key] = LOWER_KEYS.has(key) ? lower[key] : upper[key];
  return result;
}

/** Idle: breathing and a slow glance, arms relaxed. */
export function standPose(t: number): Pose {
  const breath = Math.sin((TAU * t) / 3.2);
  return pose({
    spineX: 0.015 * breath,
    shrug: 0.12 * (breath + 1),
    headY: 0.06 * Math.sin((TAU * t) / 7.3),
    armLZ: 0.07 + 0.015 * breath,
    armRZ: -0.07 - 0.015 * breath,
    elbowL: -0.08,
    elbowR: -0.08,
  });
}

/**
 * Gait after walking `distance` units at `speed` units/s: the stride follows the swing
 * amplitude (no foot sliding), faster means bigger swings, more lean and bent elbows (a run
 * from ~3 units/s). Speed ~0 is the idle stand.
 */
export function walkPose(distance: number, speed: number, t: number): Pose {
  const pace = Math.abs(speed);
  if (pace < 0.05) return standPose(t);
  const run = smoothstep(2, 3.5, pace);
  const swing = Math.min(0.75, 0.32 + 0.12 * pace);
  const stride = 4 * (LEG_VOXELS / 12) * Math.sin(swing);
  const phase = (TAU * distance) / stride;
  const s = Math.sin(phase);
  const c = Math.cos(phase);
  const arm = swing * (0.75 + 0.25 * run);
  return pose({
    hipY: -0.5 * s * s * (1 + run),
    pelvisY: 0.08 * s,
    spineX: 0.04 + 0.25 * run,
    spineY: -0.05 * s,
    headX: -0.03 - 0.1 * run,
    armLX: arm * s,
    armRX: -arm * s,
    armLZ: 0.08,
    armRZ: -0.08,
    elbowL: -0.25 - 1.1 * run - 0.2 * Math.max(0, -s),
    elbowR: -0.25 - 1.1 * run - 0.2 * Math.max(0, s),
    legLX: -swing * s,
    legRX: swing * s,
    kneeL: 0.1 + (0.8 + 0.7 * run) * Math.max(0, c),
    kneeR: 0.1 + (0.8 + 0.7 * run) * Math.max(0, -c),
  });
}

/** Seated: thighs level at the kit chair height, hands on the thighs. */
export function sitPose(t: number): Pose {
  const breath = Math.sin((TAU * t) / 3.4);
  return pose({
    hipY: SIT_HIP_VOXELS - LEG_VOXELS,
    spineX: 0.05 + 0.012 * breath,
    shrug: 0.1 * (breath + 1),
    headY: 0.05 * Math.sin((TAU * t) / 8.1),
    armLX: -0.45,
    armRX: -0.45,
    armLZ: 0.05,
    armRZ: -0.05,
    elbowL: -0.75,
    elbowR: -0.75,
    legLX: -Math.PI / 2,
    legRX: -Math.PI / 2,
    legLZ: 0.05,
    legRZ: -0.05,
    kneeL: Math.PI / 2,
    kneeR: Math.PI / 2,
  });
}

/** Seated at a keyboard: forearms level, fingers tapping, head down to the screen. */
function typingPose(t: number): Pose {
  const tapLeft = Math.max(0, Math.sin(TAU * 4.7 * t)) * Math.sin(TAU * 1.3 * t + 0.4);
  const tapRight = Math.max(0, Math.sin(TAU * 4.7 * t + 2.1)) * Math.sin(TAU * 1.1 * t + 1.9);
  return {
    ...sitPose(t),
    spineX: 0.14,
    headX: 0.3 + 0.03 * Math.sin(TAU * 0.4 * t),
    headY: 0.06 * Math.sin(TAU * 0.23 * t),
    armLX: -0.75,
    armRX: -0.75,
    armLZ: -0.14,
    armRZ: 0.14,
    elbowL: -0.85 + 0.12 * tapLeft,
    elbowR: -0.85 + 0.12 * tapRight,
  };
}

/** Right arm straight at the horizon in front (aimed by character.point(target)). */
function pointPose(t: number): Pose {
  const raise = smoothstep(0, 0.35, t);
  const aim = pose({
    ...standPose(t),
    spineY: 0.18,
    headY: 0.1,
    armRX: -Math.PI / 2 + 0.04,
    armRY: -0.18,
    armRZ: 0,
    elbowR: -0.04,
  });
  return blendPoses(standPose(t), aim, raise);
}

/** Right hand raised high, waving side to side. */
function wavePose(t: number): Pose {
  const raise = smoothstep(0, 0.3, t);
  const swing = Math.sin(TAU * 1.8 * t);
  const wave = pose({
    ...standPose(t),
    spineZ: 0.05,
    headZ: 0.08,
    armRX: -0.25,
    armRZ: -2.6 + 0.3 * swing,
    elbowR: -0.4,
  });
  return blendPoses(standPose(t), wave, raise);
}

/** Right hand at the chin, left arm across the chest, head tilted up in thought. */
function thinkPose(t: number): Pose {
  const sway = Math.sin((TAU * t) / 4.5);
  return pose({
    ...standPose(t),
    spineX: 0.03,
    headX: -0.12 + 0.03 * sway,
    headY: 0.12 * sway,
    headZ: 0.1,
    armRX: -0.62,
    armRY: 0.55,
    armRZ: 0.18,
    elbowR: -2.2,
    armLX: -0.55,
    armLY: -0.45,
    armLZ: -0.12,
    elbowL: -1.45,
  });
}

/** Shoulders up, forearms out with open palms, head tilted (rises in 0.3 s, then holds). */
function shrugPose(t: number): Pose {
  const raise = smoothstep(0, 0.3, t);
  const shrug = pose({
    ...standPose(t),
    shrug: 1,
    headX: -0.05,
    headZ: 0.2,
    spineX: -0.03,
    armLX: -0.2,
    armRX: -0.2,
    armLZ: 0.5,
    armRZ: -0.5,
    elbowL: -1.35,
    elbowR: -1.35,
  });
  return blendPoses(standPose(t), shrug, raise);
}

/** Both arms up, pumping, small hops (crowds, celebrations). */
export function cheerPose(t: number): Pose {
  const beat = Math.sin(TAU * 2 * t);
  return pose({
    hipY: 0.5 * Math.abs(Math.sin(TAU * t)),
    headX: -0.18,
    armLZ: 2.7 + 0.2 * beat,
    armRZ: -2.7 + 0.2 * beat,
    armLX: -0.15,
    armRX: -0.15,
    elbowL: -0.25,
    elbowR: -0.25,
    kneeL: 0.08,
    kneeR: 0.08,
  });
}

const CLIPS: Readonly<Record<ClipName, (t: number) => Pose>> = {
  stand: standPose,
  walk: (t) => walkPose(t * WALK_SPEED, WALK_SPEED, t),
  sit: sitPose,
  point: pointPose,
  wave: wavePose,
  typing: typingPose,
  think: thinkPose,
  shrug: shrugPose,
  cheer: cheerPose,
};

export function isClipName(value: unknown): value is ClipName {
  return typeof value === 'string' && (CLIP_NAMES as readonly string[]).includes(value);
}

/** Pose of clip `name` at local time t (t < 0 counts as 0). */
export function clipPose(call: string, name: unknown, t: number): Pose {
  if (!isClipName(name)) {
    throw new KitError(
      'invalid-params',
      `${call}: unknown pose "${String(name)}" (available: ${CLIP_NAMES.join(', ')})`,
    );
  }
  return CLIPS[name](Math.max(0, t));
}

/** True for a complete pose record (from character.poseAt or a blend). */
export function isPose(value: unknown): value is Pose {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return POSE_KEYS.every((key) => typeof record[key] === 'number' && Number.isFinite(record[key]));
}

/**
 * Right arm (and head) aimed along `direction` (character space, any length): pitch/yaw of
 * the arm with the shoulder order Y-X-Z, relative to the torso's own yaw.
 */
export function aimRightArm(base: Pose, direction: readonly [number, number, number]): Pose {
  const [x, y, z] = direction;
  const flat = Math.hypot(x, z);
  if (flat + Math.abs(y) < 1e-9) return base;
  const pitch = Math.atan2(y, flat);
  const yaw = Math.atan2(x, z);
  const torsoYaw = base.pelvisY + base.spineY;
  return {
    ...base,
    armRX: -(Math.PI / 2 + pitch),
    armRY: yaw - torsoYaw,
    armRZ: 0,
    elbowR: -0.04,
    headX: -0.6 * pitch,
    headY: Math.max(-1.1, Math.min(1.1, yaw - torsoYaw)),
  };
}
