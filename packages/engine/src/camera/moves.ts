/**
 * Cinematic camera moves (PLAN.md#12.28): rack focus, dolly zoom, orbit and layered parallax.
 * Unlike the rigs (rigs.ts), which produce a whole pose, a move modifies the pose the scene set in
 * `update` (rig, `set` or a fixed build-time pose): the shot applies the moves after update() and
 * undoes them before the next one (move-layer.ts). The math here is pure and works on a
 * PerspectiveCamera in place, so it runs (and is tested) in Node.
 */
import * as THREE from 'three';
import type { AnchorHit, Vec3 } from '../contract.js';
import { progressBetween, type EaseInput } from './easing.js';

/**
 * Time of a move: local seconds or an anchor (`ctx.anchor('phrase')`). As `t0` an anchor counts
 * from its start (`hit.t`), as `t1` until its end (`hit.tEnd`), so `{ t0: hit, t1: hit }` spans
 * the spoken phrase.
 */
export type MoveTime = number | AnchorHit;
/** A world point `[x, y, z]` or an object (its world bounding-box centre). */
export type MoveSubject = Vec3 | THREE.Object3D;

export interface MoveTiming {
  readonly t0: MoveTime;
  readonly t1: MoveTime;
  /** Default 'easeInOutCubic'. Before t0 the move holds its start, after t1 its end. */
  readonly ease?: EaseInput;
}

export interface RackFocusOptions extends MoveTiming {
  /** Focus at t0: a distance from the camera (world units), a world point or an object. */
  readonly from: number | MoveSubject;
  /** Focus at t1 (same forms as `from`). */
  readonly to: number | MoveSubject;
  /** Aperture: blur radius (low-res px) at twice or half the focus distance (0..6). Default 3. */
  readonly bokeh?: number;
}

export interface DollyZoomOptions extends MoveTiming {
  /** Camera distance to the subject at t0 (world units, along the view axis). */
  readonly from: number;
  /** Camera distance to the subject at t1. */
  readonly to: number;
  /** What keeps its size; default the camera's look-at target. */
  readonly subject?: MoveSubject;
}

/**
 * 'y' = world up (turntable; positive turns the camera towards +x seen from +z), 'x' = the
 * camera's horizontal axis (arc; positive rises over the subject), or a world axis [x, y, z].
 */
export type OrbitAxis = 'y' | 'x' | Vec3;

export interface OrbitMoveOptions extends MoveTiming {
  /** Turn over the move in degrees (positive: counter-clockwise from above / rising for 'x'). */
  readonly degrees: number;
  /** Default 'y'. */
  readonly axis?: OrbitAxis;
  /** Distance to the pivot; default the camera's own distance. */
  readonly radius?: number;
  /** Pivot; default the camera's look-at target. */
  readonly target?: MoveSubject;
}

/**
 * A parallax layer: what moves at `ratio` x its natural parallax (0 = pinned to the frame like a
 * far sky, 1 = natural, > 1 = exaggerated foreground). Members: objects by distance from the
 * camera (`near`..`far`, top-level scene objects), kit objects by kind or name, or explicit objects.
 */
export type ParallaxLayer = { readonly ratio: number } & (
  | { readonly near?: number; readonly far?: number }
  | { readonly kit: string | readonly string[] }
  | { readonly objects: readonly THREE.Object3D[] }
);

export interface ParallaxOptions extends MoveTiming {
  /** Lateral camera travel over the move in world units (positive = to the camera's right). */
  readonly amount: number;
  /** Layers with their own parallax ratio; objects in no layer move naturally. Default none. */
  readonly layers?: readonly ParallaxLayer[];
}

/** What a move call returns: its eased progress at the frame's time (0..1). */
export interface CameraMove {
  readonly progress: number;
}

/** Resolved [t0, t1] of a move in local seconds. */
export function moveWindow(timing: MoveTiming): readonly [number, number] {
  const t0 = typeof timing.t0 === 'number' ? timing.t0 : timing.t0.t;
  const t1 = typeof timing.t1 === 'number' ? timing.t1 : timing.t1.tEnd;
  return [t0, t1];
}

export function moveProgress(timing: MoveTiming, t: number): number {
  const [t0, t1] = moveWindow(timing);
  return progressBetween(t, t0, t1, timing.ease);
}

/** Min/max field of view a dolly zoom may reach (degrees). */
export const DOLLY_ZOOM_FOV_RANGE: readonly [number, number] = [1, 160];
const DEGREES = Math.PI / 180;

/** Camera axes (world space) from its orientation. */
export function cameraForward(camera: THREE.Camera): THREE.Vector3 {
  return new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
}

export function cameraRight(camera: THREE.Camera): THREE.Vector3 {
  return new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
}

/** World point of a subject: the point itself or the object's bounding-box centre. */
export function subjectPoint(subject: MoveSubject): THREE.Vector3 {
  if (subject instanceof THREE.Object3D) {
    subject.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(subject);
    return box.isEmpty()
      ? subject.getWorldPosition(new THREE.Vector3())
      : box.getCenter(new THREE.Vector3());
  }
  return new THREE.Vector3(subject[0], subject[1], subject[2]);
}

/** Distance of a world point in front of the camera, along its view axis (negative = behind). */
export function viewDepth(camera: THREE.Camera, point: THREE.Vector3): number {
  return point.clone().sub(camera.position).dot(cameraForward(camera));
}

/**
 * Field of view (degrees) that keeps the plane at `baseDepth` (seen with `baseFov`) the same size
 * from `distance`: distance * tan(fov / 2) stays constant.
 */
export function dollyZoomFov(baseDepth: number, baseFov: number, distance: number): number {
  const half = Math.atan((baseDepth * Math.tan((baseFov * DEGREES) / 2)) / distance);
  const [min, max] = DOLLY_ZOOM_FOV_RANGE;
  return Math.min(max, Math.max(min, (2 * half) / DEGREES));
}

/**
 * Dolly zoom: moves the camera along its view axis so the subject is `distance` away and widens
 * or narrows the field of view so the subject's plane keeps its size and place on screen.
 * Returns false (camera untouched) when the subject is not in front of the camera.
 */
export function applyDollyZoom(
  camera: THREE.PerspectiveCamera,
  subject: THREE.Vector3,
  distance: number,
): boolean {
  const depth = viewDepth(camera, subject);
  if (!(depth > 1e-6) || !(distance > 0)) return false;
  camera.position.addScaledVector(cameraForward(camera), depth - distance);
  camera.fov = dollyZoomFov(depth, camera.fov, distance);
  camera.updateProjectionMatrix();
  return true;
}

function orbitAxisVector(camera: THREE.Camera, axis: OrbitAxis): THREE.Vector3 {
  if (axis === 'y') return new THREE.Vector3(0, 1, 0);
  // Positive degrees about the camera's horizontal axis rise over the subject.
  if (axis === 'x') return cameraRight(camera).negate();
  return new THREE.Vector3(axis[0], axis[1], axis[2]).normalize();
}

/**
 * Turns the camera around `pivot` by `degrees` about `axis` (position and orientation turn
 * together, so a camera looking at the pivot keeps looking at it). With `radius` the camera is
 * first moved along the pivot line to that distance. Returns false when the camera sits on the
 * pivot and a radius was asked for.
 */
export function applyOrbit(
  camera: THREE.Camera,
  pivot: THREE.Vector3,
  degrees: number,
  axis: OrbitAxis,
  radius?: number,
): boolean {
  const offset = camera.position.clone().sub(pivot);
  if (radius !== undefined) {
    if (!(offset.length() > 1e-9)) return false;
    offset.setLength(radius);
  }
  const turn = new THREE.Quaternion().setFromAxisAngle(
    orbitAxisVector(camera, axis),
    degrees * DEGREES,
  );
  camera.position.copy(pivot).add(offset.applyQuaternion(turn));
  camera.quaternion.premultiply(turn);
  return true;
}

/**
 * World offset of a parallax layer member for a lateral camera travel `truck` along `right`:
 * moving with the camera by (1 - ratio) x truck leaves ratio x the natural screen motion.
 */
export function parallaxOffset(right: THREE.Vector3, truck: number, ratio: number): THREE.Vector3 {
  return right.clone().multiplyScalar((1 - ratio) * truck);
}
