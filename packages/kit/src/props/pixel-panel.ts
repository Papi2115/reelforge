/**
 * Pixel panels: flat grids of unlit, palette-coloured quads (one quad per pixel) for screens and
 * status LEDs. Colours are palette names resolved like glow voxels, so a panel always shows exact
 * style colours; `paint()` rewrites the vertex colours (cheap: a few thousand quads at most).
 * Quads face +z in panel space; the owner positions/rotates the mesh.
 */
import type * as THREE from 'three';
import { shadeColors } from '../context.js';
import { KitError } from '../errors.js';
import type { KitTools } from '../registry.js';
import type { VoxelColor } from '../voxel/model.js';

export interface PixelPanelSpec {
  /** Pixel cells [x, y] (x right, y up) in pixel units. */
  readonly cells: readonly (readonly [number, number])[];
  /** World size of one pixel. */
  readonly pixelSize: number;
  /** Colours a pixel can take (index = colour number in paint()). */
  readonly colors: readonly VoxelColor[];
  /** Added to every cell before scaling (e.g. [-w/2, -h/2] centres a screen). */
  readonly offset?: readonly [number, number] | undefined;
  readonly name: string;
}

export interface PixelPanel {
  readonly mesh: THREE.Mesh;
  readonly count: number;
  /** Colour number per cell (cells order); values outside the colour list throw. */
  paint(colors: ArrayLike<number>): void;
}

const VERTICES_PER_QUAD = 4;

export function createPixelPanel(tools: KitTools, spec: PixelPanelSpec): PixelPanel {
  const { three } = tools;
  const count = spec.cells.length;
  const [ox, oy] = spec.offset ?? [0, 0];
  const size = spec.pixelSize;
  const positions = new Float32Array(count * VERTICES_PER_QUAD * 3);
  const indices = new Uint32Array(count * 6);
  spec.cells.forEach(([cx, cy], cell) => {
    const x0 = (cx + ox) * size;
    const y0 = (cy + oy) * size;
    const corners = [x0, y0, x0 + size, y0, x0 + size, y0 + size, x0, y0 + size];
    for (let corner = 0; corner < VERTICES_PER_QUAD; corner += 1) {
      const base = (cell * VERTICES_PER_QUAD + corner) * 3;
      positions[base] = corners[corner * 2] ?? 0;
      positions[base + 1] = corners[corner * 2 + 1] ?? 0;
    }
    const first = cell * VERTICES_PER_QUAD;
    // Counter-clockwise seen from +z: the quad faces +z.
    indices.set([first, first + 1, first + 2, first, first + 2, first + 3], cell * 6);
  });
  const colorData = new Float32Array(count * VERTICES_PER_QUAD * 3);
  const geometry = tools.track(new three.BufferGeometry());
  geometry.setAttribute('position', new three.BufferAttribute(positions, 3));
  const colorAttribute = new three.BufferAttribute(colorData, 3);
  geometry.setAttribute('color', colorAttribute);
  geometry.setIndex(new three.BufferAttribute(indices, 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const mesh = new three.Mesh(geometry, tools.materials().glow);
  mesh.name = spec.name;
  const shades = shadeColors(three, tools.palette, spec.colors);
  return {
    mesh,
    count,
    paint(colors) {
      if (colors.length !== count) {
        throw new KitError(
          'invalid-params',
          `${spec.name}: paint() needs ${String(count)} colours`,
        );
      }
      for (let cell = 0; cell < count; cell += 1) {
        const shade = shades[colors[cell] ?? -1];
        if (!shade) {
          throw new KitError('invalid-params', `${spec.name}: no colour ${String(colors[cell])}`);
        }
        for (let corner = 0; corner < VERTICES_PER_QUAD; corner += 1) {
          colorData.set(shade.rgb, (cell * VERTICES_PER_QUAD + corner) * 3);
        }
      }
      colorAttribute.needsUpdate = true;
    },
  };
}
