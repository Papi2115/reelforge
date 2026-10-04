/** Tension map in ambient variation (PLAN.md#12.22): darker family members at high tension. */
import { describe, expect, it } from 'vitest';
import { ambientVariation, TENSION_DARKEN_FROM, tensionDarkShare } from './ambient.js';
import type { AmbientInput, VariationBudget } from './types.js';

const BUDGET: VariationBudget = {
  tones: {
    indigo: ['purple', 'navy'],
    purple: ['indigo', 'violet'],
    violet: ['purple', 'wine'],
    teal: ['slateBlue', 'brightTeal'],
    navy: ['indigo'],
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

/** Family -> closest darker member (what the engine derives from the palette luma). */
const DARKER = { indigo: 'navy', purple: 'indigo', violet: 'purple', teal: 'slateBlue' };

function shots(overrides: Partial<AmbientInput>): AmbientInput[] {
  return Array.from({ length: 40 }, (_, index) => ({
    seed: 2115,
    shotId: `s${String(index + 1).padStart(2, '0')}`,
    index,
    actIndex: Math.floor(index / 10),
    budgetKey: 'voxel',
    budget: BUDGET,
    ...overrides,
  }));
}

function darkened(inputs: readonly AmbientInput[]): number {
  return inputs
    .map((input) => ambientVariation(input))
    .reduce(
      (count, params) =>
        count +
        Object.entries(DARKER).filter(([family, member]) => params.tones[family] === member).length,
      0,
    );
}

describe('ambient variation with tension', () => {
  it('darkens nothing up to TENSION_DARKEN_FROM and every family at 1', () => {
    expect(tensionDarkShare(undefined)).toBe(0);
    expect(tensionDarkShare(TENSION_DARKEN_FROM)).toBe(0);
    expect(tensionDarkShare(0.75)).toBe(0.5);
    expect(tensionDarkShare(1)).toBe(1);
    const peak = shots({ tension: 1, darker: DARKER }).map((input) => ambientVariation(input));
    for (const params of peak) {
      for (const [family, member] of Object.entries(DARKER)) {
        expect(params.tones[family]).toBe(member);
        expect(BUDGET.tones[family]).toContain(member);
      }
    }
  });

  it('a tense film has more darkened families than a calm one (same shots)', () => {
    const calm = darkened(shots({ tension: 0.2, darker: DARKER }));
    const tense = darkened(shots({ tension: 0.85, darker: DARKER }));
    expect(tense).toBeGreaterThan(calm + 40);
  });

  it('is exactly the 2.0 parameter set without a tension, and at neutral tension', () => {
    for (const input of shots({})) {
      const plain = ambientVariation(input);
      expect(plain).not.toHaveProperty('tension');
      const neutral = ambientVariation({ ...input, tension: 0.5, darker: DARKER });
      const { tension, ...rest } = neutral;
      expect(tension).toBe(0.5);
      expect(rest).toEqual(plain);
    }
  });

  it('keeps scale 0 as authored and refuses a tension outside 0..1', () => {
    const [first] = shots({ tension: 1, darker: DARKER, scale: 0 });
    if (first === undefined) throw new Error('no shot');
    expect(ambientVariation(first).tones).toEqual({});
    expect(() => ambientVariation({ ...first, tension: 1.2 })).toThrow(RangeError);
  });
});
