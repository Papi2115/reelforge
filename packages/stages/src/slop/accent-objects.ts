/**
 * Accent share of the OBJECTS in a frame (PLAN.md#14.18, real run Grim Ink 1: "accent colour on
 * 23 % / 48 % / 37 %" on arena shots whose sand is the world's mustard accent). A world whose
 * places paint their ground and set in the accent's colour (Grim Ink: mustard sand, ochre walls)
 * counts only accent pixels of regions that do NOT reach the frame's border: a place reaches past
 * every frame edge (world rule), an accent object sits inside the frame. Measured on the pixels,
 * 4-connected, with the same colour tolerance as the plain accent share.
 */
import type { RgbaImage } from '@reelforge/engine/raster';
import { ACCENT_TOLERANCE } from './frame-guards.js';

function accentMask(image: RgbaImage, accent: readonly [number, number, number]): Uint8Array {
  const pixels = image.width * image.height;
  const mask = new Uint8Array(pixels);
  for (let index = 0; index < pixels; index += 1) {
    const offset = index * 4;
    const distance =
      Math.abs((image.data[offset] ?? 0) - accent[0]) +
      Math.abs((image.data[offset + 1] ?? 0) - accent[1]) +
      Math.abs((image.data[offset + 2] ?? 0) - accent[2]);
    if (distance <= ACCENT_TOLERANCE) mask[index] = 1;
  }
  return mask;
}

/** Clears every accent region that touches the border (flood fill from the edges). */
function clearBorderRegions(mask: Uint8Array, width: number, height: number): void {
  const stack: number[] = [];
  const seed = (index: number): void => {
    if (mask[index] === 1) {
      mask[index] = 0;
      stack.push(index);
    }
  };
  for (let x = 0; x < width; x += 1) {
    seed(x);
    seed((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    seed(y * width);
    seed(y * width + width - 1);
  }
  for (let index = stack.pop(); index !== undefined; index = stack.pop()) {
    const x = index % width;
    if (x > 0) seed(index - 1);
    if (x < width - 1) seed(index + 1);
    if (index >= width) seed(index - width);
    if (index < (height - 1) * width) seed(index + width);
  }
}

/** Share of the frame's pixels in the accent colour inside regions that stay off the border. */
export function accentObjectShare(
  image: RgbaImage,
  accent: readonly [number, number, number] | undefined,
): number {
  const pixels = image.width * image.height;
  if (accent === undefined || pixels === 0) return 0;
  const mask = accentMask(image, accent);
  clearBorderRegions(mask, image.width, image.height);
  let hits = 0;
  for (const value of mask) hits += value;
  return hits / pixels;
}
