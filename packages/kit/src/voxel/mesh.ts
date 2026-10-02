/**
 * Voxel model -> KitObject. Two renderers: a greedy mesh (merged quads, baked per-corner AO,
 * one draw call per material) and InstancedMesh cubes (per-voxel transforms for effects).
 * See `chooseMode` for what `mode: 'auto'` picks.
 */
import type * as THREE from 'three';
import type { KitContext } from '../context.js';
import { shadeColors } from '../context.js';
import { KitError } from '../errors.js';
import { createKitObject, type KitObject } from '../object.js';
import type { Vec3 } from '../types.js';
import { aoLevelsFor, greedyMesh, type MeshLayout } from './greedy.js';
import { chooseMode, instanceData, type VoxelInstanceData } from './instances.js';
import { filledBounds, type VoxelModel } from './model.js';

/** Default world size of one voxel: a 16-voxel-tall sprite is 2 units (the hero's height). */
export const DEFAULT_VOXEL_SIZE = 0.125;
/** Default ambient-occlusion strength (darkest corner = 55 % brightness). */
export const DEFAULT_AO_STRENGTH = 0.45;

export type VoxelPivot = 'bottom' | 'center' | 'corner' | Vec3;
export type VoxelMeshMode = 'auto' | 'greedy' | 'instanced';

export interface VoxelMeshOptions {
  /** World size of one voxel (default 0.125). */
  readonly voxelSize?: number | undefined;
  /**
   * Grid point at the local origin: 'bottom' (default; centre of the floor, so `on()` and
   * positions on the ground just work), 'center', 'corner' (grid origin) or grid coordinates.
   */
  readonly pivot?: VoxelPivot | undefined;
  /**
   * Named anchors in grid coordinates (voxel (x, y, z) spans x..x+1, so the top centre of
   * voxel (3, 5, 2) is [3.5, 6, 2.5]).
   */
  readonly anchors?: Readonly<Record<string, Vec3>> | undefined;
  /** Ambient-occlusion strength 0..1 (default 0.45, 0 = off). */
  readonly ao?: number | undefined;
  /** Renderer (default 'auto'); 'instanced' is needed for setVoxelTransform. */
  readonly mode?: VoxelMeshMode | undefined;
  /** Instanced mode: also create instances for fully hidden voxels (debris/explosions). */
  readonly includeHidden?: boolean | undefined;
}

/** Absolute per-frame transform of one instance, relative to its home cell. */
export interface VoxelTransform {
  /** Offset from the voxel's home position, in local units. */
  readonly offset?: Vec3 | undefined;
  /** Euler rotation in radians. */
  readonly rotation?: Vec3 | undefined;
  /** Uniform scale (0 hides the voxel). */
  readonly scale?: number | undefined;
}

export interface VoxelObjectMethods {
  readonly model: VoxelModel;
  readonly voxelSize: number;
  readonly mode: 'greedy' | 'instanced';
  /** Local position of a grid point. */
  gridToLocal(point: Vec3): THREE.Vector3;
  /** Number of instances (instanced mode; 0 for greedy meshes). */
  readonly instanceCount: number;
  /** Grid cell of instance `index`. */
  instanceCell(index: number): Vec3;
  /**
   * Instanced mode: sets instance `index` absolutely from its home cell. Like every update(),
   * set each animated instance on every frame from t (the transform is not accumulated).
   */
  setVoxelTransform(index: number, transform: VoxelTransform): void;
}

export type VoxelObject = KitObject & VoxelObjectMethods;

function pivotPoint(model: VoxelModel, pivot: VoxelPivot): Vec3 {
  const [sx, sy, sz] = model.size;
  if (pivot === 'corner') return [0, 0, 0];
  if (pivot === 'center') return [sx / 2, sy / 2, sz / 2];
  if (pivot === 'bottom') return [sx / 2, 0, sz / 2];
  // Scenes are untyped JS: check the array form at runtime.
  const point: unknown = pivot;
  if (Array.isArray(point) && point.length === 3 && point.every(Number.isFinite)) return pivot;
  throw new KitError(
    'invalid-model',
    `mesh: pivot must be 'bottom', 'center', 'corner' or [x, y, z]`,
  );
}

function checkOptions(options: VoxelMeshOptions): { voxelSize: number; ao: number } {
  const voxelSize = options.voxelSize ?? DEFAULT_VOXEL_SIZE;
  if (!(voxelSize > 0) || !Number.isFinite(voxelSize)) {
    throw new KitError('invalid-model', `mesh: voxelSize must be > 0 (got ${String(voxelSize)})`);
  }
  const ao = options.ao ?? DEFAULT_AO_STRENGTH;
  if (!(ao >= 0 && ao <= 1))
    throw new KitError('invalid-model', `mesh: ao must be 0..1 (got ${String(ao)})`);
  return { voxelSize, ao };
}

/** Local bounds of the filled voxels (fixed: models are immutable). */
function boundsOf(context: KitContext, model: VoxelModel, layout: MeshLayout): () => THREE.Box3 {
  const filled = filledBounds(model);
  const box = new context.three.Box3();
  if (filled) {
    const gridToLocal = toLocal(layout, context.three);
    box.set(gridToLocal(filled.min), gridToLocal(filled.max));
  }
  return () => box;
}

function greedyMesh3d(
  context: KitContext,
  model: VoxelModel,
  layout: MeshLayout,
  ao: number,
): THREE.Mesh {
  const { three } = context;
  const data = greedyMesh(
    model,
    shadeColors(three, context.palette, model.palette),
    aoLevelsFor(ao),
    layout,
  );
  const geometry = context.track(new three.BufferGeometry());
  geometry.setAttribute('position', new three.BufferAttribute(data.positions, 3));
  geometry.setAttribute('normal', new three.BufferAttribute(data.normals, 3));
  geometry.setAttribute('color', new three.BufferAttribute(data.colors, 3));
  geometry.setIndex(new three.BufferAttribute(data.indices, 1));
  geometry.addGroup(0, data.litIndexCount, 0);
  geometry.addGroup(data.litIndexCount, data.indices.length - data.litIndexCount, 1);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const materials = context.materials();
  return new three.Mesh(geometry, [materials.lit, materials.glow]);
}

interface InstancedParts {
  /** [lit, glow] meshes (a mesh may have 0 instances). */
  readonly byKind: readonly [THREE.InstancedMesh, THREE.InstancedMesh];
  /** Instance index -> [kind (0 lit, 1 glow), index within that mesh]. */
  readonly slots: Int32Array;
  readonly data: VoxelInstanceData;
  readonly geometry: THREE.BoxGeometry;
}

function vec3At(values: ArrayLike<number>, index: number): Vec3 {
  return [values[index * 3] ?? 0, values[index * 3 + 1] ?? 0, values[index * 3 + 2] ?? 0];
}

function instancedParts(
  context: KitContext,
  model: VoxelModel,
  layout: MeshLayout,
  ao: number,
  includeHidden: boolean,
): InstancedParts {
  const { three } = context;
  const colors = shadeColors(three, context.palette, model.palette);
  const data = instanceData(model, colors, aoLevelsFor(ao), layout, includeHidden);
  const size = layout.voxelSize;
  const geometry = context.track(new three.BoxGeometry(size, size, size));
  const materials = context.materials();
  const glowCount = data.glow.reduce((sum, flag) => sum + flag, 0);
  const create = (material: THREE.Material, count: number): THREE.InstancedMesh => {
    const mesh = new three.InstancedMesh(geometry, material, count);
    // Instances move independently; a stale bounding sphere would cull them.
    mesh.frustumCulled = false;
    return mesh;
  };
  const byKind = [
    create(materials.instancedLit, data.count - glowCount),
    create(materials.instancedGlow, glowCount),
  ] as const;
  const slots = new Int32Array(data.count * 2);
  const used = [0, 0];
  const matrix = new three.Matrix4();
  const color = new three.Color();
  for (let index = 0; index < data.count; index += 1) {
    const kind = data.glow[index] === 1 ? 1 : 0;
    const slot = used[kind] ?? 0;
    const [x, y, z] = vec3At(data.centers, index);
    byKind[kind].setMatrixAt(slot, matrix.makeTranslation(x, y, z));
    byKind[kind].setColorAt(slot, color.setRGB(...vec3At(data.colors, index)));
    slots[index * 2] = kind;
    slots[index * 2 + 1] = slot;
    used[kind] = slot + 1;
  }
  return { byKind, slots, data, geometry };
}

function instanceTransformer(
  context: KitContext,
  parts: InstancedParts | undefined,
): (index: number, transform: VoxelTransform) => void {
  const { three } = context;
  const matrix = new three.Matrix4();
  const position = new three.Vector3();
  const rotation = new three.Quaternion();
  const euler = new three.Euler();
  const scale = new three.Vector3();
  return (index, transform) => {
    if (!parts || !Number.isInteger(index) || index < 0 || index >= parts.data.count) {
      throw new KitError(
        'invalid-model',
        `setVoxelTransform(${String(index)}): needs mode 'instanced' and 0 <= index < instanceCount`,
      );
    }
    const [hx, hy, hz] = vec3At(parts.data.centers, index);
    const [ox, oy, oz] = transform.offset ?? [0, 0, 0];
    const [rx, ry, rz] = transform.rotation ?? [0, 0, 0];
    const s = transform.scale ?? 1;
    position.set(hx + ox, hy + oy, hz + oz);
    rotation.setFromEuler(euler.set(rx, ry, rz));
    matrix.compose(position, rotation, scale.set(s, s, s));
    const mesh = parts.byKind[parts.slots[index * 2] === 1 ? 1 : 0];
    mesh.setMatrixAt(parts.slots[index * 2 + 1] ?? 0, matrix);
    mesh.instanceMatrix.needsUpdate = true;
  };
}

function toLocal(layout: MeshLayout, three: KitContext['three']): (point: Vec3) => THREE.Vector3 {
  return (point) =>
    new three.Vector3(
      (point[0] - layout.pivot[0]) * layout.voxelSize,
      (point[1] - layout.pivot[1]) * layout.voxelSize,
      (point[2] - layout.pivot[2]) * layout.voxelSize,
    );
}

/** Builds the KitObject for a model (see VoxelMeshOptions). */
export function createVoxelObject(
  context: KitContext,
  model: VoxelModel,
  options: VoxelMeshOptions = {},
): VoxelObject {
  const { voxelSize, ao } = checkOptions(options);
  const layout: MeshLayout = { voxelSize, pivot: pivotPoint(model, options.pivot ?? 'bottom') };
  const requested = options.mode ?? 'auto';
  const mode = requested === 'auto' ? chooseMode(model) : requested;
  const gridToLocal = toLocal(layout, context.three);
  const anchors = Object.fromEntries(
    Object.entries(options.anchors ?? {}).map(([name, point]) => {
      const local = gridToLocal(point);
      return [name, [local.x, local.y, local.z] as const];
    }),
  );
  const parts =
    mode === 'instanced'
      ? instancedParts(context, model, layout, ao, options.includeHidden === true)
      : undefined;
  const greedy = parts ? undefined : greedyMesh3d(context, model, layout, ao);
  const object = createKitObject(context.three, {
    kitType: 'voxel',
    bounds: boundsOf(context, model, layout),
    anchors,
    resources: [parts?.geometry ?? greedy?.geometry].filter((resource) => resource !== undefined),
  });
  if (parts) object.add(...parts.byKind.filter((mesh) => mesh.count > 0));
  if (greedy) object.add(greedy);
  const methods: VoxelObjectMethods = {
    model,
    voxelSize,
    mode,
    gridToLocal,
    instanceCount: parts?.data.count ?? 0,
    instanceCell(index) {
      if (!parts || !Number.isInteger(index) || index < 0 || index >= parts.data.count) {
        throw new KitError('invalid-model', `instanceCell(${String(index)}): out of range`);
      }
      return vec3At(parts.data.cells, index);
    },
    setVoxelTransform: instanceTransformer(context, parts),
  };
  return Object.assign(object, methods);
}
