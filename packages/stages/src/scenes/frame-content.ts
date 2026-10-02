/**
 * "Is anything on screen?" for pixel-art frames. Counting colours is not enough: the style
 * dithers (Bayer 4×4/8×8) and adds scanlines/vignette, so an empty background has several
 * colours in a fine pattern. Averaging 8×8 blocks (one dither period) removes the pattern; the
 * content share is the fraction of blocks that differ clearly from the median block colour.
 */
import type { RgbaImage } from '@reelforge/engine/raster';

/** Block size in pixels (the Bayer 8×8 period). */
export const CONTENT_BLOCK = 8;
/** A block counts as content when a channel of its average differs this much from the median. */
export const CONTENT_DELTA = 24;

function median(values: number[]): number {
  values.sort((first, second) => first - second);
  return values[Math.floor(values.length / 2)] ?? 0;
}

/** Average RGB of every full block, row-major. */
function blockAverages(image: RgbaImage): [number, number, number][] {
  const columns = Math.floor(image.width / CONTENT_BLOCK);
  const rows = Math.floor(image.height / CONTENT_BLOCK);
  const blocks: [number, number, number][] = [];
  const area = CONTENT_BLOCK * CONTENT_BLOCK;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const sum: [number, number, number] = [0, 0, 0];
      for (let y = 0; y < CONTENT_BLOCK; y += 1) {
        const offset = ((row * CONTENT_BLOCK + y) * image.width + column * CONTENT_BLOCK) * 4;
        for (let x = 0; x < CONTENT_BLOCK; x += 1) {
          sum[0] += image.data[offset + x * 4] ?? 0;
          sum[1] += image.data[offset + x * 4 + 1] ?? 0;
          sum[2] += image.data[offset + x * 4 + 2] ?? 0;
        }
      }
      blocks.push([sum[0] / area, sum[1] / area, sum[2] / area]);
    }
  }
  return blocks;
}

/** Share (0..1) of the frame that stands out from its background. */
export function contentShare(image: RgbaImage): number {
  const blocks = blockAverages(image);
  if (blocks.length === 0) return 0;
  const background = [0, 1, 2].map((channel) => median(blocks.map((block) => block[channel] ?? 0)));
  const content = blocks.filter((block) =>
    block.some((value, channel) => Math.abs(value - (background[channel] ?? 0)) > CONTENT_DELTA),
  ).length;
  return content / blocks.length;
}
