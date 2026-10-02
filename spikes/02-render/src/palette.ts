/**
 * "Voxel Pixel - Crisp 640" spike palette and ordered-dither constants.
 * The GPU post pass (post.ts) and the CPU reference below use the same math so the
 * CPU version can serve as a unit-testable specification of the shader.
 */
export const SPIKE_PALETTE_HEX: readonly string[] = [
  '#05060f', // near black
  '#0b0f2a', // deep navy
  '#1a1446', // indigo
  '#2d1b69', // purple
  '#5b2a86', // violet
  '#b0279b', // magenta
  '#ff3cac', // neon pink
  '#12355b', // slate blue
  '#1f6f8b', // teal
  '#2ec4b6', // bright teal
  '#7fe39a', // green
  '#ff8c42', // orange
  '#ffb26b', // light orange
  '#f4e9d8', // cream
  '#8a93a6', // slate grey
  '#3c4256', // dark slate
];

/** 4x4 Bayer matrix, row-major, values 0..15. */
export const BAYER_4X4: readonly number[] = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** Strength of the dither offset in normalized color units (0..1). */
export const DITHER_SPREAD = 0.12;

export type Rgb = readonly [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (match?.[1] === undefined || match[2] === undefined || match[3] === undefined) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  return [parseInt(match[1], 16) / 255, parseInt(match[2], 16) / 255, parseInt(match[3], 16) / 255];
}

export function paletteRgb(hexList: readonly string[] = SPIKE_PALETTE_HEX): Rgb[] {
  return hexList.map(hexToRgb);
}

/** Bayer threshold in [-0.5, 0.5) for pixel (x, y). */
export function bayerOffset(x: number, y: number): number {
  const index = (y % 4) * 4 + (x % 4);
  const value = BAYER_4X4[index] ?? 0;
  return (value + 0.5) / 16 - 0.5;
}

const LUMA_WEIGHTS: Rgb = [0.3, 0.59, 0.11];

/** Index of the palette color closest to `color` (luma-weighted squared distance). */
export function nearestPaletteIndex(color: Rgb, palette: readonly Rgb[]): number {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  palette.forEach((entry, index) => {
    const dr = color[0] - entry[0];
    const dg = color[1] - entry[1];
    const db = color[2] - entry[2];
    const distance =
      LUMA_WEIGHTS[0] * dr * dr + LUMA_WEIGHTS[1] * dg * dg + LUMA_WEIGHTS[2] * db * db;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
}

/** CPU reference of the shader: ordered dither then palette snap. */
export function ditherQuantize(color: Rgb, x: number, y: number, palette: readonly Rgb[]): number {
  const offset = bayerOffset(x, y) * DITHER_SPREAD;
  const shifted: Rgb = [color[0] + offset, color[1] + offset, color[2] + offset];
  return nearestPaletteIndex(shifted, palette);
}
