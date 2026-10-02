import { describe, expect, it } from 'vitest';
import { KitError } from '../errors.js';
import { voxelFromGrid, voxelGenerate } from './grid.js';
import { voxelAt, voxelCount } from './model.js';

describe('voxelFromGrid: string layers', () => {
  const key = { o: 'hero', c: 'heroTrim', g: { color: 'accent1', glow: true } };

  it("reads 'top' layers bottom-up, rows back to front, columns left to right", () => {
    const model = voxelFromGrid({
      layers: [
        ['oo', 'c.'],
        ['g', ''],
      ],
      key,
    });
    expect(model.size).toEqual([2, 2, 2]);
    expect(model.palette).toEqual(['hero', 'heroTrim', { color: 'accent1', glow: true }]);
    expect(voxelAt(model, 0, 0, 0)).toBe(1);
    expect(voxelAt(model, 1, 0, 0)).toBe(1);
    expect(voxelAt(model, 0, 0, 1)).toBe(2); // second row = further front (+z)
    expect(voxelAt(model, 1, 0, 1)).toBe(0);
    expect(voxelAt(model, 0, 1, 0)).toBe(3); // second layer = one up
    expect(voxelCount(model)).toBe(4);
  });

  it("reads 'front' slices front to back, rows top-down", () => {
    const model = voxelFromGrid({
      layers: [
        ['o.', 'cc'],
        ['..', '.o'],
      ],
      key,
      orientation: 'front',
    });
    expect(model.size).toEqual([2, 2, 2]);
    expect(voxelAt(model, 0, 1, 1)).toBe(1); // top-left of the front slice
    expect(voxelAt(model, 0, 0, 1)).toBe(2);
    expect(voxelAt(model, 1, 0, 1)).toBe(2);
    expect(voxelAt(model, 1, 0, 0)).toBe(1); // back slice, bottom right
  });

  it('deduplicates colours shared by several characters', () => {
    const model = voxelFromGrid({ layers: [['ab']], key: { a: 'hero', b: 'hero' } });
    expect(model.palette).toEqual(['hero']);
    expect([voxelAt(model, 0, 0, 0), voxelAt(model, 1, 0, 0)]).toEqual([1, 1]);
  });

  it('points at unknown characters and reserved keys', () => {
    expect(() => voxelFromGrid({ layers: [['ox']], key })).toThrow(
      /layers\[0\]\[0\] column 1: "x" is not in key/,
    );
    expect(() => voxelFromGrid({ layers: [['o']], key: { '.': 'hero' } })).toThrow(/reserved/);
    expect(() => voxelFromGrid({ layers: [], key })).toThrow(KitError);
  });
});

describe('voxelFromGrid: numeric and sparse forms', () => {
  it('reads grid[y][z][x] with 1-based palette indices', () => {
    const model = voxelFromGrid([[[1, 0, 2]], [[0, 1]]], ['hero', 'accent2']);
    expect(model.size).toEqual([3, 2, 1]);
    expect(voxelAt(model, 2, 0, 0)).toBe(2);
    expect(voxelAt(model, 1, 1, 0)).toBe(1);
  });

  it('rejects indices outside the palette and a missing palette', () => {
    expect(() => voxelFromGrid([[[3]]], ['hero'])).toThrow(/grid\[0\]\[0\]\[0\] = 3/);
    expect(() => voxelFromGrid([[[1]]])).toThrow(/needs a palette/);
  });

  it('reads sparse voxels and sizes the grid to fit them', () => {
    const model = voxelFromGrid(
      {
        voxels: [
          [0, 0, 0, 1],
          [3, 1, 2, 1],
        ],
      },
      ['hero'],
    );
    expect(model.size).toEqual([4, 2, 3]);
    expect(voxelCount(model)).toBe(2);
    expect(() => voxelFromGrid({ size: [2, 2, 2], voxels: [[2, 0, 0, 1]] }, ['hero'])).toThrow(
      /outside size 2x2x2/,
    );
  });
});

describe('voxelGenerate', () => {
  it('fills from a pure function', () => {
    const model = voxelGenerate([4, 4, 4], (x, y, z) => (y <= (x + z) % 3 ? 1 : 0), ['ground']);
    expect(voxelAt(model, 0, 0, 0)).toBe(1);
    expect(voxelAt(model, 0, 1, 0)).toBe(0);
    expect(voxelAt(model, 2, 2, 0)).toBe(1);
  });

  it('rejects out-of-range values with the cell that produced them', () => {
    expect(() => voxelGenerate([2, 1, 1], (x) => (x === 1 ? 7 : 1), ['ground'])).toThrow(
      /fill\(1, 0, 0\) = 7/,
    );
  });
});
