/**
 * Camera rigs (PLAN.md#2.4): each rig is a pure function of the local time t that returns a
 * CameraPose. Moves run from `from` to `to` (seconds) with an easing; before `from` a rig holds its
 * start pose, after `to` its end pose. Angles are in degrees; orbit angle 0 looks from +Z.
 */
import type { CameraPose, Vec3 } from '../contract.js';
import { progressBetween, type EaseInput } from './easing.js';

export type CameraRig = (t: number) => CameraPose;
/** `[start, end]` value pair, interpolated over the move. */
export type Span = readonly [number, number];

export interface RigTiming {
  /** Local time (s) the move starts. Default 0. */
  readonly from?: number;
  /** Local time (s) the move ends. Default 1 here; `ctx.camera` defaults it to the shot length. */
  readonly to?: number;
  /** Default 'easeInOutCubic'. */
  readonly ease?: EaseInput;
  /** Vertical field of view in degrees: fixed, or `[start, end]` (dolly zoom). */
  readonly fov?: number | Span;
}

export interface DollyOptions extends RigTiming {
  readonly start: Vec3;
  readonly end: Vec3;
  /** Look-at point (default origin); with `targetEnd` it travels along with the camera. */
  readonly target?: Vec3;
  readonly targetEnd?: Vec3;
}

export interface OrbitOptions extends RigTiming {
  /** Orbit centre and look-at point. Default origin. */
  readonly target?: Vec3;
  readonly radius: number;
  /** Camera height above the target. Default 0. */
  readonly height?: number;
  /** Start/end azimuth in degrees (0 = on +Z, 90 = on +X). */
  readonly degrees: Span;
}

export interface PushInOptions extends RigTiming {
  /** Look-at point. Default origin. */
  readonly target?: Vec3;
  /** Distance from the target: `[start, end]` (end < start pushes in, end > start pulls out). */
  readonly dist: Span;
  /** Direction from the target towards the camera (normalized internally). Default slightly above +Z. */
  readonly direction?: Vec3;
}

export interface CraneOptions extends RigTiming {
  /** Look-at point. Default origin. */
  readonly target?: Vec3;
  /** Camera height above the target: `[start, end]`. */
  readonly height: Span;
  /** Horizontal distance from the target. */
  readonly dist: number;
  /** Azimuth in degrees (0 = on +Z). Default 0. */
  readonly degrees?: number;
  /** Optional rise of the look-at point: `[start, end]` added to target.y (tilt with the crane). */
  readonly targetHeight?: Span;
}

export interface LookAtOptions extends RigTiming {
  /** Fixed camera position. */
  readonly position: Vec3;
  readonly target: Vec3;
  /** If set, the camera pans from `target` to `targetEnd`. */
  readonly targetEnd?: Vec3;
}

export interface ShakeOptions {
  /** Max offset in world units of position and look-at point. */
  readonly amplitude: number;
  /** Shake speed in Hz (noise lattice steps per second). Default 8. */
  readonly frequency?: number;
  /** Noise seed; `ctx.camera.shake` derives one from the shot seed. Default 0. */
  readonly seed?: number;
  /** Shake window (local seconds). Default: always. */
  readonly from?: number;
  readonly to?: number;
  /** If set, amplitude decays as exp(-(t - from) / decay) (impact shakes). */
  readonly decay?: number;
}

export const DEFAULT_PUSH_DIRECTION: Vec3 = [0, 0.25, 1];
const DEFAULT_SHAKE_FREQUENCY = 8;
const ORIGIN: Vec3 = [0, 0, 0];
const DEGREES = Math.PI / 180;

export function lerp(a: number, b: number, k: number): number {
  return a + (b - a) * k;
}

export function lerpVec3(a: Vec3, b: Vec3, k: number): Vec3 {
  return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
}

function addVec3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function normalize(v: Vec3): Vec3 {
  const length = Math.hypot(v[0], v[1], v[2]);
  if (!(length > 0)) throw new RangeError('pushIn: direction must be a non-zero vector');
  return [v[0] / length, v[1] / length, v[2] / length];
}

function progress(timing: RigTiming, t: number): number {
  return progressBetween(t, timing.from ?? 0, timing.to ?? 1, timing.ease);
}

function withFov(pose: CameraPose, fov: RigTiming['fov'], k: number): CameraPose {
  if (fov === undefined) return pose;
  return { ...pose, fov: typeof fov === 'number' ? fov : lerp(fov[0], fov[1], k) };
}

/** Point on a horizontal circle around `centre` at azimuth `degrees` (0 = +Z), raised by `height`. */
function aroundTarget(centre: Vec3, radius: number, height: number, degrees: number): Vec3 {
  const angle = degrees * DEGREES;
  return [
    centre[0] + Math.sin(angle) * radius,
    centre[1] + height,
    centre[2] + Math.cos(angle) * radius,
  ];
}

/** Straight-line camera move from `start` to `end`. */
export function dolly(options: DollyOptions): CameraRig {
  const target = options.target ?? ORIGIN;
  const targetEnd = options.targetEnd ?? target;
  return (t) => {
    const k = progress(options, t);
    const pose = {
      position: lerpVec3(options.start, options.end, k),
      target: lerpVec3(target, targetEnd, k),
    };
    return withFov(pose, options.fov, k);
  };
}

/** Circles the target at a fixed radius and height. */
export function orbit(options: OrbitOptions): CameraRig {
  const target = options.target ?? ORIGIN;
  return (t) => {
    const k = progress(options, t);
    const degrees = lerp(options.degrees[0], options.degrees[1], k);
    const position = aroundTarget(target, options.radius, options.height ?? 0, degrees);
    return withFov({ position, target }, options.fov, k);
  };
}

/** Moves along a fixed direction towards (or away from) the target. */
export function pushIn(options: PushInOptions): CameraRig {
  const target = options.target ?? ORIGIN;
  const direction = normalize(options.direction ?? DEFAULT_PUSH_DIRECTION);
  return (t) => {
    const k = progress(options, t);
    const distance = lerp(options.dist[0], options.dist[1], k);
    const position = addVec3(target, [
      direction[0] * distance,
      direction[1] * distance,
      direction[2] * distance,
    ]);
    return withFov({ position, target }, options.fov, k);
  };
}

/** Rises (or descends) vertically at a fixed horizontal distance, looking at the target. */
export function crane(options: CraneOptions): CameraRig {
  const base = options.target ?? ORIGIN;
  return (t) => {
    const k = progress(options, t);
    const height = lerp(options.height[0], options.height[1], k);
    const position = aroundTarget(base, options.dist, height, options.degrees ?? 0);
    const rise = options.targetHeight
      ? lerp(options.targetHeight[0], options.targetHeight[1], k)
      : 0;
    const target: Vec3 = [base[0], base[1] + rise, base[2]];
    return withFov({ position, target }, options.fov, k);
  };
}

/** Static camera that looks at (or pans between) points. */
export function lookAt(options: LookAtOptions): CameraRig {
  const targetEnd = options.targetEnd ?? options.target;
  return (t) => {
    const k = progress(options, t);
    const pose = { position: options.position, target: lerpVec3(options.target, targetEnd, k) };
    return withFov(pose, options.fov, k);
  };
}

/** Deterministic lattice value in [-1, 1] for (seed, channel, index). */
function latticeValue(seed: number, channel: number, index: number): number {
  let h = (seed ^ Math.imul(index | 0, 0x9e3779b1) ^ Math.imul(channel + 1, 0x85ebca77)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  h = (h ^ (h >>> 16)) >>> 0;
  return (h / 0xffffffff) * 2 - 1;
}

/** Smooth 1D value noise in [-1, 1]: continuous in x, a pure function of (seed, channel, x). */
export function valueNoise(seed: number, channel: number, x: number): number {
  const index = Math.floor(x);
  const fraction = x - index;
  const k = fraction * fraction * (3 - 2 * fraction);
  return lerp(latticeValue(seed, channel, index), latticeValue(seed, channel, index + 1), k);
}

function shakeEnvelope(options: ShakeOptions, t: number): number {
  const from = options.from ?? Number.NEGATIVE_INFINITY;
  const to = options.to ?? Number.POSITIVE_INFINITY;
  if (t < from || t > to) return 0;
  if (options.decay === undefined || !Number.isFinite(from)) return 1;
  return Math.exp(-(t - from) / options.decay);
}

/** Adds seeded, smooth noise to the position and look-at point of `base`. */
export function shake(base: CameraRig | CameraPose, options: ShakeOptions): CameraRig {
  const seed = (options.seed ?? 0) >>> 0;
  const frequency = options.frequency ?? DEFAULT_SHAKE_FREQUENCY;
  return (t) => {
    const pose = typeof base === 'function' ? base(t) : base;
    const amount = options.amplitude * shakeEnvelope(options, t);
    if (amount === 0) return pose;
    const x = t * frequency;
    const offset = (first: number): Vec3 => [
      amount * valueNoise(seed, first, x),
      amount * valueNoise(seed, first + 1, x),
      amount * valueNoise(seed, first + 2, x),
    ];
    return {
      ...pose,
      position: addVec3(pose.position, offset(0)),
      target: addVec3(pose.target ?? ORIGIN, offset(3)),
    };
  };
}
