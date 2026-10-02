/**
 * Greedy mesher with baked per-vertex ambient occlusion (pure, no Three.js).
 *
 * For each of the 6 face directions and each slice, visible faces (filled voxel, empty
 * neighbour) are written into a 2D mask keyed by colour + the AO levels of their 4 corners;
 * equal neighbouring keys are merged into maximal rectangles (Mikola Lysenko's greedy meshing).
 * AO per corner is the classic voxel rule over the 3 cells around the corner in the face's
 * outer layer: level = side1 && side2 ? 0 : 3 - (side1 + side2 + corner), 0 = darkest. Merging
 * only identical keys keeps the baked AO exact. The quad diagonal is flipped towards the odd
 * corner so the interpolated darkening is symmetric. Output is deterministic for a given input.
 */
import type { Vec3 } from '../types.js';
import type { VoxelModel } from './model.js';

/** Linear RGB of a palette slot (already resolved from ctx.palette), and whether it is unlit. */
export interface ShadedColor {
  readonly rgb: readonly [number, number, number];
  readonly glow: boolean;
}

/** Brightness multiplier per AO level: [darkest, ..., open]. */
export type AoLevels = readonly [number, number, number, number];

export interface MeshLayout {
  /** World size of one voxel. */
  readonly voxelSize: number;
  /** Grid point (voxel corner coordinates) placed at the local origin. */
  readonly pivot: Vec3;
}

export interface VoxelMeshData {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  /** Linear RGB per vertex: palette colour x AO brightness. */
  readonly colors: Float32Array;
  readonly indices: Uint32Array;
  /** Indices [0, litIndexCount) use the lit material, the rest the unlit (glow) one. */
  readonly litIndexCount: number;
  readonly quadCount: number;
}

/** Brightness levels for an AO strength 0..1 (0 = no darkening). */
export function aoLevelsFor(strength: number): AoLevels {
  const s = Math.min(1, Math.max(0, strength));
  return [1 - s, 1 - (2 * s) / 3, 1 - s / 3, 1];
}

class GrowableArray<T extends Float32Array | Uint32Array> {
  data: T;
  length = 0;
  private readonly create: (size: number) => T;

  constructor(create: (size: number) => T, initial = 1024) {
    this.create = create;
    this.data = create(initial);
  }

  push(value: number): void {
    if (this.length === this.data.length) {
      const next = this.create(this.data.length * 2);
      next.set(this.data);
      this.data = next;
    }
    this.data[this.length] = value;
    this.length += 1;
  }

  view(): T {
    return this.data.slice(0, this.length) as T;
  }
}

/** (u, v) offsets of the 4 face corners, counter-clockwise seen from the +d side. */
const CORNERS = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
] as const;

interface MeshWriter {
  readonly positions: GrowableArray<Float32Array>;
  readonly normals: GrowableArray<Float32Array>;
  readonly colors: GrowableArray<Float32Array>;
  readonly lit: GrowableArray<Uint32Array>;
  readonly glow: GrowableArray<Uint32Array>;
  vertices: number;
  quads: number;
}

interface Quad {
  readonly d: number;
  readonly dir: 1 | -1;
  readonly plane: number;
  readonly a: number;
  readonly b: number;
  readonly w: number;
  readonly h: number;
  readonly key: number;
}

function writeQuad(
  writer: MeshWriter,
  quad: Quad,
  colors: readonly ShadedColor[],
  aoLevels: AoLevels,
  layout: MeshLayout,
): void {
  const { d, dir, plane, a, b, w, h, key } = quad;
  const u = (d + 1) % 3;
  const v = (d + 2) % 3;
  const shaded = colors[(key & 0xff) - 1] ?? { rgb: [1, 0, 1], glow: false };
  const ao = [(key >> 8) & 3, (key >> 10) & 3, (key >> 12) & 3, (key >> 14) & 3];
  const base = writer.vertices;
  const point = [0, 0, 0];
  const normal = [0, 0, 0];
  normal[d] = dir;
  CORNERS.forEach(([cu, cv], corner) => {
    point[d] = plane;
    point[u] = a + cu * w;
    point[v] = b + cv * h;
    for (let axis = 0; axis < 3; axis += 1) {
      writer.positions.push(((point[axis] ?? 0) - (layout.pivot[axis] ?? 0)) * layout.voxelSize);
      writer.normals.push(normal[axis] ?? 0);
    }
    const brightness = shaded.glow ? 1 : (aoLevels[ao[corner] ?? 3] ?? 1);
    for (const channel of shaded.rgb) writer.colors.push(channel * brightness);
  });
  writer.vertices += 4;
  writer.quads += 1;
  const flip = (ao[0] ?? 0) + (ao[2] ?? 0) > (ao[1] ?? 0) + (ao[3] ?? 0);
  const order = flip ? [1, 2, 3, 1, 3, 0] : [0, 1, 2, 0, 2, 3];
  if (dir < 0) {
    [order[1], order[2]] = [order[2] ?? 0, order[1] ?? 0];
    [order[4], order[5]] = [order[5] ?? 0, order[4] ?? 0];
  }
  const target = shaded.glow ? writer.glow : writer.lit;
  for (const index of order) target.push(base + index);
}

/** Occupancy lookup with out-of-grid = empty. */
function occupancy(model: VoxelModel): (x: number, y: number, z: number) => number {
  const [sx, sy, sz] = model.size;
  const { data } = model;
  return (x, y, z) =>
    x < 0 || y < 0 || z < 0 || x >= sx || y >= sy || z >= sz
      ? 0
      : (data[x + sx * (y + sy * z)] ?? 0);
}

/** Packs colour index + the AO level of each corner of the face of `p` facing `dir` on axis d. */
function faceKey(
  at: (x: number, y: number, z: number) => number,
  p: number[],
  d: number,
  dir: number,
  value: number,
  glow: boolean,
): number {
  if (glow) return value | (0xff << 8);
  const u = (d + 1) % 3;
  const v = (d + 2) % 3;
  const q = [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0];
  q[d] = (q[d] ?? 0) + dir;
  const probe = (du: number, dv: number): number => {
    const cell = [q[0] ?? 0, q[1] ?? 0, q[2] ?? 0];
    cell[u] = (cell[u] ?? 0) + du;
    cell[v] = (cell[v] ?? 0) + dv;
    return at(cell[0] ?? 0, cell[1] ?? 0, cell[2] ?? 0) === 0 ? 0 : 1;
  };
  let key = value;
  CORNERS.forEach(([cu, cv], corner) => {
    const du = cu === 1 ? 1 : -1;
    const dv = cv === 1 ? 1 : -1;
    const side1 = probe(du, 0);
    const side2 = probe(0, dv);
    const level = side1 && side2 ? 0 : 3 - (side1 + side2 + probe(du, dv));
    key |= level << (8 + 2 * corner);
  });
  return key;
}

/** Merges the mask of one slice into rectangles and writes them. */
function sweepMask(
  mask: Int32Array,
  extentU: number,
  extentV: number,
  emit: (a: number, b: number, w: number, h: number, key: number) => void,
): void {
  for (let b = 0; b < extentV; b += 1) {
    for (let a = 0; a < extentU;) {
      const key = mask[a + extentU * b] ?? 0;
      if (key === 0) {
        a += 1;
        continue;
      }
      let w = 1;
      while (a + w < extentU && mask[a + w + extentU * b] === key) w += 1;
      let h = 1;
      grow: while (b + h < extentV) {
        for (let k = 0; k < w; k += 1) if (mask[a + k + extentU * (b + h)] !== key) break grow;
        h += 1;
      }
      for (let row = 0; row < h; row += 1)
        mask.fill(0, a + extentU * (b + row), a + w + extentU * (b + row));
      emit(a, b, w, h, key);
      a += w;
    }
  }
}

export function greedyMesh(
  model: VoxelModel,
  colors: readonly ShadedColor[],
  aoLevels: AoLevels,
  layout: MeshLayout,
): VoxelMeshData {
  const at = occupancy(model);
  const writer: MeshWriter = {
    positions: new GrowableArray((n) => new Float32Array(n)),
    normals: new GrowableArray((n) => new Float32Array(n)),
    colors: new GrowableArray((n) => new Float32Array(n)),
    lit: new GrowableArray((n) => new Uint32Array(n)),
    glow: new GrowableArray((n) => new Uint32Array(n)),
    vertices: 0,
    quads: 0,
  };
  const glowSlots = colors.map((color) => color.glow);
  for (let d = 0; d < 3; d += 1) {
    const u = (d + 1) % 3;
    const v = (d + 2) % 3;
    const extentU = model.size[u] ?? 1;
    const extentV = model.size[v] ?? 1;
    const mask = new Int32Array(extentU * extentV);
    const p = [0, 0, 0];
    for (const dir of [1, -1] as const) {
      const ox = d === 0 ? dir : 0;
      const oy = d === 1 ? dir : 0;
      const oz = d === 2 ? dir : 0;
      for (let slice = 0; slice < (model.size[d] ?? 0); slice += 1) {
        p[d] = slice;
        let visible = false;
        for (let b = 0; b < extentV; b += 1) {
          p[v] = b;
          for (let a = 0; a < extentU; a += 1) {
            p[u] = a;
            const x = p[0] ?? 0;
            const y = p[1] ?? 0;
            const z = p[2] ?? 0;
            const value = at(x, y, z);
            const exposed = value !== 0 && at(x + ox, y + oy, z + oz) === 0;
            const key = exposed ? faceKey(at, p, d, dir, value, glowSlots[value - 1] === true) : 0;
            mask[a + extentU * b] = key;
            visible ||= exposed;
          }
        }
        if (!visible) continue;
        const plane = dir > 0 ? slice + 1 : slice;
        sweepMask(mask, extentU, extentV, (a, b, w, h, key) => {
          writeQuad(writer, { d, dir, plane, a, b, w, h, key }, colors, aoLevels, layout);
        });
      }
    }
  }
  const lit = writer.lit.view();
  const glow = writer.glow.view();
  const indices = new Uint32Array(lit.length + glow.length);
  indices.set(lit);
  indices.set(glow, lit.length);
  return {
    positions: writer.positions.view(),
    normals: writer.normals.view(),
    colors: writer.colors.view(),
    indices,
    litIndexCount: lit.length,
    quadCount: writer.quads,
  };
}
