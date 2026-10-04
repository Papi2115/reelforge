import { describe, expect, it } from 'vitest';
import {
  describeSceneCountEstimate,
  expectedShots,
  filmClock,
  projectFasterChecks,
  projectFileSchema,
  projectShotsPerMinute,
  sceneCountEstimate,
  shotRangeChoice,
  shotRangeRules,
  shotsPerMinuteSchema,
  shotsSummary,
  targetShotLength,
  tensionSpans,
} from './index.js';

const PROJECT = {
  version: 1,
  title: 'T',
  language: 'en',
  style: 'voxel-pixel-crisp640',
  fps: 30,
  seed: 1,
};

describe('scenes per minute (ADR-027)', () => {
  it('reads missing fields as no range and checks off', () => {
    const old = projectFileSchema.parse(PROJECT);
    expect(old).not.toHaveProperty('shotsPerMinute');
    expect(projectShotsPerMinute(old)).toBeUndefined();
    expect(projectFasterChecks(old)).toBe(false);
    const set = projectFileSchema.parse({
      ...PROJECT,
      shotsPerMinute: { min: 3, max: 5 },
      fasterChecks: true,
    });
    expect(projectShotsPerMinute(set)).toEqual({ min: 3, max: 5 });
    expect(projectFasterChecks(set)).toBe(true);
  });

  it('accepts 1 <= min <= max <= 20 only', () => {
    expect(shotsPerMinuteSchema.safeParse({ min: 1, max: 20 }).success).toBe(true);
    expect(shotsPerMinuteSchema.safeParse({ min: 4.5, max: 4.5 }).success).toBe(true);
    expect(shotsPerMinuteSchema.safeParse({ min: 0, max: 5 }).success).toBe(false);
    expect(shotsPerMinuteSchema.safeParse({ min: 6, max: 5 }).success).toBe(false);
    expect(shotsPerMinuteSchema.safeParse({ min: 5, max: 21 }).success).toBe(false);
  });

  it('names presets and custom ranges', () => {
    expect(shotRangeChoice(undefined)).toBe('standard');
    expect(shotRangeChoice(null)).toBe('standard');
    expect(shotRangeChoice({ min: 3, max: 5 })).toBe('calm');
    expect(shotRangeChoice({ min: 5, max: 8 })).toBe('balanced');
    expect(shotRangeChoice({ min: 8, max: 12 })).toBe('dynamic');
    expect(shotRangeChoice({ min: 4, max: 6 })).toBe('custom');
  });

  it('derives shot lengths, pattern window and tension targets from the range', () => {
    expect(shotRangeRules({ min: 3, max: 5 })).toEqual({
      maxShotS: 30,
      minShotS: 4.8,
      typicalMinShotS: 7.2,
      typicalMaxShotS: 24,
      maxPatternS: 24,
      longSentenceS: 12,
      tempo: { calmS: 20, peakS: 12 },
    });
    const dynamic = shotRangeRules({ min: 8, max: 12 });
    expect(dynamic.maxShotS).toBe(14);
    expect(dynamic.minShotS).toBe(2);
    expect(dynamic.maxPatternS).toBe(9);
    expect(dynamic.longSentenceS).toBe(7.5);
    expect(targetShotLength(0, dynamic.tempo)).toBe(7.5);
    expect(targetShotLength(1, dynamic.tempo)).toBe(5);
  });

  it('keeps the standard tension targets when no tempo is given', () => {
    expect(targetShotLength(0)).toBe(7.5);
    expect(targetShotLength(1)).toBe(3);
    const curve = {
      points: [
        { t: 0, v: 0.2 },
        { t: 60, v: 0.8 },
      ],
    };
    const calm = shotRangeRules({ min: 3, max: 5 }).tempo;
    const standard = tensionSpans(curve, 60);
    const ranged = tensionSpans(curve, 60, calm);
    expect(ranged.map((span) => span.mean)).toEqual(standard.map((span) => span.mean));
    expect(ranged.every((span, i) => span.targetS > (standard[i]?.targetS ?? 0))).toBe(true);
  });

  it('estimates scenes and build saving', () => {
    expect(expectedShots({ min: 3, max: 5 }, 642)).toEqual({ min: 32, max: 54 });
    expect(sceneCountEstimate(10, undefined, false)).toEqual({
      shots: { min: 100, max: 130 },
      buildSavingPct: 0,
    });
    const calm = sceneCountEstimate(10, { min: 3, max: 5 }, false).buildSavingPct;
    const balanced = sceneCountEstimate(10, { min: 5, max: 8 }, false).buildSavingPct;
    const dynamic = sceneCountEstimate(10, { min: 8, max: 12 }, false).buildSavingPct;
    expect(calm).toBeGreaterThan(balanced);
    expect(balanced).toBeGreaterThan(dynamic);
    expect([calm, balanced, dynamic]).toEqual([60, 35, 10]);
    expect(sceneCountEstimate(10, { min: 5, max: 8 }, true).buildSavingPct).toBe(45);
    expect(sceneCountEstimate(10, { min: 15, max: 20 }, false).buildSavingPct).toBeLessThan(0);
  });

  it('describes the estimate in one line', () => {
    expect(describeSceneCountEstimate(642, { min: 3, max: 5 }, false)).toBe(
      '≈ 32–54 scenes for a 10:42 film; roughly 60 % faster build than the default',
    );
    expect(describeSceneCountEstimate(642, undefined, false)).toBe(
      '≈ 107–139 scenes for a 10:42 film (the default)',
    );
    expect(describeSceneCountEstimate(642, undefined, true)).toBe(
      '≈ 107–139 scenes for a 10:42 film; roughly 15 % faster build than the default',
    );
    expect(describeSceneCountEstimate(600, { min: 15, max: 20 }, false)).toMatch(/slower build/);
  });

  it('summarises a storyboard', () => {
    expect(filmClock(642)).toBe('10:42');
    expect(shotsSummary(42, 642, { min: 3, max: 5 })).toBe(
      '42 shots for 10:42 · 3.9/min · range 3–5',
    );
    expect(shotsSummary(10, 60, { min: 4.5, max: 4.5 })).toBe(
      '10 shots for 1:00 · 10.0/min · range 4.5',
    );
  });
});
