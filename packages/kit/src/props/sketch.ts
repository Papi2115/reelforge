/**
 * Sketch: a small mutable voxel canvas for authoring props with named colour slots - boxes,
 * cylinders and hand-drawn character patterns - turned into an immutable VoxelModel. Coordinates
 * are grid cells (x right, y up, z towards the default camera); boxes are min-inclusive and
 * max-exclusive and are clipped to the canvas.
 */
import { KitError } from '../errors.js';
import type { Vec3 } from '../types.js';
import type { VoxelApi } from '../voxel/api.js';
import { voxelGenerate } from '../voxel/grid.js';
import type { VoxelColor, VoxelModel } from '../voxel/model.js';

/** 'xy': a front view at a fixed z (rows top-down); 'xz': a top view at a fixed y (rows back-to-front). */
export type SketchPlane = 'xy' | 'xz';

export class Sketch<Slot extends string> {
  readonly size: Vec3;
  private readonly cells: Uint8Array;
  private readonly slotIndex: ReadonlyMap<string, number>;
  private readonly palette: readonly VoxelColor[];

  constructor(size: Vec3, colors: Readonly<Record<Slot, VoxelColor>>) {
    this.size = [size[0], size[1], size[2]];
    this.cells = new Uint8Array(size[0] * size[1] * size[2]);
    const entries: [string, VoxelColor][] = Object.entries(colors);
    this.palette = entries.map(([, color]) => color);
    this.slotIndex = new Map(entries.map(([slot], index) => [slot, index + 1]));
  }

  private index(x: number, y: number, z: number): number {
    return x + this.size[0] * (y + this.size[1] * z);
  }

  private inside(x: number, y: number, z: number): boolean {
    const [sx, sy, sz] = this.size;
    return x >= 0 && y >= 0 && z >= 0 && x < sx && y < sy && z < sz;
  }

  private value(slot: Slot | null): number {
    if (slot === null) return 0;
    const value = this.slotIndex.get(slot);
    if (value === undefined) throw new KitError('invalid-model', `sketch: unknown slot "${slot}"`);
    return value;
  }

  /** Sets one cell (null clears it); cells outside the canvas are ignored. */
  set(slot: Slot | null, x: number, y: number, z: number): this {
    if (this.inside(x, y, z)) this.cells[this.index(x, y, z)] = this.value(slot);
    return this;
  }

  filled(x: number, y: number, z: number): boolean {
    return this.inside(x, y, z) && this.cells[this.index(x, y, z)] !== 0;
  }

  /** Fills (or with null clears) the box min..max. */
  box(slot: Slot | null, min: Vec3, max: Vec3): this {
    const value = this.value(slot);
    this.forBox(min, max, (index) => {
      this.cells[index] = value;
    });
    return this;
  }

  /** Recolours the filled cells of the box min..max (surface details: labels, stripes, seams). */
  paint(slot: Slot, min: Vec3, max: Vec3): this {
    const value = this.value(slot);
    this.forBox(min, max, (index) => {
      if (this.cells[index] !== 0) this.cells[index] = value;
    });
    return this;
  }

  /** Vertical cylinder: cells whose centre is within `radius` of (cx, cz), layers y0..y1. */
  cylinderY(
    slot: Slot | null,
    center: readonly [number, number],
    radius: number,
    y0: number,
    y1: number,
  ): this {
    const [cx, cz] = center;
    for (let z = Math.floor(cz - radius); z <= Math.ceil(cz + radius); z += 1) {
      for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x += 1) {
        if (Math.hypot(x + 0.5 - cx, z + 0.5 - cz) > radius) continue;
        this.box(slot, [x, y0, z], [x + 1, y1, z + 1]);
      }
    }
    return this;
  }

  /** Cylinder along z (a disc facing the camera): centre (cx, cy), slices z0..z1. */
  cylinderZ(
    slot: Slot | null,
    center: readonly [number, number],
    radius: number,
    z0: number,
    z1: number,
  ): this {
    const [cx, cy] = center;
    for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y += 1) {
      for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x += 1) {
        if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) > radius) continue;
        this.box(slot, [x, y, z0], [x + 1, y + 1, z1]);
      }
    }
    return this;
  }

  /** Cylinder along x (a wheel seen from the side): centre (cz, cy), slices x0..x1. */
  cylinderX(
    slot: Slot | null,
    center: readonly [number, number],
    radius: number,
    x0: number,
    x1: number,
  ): this {
    const [cz, cy] = center;
    for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y += 1) {
      for (let z = Math.floor(cz - radius); z <= Math.ceil(cz + radius); z += 1) {
        if (Math.hypot(z + 0.5 - cz, y + 0.5 - cy) > radius) continue;
        this.box(slot, [x0, y, z], [x1, y + 1, z + 1]);
      }
    }
    return this;
  }

  /**
   * Hand-drawn character pattern ('.' and ' ' are skipped). Plane 'xy': rows top-down, the last
   * row at y = origin y, at z = origin z. Plane 'xz': rows from z = origin z forwards, at y.
   */
  pattern(
    rows: readonly string[],
    key: Readonly<Record<string, Slot | null>>,
    plane: SketchPlane,
    origin: Vec3,
  ): this {
    const [ox, oy, oz] = origin;
    rows.forEach((row, rowIndex) => {
      Array.from(row).forEach((char, column) => {
        if (char === '.' || char === ' ') return;
        if (!(char in key)) {
          throw new KitError('invalid-model', `sketch.pattern: "${char}" is not in the key`);
        }
        const slot = key[char] ?? null;
        if (plane === 'xy') this.set(slot, ox + column, oy + rows.length - 1 - rowIndex, oz);
        else this.set(slot, ox + column, oy, oz + rowIndex);
      });
    });
    return this;
  }

  /** The immutable model (validated by kit.voxel.generate). */
  model(voxel: Pick<VoxelApi, 'generate'> = { generate: voxelGenerate }): VoxelModel {
    return voxel.generate(
      this.size,
      (x, y, z) => this.cells[this.index(x, y, z)] ?? 0,
      this.palette,
    );
  }

  private forBox(min: Vec3, max: Vec3, visit: (index: number) => void): void {
    const [sx, sy, sz] = this.size;
    for (let z = Math.max(0, min[2]); z < Math.min(sz, max[2]); z += 1) {
      for (let y = Math.max(0, min[1]); y < Math.min(sy, max[1]); y += 1) {
        for (let x = Math.max(0, min[0]); x < Math.min(sx, max[0]); x += 1) {
          visit(this.index(x, y, z));
        }
      }
    }
  }
}
