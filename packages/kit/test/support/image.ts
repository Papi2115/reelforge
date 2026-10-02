/** Integer downscaling of RGBA frames (contact sheets, catalog thumbnails). */
import type { RgbaImage } from '../../../engine/src/cli/index.js';

/**
 * Shrinks `image` by an integer `factor`: 'nearest' keeps exact palette colours (goldens),
 * 'box' averages each factor x factor block (legible small thumbnails).
 */
export function downscale(image: RgbaImage, factor: number, mode: 'nearest' | 'box'): RgbaImage {
  const width = Math.floor(image.width / factor);
  const height = Math.floor(image.height / factor);
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const target = (y * width + x) * 4;
      if (mode === 'nearest') {
        const source = (y * factor * image.width + x * factor) * 4;
        data.set(image.data.subarray(source, source + 4), target);
        continue;
      }
      for (let channel = 0; channel < 4; channel += 1) {
        let sum = 0;
        for (let dy = 0; dy < factor; dy += 1) {
          for (let dx = 0; dx < factor; dx += 1) {
            sum +=
              image.data[((y * factor + dy) * image.width + x * factor + dx) * 4 + channel] ?? 0;
          }
        }
        data[target + channel] = Math.round(sum / (factor * factor));
      }
    }
  }
  return { width, height, data };
}

/** Resizes `image` to width x height by nearest sampling (keeps exact palette colours). */
export function resizeNearest(image: RgbaImage, width: number, height: number): RgbaImage {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.floor(((y + 0.5) * image.height) / height);
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.floor(((x + 0.5) * image.width) / width);
      const source = (sourceY * image.width + sourceX) * 4;
      data.set(image.data.subarray(source, source + 4), (y * width + x) * 4);
    }
  }
  return { width, height, data };
}

/** Hex colours (`#rrggbb`) of the pixels of `image` that are not in `allowed`, at most `limit`. */
export function foreignColors(image: RgbaImage, allowed: readonly string[], limit = 8): string[] {
  const palette = new Set(allowed.map((hex) => Number.parseInt(hex.slice(1), 16)));
  const foreign = new Set<number>();
  for (let offset = 0; offset < image.data.length && foreign.size < limit; offset += 4) {
    const key =
      ((image.data[offset] ?? 0) << 16) |
      ((image.data[offset + 1] ?? 0) << 8) |
      (image.data[offset + 2] ?? 0);
    if (!palette.has(key)) foreign.add(key);
  }
  return [...foreign].map((key) => `#${key.toString(16).padStart(6, '0')}`);
}
