/**
 * Object picking for the preview (PLAN.md#6.6): what is under a point of the frame at time t.
 * Text cards (drawn over the 3D image) win; otherwise a ray from the shot camera hits the scene
 * and the hit is attributed to the nearest kit registry object (`kit.props.calculator()`, ...),
 * else the nearest kit object, else the top-level object of the scene. Read-only: it evaluates
 * the shot at t (like a seek) but renders nothing.
 */
import { isKitObject, kitOriginOf, type KitKind } from '@reelforge/kit';
import * as THREE from 'three';
import type { Vec3 } from './contract.js';
import type { BuiltShot } from './shot.js';

export type PickKind = 'kit' | 'object' | 'text';

export interface PickResult {
  readonly kind: PickKind;
  readonly shotId: string;
  /** Global time of the pick and the shot's local time. */
  readonly t: number;
  readonly localTime: number;
  /** Short name: the kit definition (`calculator`), the object name, or the card text. */
  readonly name: string;
  /** Stable id within the shot: `props.calculator#0`, `object:<name>#<n>` or `text:<card id>`. */
  readonly id: string;
  /** Kit definition kind and the scene-facing call, when the object came from the kit registry. */
  readonly kitKind: KitKind | undefined;
  readonly call: string | undefined;
  /** 0-based index of that call in the shot's build(). */
  readonly occurrence: number | undefined;
  /** The name the scene gave the object (`obj.name = ...`), when it differs from `name`. */
  readonly sceneName: string | undefined;
  /** Kit object it stands on / is mounted to (`desk`), if any. */
  readonly parent: string | undefined;
  /** World position (text: undefined) and world-space size of its bounds. */
  readonly position: Vec3 | undefined;
  readonly size: Vec3 | undefined;
  /** One human sentence about the hit. */
  readonly description: string;
}

export interface PickInput {
  readonly shot: BuiltShot;
  /** Frame size in low-res pixels (text card boxes are in these units). */
  readonly width: number;
  readonly height: number;
  /** Normalized frame coordinates: 0..1, (0, 0) = top-left. */
  readonly x: number;
  readonly y: number;
  readonly t: number;
  readonly localTime: number;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function vec(vector: THREE.Vector3): Vec3 {
  return [round(vector.x), round(vector.y), round(vector.z)];
}

function formatVec(value: Vec3): string {
  return value.map((part) => part.toFixed(2)).join(', ');
}

function isVisibleChain(object: THREE.Object3D): boolean {
  for (let node: THREE.Object3D | null = object; node !== null; node = node.parent) {
    if (!node.visible) return false;
  }
  return true;
}

function isMesh(object: THREE.Object3D): boolean {
  return (object as Partial<THREE.Mesh>).isMesh === true;
}

function pickText(input: PickInput): PickResult | undefined {
  const px = input.x * input.width;
  const py = input.y * input.height;
  const card = [...input.shot.cards()]
    .reverse()
    .find(
      (candidate) =>
        candidate.visible &&
        px >= candidate.box.x &&
        px < candidate.box.x + candidate.box.w &&
        py >= candidate.box.y &&
        py < candidate.box.y + candidate.box.h,
    );
  if (!card) return undefined;
  const text = card.text.replace(/\s+/g, ' ').trim();
  return {
    kind: 'text',
    shotId: input.shot.info.id,
    t: input.t,
    localTime: input.localTime,
    name: text,
    id: `text:${card.id}`,
    kitKind: undefined,
    call: undefined,
    occurrence: undefined,
    sceneName: undefined,
    parent: undefined,
    position: undefined,
    size: undefined,
    description: `${card.kind} text card "${text}" (id ${card.id}) at ${String(card.box.x)},${String(card.box.y)} px, ${String(card.box.w)}x${String(card.box.h)} px`,
  };
}

/** The object a mesh hit is attributed to (see the module comment). */
function ownerOf(hit: THREE.Object3D, scene: THREE.Scene): THREE.Object3D {
  let firstKitObject: THREE.Object3D | undefined;
  let topLevel = hit;
  for (let node: THREE.Object3D | null = hit; node !== null && node !== scene; node = node.parent) {
    if (kitOriginOf(node) !== undefined) return node;
    if (firstKitObject === undefined && isKitObject(node)) firstKitObject = node;
    topLevel = node;
  }
  return firstKitObject ?? topLevel;
}

function parentName(owner: THREE.Object3D, scene: THREE.Scene): string | undefined {
  for (let node = owner.parent; node !== null && node !== scene; node = node.parent) {
    const origin = kitOriginOf(node);
    if (origin) return origin.name;
  }
  return undefined;
}

/** Index of `owner` among same-named top-level objects (stable id for plain objects). */
function plainIndex(owner: THREE.Object3D, scene: THREE.Scene): number {
  let index = 0;
  let found = 0;
  scene.traverse((node) => {
    if (node === owner) found = index;
    if (node.name === owner.name && node.type === owner.type) index += 1;
  });
  return found;
}

function describeObject(result: Omit<PickResult, 'description'>): string {
  const what =
    result.kind === 'kit'
      ? `${result.name} (${result.call ?? ''} #${String((result.occurrence ?? 0) + 1)})`
      : `object "${result.name}"`;
  const named = result.sceneName === undefined ? '' : ` named "${result.sceneName}"`;
  const on = result.parent === undefined ? '' : ` on ${result.parent}`;
  const where = result.position === undefined ? '' : ` at (${formatVec(result.position)})`;
  const size = result.size === undefined ? '' : `, about ${formatVec(result.size)} units`;
  return `${what}${named}${on}${where}${size}`;
}

function pickObject(input: PickInput): PickResult | undefined {
  const { shot } = input;
  shot.scene.updateMatrixWorld(true);
  shot.camera.updateMatrixWorld();
  shot.camera.updateProjectionMatrix();
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(input.x * 2 - 1, 1 - input.y * 2), shot.camera);
  const hit = raycaster
    .intersectObject(shot.scene, true)
    .find((candidate) => isMesh(candidate.object) && isVisibleChain(candidate.object));
  if (!hit) return undefined;
  const owner = ownerOf(hit.object, shot.scene);
  const origin = kitOriginOf(owner);
  const kitType = isKitObject(owner) ? owner.kitType : undefined;
  const name = origin?.name ?? kitType ?? (owner.name === '' ? owner.type : owner.name);
  const box = new THREE.Box3().setFromObject(owner);
  const result: Omit<PickResult, 'description'> = {
    kind: origin !== undefined || kitType !== undefined ? 'kit' : 'object',
    shotId: shot.info.id,
    t: input.t,
    localTime: input.localTime,
    name,
    id:
      origin === undefined
        ? `object:${name}#${String(plainIndex(owner, shot.scene))}`
        : `${origin.kind === 'prop' ? 'props' : origin.kind}.${origin.name}#${String(origin.index)}`,
    kitKind: origin?.kind,
    call: origin?.call,
    occurrence: origin?.index,
    sceneName: owner.name !== '' && owner.name !== name ? owner.name : undefined,
    parent: parentName(owner, shot.scene),
    position: vec(owner.getWorldPosition(new THREE.Vector3())),
    size: box.isEmpty() ? undefined : vec(box.getSize(new THREE.Vector3())),
  };
  return { ...result, description: describeObject(result) };
}

/** What is at (x, y) of the shot's frame; undefined = background. */
export function pickInShot(input: PickInput): PickResult | undefined {
  if (!(input.x >= 0 && input.x <= 1 && input.y >= 0 && input.y <= 1)) return undefined;
  return pickText(input) ?? pickObject(input);
}
