/**
 * Voxel replicas for object effects (dissolve, glitch): an object's voxel meshes (or a bare
 * model) rebuilt as instanced meshes so every voxel can move on its own. The effect takes the
 * object's place: same parent and transform, the original is hidden.
 */
import type * as THREE from 'three';
import { z } from 'zod';
import { KitError } from '../errors.js';
import { createKitObject, isKitObject, type KitObject } from '../object.js';
import type { KitTools } from '../registry.js';
import type { Vec3 } from '../types.js';
import { DEFAULT_VOXEL_SIZE, type VoxelObject } from '../voxel/mesh.js';
import type { VoxelModel } from '../voxel/model.js';

function isVoxelModel(value: unknown): value is VoxelModel {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<VoxelModel>;
  return (
    candidate.data instanceof Uint8Array &&
    Array.isArray(candidate.size) &&
    Array.isArray(candidate.palette)
  );
}

export function isVoxelObject(value: unknown): value is VoxelObject {
  if (!isKitObject(value)) return false;
  const candidate = value as Partial<VoxelObject>;
  return (
    isVoxelModel(candidate.model) &&
    typeof candidate.voxelSize === 'number' &&
    typeof candidate.gridToLocal === 'function'
  );
}

/** Params shared by object effects: what to affect. */
export const sourceParams = {
  object: z
    .custom<KitObject>(isKitObject, 'must be a kit object (kit.voxel.mesh, kit.props.*, ...)')
    .optional()
    .describe(
      'Kit object to affect (its voxel meshes are replicated; the original is hidden and the effect takes its place, so call this after placing the object)',
    ),
  model: z
    .custom<VoxelModel>(isVoxelModel, 'must be a voxel model (kit.voxel.fromGrid/box/...)')
    .optional()
    .describe('Voxel model to show with the effect instead of an object'),
  voxelSize: z
    .number()
    .positive()
    .default(DEFAULT_VOXEL_SIZE)
    .describe('With model: world size of one voxel'),
};

export interface SourceInput {
  readonly object?: KitObject | undefined;
  readonly model?: VoxelModel | undefined;
  readonly voxelSize: number;
}

/** One replicated voxel mesh: instanced, with each instance's grid cell. */
export interface ReplicaPart {
  readonly mesh: VoxelObject;
  readonly model: VoxelModel;
  readonly cells: readonly Vec3[];
}

export interface Replica {
  readonly root: KitObject;
  readonly parts: readonly ReplicaPart[];
}

interface Source {
  readonly model: VoxelModel;
  readonly voxelSize: number;
  readonly pivot: Vec3;
  /** Transform relative to the effect root. */
  readonly matrix: THREE.Matrix4;
}

function collectSources(three: KitTools['three'], object: KitObject): Source[] {
  object.updateWorldMatrix(true, true);
  const inverse = object.matrixWorld.clone().invert();
  const sources: Source[] = [];
  object.traverse((child) => {
    if (!isVoxelObject(child)) return;
    const origin = child.gridToLocal([0, 0, 0]);
    sources.push({
      model: child.model,
      voxelSize: child.voxelSize,
      pivot: [
        -origin.x / child.voxelSize,
        -origin.y / child.voxelSize,
        -origin.z / child.voxelSize,
      ],
      matrix: new three.Matrix4().multiplyMatrices(inverse, child.matrixWorld),
    });
  });
  return sources;
}

/**
 * Builds the replica of `input` (instanced, hidden voxels included so the inside shows while
 * voxels leave) as a new kit object of type `kitType`.
 */
export function buildReplica(
  tools: KitTools,
  kitType: string,
  input: SourceInput,
  ao: number,
): Replica {
  const { three } = tools;
  if ((input.object === undefined) === (input.model === undefined)) {
    throw new KitError(
      'invalid-params',
      `kit.fx.${kitType}(): pass exactly one of object or model`,
    );
  }
  const sources = input.object
    ? collectSources(three, input.object)
    : input.model
      ? [
          {
            model: input.model,
            voxelSize: input.voxelSize,
            pivot: [input.model.size[0] / 2, 0, input.model.size[2] / 2] as Vec3,
            matrix: new three.Matrix4(),
          },
        ]
      : [];
  if (sources.length === 0) {
    throw new KitError(
      'invalid-params',
      `kit.fx.${kitType}(): the object has no voxel meshes to affect`,
    );
  }
  const root = createKitObject(three, { kitType });
  const parts = sources.map((source): ReplicaPart => {
    const mesh = tools.voxel.mesh(source.model, {
      mode: 'instanced',
      includeHidden: true,
      voxelSize: source.voxelSize,
      pivot: source.pivot,
      ao,
    });
    source.matrix.decompose(mesh.position, mesh.quaternion, mesh.scale);
    root.add(mesh);
    const cells = Array.from({ length: mesh.instanceCount }, (_, index) =>
      mesh.instanceCell(index),
    );
    return { mesh, model: source.model, cells };
  });
  const original = input.object;
  if (original) {
    root.position.copy(original.position);
    root.quaternion.copy(original.quaternion);
    root.scale.copy(original.scale);
    original.parent?.add(root);
    original.visible = false;
  }
  return { root, parts };
}

/** Grid bounds of a replica part's cells: [min, max] per axis. */
export function cellRange(cells: readonly Vec3[]): { min: Vec3; max: Vec3 } {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const cell of cells) {
    for (let axis = 0; axis < 3; axis += 1) {
      const value = cell[axis] ?? 0;
      if (value < (min[axis] ?? 0)) min[axis] = value;
      if (value > (max[axis] ?? 0)) max[axis] = value;
    }
  }
  return { min, max };
}
