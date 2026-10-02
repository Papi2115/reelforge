import { describe, expect, it } from 'vitest';
import {
  BAYER_4X4,
  bayerMatrix,
  bayerOffset,
  buildPaletteLut,
  ditherQuantize,
  hexToRgb,
  lutLookup,
  lutTexels,
  nearestPaletteIndex,
  paletteRgb,
  type Rgb,
} from './palette.js';
import { defaultStylePreset } from './presets/index.js';

const INK_PAPER = paletteRgb({ ink: '#000000', paper: '#ffffff' });

describe('palette', () => {
  it('parses hex colours and rejects invalid input', () => {
    expect(hexToRgb('#ff0000')).toEqual([1, 0, 0]);
    expect(() => hexToRgb('red')).toThrow(/Invalid hex/);
  });

  it('snaps every palette colour to itself, directly and through the LUT', () => {
    const palette = paletteRgb(defaultStylePreset().palette);
    const lut = buildPaletteLut(palette);
    palette.forEach((color, index) => {
      expect(nearestPaletteIndex(color, palette)).toBe(index);
      expect(lutLookup(lut, color)).toBe(index);
    });
  });

  it('matches the exact nearest colour at cell centres (checks the r/g/b cell layout)', () => {
    const palette = paletteRgb(defaultStylePreset().palette);
    const lut = buildPaletteLut(palette);
    let disagreements = 0;
    for (let index = 0; index < 512; index += 1) {
      const centre = (cell: number): number => (cell * 8 + 4.5) / lut.levels;
      const color: Rgb = [centre(index % 8), centre(Math.floor(index / 8) % 8), centre(index >> 6)];
      if (lutLookup(lut, color) !== nearestPaletteIndex(color, palette)) disagreements += 1;
    }
    expect(disagreements).toBe(0);
  });

  it('clamps out-of-range colours and stores palette colours as RGBA8 texels', () => {
    const lut = buildPaletteLut(INK_PAPER, 4);
    expect(lutLookup(lut, [-1, -1, -1])).toBe(0);
    expect(lutLookup(lut, [2, 2, 2])).toBe(1);
    const texels = lutTexels(lut);
    expect(texels).toHaveLength(4 * 4 * 4 * 4);
    expect([...texels.subarray(0, 4)]).toEqual([0, 0, 0, 255]);
    expect([...texels.subarray(-4)]).toEqual([255, 255, 255, 255]);
  });
});

describe('Bayer dithering', () => {
  it('builds Bayer matrices recursively (4x4 matches the classic table)', () => {
    expect(bayerMatrix(2)).toEqual([0, 2, 3, 1]);
    expect([...BAYER_4X4]).toEqual([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]);
    const bayer8 = bayerMatrix(8);
    expect([...bayer8].sort((a, b) => a - b)).toEqual(Array.from({ length: 64 }, (_, i) => i));
    expect(bayer8.slice(0, 8)).toEqual([0, 32, 8, 40, 2, 34, 10, 42]);
  });

  it('produces symmetric offsets that tile every n pixels', () => {
    for (const size of [4, 8] as const) {
      const cells = size * size;
      const offsets = Array.from({ length: cells }, (_, i) =>
        bayerOffset(i % size, Math.floor(i / size), size),
      );
      expect(Math.min(...offsets)).toBeCloseTo(-(cells - 1) / (2 * cells));
      expect(offsets.reduce((sum, value) => sum + value, 0)).toBeCloseTo(0);
      expect(bayerOffset(size + 1, size + 2, size)).toBe(bayerOffset(1, 2, size));
    }
  });

  it('dithers a mid-tone between two palette neighbours', () => {
    const lut = buildPaletteLut(INK_PAPER);
    const grey: Rgb = [0.5, 0.5, 0.5];
    for (const size of [4, 8] as const) {
      const cells = size * size;
      const indices = Array.from({ length: cells }, (_, i) =>
        ditherQuantize(grey, i % size, Math.floor(i / size), lut, { size, spread: 0.12 }),
      );
      expect(indices.filter((index) => index === 1)).toHaveLength(cells / 2);
    }
  });

  it('does not dither with zero spread', () => {
    const lut = buildPaletteLut(INK_PAPER);
    const indices = Array.from({ length: 16 }, (_, i) =>
      ditherQuantize([0.45, 0.45, 0.45], i % 4, Math.floor(i / 4), lut, { size: 4, spread: 0 }),
    );
    expect(new Set(indices)).toEqual(new Set([0]));
  });
});
