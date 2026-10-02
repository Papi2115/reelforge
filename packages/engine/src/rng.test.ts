import { describe, expect, it } from 'vitest';
import { createRng, hashString, mulberry32, shotSeed } from './rng.js';

function take(generator: () => number, count: number): number[] {
  return Array.from({ length: count }, () => generator());
}

describe('mulberry32', () => {
  it('matches the reference sequence for seed 1', () => {
    // Reference values of the canonical mulberry32 implementation.
    expect(take(mulberry32(1), 3)).toEqual([
      0.6270739405881613, 0.002735721180215478, 0.5274470399599522,
    ]);
  });
});

describe('createRng', () => {
  it('is reproducible and stays in [0, 1)', () => {
    const values = take(createRng(42), 1000);
    expect(take(createRng(42), 1000)).toEqual(values);
    expect(values.every((value) => value >= 0 && value < 1)).toBe(true);
  });

  it('provides range/int/pick helpers', () => {
    const rng = createRng(3);
    for (let index = 0; index < 200; index += 1) {
      const float = rng.range(-2, 2);
      expect(float).toBeGreaterThanOrEqual(-2);
      expect(float).toBeLessThan(2);
      const integer = rng.int(1, 6);
      expect(Number.isInteger(integer) && integer >= 1 && integer <= 6).toBe(true);
      expect(['a', 'b']).toContain(rng.pick(['a', 'b']));
    }
    expect(() => rng.pick([])).toThrow(RangeError);
  });

  it('forks independent streams without advancing the parent', () => {
    const parent = createRng(9);
    const forked = take(parent.fork('update'), 3);
    expect(take(parent, 3)).toEqual(take(createRng(9), 3));
    expect(take(createRng(9).fork('update'), 3)).toEqual(forked);
    expect(take(createRng(9).fork('other'), 3)).not.toEqual(forked);
  });
});

describe('shotSeed', () => {
  it('depends on both the project seed and the shot id', () => {
    expect(shotSeed(1, 's01')).toBe(shotSeed(1, 's01'));
    expect(shotSeed(1, 's01')).not.toBe(shotSeed(2, 's01'));
    expect(shotSeed(1, 's01')).not.toBe(shotSeed(1, 's02'));
    expect(hashString('')).toBe(0x811c9dc5);
  });
});
