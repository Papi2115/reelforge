/**
 * Glow quads: unlit, palette-coloured squares laid on voxel faces of the diorama canvas (LEDs,
 * screens, windows, lamps). `paint()` sets each quad's colour number, so the lights animate as a
 * pure function of t without remeshing. A quad floats a hair above its face (no z-fighting).
 */
import type * as THREE from 'three';
import { shadeColors } from '../../context.js';
import { KitError } from '../../errors.js';
import type { KitTools } from '../../registry.js';
import type { KitPalette, Vec3 } from '../../types.js';
import type { VoxelColor } from '../../voxel/model.js';
import type { GlowCell } from './canvas.js';
import type { GlowLayer } from './diorama.js';
import { tone, type ChainName } from './tones.js';

/** Lift of a quad above its voxel face, in voxels. */
const LIFT = 0.06;
const CORNERS = 4;

export interface GlowQuads {
  readonly mesh: THREE.Mesh;
  readonly count: number;
  /** Colour number per quad (cells order). */
  paint(colors: ArrayLike<number>): void;
}

/** Corners of a face quad in grid coordinates, counter-clockwise seen from outside. */
export function faceCorners({ cell, face }: GlowCell): readonly Vec3[] {
  const [x, y, z] = cell;
  if (face === 'z') {
    const zf = z + 1 + LIFT;
    return [
      [x, y, zf],
      [x + 1, y, zf],
      [x + 1, y + 1, zf],
      [x, y + 1, zf],
    ];
  }
  if (face === 'x') {
    const xf = x + 1 + LIFT;
    return [
      [xf, y, z + 1],
      [xf, y, z],
      [xf, y + 1, z],
      [xf, y + 1, z + 1],
    ];
  }
  const yf = y + 1 + LIFT;
  return [
    [x, yf, z + 1],
    [x + 1, yf, z + 1],
    [x + 1, yf, z],
    [x, yf, z],
  ];
}

/** Colour numbers of glow quads (see glowColors). */
export const GLOW = { off: 0, accent: 1, green: 2, amber: 3, red: 4, white: 5, dim: 6 } as const;

/** Glow colours in GLOW order: off is the darkest swatch, the rest are unlit palette colours. */
export function glowColors(palette: KitPalette, accent: string): VoxelColor[] {
  const lit = (name: ChainName): VoxelColor => ({ color: tone(palette, name), glow: true });
  return [
    lit('black'),
    { color: accent, glow: true },
    lit('green'),
    lit('lightOrange'),
    lit('pink'),
    lit('cream'),
    lit('teal'),
  ];
}

/** Colour number of cell `index` of a group at time t. */
export type GlowBehaviour = (t: number, index: number) => number;

/** Collects glow cells in groups, each with its own behaviour, into one glow layer. */
export class GlowBuilder {
  private readonly cells: GlowCell[] = [];
  private readonly groups: { start: number; count: number; behaviour: GlowBehaviour }[] = [];

  add(cells: readonly GlowCell[], behaviour: GlowBehaviour): this {
    this.groups.push({ start: this.cells.length, count: cells.length, behaviour });
    this.cells.push(...cells);
    return this;
  }

  layer(colors: readonly VoxelColor[]): GlowLayer {
    const groups = [...this.groups];
    return {
      cells: [...this.cells],
      colors,
      pose(t, out) {
        for (const group of groups) {
          for (let index = 0; index < group.count; index += 1) {
            out[group.start + index] = group.behaviour(t, index);
          }
        }
      },
    };
  }
}

export function createGlowQuads(
  tools: KitTools,
  name: string,
  cells: readonly GlowCell[],
  colors: readonly VoxelColor[],
  toLocal: (point: Vec3) => Vec3,
): GlowQuads {
  const { three } = tools;
  const count = cells.length;
  const positions = new Float32Array(count * CORNERS * 3);
  const indices = new Uint32Array(count * 6);
  cells.forEach((cell, index) => {
    faceCorners(cell).forEach((corner, at) => {
      positions.set(toLocal(corner), (index * CORNERS + at) * 3);
    });
    const first = index * CORNERS;
    indices.set([first, first + 1, first + 2, first, first + 2, first + 3], index * 6);
  });
  const colorData = new Float32Array(count * CORNERS * 3);
  const geometry = tools.track(new three.BufferGeometry());
  geometry.setAttribute('position', new three.BufferAttribute(positions, 3));
  const colorAttribute = new three.BufferAttribute(colorData, 3);
  geometry.setAttribute('color', colorAttribute);
  geometry.setIndex(new three.BufferAttribute(indices, 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const mesh = new three.Mesh(geometry, tools.materials().glow);
  mesh.name = name;
  const shades = shadeColors(three, tools.palette, colors);
  return {
    mesh,
    count,
    paint(values) {
      if (values.length !== count) {
        throw new KitError('invalid-params', `${name}: paint() needs ${String(count)} colours`);
      }
      for (let index = 0; index < count; index += 1) {
        const shade = shades[values[index] ?? -1];
        if (!shade) {
          throw new KitError('invalid-params', `${name}: no colour ${String(values[index])}`);
        }
        for (let corner = 0; corner < CORNERS; corner += 1) {
          colorData.set(shade.rgb, (index * CORNERS + corner) * 3);
        }
      }
      colorAttribute.needsUpdate = true;
    },
  };
}
