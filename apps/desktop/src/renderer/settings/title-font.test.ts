import { describe, expect, it } from 'vitest';
import { titleSizes } from './title-font.js';

describe('pixel title sizes (PLAN.md#13.12, U13)', () => {
  it('puts a font pixel on whole device pixels at common display scalings', () => {
    expect(titleSizes(1)).toEqual({ small: 10, large: 20 });
    expect(titleSizes(1.25)).toEqual({ small: 16, large: 24 });
    expect(titleSizes(2)).toEqual({ small: 15, large: 20 });
    for (const ratio of [1, 1.25, 1.5, 1.75, 2, 2.5, 3]) {
      const sizes = titleSizes(ratio);
      for (const size of [sizes.small, sizes.large]) {
        const devicePixelsPerFontPixel = (size * ratio) / 10;
        expect(devicePixelsPerFontPixel).toBeCloseTo(Math.round(devicePixelsPerFontPixel), 9);
      }
      expect(sizes.large).toBeGreaterThan(sizes.small);
    }
  });

  it('falls back to a scale of 1 for a missing ratio', () => {
    expect(titleSizes(0)).toEqual({ small: 10, large: 20 });
    expect(titleSizes(Number.NaN)).toEqual({ small: 10, large: 20 });
  });
});
