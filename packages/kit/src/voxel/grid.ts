/**
 * Building voxel models from authored data: string layers (hand-drawn sprites), numeric 3D
 * arrays, sparse voxel lists and generator functions. Scenes are untyped JS, so every input is
 * validated at runtime with messages that point at the offending element.
 */
import { KitError } from '../errors.js';
import type { Vec3 } from '../types.js';
import {
  checkPalette,
  colorKey,
  emptyModel,
  inBounds,
  voxelIndex,
  type VoxelColor,
  type VoxelModel,
} from './model.js';

/**
 * Hand-drawn layers of characters. Orientation 'top' (default): `layers[y]` from the bottom up,
 * each layer is rows from the back (-z) to the front (+z), characters left (-x) to right (+x) -
 * i.e. top-down maps. Orientation 'front': `layers[0]` is the front-most slice, each slice is
 * rows from the top down, characters left to right - i.e. what the default camera sees.
 * '.' and ' ' are empty; every other character must be in `key`. Short rows/layers are padded.
 */
export interface VoxelLayersInput {
  readonly layers: readonly (readonly string[])[];
  readonly key: Readonly<Record<string, VoxelColor>>;
  readonly orientation?: 'top' | 'front' | undefined;
}

/** Sparse list of `[x, y, z, paletteIndex]` (index >= 1); size defaults to the bounds. */
export interface VoxelSparseInput {
  readonly size?: Vec3 | undefined;
  readonly voxels: readonly (readonly [number, number, number, number])[];
}

/** `grid[y][z][x]` palette indices (0 = empty, n = palette[n - 1]); short rows are padded. */
export type VoxelArrayInput = readonly (readonly (readonly number[])[])[];

export type VoxelGridInput = VoxelArrayInput | VoxelLayersInput | VoxelSparseInput;

const EMPTY_CHARS = new Set(['.', ' ']);

function gridError(message: string): KitError {
  return new KitError('invalid-grid', `voxelFromGrid: ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asArray(value: unknown, what: string): readonly unknown[] {
  if (!Array.isArray(value)) throw gridError(`${what} must be an array`);
  return value as readonly unknown[];
}

/** Largest value (at least 1); a loop, so huge lists cannot overflow the argument limit. */
function maxOrOne(values: Iterable<number>): number {
  let max = 1;
  for (const value of values) if (value > max) max = value;
  return max;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function checkIndex(value: unknown, paletteSize: number, where: string): number {
  if (!isNonNegativeInteger(value) || value > paletteSize) {
    throw gridError(
      `${where} = ${String(value)}: expected 0 (empty) or a palette index 1..${String(paletteSize)}`,
    );
  }
  return value;
}

function requirePalette(palette: unknown, form: string): readonly VoxelColor[] {
  if (!Array.isArray(palette) || palette.length === 0) {
    throw gridError(
      `the ${form} form needs a palette, e.g. voxelFromGrid(grid, ['hero', 'heroTrim'])`,
    );
  }
  const colors = palette as readonly VoxelColor[];
  checkPalette(colors, 'voxelFromGrid');
  return colors;
}

function fromArray(grid: readonly unknown[], paletteInput: unknown): VoxelModel {
  const palette = requirePalette(paletteInput, 'grid[y][z][x]');
  const layers = grid.map((layer, y) =>
    asArray(layer, `grid[${String(y)}]`).map((row, z) =>
      asArray(row, `grid[${String(y)}][${String(z)}]`),
    ),
  );
  const sz = maxOrOne(layers.map((layer) => layer.length));
  const sx = maxOrOne(layers.flatMap((layer) => layer.map((row) => row.length)));
  const model = emptyModel([sx, Math.max(layers.length, 1), sz], palette, 'voxelFromGrid');
  layers.forEach((layer, y) => {
    layer.forEach((row, z) => {
      row.forEach((value, x) => {
        const where = `grid[${String(y)}][${String(z)}][${String(x)}]`;
        model.data[voxelIndex(model.size, x, y, z)] = checkIndex(value, palette.length, where);
      });
    });
  });
  return model;
}

function keyPalette(key: Record<string, unknown>): {
  palette: VoxelColor[];
  indexOf: Map<string, number>;
} {
  const palette: VoxelColor[] = [];
  const slots = new Map<string, number>();
  const indexOf = new Map<string, number>();
  for (const [char, value] of Object.entries(key)) {
    if (Array.from(char).length !== 1) throw gridError(`key "${char}" must be a single character`);
    if (EMPTY_CHARS.has(char)) throw gridError(`key "${char}" is reserved for empty voxels`);
    const color = value as VoxelColor;
    checkPalette([color], `voxelFromGrid key "${char}"`);
    const identity = colorKey(color);
    let slot = slots.get(identity);
    if (slot === undefined) {
      palette.push(color);
      slot = palette.length;
      slots.set(identity, slot);
    }
    indexOf.set(char, slot);
  }
  checkPalette(palette, 'voxelFromGrid');
  return { palette, indexOf };
}

function layerRows(layers: readonly unknown[]): string[][][] {
  return layers.map((layer, layerIndex) =>
    asArray(layer, `layers[${String(layerIndex)}]`).map((row, rowIndex) => {
      if (typeof row !== 'string') {
        throw gridError(`layers[${String(layerIndex)}][${String(rowIndex)}] must be a string`);
      }
      return Array.from(row);
    }),
  );
}

function fromLayers(input: Record<string, unknown>): VoxelModel {
  const layers = layerRows(asArray(input['layers'], 'layers'));
  if (layers.length === 0) throw gridError('layers must not be empty');
  const key = input['key'];
  if (!isRecord(key)) throw gridError("key must map characters to colours, e.g. { o: 'hero' }");
  const { palette, indexOf } = keyPalette(key);
  const front = input['orientation'] === 'front';
  const depth = maxOrOne(layers.map((layer) => layer.length));
  const width = maxOrOne(layers.flatMap((layer) => layer.map((row) => row.length)));
  const size: Vec3 = front ? [width, depth, layers.length] : [width, layers.length, depth];
  const model = emptyModel(size, palette, 'voxelFromGrid');
  layers.forEach((layer, layerIndex) => {
    layer.forEach((row, rowIndex) => {
      row.forEach((char, x) => {
        if (EMPTY_CHARS.has(char)) return;
        const slot = indexOf.get(char);
        if (slot === undefined) {
          throw gridError(
            `layers[${String(layerIndex)}][${String(rowIndex)}] column ${String(x)}: "${char}" is not in key (known: ${[...indexOf.keys()].join(' ')}; '.' = empty)`,
          );
        }
        const y = front ? depth - 1 - rowIndex : layerIndex;
        const z = front ? layers.length - 1 - layerIndex : rowIndex;
        model.data[voxelIndex(size, x, y, z)] = slot;
      });
    });
  });
  return model;
}

function sparseVoxel(value: unknown, index: number): readonly [number, number, number, unknown] {
  const voxel = asArray(value, `voxels[${String(index)}]`);
  const [x, y, z, color] = voxel;
  if (
    voxel.length !== 4 ||
    !isNonNegativeInteger(x) ||
    !isNonNegativeInteger(y) ||
    !isNonNegativeInteger(z)
  ) {
    throw gridError(`voxels[${String(index)}] must be [x, y, z, paletteIndex] with x, y, z >= 0`);
  }
  return [x, y, z, color];
}

function fromSparse(input: Record<string, unknown>, paletteInput: unknown): VoxelModel {
  const palette = requirePalette(paletteInput, 'sparse { voxels }');
  const voxels = asArray(input['voxels'], 'voxels').map(sparseVoxel);
  const bounds = (axis: 0 | 1 | 2): number => maxOrOne(voxels.map((voxel) => voxel[axis] + 1));
  const size: Vec3 =
    input['size'] === undefined ? [bounds(0), bounds(1), bounds(2)] : (input['size'] as Vec3);
  const model = emptyModel(size, palette, 'voxelFromGrid');
  voxels.forEach(([x, y, z, value], index) => {
    if (!inBounds(model.size, x, y, z)) {
      throw gridError(
        `voxels[${String(index)}] = [${String(x)}, ${String(y)}, ${String(z)}] is outside size ${model.size.join('x')}`,
      );
    }
    const where = `voxels[${String(index)}][3]`;
    model.data[voxelIndex(model.size, x, y, z)] = checkIndex(value, palette.length, where);
  });
  return model;
}

/**
 * Builds a model from string layers `{ layers, key, orientation? }`, a numeric `grid[y][z][x]`
 * or a sparse `{ size?, voxels: [[x, y, z, index], ...] }`. The numeric and sparse forms need
 * `palette` (index n -> palette[n - 1]); string layers take their colours from `key`.
 */
export function voxelFromGrid(grid: VoxelGridInput, palette?: readonly VoxelColor[]): VoxelModel {
  const input: unknown = grid;
  if (Array.isArray(input)) return fromArray(input as readonly unknown[], palette);
  if (isRecord(input) && 'layers' in input) return fromLayers(input);
  if (isRecord(input) && 'voxels' in input) return fromSparse(input, palette);
  throw gridError('expected { layers, key }, grid[y][z][x] or { voxels: [[x, y, z, index]] }');
}

/**
 * Model of `size` whose voxel (x, y, z) is `fill(x, y, z)` (0 = empty, n = palette[n - 1]).
 * `fill` must be a pure function of its arguments (procedural terrain, cities, patterns).
 */
export function voxelGenerate(
  size: Vec3,
  fill: (x: number, y: number, z: number) => number,
  palette: readonly VoxelColor[],
): VoxelModel {
  const model = emptyModel(size, requirePalette(palette, 'generate'), 'voxel.generate');
  const [sx, sy, sz] = model.size;
  for (let z = 0; z < sz; z += 1) {
    for (let y = 0; y < sy; y += 1) {
      for (let x = 0; x < sx; x += 1) {
        const value: unknown = fill(x, y, z);
        if (value === 0) continue;
        const where = `generate fill(${String(x)}, ${String(y)}, ${String(z)})`;
        model.data[voxelIndex(model.size, x, y, z)] = checkIndex(value, palette.length, where);
      }
    }
  }
  return model;
}
