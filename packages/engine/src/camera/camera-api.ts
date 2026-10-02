/** `ctx.camera`: direct `set(pose)` plus rigs that apply their pose to the shot camera. */
import type * as THREE from 'three';
import type { AppliedRig, CameraApi, CameraPose } from '../contract.js';
import { hashString } from '../rng.js';
import {
  crane,
  dolly,
  lookAt,
  orbit,
  pushIn,
  shake,
  type CameraRig,
  type RigTiming,
} from './rigs.js';

export interface CameraApiOptions {
  /** Shot length: the default `to` of every rig. */
  readonly duration: number;
  /** Shot seed: the default seed of `shake`. */
  readonly seed: number;
}

export function applyPose(camera: THREE.PerspectiveCamera, pose: CameraPose): void {
  camera.position.set(...pose.position);
  if (pose.fov !== undefined && pose.fov !== camera.fov) {
    camera.fov = pose.fov;
    camera.updateProjectionMatrix();
  }
  camera.lookAt(...(pose.target ?? [0, 0, 0]));
}

export function createCameraApi(
  camera: THREE.PerspectiveCamera,
  options: CameraApiOptions,
): CameraApi {
  const applied =
    (rig: CameraRig): AppliedRig =>
    (t) => {
      const pose = rig(t);
      applyPose(camera, pose);
      return pose;
    };
  const timed = <T extends RigTiming>(rigOptions: T): T => ({
    ...rigOptions,
    to: rigOptions.to ?? options.duration,
  });
  const shakeSeed = hashString('camera:shake', options.seed);
  return {
    object: camera,
    set: (pose) => {
      applyPose(camera, pose);
    },
    dolly: (rigOptions) => applied(dolly(timed(rigOptions))),
    orbit: (rigOptions) => applied(orbit(timed(rigOptions))),
    pushIn: (rigOptions) => applied(pushIn(timed(rigOptions))),
    crane: (rigOptions) => applied(crane(timed(rigOptions))),
    lookAt: (rigOptions) => applied(lookAt(timed(rigOptions))),
    shake: (base, shakeOptions) =>
      applied(shake(base, { ...shakeOptions, seed: shakeOptions.seed ?? shakeSeed })),
  };
}
