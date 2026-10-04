/**
 * Test fixture: a stand-in for an engine asset handle (`ctx.assets.image()`), so kit unit tests
 * can build asset props without the engine. Pixels are a deterministic diagonal ramp over the
 * colours asked for; luminance is a horizontal ramp.
 */
import type { AssetImage, AssetPixels } from '../assets/handle.js';

const DEFAULT_COLORS = ['#05060f', '#2d1b69', '#ff3cac', '#ffb26b', '#f4e9d8'];

function hexBytes(hex: string): readonly [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function fakeAsset(aspect = 4 / 3, ref = 'test-card'): AssetImage {
  return {
    kind: 'asset-image',
    id: ref.split('@')[0] ?? ref,
    ref,
    aspect,
    crop: 'cover',
    key: `fake:${ref}`,
    pixels(width, height, options = {}): AssetPixels {
      const colors = [...(options.colors ?? DEFAULT_COLORS)];
      const indices = new Uint8Array(width * height);
      const rgba = new Uint8Array(width * height * 4);
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const index = Math.floor(((x + y) * colors.length) / (width + height)) % colors.length;
          indices[y * width + x] = index;
          rgba.set([...hexBytes(colors[index] ?? '#000000'), 255], (y * width + x) * 4);
        }
      }
      return { width, height, colors, indices, rgba };
    },
    luminance(width, height) {
      return Uint8Array.from({ length: width * height }, (_, pixel) =>
        Math.floor(((pixel % width) * 255) / Math.max(1, width - 1)),
      );
    },
  };
}
