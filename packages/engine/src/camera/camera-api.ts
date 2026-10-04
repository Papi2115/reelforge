/**
 * `ctx.camera`: direct `set(pose)`, rigs that apply their pose to the shot camera, and the
 * cinematic moves (rack focus, dolly zoom, orbit move, parallax; move-layer.ts) that modify the
 * pose the scene set.
 */
import type * as THREE from 'three';
import type { AppliedRig, CameraApi, CameraPose } from '../contract.js';
import { hashString } from '../rng.js';
import type { CameraMoveMethods } from './move-layer.js';
import type { CameraMove, OrbitMoveOptions } from './moves.js';
import {
  crane,
  dolly,
  lookAt,
  orbit,
  pushIn,
  shake,
  type CameraRig,
  type OrbitOptions,
  type RigTiming,
} from './rigs.js';

export interface CameraApiOptions {
  /** Shot length: the default `to` of every rig. */
  readonly duration: number;
  /** Shot seed: the default seed of `shake`. */
  readonly seed: number;
  /** The shot's move layer (the moves' default pivot is the last pose's target). */
  readonly moves: CameraMoveMethods;
  /** Called with every pose applied through ctx.camera (set and rigs). */
  readonly onPose?: ((pose: CameraPose) => void) | undefined;
}

/** Members of `ctx.camera`: anything else is not part of the API (lint rule `camera-api`). */
export const CAMERA_API_MEMBERS: readonly string[] = [
  'object',
  'set',
  'dolly',
  'orbit',
  'pushIn',
  'crane',
  'lookAt',
  'shake',
  'rackFocus',
  'dollyZoom',
  'parallax',
];

export function applyPose(camera: THREE.PerspectiveCamera, pose: CameraPose): void {
  camera.position.set(...pose.position);
  if (pose.fov !== undefined && pose.fov !== camera.fov) {
    camera.fov = pose.fov;
    camera.updateProjectionMatrix();
  }
  camera.lookAt(...(pose.target ?? [0, 0, 0]));
}

/** An orbit move has a `t0` (the rig has `from`/`to` and a degrees span). */
function isOrbitMove(options: OrbitOptions | OrbitMoveOptions): options is OrbitMoveOptions {
  return 't0' in options;
}

export function createCameraApi(
  camera: THREE.PerspectiveCamera,
  options: CameraApiOptions,
): CameraApi {
  const apply = (pose: CameraPose): void => {
    applyPose(camera, pose);
    options.onPose?.(pose);
  };
  const applied =
    (rig: CameraRig): AppliedRig =>
    (t) => {
      const pose = rig(t);
      apply(pose);
      return pose;
    };
  const timed = <T extends RigTiming>(rigOptions: T): T => ({
    ...rigOptions,
    to: rigOptions.to ?? options.duration,
  });
  const shakeSeed = hashString('camera:shake', options.seed);
  const { moves } = options;
  function orbitRigOrMove(rigOptions: OrbitOptions): AppliedRig;
  function orbitRigOrMove(moveOptions: OrbitMoveOptions): CameraMove;
  function orbitRigOrMove(input: OrbitOptions | OrbitMoveOptions): AppliedRig | CameraMove {
    return isOrbitMove(input) ? moves.orbit(input) : applied(orbit(timed(input)));
  }
  return {
    object: camera,
    set: apply,
    dolly: (rigOptions) => applied(dolly(timed(rigOptions))),
    orbit: orbitRigOrMove,
    pushIn: (rigOptions) => applied(pushIn(timed(rigOptions))),
    crane: (rigOptions) => applied(crane(timed(rigOptions))),
    lookAt: (rigOptions) => applied(lookAt(timed(rigOptions))),
    shake: (base, shakeOptions) =>
      applied(shake(base, { ...shakeOptions, seed: shakeOptions.seed ?? shakeSeed })),
    rackFocus: (moveOptions) => moves.rackFocus(moveOptions),
    dollyZoom: (moveOptions) => moves.dollyZoom(moveOptions),
    parallax: (moveOptions) => moves.parallax(moveOptions),
  } satisfies CameraApi;
}
