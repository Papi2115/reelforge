import { describe, expect, it } from 'vitest';
import {
  FASTER_CHECKS_TITLE,
  isShotRangeChoice,
  parseCustomRange,
  rangeForChoice,
  sceneCountEstimateLine,
  SHOT_RANGE_OPTIONS,
  shotRangeChoice,
} from './scene-count-view.js';

describe('scenes per minute view (ADR-027)', () => {
  it('offers Standard, three presets and Custom', () => {
    expect(SHOT_RANGE_OPTIONS.map((option) => option.value)).toEqual([
      'standard',
      'calm',
      'balanced',
      'dynamic',
      'custom',
    ]);
    expect(SHOT_RANGE_OPTIONS.map((option) => option.label)).toContain('Calm — 3–5 per minute');
    expect(isShotRangeChoice('dynamic')).toBe(true);
    expect(isShotRangeChoice('lean')).toBe(false);
  });

  it('maps choices to ranges and back', () => {
    expect(rangeForChoice('standard', { min: 3, max: 5 })).toBeNull();
    expect(rangeForChoice('balanced', null)).toEqual({ min: 5, max: 8 });
    expect(rangeForChoice('custom', null)).toEqual({ min: 5, max: 8 });
    expect(rangeForChoice('custom', { min: 4, max: 6 })).toEqual({ min: 4, max: 6 });
    expect(shotRangeChoice(null)).toBe('standard');
    expect(shotRangeChoice({ min: 8, max: 12 })).toBe('dynamic');
  });

  it('parses the custom fields', () => {
    expect(parseCustomRange('4', '6,5')).toEqual({ ok: true, range: { min: 4, max: 6.5 } });
    expect(parseCustomRange('', '6')).toMatchObject({ ok: false });
    expect(parseCustomRange('0', '6')).toEqual({
      ok: false,
      message: 'Scenes per minute must be between 1–20.',
    });
    expect(parseCustomRange('7', '5')).toEqual({
      ok: false,
      message: '“From” must not be larger than “to”.',
    });
  });

  it('estimates scenes and build time live', () => {
    expect(sceneCountEstimateLine(null, false)).toBe(
      '≈ 100–130 scenes for a 10:00 film (the default)',
    );
    expect(sceneCountEstimateLine({ min: 3, max: 5 }, false)).toBe(
      '≈ 30–50 scenes for a 10:00 film; roughly 60 % faster build than the default',
    );
    expect(sceneCountEstimateLine({ min: 5, max: 8 }, true, 642)).toBe(
      '≈ 54–86 scenes for a 10:42 film; roughly 45 % faster build than the default',
    );
    expect(FASTER_CHECKS_TITLE).toBe('Faster checks: lighter review, small quality trade-off');
  });
});
