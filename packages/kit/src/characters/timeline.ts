/**
 * Time-driven direction of a character (ADR-024): pose, expression, walk and look-at cues set in
 * build() (`pose('wave', { at: 2 })`), evaluated as a pure function of t; a cue replaces one at
 * the same time. Any time can be evaluated in any order. Pose changes blend over 0.35 s from the previous pose (which keeps
 * playing), the head follows with a lag, and walks move the character between points.
 */
import { KitError } from '../errors.js';
import {
  blendPose,
  CLIPS,
  type ClipFrame,
  type Expression,
  type Pose,
  type PoseName,
} from './clips.js';
import { lerp, smooth } from './math.js';

/** Seconds a pose change blends over. */
export const POSE_BLEND = 0.35;
/** Seconds a walker takes to turn into / out of the walking direction. */
const TURN_IN = 0.25;
const TURN_OUT = 0.4;

export interface PoseCue {
  readonly at: number;
  readonly pose: PoseName;
  /** Added by walkTo (an explicit cue at the same time wins). */
  readonly auto: boolean;
}

export interface WalkSegment {
  readonly start: number;
  readonly end: number;
  /** [x, z] in the character's parent space. */
  readonly from: readonly [number, number];
  readonly to: readonly [number, number];
}

export interface Personality {
  readonly energy: number;
  /** Seconds the head lags the body. */
  readonly lag: number;
  /** Phase offset of global time (idle cycles, blinks), per character. */
  readonly phase: number;
  /** Mannequin: think/eureka fold the long arm to the chin. */
  readonly longArms: boolean;
}

/**
 * Sorted cue list with `cue` added: it replaces a cue at the same time, unless `yields` (then
 * the list is unchanged when one exists).
 */
export function insertCue<T extends { readonly at: number }>(
  cues: readonly T[],
  cue: T,
  yields = false,
): T[] {
  const clash = cues.some((existing) => existing.at === cue.at);
  if (clash && yields) return [...cues];
  return [...cues.filter((existing) => existing.at !== cue.at), cue].sort((a, b) => a.at - b.at);
}

/** Index of the last cue at or before t (-1: none). */
export function cueIndex(cues: readonly { readonly at: number }[], t: number): number {
  let index = -1;
  for (let i = 0; i < cues.length; i += 1) {
    if ((cues[i]?.at ?? Infinity) <= t) index = i;
    else break;
  }
  return index;
}

function clipAt(cue: PoseCue, t: number, personality: Personality): ClipFrame {
  const global = t + personality.phase;
  return CLIPS[cue.pose](Math.max(0, t - cue.at), global, personality.energy);
}

/** Pose at t: the current cue's clip, blended from the previous one for POSE_BLEND s. */
export function blendedPose(
  cues: readonly PoseCue[],
  t: number,
  personality: Personality,
): ClipFrame {
  const index = Math.max(0, cueIndex(cues, t));
  const current = cues[index];
  if (!current) throw new KitError('invalid-params', 'character: no pose cues');
  const frame = clipAt(current, t, personality);
  const previous = cues[index - 1];
  const k = smooth(0, POSE_BLEND, t - current.at);
  if (!previous || k >= 1) return frame;
  return {
    pose: blendPose(clipAt(previous, t, personality).pose, frame.pose, k),
    expression: frame.expression,
  };
}

/** The full pose of the body at t: blended clips, lagging head, long-arm folding. */
export function evaluatePose(
  cues: readonly PoseCue[],
  t: number,
  personality: Personality,
): ClipFrame {
  const frame = blendedPose(cues, t, personality);
  const late = blendedPose(cues, t - personality.lag, personality).pose;
  let pose: Pose = { ...frame.pose, headX: late.headX, headY: late.headY, headZ: late.headZ };
  if (personality.longArms) {
    const current = cues[Math.max(0, cueIndex(cues, t))];
    const folding = current && (current.pose === 'think' || current.pose === 'eureka');
    const k = folding ? smooth(0, POSE_BLEND, t - current.at) : 0;
    pose = {
      ...pose,
      armRX: pose.armRX * (1 - 0.46 * k),
      elbowR: pose.elbowR * (1 + 0.1 * k),
      armRY: pose.armRY * (1 + 0.2 * k),
    };
  }
  return { pose, expression: frame.expression };
}

/** Vertical hip velocity proxy that drives secondary motion (hipY change over 0.1 s, halved). */
export function hipVelocity(
  cues: readonly PoseCue[],
  t: number,
  personality: Personality,
  hipY: number,
): number {
  return (hipY - blendedPose(cues, t - 0.1, personality).pose.hipY) * 0.5;
}

export interface ExpressionCue {
  readonly at: number;
  readonly expression: Expression | 'auto';
}

/** The expression shown at t ('auto' resolves to the pose's suggestion). */
export function expressionAt(
  cues: readonly ExpressionCue[],
  t: number,
  suggested: Expression,
): Expression {
  const cue = cues[cueIndex(cues, t)];
  return cue === undefined || cue.expression === 'auto' ? suggested : cue.expression;
}

function wrapAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function heading(segment: WalkSegment): number {
  return Math.atan2(segment.to[0] - segment.from[0], segment.to[1] - segment.from[1]);
}

export interface WalkState {
  /** [x, z] in the parent space (undefined without walks). */
  readonly position: readonly [number, number] | undefined;
  /** Yaw of the body relative to the object's facing (radians). */
  readonly yaw: number;
}

/**
 * Where the walks put the character at t ([x, z]; the first walk's start before it) and the
 * body yaw relative to `facing` (the object's own yaw): it turns into the walking direction and
 * back to its facing after arriving.
 */
export function walkState(segments: readonly WalkSegment[], t: number, facing = 0): WalkState {
  let index = -1;
  segments.forEach((segment, i) => {
    if (segment.start <= t) index = i;
  });
  const segment = segments[index];
  if (!segment) {
    const first = segments[0];
    return { position: first ? first.from : undefined, yaw: 0 };
  }
  const duration = segment.end - segment.start;
  const k = duration > 0 ? Math.min(1, (t - segment.start) / duration) : 1;
  const position: [number, number] = [
    lerp(segment.from[0], segment.to[0], k),
    lerp(segment.from[1], segment.to[1], k),
  ];
  const previous = segments[index - 1];
  const chained = previous !== undefined && previous.end >= segment.start - 1e-6;
  const startYaw = chained ? wrapAngle(heading(previous) - facing) : 0;
  const turn = wrapAngle(heading(segment) - facing - startYaw);
  const into = startYaw + turn * smooth(segment.start, segment.start + TURN_IN, t);
  const yaw = into * (1 - smooth(segment.end, segment.end + TURN_OUT, t));
  return { position, yaw };
}

export interface LookCue {
  readonly at: number;
  readonly until: number | undefined;
  readonly target: unknown;
}

/** Weight 0..1 of a look-at cue at t (0.3 s in and out). */
export function lookWeight(cue: LookCue, t: number): number {
  const out = cue.until === undefined ? 0 : smooth(cue.until, cue.until + 0.3, t);
  return smooth(cue.at, cue.at + 0.3, t) * (1 - out);
}
