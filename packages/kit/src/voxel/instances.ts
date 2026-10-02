/**
 * Instanced representation of a model (pure, no Three.js): one entry per *visible* voxel (at
 * least one empty face neighbour; every voxel with includeHidden), with its centre and a colour
 * darkened by a per-voxel AO approximation (instanced cubes cannot bake per-corner AO). Also
 * the heuristic that picks
 * instancing vs greedy meshing for `mode: 'auto'`.
 */
import type { AoLevels, MeshLayout, ShadedColor } from './greedy.js';
import type { VoxelModel } from './model.js';

export interface VoxelInstanceData {
  readonly count: number;
  /** Local centre of each instance (xyz). */
  readonly centers: Float32Array;
  /** Linear RGB of each instance (palette colour x AO). */
  readonly colors: Float32Array;
  /** 1 = unlit (glow) instance. */
  readonly glow: Uint8Array;
  /** Grid cell of each instance (xyz). */
  readonly cells: Int32Array;
}

const FACE_NEIGHBOURS = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
] as const;

/**
 * Occupied voxels among the 26 neighbours -> AO level. A voxel in a flat surface has 17 filled
 * neighbours (open, level 3); every 2 extra neighbours (creases, inner corners) is one level
 * darker. Convex edges and corners (fewer neighbours) stay open.
 */
export function neighbourAoLevel(filledNeighbours: number): number {
  return 3 - Math.min(3, Math.max(0, Math.floor((filledNeighbours - 16) / 2)));
}

function countNeighbours(
  data: Uint8Array,
  size: VoxelModel['size'],
  x: number,
  y: number,
  z: number,
): { readonly all: number; readonly openFaces: number } {
  const [sx, sy, sz] = size;
  const filled = (cx: number, cy: number, cz: number): boolean =>
    cx >= 0 &&
    cy >= 0 &&
    cz >= 0 &&
    cx < sx &&
    cy < sy &&
    cz < sz &&
    data[cx + sx * (cy + sy * cz)] !== 0;
  let all = 0;
  for (let dz = -1; dz <= 1; dz += 1) {
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if ((dx !== 0 || dy !== 0 || dz !== 0) && filled(x + dx, y + dy, z + dz)) all += 1;
      }
    }
  }
  let openFaces = 0;
  for (const [dx, dy, dz] of FACE_NEIGHBOURS) if (!filled(x + dx, y + dy, z + dz)) openFaces += 1;
  return { all, openFaces };
}

export function instanceData(
  model: VoxelModel,
  colors: readonly ShadedColor[],
  aoLevels: AoLevels,
  layout: MeshLayout,
  includeHidden = false,
): VoxelInstanceData {
  const [sx, sy, sz] = model.size;
  const centers: number[] = [];
  const rgb: number[] = [];
  const glow: number[] = [];
  const cells: number[] = [];
  for (let z = 0; z < sz; z += 1) {
    for (let y = 0; y < sy; y += 1) {
      for (let x = 0; x < sx; x += 1) {
        const value = model.data[x + sx * (y + sy * z)] ?? 0;
        if (value === 0) continue;
        const { all, openFaces } = countNeighbours(model.data, model.size, x, y, z);
        if (openFaces === 0 && !includeHidden) continue;
        const shaded = colors[value - 1] ?? { rgb: [1, 0, 1], glow: false };
        const brightness = shaded.glow ? 1 : (aoLevels[neighbourAoLevel(all)] ?? 1);
        const cell = [x, y, z];
        cell.forEach((coordinate, axis) => {
          centers.push((coordinate + 0.5 - (layout.pivot[axis] ?? 0)) * layout.voxelSize);
        });
        for (const channel of shaded.rgb) rgb.push(channel * brightness);
        glow.push(shaded.glow ? 1 : 0);
        cells.push(x, y, z);
      }
    }
  }
  return {
    count: glow.length,
    centers: Float32Array.from(centers),
    colors: Float32Array.from(rgb),
    glow: Uint8Array.from(glow),
    cells: Int32Array.from(cells),
  };
}

/** Filled voxels and their exposed faces (a face whose neighbour is empty or outside). */
export function surfaceStats(model: VoxelModel): {
  readonly filled: number;
  readonly faces: number;
} {
  const [sx, sy, sz] = model.size;
  let filled = 0;
  let faces = 0;
  for (let z = 0; z < sz; z += 1) {
    for (let y = 0; y < sy; y += 1) {
      for (let x = 0; x < sx; x += 1) {
        if (model.data[x + sx * (y + sy * z)] === 0) continue;
        filled += 1;
        for (const [dx, dy, dz] of FACE_NEIGHBOURS) {
          const cx = x + dx;
          const cy = y + dy;
          const cz = z + dz;
          const inside = cx >= 0 && cy >= 0 && cz >= 0 && cx < sx && cy < sy && cz < sz;
          if (!inside || model.data[cx + sx * (cy + sy * cz)] === 0) faces += 1;
        }
      }
    }
  }
  return { filled, faces };
}

/** Below this many voxels `auto` always meshes greedily (cheap either way). */
export const AUTO_INSTANCING_MIN_VOXELS = 4096;
/** Average exposed faces per voxel above which a model counts as a sparse cloud. */
export const AUTO_INSTANCING_FACES_PER_VOXEL = 4;

/**
 * `mode: 'auto'`: greedy meshing for solid models (props, terrain: merged quads, exact AO, far
 * fewer triangles); instancing for large sparse clouds (> 4096 voxels averaging > 4 exposed
 * faces each - particles, debris), where greedy cannot merge and would emit up to 6 quads per
 * voxel. Animating single voxels (`setVoxelTransform`) always needs `mode: 'instanced'`.
 */
export function chooseMode(model: VoxelModel): 'greedy' | 'instanced' {
  const { filled, faces } = surfaceStats(model);
  if (filled <= AUTO_INSTANCING_MIN_VOXELS) return 'greedy';
  return faces / filled > AUTO_INSTANCING_FACES_PER_VOXEL ? 'instanced' : 'greedy';
}
