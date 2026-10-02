/** Pure model operations: primitives, extrusion, mirroring, merging and recolouring. */
import { KitError } from '../errors.js';
import { AXIS_INDEX, type Axis, type KitRng, type Vec3 } from '../types.js';
import { voxelFromGrid } from './grid.js';
import {
  checkPalette,
  colorKey,
  emptyModel,
  voxelIndex,
  type VoxelColor,
  type VoxelModel,
} from './model.js';

/** Solid box of `size` voxels in one colour. */
export function voxelBox(size: Vec3, color: VoxelColor): VoxelModel {
  const model = emptyModel(size, [color], 'voxel.box');
  model.data.fill(1);
  return model;
}

export interface ExtrudeInput {
  /** Rows of characters: a front view (top row first) for axis 'z', a top view for axis 'y'. */
  readonly rows: readonly string[];
  /** Character -> colour; '.' and ' ' are empty. */
  readonly key: Readonly<Record<string, VoxelColor>>;
  /** Thickness in voxels (default 1). */
  readonly depth?: number | undefined;
  /** 'z' (default): the pattern faces the camera, extruded backwards; 'y': a floor plan extruded up. */
  readonly axis?: 'y' | 'z' | undefined;
}

/** Extrudes a 2D character pattern into a slab (signs, logos, coins, floor plans -> walls). */
export function extrude(input: ExtrudeInput): VoxelModel {
  const depth = input.depth ?? 1;
  if (!Number.isInteger(depth) || depth < 1) {
    throw new KitError(
      'invalid-model',
      `extrude: depth must be an integer >= 1 (got ${String(depth)})`,
    );
  }
  const layers = Array.from({ length: depth }, () => input.rows);
  return voxelFromGrid({
    layers,
    key: input.key,
    orientation: input.axis === 'y' ? 'top' : 'front',
  });
}

export interface MirrorOptions {
  /**
   * false (default): return the flipped model. true: return the model followed by its mirror
   * image along the axis (draw one half of a symmetric object, mirror it into the whole).
   */
  readonly join?: boolean | undefined;
  /** With join: slices shared by both halves (1 = odd width with a centre column). */
  readonly overlap?: number | undefined;
}

/** Mirrors a model along an axis (see MirrorOptions). */
export function mirror(model: VoxelModel, axis: Axis, options: MirrorOptions = {}): VoxelModel {
  const a = AXIS_INDEX[axis];
  const extent = model.size[a];
  const overlap = options.overlap ?? 0;
  if (!Number.isInteger(overlap) || overlap < 0 || overlap > extent) {
    throw new KitError('invalid-model', `mirror: overlap must be an integer 0..${String(extent)}`);
  }
  const join = options.join === true;
  const outExtent = join ? 2 * extent - overlap : extent;
  const dims = [model.size[0], model.size[1], model.size[2]];
  dims[a] = outExtent;
  const size: Vec3 = [dims[0] ?? 1, dims[1] ?? 1, dims[2] ?? 1];
  const result = emptyModel(size, model.palette, 'mirror');
  const [sx, sy, sz] = model.size;
  for (let z = 0; z < sz; z += 1) {
    for (let y = 0; y < sy; y += 1) {
      for (let x = 0; x < sx; x += 1) {
        const value = model.data[voxelIndex(model.size, x, y, z)] ?? 0;
        if (value === 0) continue;
        const point = [x, y, z];
        if (join) result.data[voxelIndex(size, x, y, z)] = value;
        point[a] = outExtent - 1 - (point[a] ?? 0);
        result.data[voxelIndex(size, point[0] ?? 0, point[1] ?? 0, point[2] ?? 0)] = value;
      }
    }
  }
  return result;
}

export interface MergePart {
  readonly model: VoxelModel;
  /** Grid offset of the part's corner (integers >= 0; default [0, 0, 0]). */
  readonly at?: Vec3 | undefined;
}

/** Combines parts into one model (palettes are unioned; later parts overwrite earlier voxels). */
export function merge(parts: readonly MergePart[]): VoxelModel {
  if (parts.length === 0) throw new KitError('invalid-model', 'merge: needs at least one part');
  const size = [1, 1, 1];
  for (const [index, part] of parts.entries()) {
    const at = part.at ?? [0, 0, 0];
    for (let axis = 0; axis < 3; axis += 1) {
      const offset = at[axis] ?? 0;
      if (!Number.isInteger(offset) || offset < 0) {
        throw new KitError(
          'invalid-model',
          `merge: parts[${String(index)}].at must be integers >= 0`,
        );
      }
      size[axis] = Math.max(size[axis] ?? 1, offset + (part.model.size[axis] ?? 0));
    }
  }
  const palette: VoxelColor[] = [];
  const slots = new Map<string, number>();
  const slotOf = (color: VoxelColor): number => {
    const identity = colorKey(color);
    let slot = slots.get(identity);
    if (slot === undefined) {
      palette.push(color);
      slot = palette.length;
      slots.set(identity, slot);
    }
    return slot;
  };
  const remaps = parts.map((part) => part.model.palette.map(slotOf));
  checkPalette(palette, 'merge');
  const outSize: Vec3 = [size[0] ?? 1, size[1] ?? 1, size[2] ?? 1];
  const result = emptyModel(outSize, palette, 'merge');
  parts.forEach((part, index) => {
    const remap = remaps[index] ?? [];
    const [ox, oy, oz] = part.at ?? [0, 0, 0];
    const [sx, sy, sz] = part.model.size;
    for (let z = 0; z < sz; z += 1) {
      for (let y = 0; y < sy; y += 1) {
        for (let x = 0; x < sx; x += 1) {
          const value = part.model.data[voxelIndex(part.model.size, x, y, z)] ?? 0;
          if (value === 0) continue;
          result.data[voxelIndex(outSize, x + ox, y + oy, z + oz)] = remap[value - 1] ?? 0;
        }
      }
    }
  });
  return result;
}

function colorName(color: VoxelColor): string {
  return typeof color === 'string' ? color : color.color;
}

/**
 * Swaps palette colours by name, e.g. `recolor(model, { hero: 'accent1' })` (variants of one
 * prop). A string replacement keeps the slot's glow flag.
 */
export function recolor(
  model: VoxelModel,
  mapping: Readonly<Record<string, VoxelColor>>,
): VoxelModel {
  const palette = model.palette.map((color) => {
    const replacement = mapping[colorName(color)];
    if (replacement === undefined) return color;
    if (typeof replacement === 'string' && typeof color !== 'string' && color.glow === true) {
      return { color: replacement, glow: true };
    }
    return replacement;
  });
  checkPalette(palette, 'recolor');
  return { size: model.size, data: model.data, palette };
}

export interface SpeckleOptions {
  /** Colour name of the voxels to vary. */
  readonly from: string;
  /** Colour they may become. */
  readonly to: VoxelColor;
  /** Share of `from` voxels that change, 0..1. */
  readonly share: number;
}

/**
 * Texture noise for pixel art: turns a seeded random share of `from` voxels into `to`.
 * Deterministic: pass a seeded rng (e.g. `ctx.rng.fork('grass')`), never Math.random.
 */
export function speckle(model: VoxelModel, options: SpeckleOptions, rng: KitRng): VoxelModel {
  if (typeof rng !== 'function') {
    throw new KitError('invalid-model', "speckle: pass a seeded rng, e.g. ctx.rng.fork('speckle')");
  }
  const share = Math.min(1, Math.max(0, options.share));
  const sources = new Set<number>();
  model.palette.forEach((color, index) => {
    if (colorName(color) === options.from) sources.add(index + 1);
  });
  const toKey = colorKey(options.to);
  const existing = model.palette.findIndex((color) => colorKey(color) === toKey);
  const palette = existing === -1 ? [...model.palette, options.to] : [...model.palette];
  checkPalette(palette, 'speckle');
  const target = existing === -1 ? palette.length : existing + 1;
  const data = Uint8Array.from(model.data);
  for (let index = 0; index < data.length; index += 1) {
    if (!sources.has(data[index] ?? 0)) continue;
    if (rng() < share) data[index] = target;
  }
  return { size: model.size, data, palette };
}
