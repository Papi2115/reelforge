import { describe, expect, it } from 'vitest';
import { GENRE_PRESETS } from './genre-presets.js';
import { clampWowScale, WOW_RULES, wowBudget, wowPacing } from './wow-transitions.js';

describe('wow pacing under a genre multiplier (ADR-035)', () => {
  it('is exactly WOW_RULES at scale 1 (and by default)', () => {
    const plain = {
      warnSpacingS: WOW_RULES.warnSpacingS,
      errorSpacingS: WOW_RULES.errorSpacingS,
      maxSpacingS: WOW_RULES.repeatWindowS,
    };
    expect(wowPacing()).toEqual(plain);
    expect(wowPacing(1)).toEqual(plain);
    expect(wowBudget(480, 1)).toBe(wowBudget(480));
  });

  it.each([
    [0.5, { warnSpacingS: 80, errorSpacingS: 25, maxSpacingS: 180 }, 6],
    [0.75, { warnSpacingS: 53, errorSpacingS: 25, maxSpacingS: 120 }, 9],
    [1, { warnSpacingS: 40, errorSpacingS: 25, maxSpacingS: 90 }, 12],
    [1.25, { warnSpacingS: 32, errorSpacingS: 20, maxSpacingS: 72 }, 15],
    [1.5, { warnSpacingS: 27, errorSpacingS: 17, maxSpacingS: 60 }, 17],
  ])('scale %s: pacing %j, budget %s in 8 minutes', (scale, pacing, budget) => {
    expect(wowPacing(scale)).toEqual(pacing);
    expect(wowBudget(480, scale)).toBe(budget);
  });

  it('keeps the multiplier within sane bounds', () => {
    expect(clampWowScale(0)).toBe(0.25);
    expect(clampWowScale(3)).toBe(2);
    expect(clampWowScale(Number.NaN)).toBe(1);
    expect(wowPacing(0)).toEqual(wowPacing(0.25));
    expect(wowPacing(3)).toEqual({ warnSpacingS: 20, errorSpacingS: 13, maxSpacingS: 45 });
    // At least one wow moment however calm the genre and short the film.
    expect(wowBudget(30, 0)).toBe(1);
  });

  it('never makes the error gap stricter than without a preset', () => {
    for (const preset of GENRE_PRESETS) {
      const pacing = wowPacing(preset.wowTransitionBudget ?? 1);
      expect(pacing.errorSpacingS, preset.id).toBeLessThanOrEqual(WOW_RULES.errorSpacingS);
      expect(pacing.errorSpacingS, preset.id).toBeLessThan(pacing.warnSpacingS);
    }
  });
});
