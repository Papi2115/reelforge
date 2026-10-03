/** `kit.voxel`: the scene-facing voxel toolbox, and its documentation for kit-docs. */
import type { KitContext } from '../context.js';
import { KitError } from '../errors.js';
import { createKitObject, type KitObject } from '../object.js';
import { Sketch } from '../props/sketch.js';
import type { Axis, KitRng, Vec3 } from '../types.js';
import { voxelFromGrid, voxelGenerate, type VoxelGridInput } from './grid.js';
import { inspectObject, type KitInspection } from './inspect.js';
import { createVoxelObject, type VoxelMeshOptions, type VoxelObject } from './mesh.js';
import {
  checkSize,
  MAX_MODEL_COLORS,
  voxelCount,
  type VoxelColor,
  type VoxelModel,
} from './model.js';
import {
  extrude,
  merge,
  mirror,
  recolor,
  speckle,
  voxelBox,
  type ExtrudeInput,
  type MergePart,
  type MirrorOptions,
  type SpeckleOptions,
} from './ops.js';

export interface GroupOptions {
  /** Custom anchors in local units. */
  readonly anchors?: Readonly<Record<string, Vec3>> | undefined;
}

export interface VoxelApi {
  fromGrid(grid: VoxelGridInput, palette?: readonly VoxelColor[]): VoxelModel;
  generate(
    size: Vec3,
    fill: (x: number, y: number, z: number) => number,
    palette: readonly VoxelColor[],
  ): VoxelModel;
  box(size: Vec3, color: VoxelColor): VoxelModel;
  extrude(input: ExtrudeInput): VoxelModel;
  mirror(model: VoxelModel, axis: Axis, options?: MirrorOptions): VoxelModel;
  merge(parts: readonly MergePart[]): VoxelModel;
  recolor(model: VoxelModel, mapping: Readonly<Record<string, VoxelColor>>): VoxelModel;
  speckle(model: VoxelModel, options: SpeckleOptions, rng: KitRng): VoxelModel;
  count(model: VoxelModel): number;
  sketch<Slot extends string>(size: Vec3, colors: Readonly<Record<Slot, VoxelColor>>): Sketch<Slot>;
  inspect(object: KitObject): KitInspection;
  mesh(model: VoxelModel, options?: VoxelMeshOptions): VoxelObject;
  group(options?: GroupOptions): KitObject;
}

export interface ApiDoc {
  readonly signature: string;
  readonly description: string;
}

/** One entry per kit.voxel function (the Record type keeps it complete). */
export const VOXEL_API_DOCS: Readonly<Record<keyof VoxelApi, ApiDoc>> = {
  fromGrid: {
    signature:
      "fromGrid({ layers, key, orientation?: 'top' | 'front' } | grid[y][z][x] | { size?, voxels: [[x, y, z, i]] }, palette?) -> model",
    description:
      "Model from hand-drawn string layers (key maps characters to palette names; '.' and ' ' are empty), a numeric 3D array or a sparse list (index i >= 1 -> palette[i - 1]). 'top': layers bottom->top, rows back->front; 'front': slices front->back, rows top->bottom.",
  },
  generate: {
    signature: 'generate([sx, sy, sz], (x, y, z) => index, palette) -> model',
    description: 'Procedural model (terrain, cities, patterns); fill must be pure, 0 = empty.',
  },
  box: { signature: 'box([sx, sy, sz], color) -> model', description: 'Solid box of one colour.' },
  extrude: {
    signature: "extrude({ rows, key, depth = 1, axis: 'z' | 'y' = 'z' }) -> model",
    description:
      "2D character pattern turned into a slab: 'z' = front view extruded backwards (signs, logos), 'y' = floor plan extruded up (walls).",
  },
  mirror: {
    signature: "mirror(model, 'x' | 'y' | 'z', { join = false, overlap = 0 }) -> model",
    description:
      'Flipped copy; join: model + its mirror image (draw half of a symmetric object), overlap = shared centre slices.',
  },
  merge: {
    signature: 'merge([{ model, at: [x, y, z] }, ...]) -> model',
    description:
      'Combines parts at integer grid offsets >= 0; later parts overwrite earlier voxels.',
  },
  recolor: {
    signature: "recolor(model, { hero: 'accent1', ... }) -> model",
    description: 'Swaps palette colours by name (variants of one model).',
  },
  speckle: {
    signature: 'speckle(model, { from, to, share }, rng) -> model',
    description:
      "Pixel-art texture noise: a seeded share of 'from' voxels become 'to'. Pass ctx.rng.fork('name').",
  },
  count: { signature: 'count(model) -> number', description: 'Number of filled voxels.' },
  sketch: {
    signature:
      "sketch([sx, sy, sz], { slot: color, ... }) -> sketch; sketch.box(slot | null, [x0,y0,z0], [x1,y1,z1]) / paint(slot, min, max) / set(slot, x, y, z) / cylinderY(slot, [cx, cz], r, y0, y1) / cylinderX(slot, [cz, cy], r, x0, x1) / cylinderZ(slot, [cx, cy], r, z0, z1) / pattern(rows, key, 'xy' | 'xz', [x, y, z]) / filled(x, y, z); sketch.model() -> model",
    description:
      "Mutable voxel canvas with named colour slots (how the kit's own props are drawn): boxes are min-inclusive, max-exclusive and clipped to the canvas; null clears; paint recolours only filled cells (labels, stripes, seams); the methods chain. Grid y is up, +z faces the camera.",
  },
  inspect: {
    signature: 'inspect(object) -> { size: [x, y, z], meshes, voxels, floatingParts: [text] }',
    description:
      'Size of an object (its scale applied) and the parts that float (touch no other part and not the ground). Read-only; used by reelforge prop-preview.',
  },
  mesh: {
    signature:
      "mesh(model, { voxelSize = 0.125, pivot: 'bottom' | 'center' | 'corner' | [x, y, z], anchors: { name: [x, y, z] }, ao = 0.45, mode: 'auto' | 'greedy' | 'instanced', includeHidden }) -> object",
    description:
      "Scene object (add it to ctx.scene or put it on a surface). Colours follow the style. Flat-shaded and lit (add lights), glow colours ({ color, glow: true }) are unlit. 'instanced' allows object.setVoxelTransform(i, { offset, rotation, scale }) for per-voxel animation. build() only.",
  },
  group: {
    signature: 'group({ anchors: { name: [x, y, z] } }) -> object',
    description:
      'Empty kit object to compose others (object.add(child)); its standard anchors follow its children. build() only.',
  },
};

function checkModel(value: unknown, call: string): VoxelModel {
  const candidate = value as Partial<VoxelModel> | null | undefined;
  if (
    typeof candidate !== 'object' ||
    candidate === null ||
    !(candidate.data instanceof Uint8Array) ||
    !Array.isArray(candidate.size) ||
    !Array.isArray(candidate.palette)
  ) {
    throw new KitError(
      'invalid-model',
      `${call}: expected a voxel model (from kit.voxel.fromGrid/box/generate/...), got ${typeof value}`,
    );
  }
  return candidate as VoxelModel;
}

function createSketch<Slot extends string>(
  size: Vec3,
  colors: Readonly<Record<Slot, VoxelColor>>,
): Sketch<Slot> {
  // Scenes and project props are untyped JS: check the shapes the types promise.
  const rawSize: unknown = size;
  if (!Array.isArray(rawSize) || rawSize.length !== 3) {
    throw new KitError(
      'invalid-model',
      'kit.voxel.sketch(size, colors): size must be [sx, sy, sz]',
    );
  }
  checkSize(size, 'kit.voxel.sketch');
  const rawColors: unknown = colors;
  const count =
    typeof rawColors === 'object' && rawColors !== null ? Object.keys(rawColors).length : 0;
  if (count === 0 || count > MAX_MODEL_COLORS) {
    throw new KitError(
      'invalid-model',
      `kit.voxel.sketch(size, colors): colors must map 1..${String(MAX_MODEL_COLORS)} slot names to palette colours, e.g. { body: 'heroTrim', trim: 'accent1' }`,
    );
  }
  return new Sketch(size, colors);
}

export function createVoxelApi(context: KitContext): VoxelApi {
  return Object.freeze({
    fromGrid: voxelFromGrid,
    generate: voxelGenerate,
    box: voxelBox,
    extrude,
    mirror: (model: VoxelModel, axis: Axis, options?: MirrorOptions) =>
      mirror(checkModel(model, 'kit.voxel.mirror'), axis, options),
    merge,
    recolor: (model: VoxelModel, mapping: Readonly<Record<string, VoxelColor>>) =>
      recolor(checkModel(model, 'kit.voxel.recolor'), mapping),
    speckle: (model: VoxelModel, options: SpeckleOptions, rng: KitRng) =>
      speckle(checkModel(model, 'kit.voxel.speckle'), options, rng),
    count: (model: VoxelModel) => voxelCount(checkModel(model, 'kit.voxel.count')),
    sketch: <Slot extends string>(size: Vec3, colors: Readonly<Record<Slot, VoxelColor>>) =>
      createSketch(size, colors),
    inspect: (object: KitObject) => inspectObject(context.three, object),
    mesh(model: VoxelModel, options?: VoxelMeshOptions) {
      context.assertBuildPhase('kit.voxel.mesh()');
      return createVoxelObject(context, checkModel(model, 'kit.voxel.mesh'), options);
    },
    group(options: GroupOptions = {}) {
      context.assertBuildPhase('kit.voxel.group()');
      return createKitObject(context.three, { kitType: 'group', anchors: options.anchors });
    },
  });
}
