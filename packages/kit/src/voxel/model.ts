/**
 * Voxel models: a dense grid of palette indices plus a palette of colour references. Models are
 * plain data (no Three.js), immutable by convention: every helper returns a new model.
 */
import { KitError } from '../errors.js';
import type { Vec3 } from '../types.js';

/**
 * Colour of a palette slot: a `ctx.palette` name (semantic token such as 'hero' or 'accent1',
 * or a swatch such as 'teal') resolved when the model is meshed, so models recolour with the
 * style; or a literal '#rrggbb' (avoid: it does not follow the style). `glow: true` = unlit
 * (screens, neon, lamps) and without ambient occlusion.
 */
export type VoxelColor = string | { readonly color: string; readonly glow?: boolean | undefined };

export interface VoxelModel {
  /** Grid size in voxels [x, y, z]; y is up, +z faces the default camera. */
  readonly size: Vec3;
  /**
   * Palette index per voxel: 0 = empty, n >= 1 = `palette[n - 1]`.
   * Layout: `data[x + sx * (y + sy * z)]`. Treat as read-only.
   */
  readonly data: Uint8Array;
  readonly palette: readonly VoxelColor[];
}

/** At most 255 colours per model (indices are bytes, 0 = empty). */
export const MAX_MODEL_COLORS = 255;
/** Largest grid edge, in voxels. */
export const MAX_MODEL_EDGE = 1024;
/** Largest grid volume (x*y*z), in voxels. */
export const MAX_MODEL_VOLUME = 1 << 24;

function checkEdge(value: number, axis: string, where: string): void {
  if (!Number.isInteger(value) || value < 1 || value > MAX_MODEL_EDGE) {
    throw new KitError(
      'invalid-model',
      `${where}: size.${axis} must be an integer 1..${String(MAX_MODEL_EDGE)} (got ${String(value)})`,
    );
  }
}

export function checkSize(size: Vec3, where: string): void {
  checkEdge(size[0], 'x', where);
  checkEdge(size[1], 'y', where);
  checkEdge(size[2], 'z', where);
  const volume = size[0] * size[1] * size[2];
  if (volume > MAX_MODEL_VOLUME) {
    throw new KitError(
      'invalid-model',
      `${where}: ${size.join('x')} = ${String(volume)} voxels is larger than ${String(MAX_MODEL_VOLUME)}`,
    );
  }
}

/** Stable identity of a colour reference (used to deduplicate palettes). */
export function colorKey(color: VoxelColor): string {
  if (typeof color === 'string') return color;
  return color.glow === true ? `${color.color}|glow` : color.color;
}

export function checkPalette(palette: readonly VoxelColor[], where: string): void {
  if (palette.length > MAX_MODEL_COLORS) {
    throw new KitError(
      'invalid-model',
      `${where}: a model has at most ${String(MAX_MODEL_COLORS)} colours (got ${String(palette.length)})`,
    );
  }
  palette.forEach((color, index) => {
    const name = typeof color === 'string' ? color : color.color;
    if (typeof name !== 'string' || name.length === 0) {
      throw new KitError(
        'invalid-color',
        `${where}: palette[${String(index)}] must be a palette name like 'hero' or '#rrggbb'`,
      );
    }
  });
}

/** Empty model of the given size and palette. */
export function emptyModel(size: Vec3, palette: readonly VoxelColor[], where: string): VoxelModel {
  checkSize(size, where);
  checkPalette(palette, where);
  return {
    size: [size[0], size[1], size[2]],
    data: new Uint8Array(size[0] * size[1] * size[2]),
    palette,
  };
}

export function voxelIndex(size: Vec3, x: number, y: number, z: number): number {
  return x + size[0] * (y + size[1] * z);
}

export function inBounds(size: Vec3, x: number, y: number, z: number): boolean {
  return x >= 0 && y >= 0 && z >= 0 && x < size[0] && y < size[1] && z < size[2];
}

/** Palette index at (x, y, z); 0 outside the grid. */
export function voxelAt(model: VoxelModel, x: number, y: number, z: number): number {
  if (!inBounds(model.size, x, y, z)) return 0;
  return model.data[voxelIndex(model.size, x, y, z)] ?? 0;
}

/** Number of filled voxels. */
export function voxelCount(model: VoxelModel): number {
  let count = 0;
  for (const value of model.data) if (value !== 0) count += 1;
  return count;
}

export interface VoxelBounds {
  readonly min: Vec3;
  /** Exclusive upper corner (a voxel at x spans x..x+1). */
  readonly max: Vec3;
}

/** Tight bounds of the filled voxels in grid coordinates, or undefined for an empty model. */
export function filledBounds(model: VoxelModel): VoxelBounds | undefined {
  const [sx, sy, sz] = model.size;
  const min = [sx, sy, sz];
  const max = [0, 0, 0];
  let any = false;
  for (let z = 0; z < sz; z += 1) {
    for (let y = 0; y < sy; y += 1) {
      const row = sx * (y + sy * z);
      for (let x = 0; x < sx; x += 1) {
        if (model.data[row + x] === 0) continue;
        any = true;
        const point = [x, y, z];
        for (let axis = 0; axis < 3; axis += 1) {
          const value = point[axis] ?? 0;
          if (value < (min[axis] ?? 0)) min[axis] = value;
          if (value + 1 > (max[axis] ?? 0)) max[axis] = value + 1;
        }
      }
    }
  }
  if (!any) return undefined;
  return {
    min: [min[0] ?? 0, min[1] ?? 0, min[2] ?? 0],
    max: [max[0] ?? 0, max[1] ?? 0, max[2] ?? 0],
  };
}
