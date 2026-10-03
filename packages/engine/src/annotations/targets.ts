/**
 * Resolves annotation targets for the current frame: 3D targets are projected through the shot
 * camera every frame (annotations follow camera and object moves), objects also get their
 * projected bounds, and an optional raycast tells whether something hides the target point.
 */
import { isKitObject, kitOriginOf } from '@reelforge/kit';
import * as THREE from 'three';
import { EngineError } from '../errors.js';
import type { PixelRect, TextCard } from '../text/types.js';
import { unionRects, type Point } from './raster.js';
import type { TargetSpec } from './target-spec.js';

export interface ResolvedTarget extends Point {
  readonly kind: TargetSpec['kind'];
  /**
   * Projected bounds (whole objects, no anchor), the region (screen with size) or the card/word
   * ink box; undefined for points.
   */
  readonly rect: PixelRect | undefined;
  /** Projected bounds of the target object even when an anchor names a point of it (placement). */
  readonly bounds: PixelRect | undefined;
  readonly inFront: boolean;
  readonly onScreen: boolean;
  /** Undefined when not tested. */
  readonly occluded: boolean | undefined;
  readonly label: string;
}

export interface TargetEnv {
  readonly shotId: string;
  readonly width: number;
  readonly height: number;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly cards: readonly TextCard[];
}

const STANDARD = ['center', 'top', 'bottom', 'front', 'back', 'left', 'right'];

function objectLabel(object: THREE.Object3D): string {
  const origin = kitOriginOf(object);
  if (origin) return `${origin.call}${origin.index > 0 ? ` #${String(origin.index + 1)}` : ''}`;
  if (object.name !== '') return `object "${object.name}"`;
  return isKitObject(object) ? `kit ${object.kitType}` : `a ${object.type}`;
}

function boxAnchor(box: THREE.Box3, name: string): THREE.Vector3 {
  const point = box.getCenter(new THREE.Vector3());
  if (name === 'top') point.y = box.max.y;
  if (name === 'bottom') point.y = box.min.y;
  if (name === 'front') point.z = box.max.z;
  if (name === 'back') point.z = box.min.z;
  if (name === 'left') point.x = box.min.x;
  if (name === 'right') point.x = box.max.x;
  return point;
}

function anchorWorld(
  object: THREE.Object3D,
  anchor: string | undefined,
  shotId: string,
): THREE.Vector3 {
  const name = anchor ?? 'center';
  if (isKitObject(object)) {
    if (!object.anchorNames().includes(name)) {
      throw new EngineError(
        'invalid-annotation-options',
        `annotation target ${objectLabel(object)} has no anchor "${name}" (available: ${object.anchorNames().join(', ')})`,
        { shotId },
      );
    }
    return object.localToWorld(object.anchor(name));
  }
  if (!STANDARD.includes(name)) {
    throw new EngineError(
      'invalid-annotation-options',
      `annotation target ${objectLabel(object)} is not a kit object; only the standard anchors ${STANDARD.join(', ')} work on it`,
      { shotId },
    );
  }
  return boxAnchor(new THREE.Box3().setFromObject(object), name);
}

interface Projected extends Point {
  readonly inFront: boolean;
}

function project(world: THREE.Vector3, env: TargetEnv): Projected {
  const view = world.clone().applyMatrix4(env.camera.matrixWorldInverse);
  const inFront = view.z < -env.camera.near;
  const ndc = world.clone().project(env.camera);
  return {
    x: ((ndc.x + 1) / 2) * env.width,
    y: ((1 - ndc.y) / 2) * env.height,
    inFront,
  };
}

function projectedBounds(object: THREE.Object3D, env: TargetEnv): PixelRect | undefined {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return undefined;
  const corners: Point[] = [];
  for (const x of [box.min.x, box.max.x]) {
    for (const y of [box.min.y, box.max.y]) {
      for (const z of [box.min.z, box.max.z]) {
        const point = project(new THREE.Vector3(x, y, z), env);
        if (point.inFront) corners.push(point);
      }
    }
  }
  if (corners.length === 0) return undefined;
  const x0 = Math.floor(Math.min(...corners.map((corner) => corner.x)));
  const y0 = Math.floor(Math.min(...corners.map((corner) => corner.y)));
  const x1 = Math.ceil(Math.max(...corners.map((corner) => corner.x)));
  const y1 = Math.ceil(Math.max(...corners.map((corner) => corner.y)));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function isVisibleChain(object: THREE.Object3D): boolean {
  for (let node: THREE.Object3D | null = object; node !== null; node = node.parent) {
    if (!node.visible) return false;
  }
  return true;
}

function isInside(object: THREE.Object3D, owner: THREE.Object3D | undefined): boolean {
  if (!owner) return false;
  for (let node: THREE.Object3D | null = object; node !== null; node = node.parent) {
    if (node === owner) return true;
  }
  return false;
}

/** True when a visible mesh (not the target object itself) is between the camera and `world`. */
function occludedPoint(
  world: THREE.Vector3,
  owner: THREE.Object3D | undefined,
  env: TargetEnv,
): boolean {
  const origin = env.camera.getWorldPosition(new THREE.Vector3());
  const direction = world.clone().sub(origin);
  const distance = direction.length();
  if (distance <= 1e-6) return false;
  const raycaster = new THREE.Raycaster(origin, direction.normalize(), env.camera.near, distance);
  const margin = Math.max(0.05, distance * 0.01);
  return raycaster
    .intersectObject(env.scene, true)
    .some(
      (hit) =>
        hit.distance < distance - margin &&
        (hit.object as Partial<THREE.Mesh>).isMesh === true &&
        isVisibleChain(hit.object) &&
        !isInside(hit.object, owner),
    );
}

function onFrame(point: Point, env: TargetEnv): boolean {
  return point.x >= 0 && point.x < env.width && point.y >= 0 && point.y < env.height;
}

function cardTarget(spec: Extract<TargetSpec, { kind: 'card' }>, env: TargetEnv): ResolvedTarget {
  const card = env.cards.find(
    (candidate) => candidate.id === spec.card && candidate.kind !== 'annotation',
  );
  if (!card) {
    const ids = env.cards
      .filter((candidate) => candidate.kind !== 'annotation')
      .map((candidate) => `"${candidate.id}"`);
    throw new EngineError(
      'invalid-annotation-options',
      `annotation target { card: "${spec.card}" }: no ctx.text card with that id in this frame (cards: ${ids.join(', ') || 'none'}); give the text call an id option and call it every frame`,
      { shotId: env.shotId },
    );
  }
  let rect = card.box;
  if (spec.words) {
    const words = card.words ?? [];
    const [first, last] = spec.words;
    if (words.length === 0 || first > last || last >= words.length) {
      throw new EngineError(
        'invalid-annotation-options',
        `annotation target { card: "${spec.card}", words: [${String(first)}, ${String(last)}] }: the card has ${String(words.length)} words (0-based indices, first <= last)`,
        { shotId: env.shotId },
      );
    }
    rect = unionRects(words.slice(first, last + 1));
  }
  return {
    kind: 'card',
    x: rect.x + rect.w / 2,
    y: rect.y + rect.h / 2,
    rect,
    bounds: rect,
    inFront: true,
    onScreen: card.visible,
    occluded: undefined,
    label: `text card "${spec.card}"`,
  };
}

export function resolveTarget(
  spec: TargetSpec,
  env: TargetEnv,
  probeOcclusion: boolean,
): ResolvedTarget {
  switch (spec.kind) {
    case 'screen': {
      const x = spec.screen[0] * env.width;
      const y = spec.screen[1] * env.height;
      const rect = spec.size && {
        x: Math.round(x - (spec.size[0] * env.width) / 2),
        y: Math.round(y - (spec.size[1] * env.height) / 2),
        w: Math.round(spec.size[0] * env.width),
        h: Math.round(spec.size[1] * env.height),
      };
      const onScreen = onFrame({ x, y }, env);
      return {
        kind: 'screen',
        x,
        y,
        rect,
        bounds: rect,
        inFront: true,
        onScreen,
        occluded: undefined,
        label: `screen point [${spec.screen.join(', ')}]`,
      };
    }
    case 'card':
      return cardTarget(spec, env);
    case 'world': {
      const world = new THREE.Vector3(...spec.world);
      const point = project(world, env);
      return {
        kind: 'world',
        ...point,
        rect: undefined,
        bounds: undefined,
        onScreen: point.inFront && onFrame(point, env),
        occluded:
          probeOcclusion && point.inFront ? occludedPoint(world, undefined, env) : undefined,
        label: `world point [${spec.world.join(', ')}]`,
      };
    }
    case 'object': {
      const world = anchorWorld(spec.object, spec.anchor, env.shotId);
      if (spec.offset) world.add(new THREE.Vector3(...spec.offset));
      const point = project(world, env);
      const anchorText = spec.anchor === undefined ? '' : ` anchor "${spec.anchor}"`;
      const bounds = projectedBounds(spec.object, env);
      return {
        kind: 'object',
        ...point,
        // Bounds describe the whole object; an anchor names a point of it.
        rect: spec.anchor === undefined ? bounds : undefined,
        bounds,
        onScreen: point.inFront && onFrame(point, env),
        occluded:
          probeOcclusion && point.inFront ? occludedPoint(world, spec.object, env) : undefined,
        label: `${objectLabel(spec.object)}${anchorText}`,
      };
    }
  }
}
