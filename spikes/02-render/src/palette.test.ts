import { describe, expect, it } from 'vitest';
import {
  BAYER_4X4,
  bayerOffset,
  ditherQuantize,
  hexToRgb,
  nearestPaletteIndex,
  paletteRgb,
  SPIKE_PALETTE_HEX,
} from './palette.ts';

describe('palette', () => {
  it('parses hex colors and rejects invalid input', () => {
    expect(hexToRgb('#ff0000')).toEqual([1, 0, 0]);
    expect(() => hexToRgb('red')).toThrow(/Invalid hex/);
  });

  it('has 16 distinct colors', () => {
    expect(new Set(SPIKE_PALETTE_HEX.map((hex) => hex.toLowerCase())).size).toBe(16);
  });

  it('snaps every palette color to itself', () => {
    const palette = paletteRgb();
    palette.forEach((color, index) => {
      expect(nearestPaletteIndex(color, palette)).toBe(index);
    });
  });
});

describe('Bayer 4x4 dithering', () => {
  it('is a permutation of 0..15', () => {
    expect([...BAYER_4X4].sort((a, b) => a - b)).toEqual(Array.from({ length: 16 }, (_, i) => i));
  });

  it('produces symmetric offsets in (-0.5, 0.5) that tile every 4 pixels', () => {
    const offsets = Array.from({ length: 16 }, (_, i) => bayerOffset(i % 4, Math.floor(i / 4)));
    expect(Math.min(...offsets)).toBeCloseTo(-15 / 32);
    expect(Math.max(...offsets)).toBeCloseTo(15 / 32);
    expect(offsets.reduce((sum, value) => sum + value, 0)).toBeCloseTo(0);
    expect(bayerOffset(5, 6)).toBe(bayerOffset(1, 2));
  });

  it('dithers a mid-tone between two palette neighbours deterministically', () => {
    const palette = paletteRgb(['#000000', '#ffffff']);
    const grey = [0.5, 0.5, 0.5] as const;
    const indices = Array.from({ length: 16 }, (_, i) =>
      ditherQuantize(grey, i % 4, Math.floor(i / 4), palette),
    );
    expect(new Set(indices)).toEqual(new Set([0, 1]));
    expect(indices).toEqual(
      Array.from({ length: 16 }, (_, i) => ditherQuantize(grey, i % 4, Math.floor(i / 4), palette)),
    );
  });
});
