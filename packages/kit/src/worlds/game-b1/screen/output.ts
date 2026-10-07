/**
 * Presents the 640x360 index frame of the Game B1 world as a full-frame quad: palette indices ->
 * the style's colours, scaled nearest-neighbour to the shot size. The engine's post pass then
 * maps the exact palette colours onto themselves.
 */
import { emptyBounds } from '../../../env/shared.js';
import { hexPixel, Raster } from '../../../looks/blueprint/raster.js';
import { createQuad } from '../../../looks/whiteboard/quad.js';
import { createKitObject, type KitObject } from '../../../object.js';
import type { KitTools } from '../../../registry.js';
import { B1_TABLE } from '../palette.js';
import { SCREEN_H, SCREEN_W } from './model.js';

export interface Output {
  readonly object: KitObject;
  present(frame: Uint8Array): void;
}

export function createOutput(
  tools: KitTools,
  size: readonly [number, number],
  layer: number,
): Output {
  const [width, height] = size;
  const raster = new Raster(width, height);
  const pixels = new Uint32Array(raster.data.buffer);
  const colors = new Uint32Array(256);
  B1_TABLE.forEach(([, swatch, hex], index) => {
    colors[index] = hexPixel(tools.palette[swatch] ?? hex);
  });
  const xs = Int32Array.from({ length: width }, (_, x) => Math.floor((x * SCREEN_W) / width));
  const ys = Int32Array.from({ length: height }, (_, y) => Math.floor((y * SCREEN_H) / height));
  const native = width === SCREEN_W && height === SCREEN_H;
  const { mesh, texture } = createQuad(tools, raster, { region: [0, 0, 1, 1], layer });
  mesh.name = 'b1Screen';
  const object = createKitObject(tools.three, { kitType: 'b1Screen', bounds: emptyBounds(tools) });
  object.add(mesh);
  return {
    object,
    present(frame) {
      if (native) {
        for (let i = 0; i < frame.length; i += 1) pixels[i] = colors[frame[i] ?? 0] ?? 0;
      } else {
        for (let y = 0; y < height; y += 1) {
          const row = (ys[y] ?? 0) * SCREEN_W;
          for (let x = 0; x < width; x += 1)
            pixels[y * width + x] = colors[frame[row + (xs[x] ?? 0)] ?? 0] ?? 0;
        }
      }
      texture.needsUpdate = true;
    },
  };
}
