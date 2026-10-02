import { describe, expect, it } from 'vitest';
import { nextGainDb } from './passes.js';

describe('nextGainDb', () => {
  it('first correction is a unit-slope step', () => {
    expect(nextGainDb([{ gainDb: 10, lufs: -16.8 }], -16)).toBeCloseTo(10.8);
  });

  it('then follows the measured slope (limiter compresses gain)', () => {
    const next = nextGainDb(
      [
        { gainDb: 10, lufs: -17 },
        { gainDb: 11, lufs: -16.5 },
      ],
      -16,
    );
    expect(next).toBeCloseTo(12);
  });

  it('ignores implausible slopes and clamps huge steps', () => {
    const flat = nextGainDb(
      [
        { gainDb: 10, lufs: -17 },
        { gainDb: 11, lufs: -17 },
      ],
      -16,
    );
    expect(flat).toBeCloseTo(12);
    expect(nextGainDb([{ gainDb: 0, lufs: -60 }], -16)).toBe(12);
    expect(nextGainDb([], -16)).toBe(0);
  });
});
