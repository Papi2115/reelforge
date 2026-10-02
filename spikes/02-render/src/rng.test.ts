import { describe, expect, it } from 'vitest';
import { createRng } from './rng.ts';

describe('createRng', () => {
  it('yields the same sequence for the same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const sequenceA = Array.from({ length: 50 }, () => a());
    const sequenceB = Array.from({ length: 50 }, () => b());
    expect(sequenceA).toEqual(sequenceB);
  });

  it('yields different sequences for different seeds', () => {
    expect(createRng(1)()).not.toEqual(createRng(2)());
  });

  it('stays within [0, 1)', () => {
    const rng = createRng(7);
    for (let index = 0; index < 10_000; index += 1) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
