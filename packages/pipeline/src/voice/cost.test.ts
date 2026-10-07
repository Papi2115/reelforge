import { describe, expect, it } from 'vitest';
import { calibrateCosts, estimateCost, formatCount, measuredMultiplier } from './cost.js';

const quota = { characterCount: 57_000, characterLimit: 100_000, nextResetUnix: 1_790_000_000 };

describe('estimateCost', () => {
  it('uses the default multiplier and shows the share of the remaining quota', () => {
    const estimate = estimateCost({ characters: 5_200, modelId: 'eleven_multilingual_v2', quota });
    expect(estimate).toMatchObject({
      multiplier: 1,
      multiplierSource: 'default',
      estimatedCredits: 5_200,
      remaining: 43_000,
      exceedsRemaining: false,
      warning: null,
    });
    expect(estimate.summary).toBe('about 5,200 characters (12% of your remaining 43,000)');
  });

  it('halves flash and prefers a calibrated multiplier', () => {
    expect(
      estimateCost({ characters: 1_001, modelId: 'eleven_flash_v2_5', quota }).estimatedCredits,
    ).toBe(501);
    const calibrated = estimateCost({
      characters: 1_000,
      modelId: 'eleven_flash_v2_5',
      quota,
      calibration: { eleven_flash_v2_5: 0.6 },
    });
    expect(calibrated).toMatchObject({
      multiplier: 0.6,
      multiplierSource: 'calibrated',
      estimatedCredits: 600,
    });
  });

  it('warns when the quota is not enough, with the reset date', () => {
    const estimate = estimateCost({
      characters: 50_000,
      modelId: 'eleven_v4',
      quota,
    });
    expect(estimate.exceedsRemaining).toBe(true);
    expect(estimate.warning).toBe(
      'This needs 50,000 characters but only 43,000 are left; the quota resets on 2026-09-21.',
    );
  });

  it('handles an unknown or empty quota', () => {
    expect(estimateCost({ characters: 10, modelId: 'x', quota: null }).summary).toBe(
      'about 10 characters (quota unknown)',
    );
    const empty = estimateCost({
      characters: 10,
      modelId: 'eleven_v4',
      quota: { characterCount: 5, characterLimit: 5, nextResetUnix: null },
    });
    expect(empty.summary).toBe('about 10 characters (nothing left on the account)');
    expect(empty.warning).toBe('This needs 10 characters but only 0 are left.');
    expect(estimateCost({ characters: 10, modelId: 'eleven_v4', quota }).summary).toContain(
      '(<1% of',
    );
  });
});

describe('calibration', () => {
  it('derives multipliers from character-cost headers', () => {
    expect(measuredMultiplier(200, 100)).toBe(0.5);
    expect(measuredMultiplier(200, null)).toBeNull();
    expect(
      calibrateCosts([
        { modelId: 'a', characters: 100, characterCost: 50 },
        { modelId: 'a', characters: 300, characterCost: 250 },
        { modelId: 'b', characters: 100, characterCost: null },
      ]),
    ).toEqual({ a: 0.75 });
  });
});

describe('formatCount', () => {
  it('groups thousands without the OS locale', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(1_234_567)).toBe('1,234,567');
    expect(formatCount(999)).toBe('999');
  });
});
