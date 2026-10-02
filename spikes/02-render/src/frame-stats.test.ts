import { describe, expect, it } from 'vitest';
import { computeFrameStats, countDifferingPixels } from './frame-stats.ts';

describe('computeFrameStats', () => {
  it('flags a uniform RGBA frame', () => {
    const frame = new Uint8Array(4 * 100).fill(10);
    const stats = computeFrameStats(frame, 4);
    expect(stats).toEqual({
      pixels: 100,
      uniqueColors: 1,
      meanRgb: [10, 10, 10],
      dominantColorShare: 1,
    });
  });

  it('counts colors and means for RGB data', () => {
    const frame = new Uint8Array([255, 0, 0, 0, 0, 255, 255, 0, 0, 0, 0, 255]);
    const stats = computeFrameStats(frame, 3);
    expect(stats.uniqueColors).toBe(2);
    expect(stats.meanRgb).toEqual([127.5, 0, 127.5]);
    expect(stats.dominantColorShare).toBe(0.5);
  });
});

describe('countDifferingPixels', () => {
  it('counts pixels with any differing channel', () => {
    const a = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const b = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 9]);
    expect(countDifferingPixels(a, a)).toBe(0);
    expect(countDifferingPixels(a, b)).toBe(1);
  });

  it('rejects buffers of different sizes', () => {
    expect(() => countDifferingPixels(new Uint8Array(4), new Uint8Array(8))).toThrow(
      /Size mismatch/,
    );
  });
});
