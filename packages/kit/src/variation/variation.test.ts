import { describe, expect, it } from 'vitest';
import {
  ambientVariation,
  debrisCount,
  guaranteedAxes,
  layoutLabel,
  toneOf,
  variationDistance,
} from './ambient.js';
import { hash32, seededPermutation, steppedLevel } from './sequence.js';
import { CONTINUOUS_AXES, NEUTRAL, type AmbientInput, type VariationBudget } from './types.js';

const BUDGET: VariationBudget = {
  tones: {
    navy: ['indigo', 'slateBlue'],
    indigo: ['purple', 'navy'],
    magenta: ['pink', 'violet'],
    teal: ['slateBlue', 'brightTeal'],
  },
  toneShare: 0.35,
  steps: 5,
  cell: [0.8, 1.25],
  horizon: [-0.06, 0.08],
  fade: [0.85, 1.2],
  lightAzimuth: [-24, 24],
  lightElevation: [-8, 8],
  debris: [0.75, 1.3],
  cameraDrift: [1.2, 0.5],
};

const ROLLS = ['A', 'B', 'C'] as const;

/** A synthetic film: 80 shots, a new act every 16, rolls cycling A A B A C. */
function film(count = 80, overrides: Partial<AmbientInput> = {}): AmbientInput[] {
  return Array.from({ length: count }, (_, index) => ({
    seed: 2115,
    shotId: `s${String(index + 1).padStart(2, '0')}`,
    index,
    actIndex: Math.floor(index / 16),
    roll: ROLLS[[0, 0, 1, 0, 2][index % 5] ?? 0],
    budgetKey: 'voxel',
    budget: BUDGET,
    ...overrides,
  }));
}

describe('variation sequences', () => {
  it('hashes deterministically and spreads seeds', () => {
    expect(hash32('axis:horizon', 1)).toBe(hash32('axis:horizon', 1));
    expect(hash32('axis:horizon', 1)).not.toBe(hash32('axis:horizon', 2));
    expect(hash32('a', 0)).not.toBe(hash32('b', 0));
  });

  it('builds seeded permutations', () => {
    for (const size of [3, 5, 9]) {
      const order = seededPermutation(7, size);
      expect([...order].sort((a, b) => a - b)).toEqual(Array.from({ length: size }, (_, i) => i));
      expect(seededPermutation(7, size)).toEqual(order);
    }
  });

  it.each([3, 4, 5, 7, 9])('never repeats a level between neighbours (%i steps)', (steps) => {
    const levels = Array.from({ length: 600 }, (_, index) =>
      steppedLevel(42, 'axis:test', index, steps),
    );
    levels.forEach((level, index) => {
      expect(level).toBeGreaterThanOrEqual(0);
      expect(level).toBeLessThan(steps);
      if (index > 0) expect(level, `shot ${String(index)}`).not.toBe(levels[index - 1]);
    });
    // Every cycle visits every level once.
    for (let start = 0; start + steps <= levels.length; start += steps) {
      expect(new Set(levels.slice(start, start + steps)).size).toBe(steps);
    }
  });

  it('computes a level from its own and the previous cycle only (any order)', () => {
    const forward = Array.from({ length: 40 }, (_, index) => steppedLevel(9, 'x', index, 5));
    const backward = Array.from({ length: 40 }, (_, index) => steppedLevel(9, 'x', 39 - index, 5));
    expect(backward.reverse()).toEqual(forward);
  });

  it('rejects too few steps and bad indices', () => {
    expect(() => steppedLevel(1, 'x', 0, 2)).toThrow(RangeError);
    expect(() => steppedLevel(1, 'x', -1, 5)).toThrow(RangeError);
  });
});

describe('ambientVariation', () => {
  it('is a pure function of its inputs', () => {
    for (const input of film(10)) {
      expect(ambientVariation(input)).toEqual(ambientVariation({ ...input }));
    }
    const [first] = film(1);
    if (!first) throw new Error('no shot');
    expect(ambientVariation({ ...first, seed: 1 })).not.toEqual(ambientVariation(first));
  });

  it('keeps every neighbour of an 80-shot film at distance >= 2', () => {
    const shots = film().map(ambientVariation);
    shots.forEach((shot, index) => {
      const previous = shots[index - 1];
      if (!previous) return;
      expect(
        variationDistance(previous, shot),
        `shots ${String(index)}/${String(index + 1)}`,
      ).toBeGreaterThanOrEqual(2);
      expect(shot.horizon).not.toBe(previous.horizon);
      expect(shot.lightAzimuth).not.toBe(previous.lightAzimuth);
    });
    // Drifts, not a loop: the film uses many distinct parameter sets.
    expect(new Set(shots.map((shot) => JSON.stringify(shot))).size).toBe(shots.length);
  });

  it('stays inside the budget at scale 1 and only uses family members', () => {
    for (const shot of film().map(ambientVariation)) {
      for (const axis of CONTINUOUS_AXES) {
        const [min, max] = BUDGET[axis];
        expect(shot[axis]).toBeGreaterThanOrEqual(min - 1e-12);
        expect(shot[axis]).toBeLessThanOrEqual(max + 1e-12);
      }
      for (const [family, member] of Object.entries(shot.tones)) {
        expect(BUDGET.tones[family]).toContain(member);
      }
      expect(Math.abs(shot.cameraDrift[0])).toBeLessThanOrEqual(BUDGET.cameraDrift[0]);
      expect(Math.abs(shot.cameraDrift[1])).toBeLessThanOrEqual(BUDGET.cameraDrift[1]);
      expect(shot.layout).toBeGreaterThan(0);
    }
  });

  it('swaps about toneShare of the families, one member per family within an act and roll', () => {
    const shots = film(400, { actIndex: 0, roll: 'A' }).map(ambientVariation);
    const swaps = shots.reduce((sum, shot) => sum + Object.keys(shot.tones).length, 0);
    const share = swaps / (shots.length * Object.keys(BUDGET.tones).length);
    expect(share).toBeGreaterThan(0.2);
    expect(share).toBeLessThan(0.45);
    for (const family of Object.keys(BUDGET.tones)) {
      const members = new Set(shots.flatMap((shot) => shot.tones[family] ?? []));
      expect(members.size, family).toBeLessThanOrEqual(1);
    }
  });

  it('is exactly neutral at scale 0', () => {
    for (const shot of film(20, { scale: 0 }).map(ambientVariation)) {
      for (const axis of CONTINUOUS_AXES) expect(shot[axis]).toBe(NEUTRAL[axis]);
      expect(shot.tones).toEqual({});
      expect(shot.layout).toBe(0);
      expect(shot.cameraDrift.map(Math.abs)).toEqual([0, 0]);
    }
  });

  it('scales the budget around the neutral values', () => {
    const [input] = film(1);
    if (!input) throw new Error('no shot');
    const full = ambientVariation(input);
    const half = ambientVariation({ ...input, scale: 0.5 });
    expect(half.horizon).toBeCloseTo(full.horizon / 2, 12);
    expect(half.cell - 1).toBeCloseTo((full.cell - 1) / 2, 12);
    expect(half.levels).toEqual(full.levels);
  });

  it('guarantees the first two axes that can vary', () => {
    expect(guaranteedAxes(BUDGET)).toEqual(['horizon', 'lightAzimuth']);
    const still: VariationBudget = { ...BUDGET, horizon: [0, 0], lightAzimuth: [0, 0] };
    expect(guaranteedAxes(still)).toEqual(['cell', 'fade']);
    const shots = film(30, { budget: still }).map(ambientVariation);
    shots.slice(1).forEach((shot, index) => {
      expect(shot.cell).not.toBe(shots[index]?.cell);
      expect(shot.horizon).toBe(0);
    });
  });

  it('rejects a negative scale', () => {
    const [input] = film(1);
    if (!input) throw new Error('no shot');
    expect(() => ambientVariation({ ...input, scale: -1 })).toThrow(RangeError);
  });
});

describe('environment helpers', () => {
  const [input] = film(1);
  if (!input) throw new Error('no shot');
  const variation = ambientVariation(input);

  it('leave everything unchanged without variation', () => {
    expect(toneOf(undefined, 'navy')).toBe('navy');
    expect(debrisCount(undefined, 37)).toBe(37);
    expect(layoutLabel(undefined, 'seed:3')).toBe('seed:3');
  });

  it('apply tones, debris and layout with variation', () => {
    expect(toneOf(variation, 'hero')).toBe('hero');
    expect(debrisCount(variation, 40)).toBe(Math.round(40 * variation.debris));
    expect(debrisCount({ ...variation, debris: 0.25 }, 1, 1)).toBe(1);
    expect(layoutLabel(variation, 'seed:3')).toBe(`seed:3:layout:${String(variation.layout)}`);
    expect(layoutLabel({ ...variation, layout: 0 }, 'seed:3')).toBe('seed:3');
  });
});
