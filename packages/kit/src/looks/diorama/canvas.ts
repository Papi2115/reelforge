/**
 * The diorama canvas: one voxel sketch per diorama holding the floating platform (display plate,
 * cross-section slab, tiled floor with steps, cut-away back and left walls) and every static
 * object, so the whole diorama is one greedy mesh. Objects are drawn through stamps (a local
 * frame that faces +z or +x); glowing cells that animate (LEDs, screens, windows) are recorded
 * as glow cells and drawn as quads on top (glow.ts).
 */
import { Sketch } from '../../props/sketch.js';
import type { Vec3 } from '../../types.js';
import type { VoxelColor } from '../../voxel/model.js';
import { heightAt, kindAt, TILE_VOXELS, type TileGrid } from './tiles.js';
import type { Slot } from './tones.js';

/** Display plate thickness under the slab (voxels). */
export const PLATE = 2;
/** Plate overhang around the slab (voxels). */
export const OVERHANG = 2;
/** Cross-section slab under the floor layer (voxels). */
export const SLAB = 4;
/** Height of the floor top above the canvas bottom: plate + slab + floor layer. */
export const BASE = PLATE + SLAB + 1;
/** Wall thickness (voxels). */
export const WALL = 2;

export type Face = 'x' | 'y' | 'z';
export type Facing = 'z' | 'x';

/** A voxel face that gets an animated glow quad (canvas coordinates). */
export interface GlowCell {
  readonly cell: Vec3;
  readonly face: Face;
}

/** Top floor voxel of a tile: slot for local voxel (lx, lz) of tile (tx, tz). */
export type FloorPattern<Kind extends string> = (
  kind: Kind,
  tx: number,
  tz: number,
  lx: number,
  lz: number,
) => Slot;

export class DioramaCanvas<Kind extends string> {
  readonly sketch: Sketch<Slot>;
  readonly grid: TileGrid<Kind>;
  readonly size: Vec3;
  /** Grid point at the local origin: centre of the platform at floor top. */
  readonly pivot: Vec3;
  private readonly anchorPoints = new Map<string, Vec3>();

  constructor(grid: TileGrid<Kind>, colors: Readonly<Record<Slot, VoxelColor>>, headroom: number) {
    this.grid = grid;
    const maxStep = Math.max(0, ...grid.heights);
    this.size = [
      grid.width * TILE_VOXELS + 2 * OVERHANG,
      BASE + maxStep + headroom,
      grid.depth * TILE_VOXELS + 2 * OVERHANG,
    ];
    this.sketch = new Sketch<Slot>(this.size, colors);
    this.pivot = [this.size[0] / 2, BASE, this.size[2] / 2];
  }

  /** Canvas voxel of tile (tx, tz)'s back-left corner, on its floor (first free layer). */
  tile(tx: number, tz: number): Vec3 {
    return [
      OVERHANG + tx * TILE_VOXELS,
      BASE + heightAt(this.grid, tx, tz),
      OVERHANG + tz * TILE_VOXELS,
    ];
  }

  /** Records an anchor at a canvas grid point. */
  anchor(name: string, point: Vec3): void {
    this.anchorPoints.set(name, point);
  }

  /** Grid point -> local units of the diorama object (voxel size 1/8, pivot at floor centre). */
  toLocal(point: Vec3): Vec3 {
    return [
      (point[0] - this.pivot[0]) / TILE_VOXELS,
      (point[1] - this.pivot[1]) / TILE_VOXELS,
      (point[2] - this.pivot[2]) / TILE_VOXELS,
    ];
  }

  /** Anchors in local units. */
  localAnchors(): Record<string, Vec3> {
    const result: Record<string, Vec3> = {};
    for (const [name, point] of this.anchorPoints) result[name] = this.toLocal(point);
    return result;
  }

  /** Draws plate, slab and the tiled floor (risers under raised tiles in the `riser` slot). */
  platform(
    pattern: FloorPattern<Kind>,
    speckle: (x: number, y: number, z: number) => boolean,
    riser: Slot = 'seam',
  ): void {
    const s = this.sketch;
    const [sx, , sz] = this.size;
    s.box('plate', [0, 0, 0], [sx, PLATE, sz]);
    s.box('plateRim', [0, PLATE - 1, 0], [sx, PLATE, sz]);
    const x1 = sx - OVERHANG;
    const z1 = sz - OVERHANG;
    s.box('base', [OVERHANG, PLATE, OVERHANG], [x1, BASE - 1, z1]);
    s.box('baseAlt', [OVERHANG, BASE - 2, OVERHANG], [x1, BASE - 1, z1]);
    for (let z = OVERHANG; z < z1; z += 1) {
      for (let y = PLATE; y < BASE - 2; y += 1) {
        for (let x = OVERHANG; x < x1; x += 1) {
          const outside = x === x1 - 1 || z === z1 - 1 || x === OVERHANG || z === OVERHANG;
          if (outside && speckle(x, y, z)) s.set('baseAlt', x, y, z);
        }
      }
    }
    for (let tz = 0; tz < this.grid.depth; tz += 1) {
      for (let tx = 0; tx < this.grid.width; tx += 1) this.floorTile(pattern, riser, tx, tz);
    }
  }

  private floorTile(pattern: FloorPattern<Kind>, riser: Slot, tx: number, tz: number): void {
    const kind = kindAt(this.grid, tx, tz);
    if (kind === undefined) return;
    const [x0, top, z0] = this.tile(tx, tz);
    for (let lz = 0; lz < TILE_VOXELS; lz += 1) {
      for (let lx = 0; lx < TILE_VOXELS; lx += 1) {
        const x = x0 + lx;
        const z = z0 + lz;
        if (top - 1 > BASE - 1) this.sketch.box(riser, [x, BASE - 1, z], [x + 1, top - 1, z + 1]);
        this.sketch.set(pattern(kind, tx, tz, lx, lz), x, top - 1, z);
      }
    }
  }

  /**
   * Cut-away walls along the back (z = 0) and left (x = 0) edges: low band, trim line, upper
   * wall and a light cap where the wall is cut. `height` in voxels above the floor.
   */
  walls(height: number): void {
    const s = this.sketch;
    const [sx, , sz] = this.size;
    const y0 = BASE;
    const low = y0 + Math.max(2, Math.round(height * 0.32));
    const top = y0 + height;
    const back: readonly [Vec3, Vec3] = [
      [OVERHANG, y0, OVERHANG],
      [sx - OVERHANG, top, OVERHANG + WALL],
    ];
    const left: readonly [Vec3, Vec3] = [
      [OVERHANG, y0, OVERHANG],
      [OVERHANG + WALL, top, sz - OVERHANG],
    ];
    for (const [min, max] of [back, left]) {
      s.box('wall', min, max);
      s.paint('wallLow', min, [max[0], low, max[2]]);
      s.paint('trim', [min[0], low, min[2]], [max[0], low + 1, max[2]]);
      s.paint('wallCap', [min[0], top - 1, min[2]], max);
    }
  }

  /**
   * A window in the back wall (`along` = x voxel offset from the left edge) or the left wall
   * (`along` = z offset from the back edge): frame and panes, `width` x `height` voxels from
   * `bottom` voxels above the floor.
   */
  window(
    wall: 'back' | 'left',
    along: number,
    bottom: number,
    width: number,
    height: number,
  ): void {
    const y0 = BASE + bottom;
    const y1 = y0 + height;
    const a0 = OVERHANG + along;
    const a1 = a0 + width;
    const mid = Math.floor((a0 + a1) / 2);
    const s = this.sketch;
    const face = OVERHANG + WALL - 1;
    for (let y = y0; y < y1; y += 1) {
      for (let a = a0; a < a1; a += 1) {
        const frame = y === y0 || y === y1 - 1 || a === a0 || a === a1 - 1 || a === mid;
        const slot: Slot = frame ? 'trim' : 'pane';
        if (wall === 'back') s.box(slot, [a, y, OVERHANG], [a + 1, y + 1, face + 1]);
        else s.box(slot, [OVERHANG, y, a], [face + 1, y + 1, a + 1]);
      }
    }
  }
}

/**
 * Local drawing frame of an object on the canvas: u across the object (left to right as seen
 * from its front), y up, v from its back to its front. Facing 'z': the front faces +z (screen
 * left); facing 'x': the front faces +x (screen right).
 */
export class Stamp {
  constructor(
    private readonly sketch: Sketch<Slot>,
    private readonly at: Vec3,
    /** Footprint [across, deep] in voxels. */
    readonly footprint: readonly [number, number],
    readonly facing: Facing,
  ) {}

  /** Canvas cell of local voxel (u, y, v). */
  cell(u: number, y: number, v: number): Vec3 {
    const [ax, ay, az] = this.at;
    if (this.facing === 'z') return [ax + u, ay + y, az + v];
    return [ax + v, ay + y, az + this.footprint[0] - 1 - u];
  }

  /** Fills the local box [u0, y0, v0]..[u1, y1, v1) (null clears). */
  box(slot: Slot | null, min: Vec3, max: Vec3): this {
    const [a, b] = this.canvasBox(min, max);
    this.sketch.box(slot, a, b);
    return this;
  }

  /** Recolours filled cells of the local box. */
  paint(slot: Slot, min: Vec3, max: Vec3): this {
    const [a, b] = this.canvasBox(min, max);
    this.sketch.paint(slot, a, b);
    return this;
  }

  set(slot: Slot | null, u: number, y: number, v: number): this {
    const [x, cy, z] = this.cell(u, y, v);
    this.sketch.set(slot, x, cy, z);
    return this;
  }

  /** Glow cell on the front face of local voxel (u, y, v). */
  front(u: number, y: number, v: number): GlowCell {
    return { cell: this.cell(u, y, v), face: this.facing };
  }

  /** Local u of the side face the iso camera sees (+x for facing 'z', +z for facing 'x'). */
  visibleSide(): number {
    return this.facing === 'z' ? this.footprint[0] - 1 : 0;
  }

  /** Glow cell on the visible side face of local voxel (u, y, v). */
  side(u: number, y: number, v: number): GlowCell {
    return { cell: this.cell(u, y, v), face: this.facing === 'z' ? 'x' : 'z' };
  }

  /** Glow cell on the top face of local voxel (u, y, v). */
  top(u: number, y: number, v: number): GlowCell {
    return { cell: this.cell(u, y, v), face: 'y' };
  }

  /** Canvas grid point of a local point (for anchors; u/v may be fractional). */
  point(u: number, y: number, v: number): Vec3 {
    const [ax, ay, az] = this.at;
    if (this.facing === 'z') return [ax + u, ay + y, az + v];
    return [ax + v, ay + y, az + this.footprint[0] - u];
  }

  private canvasBox(min: Vec3, max: Vec3): readonly [Vec3, Vec3] {
    const a = this.point(min[0], min[1], min[2]);
    const b = this.point(max[0], max[1], max[2]);
    return [
      [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])],
      [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])],
    ];
  }
}
