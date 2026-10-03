/**
 * `kit.voxel.inspect(object)`: size and structure checks of a built object, the same rule the
 * kit's own props are tested with ("every voxel part is connected or rests on its floor"), so a
 * prop built inside a project (PLAN.md#7.4) can be checked the same way. Pure: reads the object.
 */
import type * as THREE from 'three';
import { KitError } from '../errors.js';
import { isKitObject, type KitObject, type Three } from '../object.js';
import type { Vec3 } from '../types.js';
import { voxelAt, voxelCount, type VoxelModel } from './model.js';

export interface KitInspection {
  /** Size of the object's bounds [x, y, z] in its parent's units (its own scale applied). */
  readonly size: Vec3;
  /** Meshes (voxel meshes and other geometry) inside the object. */
  readonly meshes: number;
  /** Filled voxels of all voxel meshes. */
  readonly voxels: number;
  /** One line per part that floats: touches no other part and not the ground. Empty = ok. */
  readonly floatingParts: readonly string[];
}

/** Two boxes closer than this (units) count as touching. */
const TOUCH_EPSILON = 0.005;

const STEPS = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
] as const;

/** 6-connected components of a model, each as the lowest y (grid row) it reaches. */
export function componentFloors(model: VoxelModel): number[] {
  const [sx, sy, sz] = model.size;
  const seen = new Uint8Array(sx * sy * sz);
  const floors: number[] = [];
  for (let start = 0; start < seen.length; start += 1) {
    if (seen[start] === 1 || model.data[start] === 0) continue;
    let floor = Number.POSITIVE_INFINITY;
    const stack = [start];
    seen[start] = 1;
    while (stack.length > 0) {
      const index = stack.pop() ?? 0;
      const x = index % sx;
      const y = Math.floor(index / sx) % sy;
      const z = Math.floor(index / (sx * sy));
      floor = Math.min(floor, y);
      for (const [dx, dy, dz] of STEPS) {
        const [nx, ny, nz] = [x + dx, y + dy, z + dz];
        if (voxelAt(model, nx, ny, nz) === 0) continue;
        const next = nx + sx * (ny + sy * nz);
        if (seen[next] === 1) continue;
        seen[next] = 1;
        stack.push(next);
      }
    }
    floors.push(floor);
  }
  return floors;
}

interface Part {
  readonly label: string;
  readonly box: THREE.Box3;
}

function isMesh(object: THREE.Object3D): object is THREE.Mesh {
  return (object as Partial<THREE.Mesh>).isMesh === true;
}

function voxelModelOf(object: THREE.Object3D): VoxelModel | undefined {
  if (!isKitObject(object) || !('model' in object)) return undefined;
  const model: unknown = object.model;
  if (typeof model !== 'object' || model === null || !('data' in model)) return undefined;
  return model as VoxelModel;
}

function labelOf(object: THREE.Object3D, index: number): string {
  const kitType = isKitObject(object) ? object.kitType : object.type;
  const name = object.name !== '' && object.name !== kitType ? ` "${object.name}"` : '';
  return `part ${String(index + 1)} (${kitType}${name})`;
}

/** Islands of a voxel model that do not reach the model's lowest filled row. */
function floatingIslands(model: VoxelModel): number {
  const floors = componentFloors(model);
  const lowest = Math.min(...floors);
  return floors.filter((floor) => floor > lowest).length;
}

/** Parts (mesh boxes in world space) not connected to the ground through touching boxes. */
function detachedParts(parts: readonly Part[]): string[] {
  if (parts.length === 0) return [];
  const ground = Math.min(...parts.map((part) => part.box.min.y));
  const reached = new Set<number>();
  const queue: number[] = [];
  parts.forEach((part, index) => {
    if (part.box.min.y <= ground + TOUCH_EPSILON) {
      reached.add(index);
      queue.push(index);
    }
  });
  while (queue.length > 0) {
    const current = parts[queue.pop() ?? 0];
    if (current === undefined) continue;
    const grown = current.box.clone().expandByScalar(TOUCH_EPSILON);
    parts.forEach((part, index) => {
      if (reached.has(index) || !grown.intersectsBox(part.box)) return;
      reached.add(index);
      queue.push(index);
    });
  }
  return parts
    .filter((_, index) => !reached.has(index))
    .map(
      (part) =>
        `${part.label} floats at y=${part.box.min.y.toFixed(2)}: it touches no other part and not the ground`,
    );
}

export function inspectObject(three: Three, value: unknown): KitInspection {
  if (!isKitObject(value)) {
    throw new KitError(
      'invalid-surface',
      'kit.voxel.inspect(object): expected a kit object (kit.voxel.mesh/group, kit.props.*)',
    );
  }
  const object: KitObject = value;
  object.updateMatrixWorld(true);
  const local = object.bounds();
  const extent = local.isEmpty() ? new three.Vector3() : local.getSize(new three.Vector3());
  extent.multiply(object.scale);
  const parts: Part[] = [];
  const problems: string[] = [];
  let voxels = 0;
  object.traverse((child) => {
    const model = voxelModelOf(child);
    if (model !== undefined) {
      voxels += voxelCount(model);
      const islands = floatingIslands(model);
      if (islands > 0) {
        problems.push(
          `${labelOf(child, parts.length)} has ${String(islands)} voxel island(s) above its floor that touch nothing (connect them or remove them)`,
        );
      }
    }
    if (!isMesh(child)) return;
    const box = new three.Box3().setFromObject(child);
    if (!box.isEmpty()) parts.push({ label: labelOf(child.parent ?? child, parts.length), box });
  });
  return {
    size: [Math.abs(extent.x), Math.abs(extent.y), Math.abs(extent.z)],
    meshes: parts.length,
    voxels,
    floatingParts: [...problems, ...detachedParts(parts)],
  };
}
