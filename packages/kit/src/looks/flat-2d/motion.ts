/**
 * Enter / exit / idle motion of flat-2d elements: a pure pose (offset, scale, rotation, dither
 * coverage, wipe share) from local time t. Motion-graphics conventions: snappy ease-outs on the
 * way in (pop overshoots, drops bounce), quick ease-ins on the way out, small idle loops.
 */
import { z } from 'zod';
import {
  clamp01,
  easeInCubic,
  easeOutBack,
  easeOutBounce,
  easeOutCubic,
  ramp,
  whenParam,
  type Resolver,
  type When,
} from './timing.js';

export const ENTRANCES = [
  'pop',
  'scale',
  'slide-left',
  'slide-right',
  'slide-up',
  'slide-down',
  'drop',
  'spin',
  'wipe',
  'fade',
  'none',
] as const;
export type Entrance = (typeof ENTRANCES)[number];

export const IDLES = ['none', 'float', 'pulse', 'spin', 'wobble'] as const;
export type Idle = (typeof IDLES)[number];

/** Motion params every element shares (spread into the element schemas). */
export const motionFields = {
  at: whenParam.optional().describe('When it enters (seconds or phrase; default staggered)'),
  enter: z
    .enum(ENTRANCES)
    .optional()
    .describe(
      'Entrance: pop, scale, slide-left (comes from the left)/right/up/down, drop, spin, wipe, fade, none',
    ),
  out: whenParam.optional().describe('When it leaves (default: stays)'),
  exit: z.enum(ENTRANCES).optional().describe('Exit animation (default: the entrance reversed)'),
  idle: z.enum(IDLES).optional().describe('Loop while shown: none, float, pulse, spin, wobble'),
} as const;

export interface Pose {
  /** False before the entrance / after the exit. */
  readonly visible: boolean;
  /** Dither coverage 0..1. */
  readonly level: number;
  readonly scale: number;
  /** Offset in raster pixels. */
  readonly dx: number;
  readonly dy: number;
  /** Degrees, clockwise on screen. */
  readonly rotation: number;
  /** Revealed share 0..1 left to right (wipes and draw-ons). */
  readonly reveal: number;
}

export const REST: Pose = {
  visible: true,
  level: 1,
  scale: 1,
  dx: 0,
  dy: 0,
  rotation: 0,
  reveal: 1,
};

export interface MotionSpec {
  /** Entrance start (s). */
  readonly at: number;
  readonly enter: Entrance;
  /** Exit start (s); undefined = stays. */
  readonly out?: number | undefined;
  readonly exit?: Entrance | undefined;
  readonly idle: Idle;
  /** Entrance / exit length (s). */
  readonly duration: number;
  /** Phase of the idle loop. */
  readonly seed: number;
  /** Slide distance in raster pixels. */
  readonly distance: number;
}

/** Pose of an entrance at progress k (0 = hidden start, 1 = at rest). */
export function entrancePose(kind: Entrance, k: number, distance: number): Pose {
  const p = clamp01(k);
  const out = easeOutCubic(p);
  const base = { ...REST, level: Math.min(1, p * 4) };
  switch (kind) {
    case 'pop':
      return { ...base, scale: Math.max(0, easeOutBack(p)) };
    case 'scale':
      return { ...base, scale: out };
    case 'slide-left':
      return { ...base, dx: -(1 - out) * distance };
    case 'slide-right':
      return { ...base, dx: (1 - out) * distance };
    case 'slide-up':
      return { ...base, dy: (1 - out) * distance };
    case 'slide-down':
      return { ...base, dy: -(1 - out) * distance };
    case 'drop':
      return { ...base, level: 1, dy: -(1 - easeOutBounce(p)) * distance * 2 };
    case 'spin':
      return { ...base, scale: out, rotation: -(1 - out) * 180 };
    case 'wipe':
      return { ...REST, reveal: out };
    case 'fade':
      return { ...REST, level: p };
    case 'none':
      return REST;
  }
}

/** Pose of an element at local time t. */
export function motionPose(t: number, spec: MotionSpec): Pose {
  if (t < spec.at) return { ...REST, visible: false };
  let pose = entrancePose(spec.enter, ramp(t, spec.at, spec.duration), spec.distance);
  if (spec.out !== undefined && t >= spec.out) {
    const k = ramp(t, spec.out, spec.duration * 0.8);
    if (k >= 1) return { ...REST, visible: false };
    pose = entrancePose(spec.exit ?? spec.enter, 1 - easeInCubic(k), spec.distance);
  }
  return applyIdle(pose, spec.idle, t - spec.at, spec.seed, spec.distance);
}

function applyIdle(pose: Pose, idle: Idle, local: number, seed: number, distance: number): Pose {
  const phase = seed * 1.3;
  switch (idle) {
    case 'none':
      return pose;
    case 'float':
      return { ...pose, dy: pose.dy + Math.sin(local * 2.1 + phase) * distance * 0.06 };
    case 'pulse':
      return { ...pose, scale: pose.scale * (1 + 0.05 * Math.sin(local * 5.2 + phase)) };
    case 'spin':
      return { ...pose, rotation: pose.rotation + local * 45 };
    case 'wobble':
      return { ...pose, rotation: pose.rotation + Math.sin(local * 4 + phase) * 6 };
  }
}

/** Motion fields of one element as given by the scene. */
export interface MotionFields {
  readonly at?: When | undefined;
  readonly enter?: Entrance | undefined;
  readonly out?: When | undefined;
  readonly exit?: Entrance | undefined;
  readonly idle?: Idle | undefined;
}

export interface MotionDefaults {
  /** Default entrance time of element `index` (staggered). */
  readonly at: number;
  readonly enter: Entrance;
  readonly idle?: Idle | undefined;
  readonly duration: number;
  readonly distance: number;
}

/** Resolves an element's motion fields (phrases through `resolve`) into a MotionSpec. */
export function resolveMotion(
  fields: MotionFields,
  index: number,
  resolve: Resolver,
  defaults: MotionDefaults,
): MotionSpec {
  const out = fields.out === undefined ? undefined : resolve(fields.out, 0);
  return {
    at: resolve(fields.at, defaults.at),
    enter: fields.enter ?? defaults.enter,
    out,
    exit: fields.exit,
    idle: fields.idle ?? defaults.idle ?? 'none',
    duration: defaults.duration,
    seed: index + 1,
    distance: defaults.distance,
  };
}
