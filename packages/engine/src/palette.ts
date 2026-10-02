/**
 * Palette quantization and ordered-dither math. The GPU post pass (gl/post-shader.ts) samples the
 * same lookup table and uses the same Bayer matrices, so the CPU functions below are the
 * unit-tested specification of the shader's final step.
 */
import type { NamedPalette } from '@reelforge/shared';

export type Rgb = readonly [number, number, number];

/** Supported ordered-dither matrix sizes. */
export type BayerSize = 2 | 4 | 8;

/** Bayer matrix of size n (row-major, values 0..n*n-1), built recursively from the 2x2 one. */
export function bayerMatrix(size: BayerSize): number[] {
  let matrix = [0];
  for (let n = 1; n < size; n *= 2) {
    const next = new Array<number>(4 * n * n);
    const quadrants = [0, 2, 3, 1]; // top-left, top-right, bottom-left, bottom-right
    for (let y = 0; y < n; y += 1) {
      for (let x = 0; x < n; x += 1) {
        const base = 4 * (matrix[y * n + x] ?? 0);
        quadrants.forEach((offset, quadrant) => {
          const qx = x + (quadrant % 2) * n;
          const qy = y + Math.floor(quadrant / 2) * n;
          next[qy * 2 * n + qx] = base + offset;
        });
      }
    }
    matrix = next;
  }
  return matrix;
}

/** 4x4 Bayer matrix, row-major, values 0..15. */
export const BAYER_4X4: readonly number[] = Object.freeze(bayerMatrix(4));

/** Luma weights of the palette distance metric. */
export const LUMA_WEIGHTS: Rgb = [0.3, 0.59, 0.11];

/** Levels per channel of the palette lookup table (64^3 entries). */
export const LUT_LEVELS = 64;

export function hexToRgb(hex: string): Rgb {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (match?.[1] === undefined || match[2] === undefined || match[3] === undefined) {
    throw new Error(`Invalid hex colour: ${hex}`);
  }
  return [parseInt(match[1], 16) / 255, parseInt(match[2], 16) / 255, parseInt(match[3], 16) / 255];
}

/** Palette colours in declaration order, normalized to 0..1. */
export function paletteRgb(palette: Readonly<NamedPalette>): Rgb[] {
  return Object.values(palette).map(hexToRgb);
}

/** Bayer threshold in [-0.5, 0.5) for pixel (x, y). */
export function bayerOffset(x: number, y: number, size: BayerSize = 4): number {
  const matrix = size === 4 ? BAYER_4X4 : bayerMatrix(size);
  const value = matrix[(y % size) * size + (x % size)] ?? 0;
  return (value + 0.5) / (size * size) - 0.5;
}

/** Index of the palette colour closest to `color` (luma-weighted squared distance). */
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

/**
 * Palette lookup table: for every cell of a LUT_LEVELS^3 RGB grid, the index of the nearest palette
 * colour to the cell centre. Layout: index = (b * levels + g) * levels + r (a 3D texture's layout).
 */
export interface PaletteLut {
  readonly levels: number;
  readonly palette: readonly Rgb[];
  readonly indices: Uint8Array;
}

export function buildPaletteLut(palette: readonly Rgb[], levels = LUT_LEVELS): PaletteLut {
  if (palette.length === 0 || palette.length > 256) {
    throw new RangeError(`palette needs 1..256 colours, got ${String(palette.length)}`);
  }
  const indices = new Uint8Array(levels * levels * levels);
  const centre = (level: number): number => (level + 0.5) / levels;
  for (let b = 0; b < levels; b += 1) {
    for (let g = 0; g < levels; g += 1) {
      for (let r = 0; r < levels; r += 1) {
        indices[(b * levels + g) * levels + r] = nearestPaletteIndex(
          [centre(r), centre(g), centre(b)],
          palette,
        );
      }
    }
  }
  return { levels, palette, indices };
}

/** LUT cell of a channel value (same clamp/floor as the shader). */
export function lutCell(value: number, levels: number): number {
  return Math.min(levels - 1, Math.max(0, Math.floor(value * levels)));
}

/** Palette index for `color` via the LUT. */
export function lutLookup(lut: PaletteLut, color: Rgb): number {
  const { levels } = lut;
  const cell =
    (lutCell(color[2], levels) * levels + lutCell(color[1], levels)) * levels +
    lutCell(color[0], levels);
  return lut.indices[cell] ?? 0;
}

/** RGBA8 texels of the LUT (palette colour per cell), for a levels^3 3D texture. */
export function lutTexels(lut: PaletteLut): Uint8Array<ArrayBuffer> {
  const bytes = lut.palette.map((color) => color.map((channel) => Math.round(channel * 255)));
  const texels = new Uint8Array(lut.indices.length * 4);
  lut.indices.forEach((index, cell) => {
    const color = bytes[index] ?? [0, 0, 0];
    texels.set([color[0] ?? 0, color[1] ?? 0, color[2] ?? 0, 255], cell * 4);
  });
  return texels;
}

export interface DitherOptions {
  readonly size: BayerSize;
  /** Strength of the dither offset in normalized colour units (0..1). */
  readonly spread: number;
}

/** CPU reference of the shader's final step: ordered dither, then LUT palette snap. */
export function ditherQuantize(
  color: Rgb,
  x: number,
  y: number,
  lut: PaletteLut,
  dither: DitherOptions,
): number {
  const offset = bayerOffset(x, y, dither.size) * dither.spread;
  return lutLookup(lut, [color[0] + offset, color[1] + offset, color[2] + offset]);
}
