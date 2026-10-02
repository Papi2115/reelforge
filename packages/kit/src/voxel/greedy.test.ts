import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { aoLevelsFor, greedyMesh, type ShadedColor, type VoxelMeshData } from './greedy.js';
import { voxelFromGrid, voxelGenerate } from './grid.js';
import { voxelBox } from './ops.js';
import type { VoxelModel } from './model.js';

const WHITE: ShadedColor = { rgb: [1, 1, 1], glow: false };
const LAYOUT = { voxelSize: 1, pivot: [0, 0, 0] as const };
const AO = aoLevelsFor(0.45);

function mesh(model: VoxelModel, colors: readonly ShadedColor[] = [WHITE, WHITE]): VoxelMeshData {
  return greedyMesh(model, colors, AO, LAYOUT);
}

function vertex(
  data: VoxelMeshData,
  index: number,
  attribute: Float32Array = data.positions,
): number[] {
  return [0, 1, 2].map((axis) => attribute[index * 3 + axis] ?? Number.NaN);
}

function hashMesh(data: VoxelMeshData): string {
  const hash = createHash('sha256');
  for (const array of [data.positions, data.normals, data.colors, data.indices]) {
    hash.update(new Uint8Array(array.buffer, array.byteOffset, array.byteLength));
  }
  return hash.digest('hex');
}

/** City-like blocks: 8x8-voxel plateaus of varying height, ~115k voxels. */
function terrain(): VoxelModel {
  return voxelGenerate(
    [128, 24, 128],
    (x, y, z) => {
      const blockX = Math.floor(x / 8);
      const blockZ = Math.floor(z / 8);
      const height = 4 + ((blockX * 3 + blockZ * 5) % 7);
      return y < height ? 1 + ((blockX + blockZ) % 2) : 0;
    },
    ['ground', 'groundAlt'],
  );
}

describe('greedyMesh', () => {
  it('meshes one voxel into 6 quads with outward normals and counter-clockwise triangles', () => {
    const data = mesh(voxelBox([1, 1, 1], 'ground'));
    expect(data.quadCount).toBe(6);
    expect(data.positions.length).toBe(24 * 3);
    expect(data.indices.length).toBe(36);
    for (let triangle = 0; triangle < data.indices.length / 3; triangle += 1) {
      const [a, b, c] = [0, 1, 2].map((corner) =>
        vertex(data, data.indices[triangle * 3 + corner] ?? 0),
      );
      const e1 = [0, 1, 2].map((axis) => (b?.[axis] ?? 0) - (a?.[axis] ?? 0));
      const e2 = [0, 1, 2].map((axis) => (c?.[axis] ?? 0) - (a?.[axis] ?? 0));
      const cross = [
        (e1[1] ?? 0) * (e2[2] ?? 0) - (e1[2] ?? 0) * (e2[1] ?? 0),
        (e1[2] ?? 0) * (e2[0] ?? 0) - (e1[0] ?? 0) * (e2[2] ?? 0),
        (e1[0] ?? 0) * (e2[1] ?? 0) - (e1[1] ?? 0) * (e2[0] ?? 0),
      ];
      const normal = vertex(data, data.indices[triangle * 3] ?? 0, data.normals);
      const facing = cross.reduce((sum, value, axis) => sum + value * (normal[axis] ?? 0), 0);
      expect(facing).toBeGreaterThan(0);
    }
    // An isolated voxel has no occluders: every vertex at full brightness.
    expect([...data.colors].every((value) => value === 1)).toBe(true);
  });

  it('merges coplanar faces of one colour into single quads', () => {
    expect(mesh(voxelBox([8, 3, 5], 'ground')).quadCount).toBe(6);
    const striped = voxelFromGrid({ layers: [['abab']], key: { a: 'hero', b: 'heroTrim' } });
    // top/bottom/front/back split by colour (4 x 4), the two ends stay whole.
    expect(mesh(striped).quadCount).toBe(18);
  });

  it('bakes ambient occlusion into the corners next to a wall', () => {
    // Floor of 3x3 with a wall voxel on top of the back-left corner.
    const model = voxelFromGrid({
      layers: [
        ['ooo', 'ooo', 'ooo'],
        ['o..', '...', '...'],
      ],
      key: { o: 'ground' },
    });
    const data = mesh(model, [WHITE]);
    const topVertices: { position: number[]; brightness: number }[] = [];
    for (let index = 0; index < data.positions.length / 3; index += 1) {
      const normal = vertex(data, index, data.normals);
      if (normal[1] === 1 && vertex(data, index)[1] === 1) {
        topVertices.push({
          position: vertex(data, index),
          brightness: data.colors[index * 3] ?? 0,
        });
      }
    }
    const at = (x: number, z: number): number[] =>
      topVertices
        .filter(({ position }) => position[0] === x && position[2] === z)
        .map(({ brightness }) => brightness);
    // Floor corner touching the wall's edge is darkened, the far corner is open.
    expect(Math.min(...at(1, 1))).toBeLessThan(1);
    expect(Math.max(...at(3, 3))).toBe(1);
    expect(Math.min(...[...data.colors])).toBeCloseTo(AO[1], 5);
  });

  it('is deterministic: the same model always yields byte-identical buffers', () => {
    const model = terrain();
    expect(hashMesh(mesh(model))).toBe(hashMesh(mesh(model)));
  });

  it('keeps glow faces unshaded, in their own index range after the lit ones', () => {
    const model = voxelFromGrid({
      layers: [['ag', 'aa']],
      key: { a: 'ground', g: { color: 'accent1', glow: true } },
    });
    const colors: ShadedColor[] = [WHITE, { rgb: [0.5, 0.25, 1], glow: true }];
    const data = mesh(model, colors);
    expect(data.litIndexCount).toBeGreaterThan(0);
    expect(data.litIndexCount).toBeLessThan(data.indices.length);
    const glowVertices = new Set([...data.indices.subarray(data.litIndexCount)]);
    for (const index of glowVertices)
      expect(vertex(data, index, data.colors)).toEqual([0.5, 0.25, 1]);
  });

  it('meshes a 100k-voxel model quickly into far fewer quads than voxel faces', () => {
    const model = terrain();
    const filled = model.data.reduce((sum, value) => sum + (value === 0 ? 0 : 1), 0);
    expect(filled).toBeGreaterThanOrEqual(100_000);
    const started = process.hrtime.bigint();
    const data = mesh(model);
    const milliseconds = Number(process.hrtime.bigint() - started) / 1e6;
    expect(data.quadCount).toBeLessThan(filled / 2);
    // Generous bound for slow CI machines (typically ~100-300 ms).
    expect(milliseconds).toBeLessThan(5000);
  });
});
