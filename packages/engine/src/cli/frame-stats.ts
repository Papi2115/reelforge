/** Cheap "is this frame blank?" statistics and pixel diffs for RGBA8 buffers. */
import type { RgbaImage } from './png.js';

export interface FrameStats {
  readonly pixels: number;
  readonly uniqueColors: number;
  /** Fraction of pixels equal to the most common colour (1 = uniform frame). */
  readonly dominantColorShare: number;
}

export function computeFrameStats(data: Uint8Array): FrameStats {
  const pixels = Math.floor(data.length / 4);
  const counts = new Map<number, number>();
  for (let offset = 0; offset + 4 <= data.length; offset += 4) {
    const key =
      ((data[offset] ?? 0) << 16) | ((data[offset + 1] ?? 0) << 8) | (data[offset + 2] ?? 0);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let dominant = 0;
  for (const count of counts.values()) dominant = Math.max(dominant, count);
  return { pixels, uniqueColors: counts.size, dominantColorShare: dominant / Math.max(pixels, 1) };
}

function assertSameSize(first: Uint8Array, second: Uint8Array): void {
  if (first.length !== second.length) {
    throw new RangeError(`size mismatch: ${String(first.length)} vs ${String(second.length)}`);
  }
}

/** Largest absolute RGBA channel difference of the pixel at byte `offset`. */
function maxChannelDelta(first: Uint8Array, second: Uint8Array, offset: number): number {
  let delta = 0;
  for (let channel = 0; channel < 4; channel += 1) {
    const difference = Math.abs((first[offset + channel] ?? 0) - (second[offset + channel] ?? 0));
    if (difference > delta) delta = difference;
  }
  return delta;
}

/**
 * Number of pixels whose RGBA differs between two equally sized buffers by more than
 * `channelTolerance` (0..255) in at least one channel.
 */
export function countDifferingPixels(
  first: Uint8Array,
  second: Uint8Array,
  channelTolerance = 0,
): number {
  assertSameSize(first, second);
  let differing = 0;
  for (let offset = 0; offset < first.length; offset += 4) {
    if (maxChannelDelta(first, second, offset) > channelTolerance) differing += 1;
  }
  return differing;
}

/**
 * Visual diff: differing pixels in opaque red, matching pixels as a dimmed greyscale of
 * `expected` so the location of the change is easy to see.
 */
export function diffImage(expected: RgbaImage, actual: RgbaImage, channelTolerance = 0): RgbaImage {
  assertSameSize(expected.data, actual.data);
  const data = new Uint8Array(expected.data.length);
  for (let offset = 0; offset < data.length; offset += 4) {
    if (maxChannelDelta(expected.data, actual.data, offset) > channelTolerance) {
      data.set([255, 0, 0, 255], offset);
      continue;
    }
    const luma =
      0.299 * (expected.data[offset] ?? 0) +
      0.587 * (expected.data[offset + 1] ?? 0) +
      0.114 * (expected.data[offset + 2] ?? 0);
    const dimmed = Math.round(luma * 0.35);
    data.set([dimmed, dimmed, dimmed, 255], offset);
  }
  return { width: expected.width, height: expected.height, data };
}
