/**
 * View model of the scenes-per-minute choice and the faster-checks switch (ADR-027), shared by the
 * New project form, Project settings and Settings → Projects: the presets, the custom range
 * fields, and the live estimate line.
 */
import {
  describeSceneCountEstimate,
  MAX_SHOTS_PER_MINUTE,
  MIN_SHOTS_PER_MINUTE,
  SHOT_RANGE_CHOICES,
  SHOT_RANGE_PRESETS,
  shotRangeChoice,
  type ShotRangeChoice,
  type ShotsPerMinute,
} from '@reelforge/shared';

export interface ShotRangeOption {
  readonly value: ShotRangeChoice;
  readonly label: string;
}

export const SHOT_RANGE_OPTIONS: readonly ShotRangeOption[] = [
  { value: 'standard', label: 'Standard — no limit (about 10–13 per minute)' },
  { value: 'calm', label: 'Calm — 3–5 per minute' },
  { value: 'balanced', label: 'Balanced — 5–8 per minute' },
  { value: 'dynamic', label: 'Dynamic — 8–12 per minute' },
  { value: 'custom', label: 'Custom…' },
];

export function isShotRangeChoice(value: string): value is ShotRangeChoice {
  return (SHOT_RANGE_CHOICES as readonly string[]).includes(value);
}

/** The range a choice stands for; `custom` starts from the current range (or Balanced). */
export function rangeForChoice(
  choice: ShotRangeChoice,
  current: ShotsPerMinute | null,
): ShotsPerMinute | null {
  if (choice === 'standard') return null;
  if (choice === 'custom') return current ?? { ...SHOT_RANGE_PRESETS.balanced };
  return { ...SHOT_RANGE_PRESETS[choice] };
}

export { shotRangeChoice };

export type CustomRangeResult =
  | { readonly ok: true; readonly range: ShotsPerMinute }
  | { readonly ok: false; readonly message: string };

/** The two number fields of `Custom` → a range, or why it is not one yet. */
export function parseCustomRange(fromText: string, toText: string): CustomRangeResult {
  const min = Number(fromText.trim().replace(',', '.'));
  const max = Number(toText.trim().replace(',', '.'));
  const limits = `${String(MIN_SHOTS_PER_MINUTE)}–${String(MAX_SHOTS_PER_MINUTE)}`;
  if (
    fromText.trim() === '' ||
    toText.trim() === '' ||
    !Number.isFinite(min) ||
    !Number.isFinite(max)
  ) {
    return { ok: false, message: `Enter two numbers between ${limits}.` };
  }
  if (min < MIN_SHOTS_PER_MINUTE || max > MAX_SHOTS_PER_MINUTE) {
    return { ok: false, message: `Scenes per minute must be between ${limits}.` };
  }
  if (min > max) return { ok: false, message: '“From” must not be larger than “to”.' };
  return { ok: true, range: { min, max } };
}

/** Film length the dialogs estimate for (the film is not written yet). */
export const ESTIMATE_FILM_S = 600;

/** "≈ 50–80 scenes for a 10:00 film; roughly 35 % faster build than the default". */
export function sceneCountEstimateLine(
  range: ShotsPerMinute | null,
  fasterChecks: boolean,
  durationS = ESTIMATE_FILM_S,
): string {
  return describeSceneCountEstimate(durationS, range ?? undefined, fasterChecks);
}

export const SCENE_COUNT_HINT =
  'Fewer scenes per minute = longer shots that develop on the narration (one idea per shot, cuts on sentence ends) and a much faster build; the look and sound stay the same.';

export const FASTER_CHECKS_TITLE = 'Faster checks: lighter review, small quality trade-off';

export const FASTER_CHECKS_HINT =
  'The frame critic looks at flagged shots and a sample (every 4th), one fix per shot, at most 4 new props (checked from 2 angles), and the final review skips fixes for small-text hints.';

export const SCENE_COUNT_NOTE =
  'Scenes per minute applies from the next Storyboard, faster checks from the next Scenes build. Standard and off: the project behaves as before.';
