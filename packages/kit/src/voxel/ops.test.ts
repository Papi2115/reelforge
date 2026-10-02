import { describe, expect, it } from 'vitest';
import { testRng } from '../testing/rng.js';
import { voxelFromGrid } from './grid.js';
import { voxelAt, voxelCount } from './model.js';
import { extrude, merge, mirror, recolor, speckle, voxelBox } from './ops.js';

describe('voxel model operations', () => {
  it('box fills every voxel with one colour', () => {
    const model = voxelBox([3, 2, 4], 'ground');
    expect(model.palette).toEqual(['ground']);
    expect(voxelCount(model)).toBe(24);
  });

  it("extrude turns a front view into a slab ('z') or a floor plan into walls ('y')", () => {
    const sign = extrude({ rows: ['o.o', 'ooo'], key: { o: 'accent1' }, depth: 2 });
    expect(sign.size).toEqual([3, 2, 2]);
    expect(voxelAt(sign, 1, 1, 0)).toBe(0); // top-middle is a gap in both slices
    expect(voxelCount(sign)).toBe(10);
    const walls = extrude({ rows: ['ooo', 'o.o'], key: { o: 'ground' }, depth: 3, axis: 'y' });
    expect(walls.size).toEqual([3, 3, 2]);
    expect(voxelCount(walls)).toBe(15);
  });

  it('mirror flips, or joins the mirror image (with a shared centre)', () => {
    const half = voxelFromGrid({ layers: [['ab']], key: { a: 'hero', b: 'heroTrim' } });
    const flipped = mirror(half, 'x');
    expect([voxelAt(flipped, 0, 0, 0), voxelAt(flipped, 1, 0, 0)]).toEqual([2, 1]);
    const joined = mirror(half, 'x', { join: true });
    expect(joined.size).toEqual([4, 1, 1]);
    expect([0, 1, 2, 3].map((x) => voxelAt(joined, x, 0, 0))).toEqual([1, 2, 2, 1]);
    const shared = mirror(half, 'x', { join: true, overlap: 1 });
    expect([0, 1, 2].map((x) => voxelAt(shared, x, 0, 0))).toEqual([1, 2, 1]);
  });

  it('merge unions palettes and lets later parts overwrite', () => {
    const base = voxelBox([2, 1, 1], 'ground');
    const top = voxelBox([1, 1, 1], 'hero');
    const model = merge([
      { model: base },
      { model: top, at: [1, 0, 0] },
      { model: top, at: [0, 1, 0] },
    ]);
    expect(model.size).toEqual([2, 2, 1]);
    expect(model.palette).toEqual(['ground', 'hero']);
    expect([voxelAt(model, 0, 0, 0), voxelAt(model, 1, 0, 0), voxelAt(model, 0, 1, 0)]).toEqual([
      1, 2, 2,
    ]);
    expect(() => merge([{ model: base, at: [-1, 0, 0] }])).toThrow(/integers >= 0/);
  });

  it('recolor swaps colours by name and keeps glow', () => {
    const model = voxelFromGrid({
      layers: [['ab']],
      key: { a: 'hero', b: { color: 'accent1', glow: true } },
    });
    expect(recolor(model, { hero: 'accent2', accent1: 'accent3' }).palette).toEqual([
      'accent2',
      { color: 'accent3', glow: true },
    ]);
  });

  it('speckle is deterministic for a seed and changes about `share` of the voxels', () => {
    const grass = voxelBox([32, 1, 32], 'ground');
    const first = speckle(grass, { from: 'ground', to: 'groundAlt', share: 0.25 }, testRng(7));
    const again = speckle(grass, { from: 'ground', to: 'groundAlt', share: 0.25 }, testRng(7));
    const other = speckle(grass, { from: 'ground', to: 'groundAlt', share: 0.25 }, testRng(8));
    expect(Buffer.from(again.data).equals(Buffer.from(first.data))).toBe(true);
    expect(Buffer.from(other.data).equals(Buffer.from(first.data))).toBe(false);
    const changed = first.data.filter((value) => value === 2).length;
    expect(changed / 1024).toBeGreaterThan(0.18);
    expect(changed / 1024).toBeLessThan(0.32);
    expect(grass.data.every((value) => value === 1)).toBe(true); // input untouched
  });
});
