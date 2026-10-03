/**
 * Camera drift of ambient variation (PLAN.md#12.8): a slow yaw/pitch turn on top of whatever pose
 * the scene set, from -drift at the shot start to +drift at its end. It is applied after the
 * scene's update and undone before the next one, so a scene that never touches the camera in
 * update still gets a pure function of t (no accumulation across seeks).
 */
import type * as THREE from 'three';

export interface CameraDrift {
  /** Restores the scene's own orientation (call before the scene's update). */
  begin(): void;
  /** Turns the camera for local time t (call after the scene's update). */
  apply(localTime: number): void;
}

const DEGREES = Math.PI / 180;

/** Signed share of the drift at local time t: -1 at the start, +1 at the end of the shot. */
export function driftProgress(localTime: number, duration: number): number {
  if (!(duration > 0)) return 0;
  return Math.min(1, Math.max(0, localTime / duration)) * 2 - 1;
}

export function createCameraDrift(
  camera: THREE.PerspectiveCamera,
  drift: readonly [number, number],
  duration: number,
): CameraDrift {
  const own = camera.quaternion.clone();
  let turned = false;
  return {
    begin() {
      if (turned) camera.quaternion.copy(own);
      turned = false;
    },
    apply(localTime) {
      own.copy(camera.quaternion);
      const progress = driftProgress(localTime, duration);
      camera.rotateY(drift[0] * DEGREES * progress);
      camera.rotateX(drift[1] * DEGREES * progress);
      camera.updateMatrixWorld();
      turned = true;
    },
  };
}
