/** Cheap "is this frame blank?" statistics for packed 8-bit RGB/RGBA buffers. */
export interface FrameStats {
  readonly pixels: number;
  readonly uniqueColors: number;
  /** Mean of R, G, B over all pixels (0..255). */
  readonly meanRgb: readonly [number, number, number];
  /** Fraction of pixels equal to the most common color (1 = uniform frame). */
  readonly dominantColorShare: number;
}

export function computeFrameStats(data: Uint8Array, channels: 3 | 4): FrameStats {
  const pixels = Math.floor(data.length / channels);
  const counts = new Map<number, number>();
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  for (let offset = 0; offset + channels <= data.length; offset += channels) {
    const r = data[offset] ?? 0;
    const g = data[offset + 1] ?? 0;
    const b = data[offset + 2] ?? 0;
    sumR += r;
    sumG += g;
    sumB += b;
    const key = (r << 16) | (g << 8) | b;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let dominant = 0;
  for (const count of counts.values()) dominant = Math.max(dominant, count);
  const safePixels = Math.max(pixels, 1);
  return {
    pixels,
    uniqueColors: counts.size,
    meanRgb: [sumR / safePixels, sumG / safePixels, sumB / safePixels],
    dominantColorShare: dominant / safePixels,
  };
}

/** Number of pixels whose RGBA differs between two equally sized buffers. */
export function countDifferingPixels(a: Uint8Array, b: Uint8Array): number {
  if (a.length !== b.length)
    throw new Error(`Size mismatch: ${String(a.length)} vs ${String(b.length)}`);
  let differing = 0;
  for (let offset = 0; offset < a.length; offset += 4) {
    if (
      a[offset] !== b[offset] ||
      a[offset + 1] !== b[offset + 1] ||
      a[offset + 2] !== b[offset + 2] ||
      a[offset + 3] !== b[offset + 3]
    ) {
      differing += 1;
    }
  }
  return differing;
}
