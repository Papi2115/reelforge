/**
 * Presents a 640x360 index buffer of the Game B2 world as a full-frame quad: palette indices ->
 * the style's colours (index 255 = transparent, so the HUD can sit on top of the view), scaled
 * nearest-neighbour to the shot size. The engine's post pass then maps the exact palette colours
 * onto themselves.
 */
import { emptyBounds } from '../../../env/shared.js';
import { hexPixel, Raster } from '../../../looks/blueprint/raster.js';
import { createQuad } from '../../../looks/whiteboard/quad.js';
import { createKitObject, type KitObject } from '../../../object.js';
import type { KitTools } from '../../../registry.js';
import { B2_TABLE, T } from '../palette.js';

/** The world's native screen (HUD coordinates); the 3D view is 320x180 doubled. */
export const SCREEN_W = 640;
export const SCREEN_H = 360;

export interface Output {
  readonly object: KitObject;
  /** Writes the index screen (SCREEN_W x SCREEN_H) to the quad. */
  present(screen: Uint8Array): void;
}

function colorTable(tools: KitTools): Uint32Array {
  const table = new Uint32Array(256);
  B2_TABLE.forEach(([, swatch, hex], index) => {
    table[index] = hexPixel(tools.palette[swatch] ?? hex);
  });
  table[T] = 0;
  return table;
}

export function createOutput(
  tools: KitTools,
  size: readonly [number, number],
  layer: number,
  kitType: string,
): Output {
  const [width, height] = size;
  const raster = new Raster(width, height);
  const pixels = new Uint32Array(raster.data.buffer);
  const colors = colorTable(tools);
  const xs = Int32Array.from({ length: width }, (_, x) => Math.floor((x * SCREEN_W) / width));
  const ys = Int32Array.from({ length: height }, (_, y) => Math.floor((y * SCREEN_H) / height));
  const native = width === SCREEN_W && height === SCREEN_H;
  const { mesh, texture } = createQuad(tools, raster, { region: [0, 0, 1, 1], layer });
  mesh.name = kitType;
  const object = createKitObject(tools.three, { kitType, bounds: emptyBounds(tools) });
  object.add(mesh);
  return {
    object,
    present(screen) {
      if (native) {
        for (let i = 0; i < screen.length; i += 1) pixels[i] = colors[screen[i] ?? 0] ?? 0;
      } else {
        for (let y = 0; y < height; y += 1) {
          const row = (ys[y] ?? 0) * SCREEN_W;
          for (let x = 0; x < width; x += 1)
            pixels[y * width + x] = colors[screen[row + (xs[x] ?? 0)] ?? 0] ?? 0;
        }
      }
      texture.needsUpdate = true;
    },
  };
}
