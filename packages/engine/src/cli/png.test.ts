import { describe, expect, it } from 'vitest';
import { computeFrameStats, countDifferingPixels } from './frame-stats.js';
import { decodePng, encodePng } from './png.js';

describe('png codec', () => {
  it('round-trips RGBA data', () => {
    const data = Uint8Array.from({ length: 3 * 2 * 4 }, (_, index) => (index * 37) % 256);
    const file = encodePng({ width: 3, height: 2, data });
    expect(file.subarray(1, 4).toString('latin1')).toBe('PNG');
    expect(decodePng(file)).toEqual({ width: 3, height: 2, data });
  });

  it('rejects malformed input', () => {
    expect(() => encodePng({ width: 2, height: 2, data: new Uint8Array(3) })).toThrow(RangeError);
    expect(() => decodePng(Buffer.from('not a png'))).toThrow(/not a PNG/);
  });
});

describe('frame stats', () => {
  it('counts colours and differing pixels', () => {
    const first = Uint8Array.from([0, 0, 0, 255, 0, 0, 0, 255, 9, 9, 9, 255]);
    const second = Uint8Array.from([0, 0, 0, 255, 1, 0, 0, 255, 9, 9, 9, 255]);
    expect(computeFrameStats(first)).toEqual({
      pixels: 3,
      uniqueColors: 2,
      dominantColorShare: 2 / 3,
    });
    expect(countDifferingPixels(first, second)).toBe(1);
    expect(() => countDifferingPixels(first, new Uint8Array(4))).toThrow(RangeError);
  });
});
