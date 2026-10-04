/**
 * Per-shot layer of the cinematic camera moves (PLAN.md#12.28, ADR-013). Immediate mode like
 * ctx.text: the scene calls the moves in `update(t)`, the shot applies them after update() on top
 * of the pose the scene set (orbit -> dolly zoom -> parallax, then the ambient drift) and resolves
 * the focus with the final camera. Before the next update everything the moves changed (camera
 * pose and fov, parallax object positions) is restored, so a frame never depends on the frames
 * rendered before it.
 */
import * as THREE from 'three';
import { kitOriginOf } from '@reelforge/kit';
import type { Vec3 } from '../contract.js';
import { EngineError } from '../errors.js';
import { DEFAULT_BOKEH, type FocusState } from './bokeh.js';
import {
  checkDollyZoom,
  checkOrbitMove,
  checkParallax,
  checkRackFocus,
  moveFailer,
  type MoveName,
} from './move-options.js';
import {
  applyDollyZoom,
  applyOrbit,
  cameraRight,
  moveProgress,
  moveWindow,
  parallaxOffset,
  subjectPoint,
  viewDepth,
  type CameraMove,
  type DollyZoomOptions,
  type MoveSubject,
  type OrbitMoveOptions,
  type ParallaxLayer,
  type ParallaxOptions,
  type RackFocusOptions,
} from './moves.js';

/** The four moves as scenes call them. */
export interface CameraMoveMethods {
  rackFocus(options: RackFocusOptions): CameraMove;
  dollyZoom(options: DollyZoomOptions): CameraMove;
  orbit(options: OrbitMoveOptions): CameraMove;
  parallax(options: ParallaxOptions): CameraMove;
}

export interface CameraMoveLayer extends CameraMoveMethods {
  /** Restores what the previous frame's moves changed and opens a frame at local time t. */
  beginFrame(localTime: number): void;
  /** Applies the recorded moves to the camera and the parallax layers (after the scene update). */
  applyMoves(): void;
  /** Resolves the focus with the final camera (after the ambient drift) and closes the frame. */
  endFrame(): void;
  /** Depth of field of the last frame; undefined when it had no rack focus. */
  focus(): FocusState | undefined;
}

export interface CameraMoveLayerOptions {
  readonly shotId: string;
  readonly camera: THREE.PerspectiveCamera;
  readonly scene: THREE.Scene;
  /** The camera's look-at target as last set by ctx.camera (set / rigs). */
  lookTarget(): Vec3;
}

/** Nearest focus distance (world units). */
const MIN_FOCUS_DISTANCE = 0.05;

interface Recorded<T> {
  readonly options: T;
  readonly t0: number;
  readonly progress: number;
}

interface Snapshot {
  readonly position: THREE.Vector3;
  readonly quaternion: THREE.Quaternion;
  readonly fov: number;
}

/** The move that holds the frame: the last one started by t, else the first to start. */
function activeMove<T>(moves: readonly Recorded<T>[], t: number): Recorded<T> | undefined {
  const sorted = [...moves].sort((first, second) => first.t0 - second.t0);
  return sorted.filter((move) => move.t0 <= t).at(-1) ?? sorted[0];
}

function toVector(point: Vec3): THREE.Vector3 {
  return new THREE.Vector3(point[0], point[1], point[2]);
}

function containsLight(object: THREE.Object3D): boolean {
  if ((object as Partial<THREE.Light>).isLight === true) return true;
  return object.children.some(containsLight);
}

function matchesKit(object: THREE.Object3D, tags: readonly string[]): boolean {
  const origin = kitOriginOf(object);
  return origin !== undefined && (tags.includes(origin.kind) || tags.includes(origin.name));
}

/** Kit objects of the scene matching the tags (outermost match; its children are not searched). */
function kitMembers(root: THREE.Object3D, tags: readonly string[], out: THREE.Object3D[]): void {
  for (const child of root.children) {
    if (matchesKit(child, tags)) out.push(child);
    else kitMembers(child, tags, out);
  }
}

export function createCameraMoveLayer(options: CameraMoveLayerOptions): CameraMoveLayer {
  const { camera, scene } = options;
  const fail = moveFailer(options.shotId);
  /** Local time of the open frame; moves can be recorded while `recording` (during update). */
  let frameTime = 0;
  let recording = false;
  let focus: FocusState | undefined;
  let snapshot: Snapshot | undefined;
  const moved = new Map<THREE.Object3D, THREE.Vector3>();
  let focuses: Recorded<RackFocusOptions>[] = [];
  let dollies: Recorded<DollyZoomOptions>[] = [];
  let orbits: Recorded<OrbitMoveOptions>[] = [];
  let parallaxes: Recorded<ParallaxOptions>[] = [];

  const record = <
    T extends RackFocusOptions | DollyZoomOptions | OrbitMoveOptions | ParallaxOptions,
  >(
    move: MoveName,
    list: Recorded<T>[],
    moveOptions: T,
  ): CameraMove => {
    if (!recording) {
      throw new EngineError(
        'camera-move-outside-update',
        `ctx.camera.${move}(…) was called outside update(); call camera moves in update(t, state, ctx) every frame (resolve anchors in build and keep them in the state)`,
        { shotId: options.shotId },
      );
    }
    const progress = moveProgress(moveOptions, frameTime);
    list.push({ options: moveOptions, t0: moveWindow(moveOptions)[0], progress });
    return { progress };
  };

  const point = (subject: MoveSubject | undefined): THREE.Vector3 =>
    subject === undefined ? toVector(options.lookTarget()) : subjectPoint(subject);

  const moveObject = (object: THREE.Object3D, offset: THREE.Vector3): void => {
    if (!moved.has(object)) moved.set(object, object.position.clone());
    const world = object.getWorldPosition(new THREE.Vector3()).add(offset);
    if (object.parent) object.position.copy(object.parent.worldToLocal(world));
    else object.position.copy(world);
    object.updateMatrixWorld();
  };

  const layerMembers = (layer: ParallaxLayer, claimed: Set<THREE.Object3D>): THREE.Object3D[] => {
    const members: THREE.Object3D[] = [];
    if ('kit' in layer) {
      kitMembers(scene, typeof layer.kit === 'string' ? [layer.kit] : layer.kit, members);
    } else if ('objects' in layer) {
      members.push(...layer.objects);
    } else {
      const near = layer.near ?? 0;
      const far = layer.far ?? Number.POSITIVE_INFINITY;
      for (const child of scene.children) {
        if ((child as Partial<THREE.Camera>).isCamera === true) continue;
        const depth = viewDepth(camera, child.getWorldPosition(new THREE.Vector3()));
        if (depth >= near && depth < far) members.push(child);
      }
    }
    // Moving a light would change the shading, not the parallax: rigs with lights stay put.
    return members.filter((member) => !claimed.has(member) && !containsLight(member));
  };

  const applyParallax = (move: Recorded<ParallaxOptions>): void => {
    const truck = move.options.amount * move.progress;
    const right = cameraRight(camera);
    const claimed = new Set<THREE.Object3D>();
    for (const layer of move.options.layers ?? []) {
      const offset = parallaxOffset(right, truck, layer.ratio);
      for (const member of layerMembers(layer, claimed)) {
        claimed.add(member);
        moveObject(member, offset);
      }
    }
    camera.position.addScaledVector(right, truck);
  };

  const applyOrbitMove = (move: Recorded<OrbitMoveOptions>): void => {
    const { degrees, axis, radius, target } = move.options;
    if (!applyOrbit(camera, point(target), degrees * move.progress, axis ?? 'y', radius)) {
      fail('orbit', 'the camera sits on the pivot; move it away or pass a target');
    }
  };

  const applyDolly = (move: Recorded<DollyZoomOptions>): void => {
    const { from, to, subject } = move.options;
    const distance = from + (to - from) * move.progress;
    if (!applyDollyZoom(camera, point(subject), distance)) {
      fail('dollyZoom', 'the subject must be in front of the camera');
    }
  };

  const resolveFocus = (move: Recorded<RackFocusOptions>): FocusState => {
    const depth = (target: number | MoveSubject): number =>
      typeof target === 'number' ? target : viewDepth(camera, subjectPoint(target));
    const { from, to, bokeh } = move.options;
    const start = depth(from);
    const distance = start + (depth(to) - start) * move.progress;
    return { distance: Math.max(MIN_FOCUS_DISTANCE, distance), aperture: bokeh ?? DEFAULT_BOKEH };
  };

  const restore = (): void => {
    if (snapshot) {
      camera.position.copy(snapshot.position);
      camera.quaternion.copy(snapshot.quaternion);
      if (camera.fov !== snapshot.fov) {
        camera.fov = snapshot.fov;
        camera.updateProjectionMatrix();
      }
      camera.updateMatrixWorld();
      snapshot = undefined;
    }
    for (const [object, position] of moved) {
      object.position.copy(position);
      object.updateMatrixWorld();
    }
    moved.clear();
  };

  return {
    rackFocus: (moveOptions) => record('rackFocus', focuses, checkRackFocus(moveOptions, fail)),
    dollyZoom: (moveOptions) => record('dollyZoom', dollies, checkDollyZoom(moveOptions, fail)),
    orbit: (moveOptions) => record('orbit', orbits, checkOrbitMove(moveOptions, fail)),
    parallax: (moveOptions) => record('parallax', parallaxes, checkParallax(moveOptions, fail)),
    beginFrame(localTime) {
      restore();
      focuses = [];
      dollies = [];
      orbits = [];
      parallaxes = [];
      focus = undefined;
      frameTime = localTime;
      recording = true;
    },
    applyMoves() {
      recording = false;
      if (orbits.length + dollies.length + parallaxes.length === 0) return;
      snapshot = {
        position: camera.position.clone(),
        quaternion: camera.quaternion.clone(),
        fov: camera.fov,
      };
      camera.updateMatrixWorld();
      for (const move of orbits) applyOrbitMove(move);
      const dolly = activeMove(dollies, frameTime);
      if (dolly) applyDolly(dolly);
      for (const move of parallaxes) applyParallax(move);
      camera.updateMatrixWorld();
    },
    endFrame() {
      recording = false;
      const rack = activeMove(focuses, frameTime);
      focus = rack && resolveFocus(rack);
    },
    focus: () => focus,
  };
}
