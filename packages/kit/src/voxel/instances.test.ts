import { describe, expect, it } from 'vitest';
import { aoLevelsFor, type ShadedColor } from './greedy.js';
import { voxelGenerate } from './grid.js';
import { chooseMode, instanceData, neighbourAoLevel, surfaceStats } from './instances.js';
import { voxelBox } from './ops.js';

const LAYOUT = { voxelSize: 0.5, pivot: [0, 0, 0] as const };
const COLORS: ShadedColor[] = [{ rgb: [1, 1, 1], glow: false }];

describe('instanceData', () => {
  it('creates instances only for visible voxels unless includeHidden', () => {
    const cube = voxelBox([3, 3, 3], 'ground');
    expect(instanceData(cube, COLORS, aoLevelsFor(0.45), LAYOUT).count).toBe(26);
    const all = instanceData(cube, COLORS, aoLevelsFor(0.45), LAYOUT, true);
    expect(all.count).toBe(27);
    // Centre of cell (1, 1, 1) with 0.5 voxels.
    expect([...all.centers.subarray(13 * 3, 13 * 3 + 3)]).toEqual([0.75, 0.75, 0.75]);
    expect([...all.cells.subarray(13 * 3, 13 * 3 + 3)]).toEqual([1, 1, 1]);
  });

  it('darkens voxels in creases, keeps flat surfaces and convex edges open', () => {
    expect(neighbourAoLevel(7)).toBe(3); // box corner
    expect(neighbourAoLevel(17)).toBe(3); // flat surface
    expect(neighbourAoLevel(18)).toBe(2);
    expect(neighbourAoLevel(20)).toBe(1);
    expect(neighbourAoLevel(25)).toBe(0);
  });
});

describe('chooseMode', () => {
  it('meshes solid models greedily and sparse clouds with instancing', () => {
    expect(chooseMode(voxelBox([40, 40, 40], 'ground'))).toBe('greedy');
    const cloud = voxelGenerate([40, 40, 40], (x, y, z) => ((x + y + z) % 2 === 0 ? 1 : 0), [
      'accent1',
    ]);
    expect(surfaceStats(cloud).faces / surfaceStats(cloud).filled).toBe(6);
    expect(chooseMode(cloud)).toBe('instanced');
    // Small models are always greedy.
    const small = voxelGenerate([8, 8, 8], (x, y, z) => ((x + y + z) % 2 === 0 ? 1 : 0), [
      'accent1',
    ]);
    expect(chooseMode(small)).toBe('greedy');
  });
});
