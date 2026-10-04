/**
 * Scenes per minute and faster checks (ADR-027, ReelForge 2.3.6). `shotsPerMinute` is the range
 * of shots per minute of film the user wants (absent = no constraint: the storyboard as before);
 * it steers the storyboard prompt and validator (one idea = one shot, cuts on sentence ends, shot
 * lengths and tension targets derived from the range). `fasterChecks` is an independent switch
 * for lighter scene QA. Both absent in project.json = the pipeline exactly as before 2.3.6.
 */
import { z } from 'zod';
import type { ShotTempo } from './tension-tempo.js';

export const MIN_SHOTS_PER_MINUTE = 1;
export const MAX_SHOTS_PER_MINUTE = 20;

const rateSchema = z.number().min(MIN_SHOTS_PER_MINUTE).max(MAX_SHOTS_PER_MINUTE);

export const shotsPerMinuteSchema = z
  .object({ min: rateSchema, max: rateSchema })
  .refine((range) => range.min <= range.max, {
    message: 'min must be <= max',
    path: ['max'],
  });
export type ShotsPerMinute = z.infer<typeof shotsPerMinuteSchema>;

/** Named ranges of the dialogs; `standard` = no range, `custom` = the user's own numbers. */
export const SHOT_RANGE_PRESETS = {
  calm: { min: 3, max: 5 },
  balanced: { min: 5, max: 8 },
  dynamic: { min: 8, max: 12 },
} as const satisfies Readonly<Record<string, ShotsPerMinute>>;
export type ShotRangePresetId = keyof typeof SHOT_RANGE_PRESETS;
export const SHOT_RANGE_CHOICES = ['standard', 'calm', 'balanced', 'dynamic', 'custom'] as const;
export type ShotRangeChoice = (typeof SHOT_RANGE_CHOICES)[number];

export function projectShotsPerMinute(project: {
  readonly shotsPerMinute?: ShotsPerMinute | undefined;
}): ShotsPerMinute | undefined {
  return project.shotsPerMinute;
}

export function projectFasterChecks(project: {
  readonly fasterChecks?: boolean | undefined;
}): boolean {
  return project.fasterChecks ?? false;
}

/** The preset a range is (or `custom`; no range = `standard`). */
export function shotRangeChoice(range: ShotsPerMinute | undefined | null): ShotRangeChoice {
  if (range === undefined || range === null) return 'standard';
  for (const [id, preset] of Object.entries(SHOT_RANGE_PRESETS)) {
    if (preset.min === range.min && preset.max === range.max) return id as ShotRangePresetId;
  }
  return 'custom';
}

/** Storyboard rules derived from a range (validator, prompt). */
export interface ShotRangeRules {
  /** Hard shot length limits (s): max(14, 1.5 x 60 / min) and max(1, 0.4 x 60 / max). */
  readonly maxShotS: number;
  readonly minShotS: number;
  /** Typical lengths (warning outside, s): 0.6 x 60 / max .. 1.2 x 60 / min (<= maxShotS). */
  readonly typicalMinShotS: number;
  readonly typicalMaxShotS: number;
  /** One roll + look + treatment at most this long (s): max(8, 1.2 x 60 / min). */
  readonly maxPatternS: number;
  /** A cut inside a sentence needs a sentence longer than this (s): min(12, 1.5 x 60 / max). */
  readonly longSentenceS: number;
  /** Tension targets: 60 / min at tension 0, 60 / max at tension 1. */
  readonly tempo: ShotTempo;
}

const round1 = (value: number): number => Math.round(value * 10) / 10;

export function shotRangeRules(range: ShotsPerMinute): ShotRangeRules {
  const longest = 60 / range.min;
  const shortest = 60 / range.max;
  const maxShotS = round1(Math.max(14, 1.5 * longest));
  return {
    maxShotS,
    minShotS: round1(Math.max(1, 0.4 * shortest)),
    typicalMinShotS: round1(0.6 * shortest),
    typicalMaxShotS: round1(Math.min(maxShotS, 1.2 * longest)),
    maxPatternS: round1(Math.max(8, 1.2 * longest)),
    longSentenceS: round1(Math.min(12, 1.5 * shortest)),
    tempo: { calmS: round1(longest), peakS: round1(shortest) },
  };
}

/** The film's average may miss the range by this share before it is an error. */
export const SHOT_RANGE_TOLERANCE = 0.1;
/** A 60 s window warns outside [min x low, max x high]. */
export const SHOT_RANGE_WINDOW = { low: 0.6, high: 1.4 } as const;

/** Shots a film of `durationS` should have for the range (rounded). */
export function expectedShots(
  range: ShotsPerMinute,
  durationS: number,
): { readonly min: number; readonly max: number } {
  const minutes = Math.max(0, durationS) / 60;
  return {
    min: Math.max(1, Math.round(range.min * minutes)),
    max: Math.max(1, Math.round(range.max * minutes)),
  };
}

/** Shots per minute of the 2.x pipeline without a range (real runs: 12.5/min, 13/min). */
export const DEFAULT_SHOTS_PER_MINUTE = { min: 10, max: 13 } as const;
const DEFAULT_MID = (DEFAULT_SHOTS_PER_MINUTE.min + DEFAULT_SHOTS_PER_MINUTE.max) / 2;
/** Faster checks leave about this share of the scene build time (critic sample, fewer fixes). */
const FASTER_CHECKS_FACTOR = 0.85;

export interface SceneCountEstimate {
  readonly shots: { readonly min: number; readonly max: number };
  /** Build time saved against the default, percent, rounded to 5 (negative = slower). */
  readonly buildSavingPct: number;
}

/**
 * Expected scenes and build saving: scene builds dominate the build and scale with the shot
 * count; a longer shot costs a little more to build (+25 % at the far end). An estimate.
 */
export function sceneCountEstimate(
  minutes: number,
  range: ShotsPerMinute | undefined,
  fasterChecks: boolean,
): SceneCountEstimate {
  const rates = range ?? DEFAULT_SHOTS_PER_MINUTE;
  const shots = expectedShots(rates, minutes * 60);
  const share = range === undefined ? 1 : (range.min + range.max) / 2 / DEFAULT_MID;
  const relative = share * (1 + 0.25 * Math.max(0, 1 - share));
  const time = relative * (fasterChecks ? FASTER_CHECKS_FACTOR : 1);
  return { shots, buildSavingPct: Math.round(((1 - time) * 100) / 5) * 5 };
}

/** `10:42` from seconds. */
export function filmClock(seconds: number): string {
  const whole = Math.round(Math.max(0, seconds));
  return `${String(Math.floor(whole / 60))}:${String(whole % 60).padStart(2, '0')}`;
}

/** "3–5" of a range. */
export function formatShotRange(range: ShotsPerMinute): string {
  return range.min === range.max ? String(range.min) : `${String(range.min)}–${String(range.max)}`;
}

/** "≈ 32–54 scenes for a 10:42 film; roughly 50 % faster build than the default". */
export function describeSceneCountEstimate(
  durationS: number,
  range: ShotsPerMinute | undefined,
  fasterChecks: boolean,
): string {
  const estimate = sceneCountEstimate(durationS / 60, range, fasterChecks);
  const { min, max } = estimate.shots;
  const scenes = `≈ ${min === max ? String(min) : `${String(min)}–${String(max)}`} scenes for a ${filmClock(durationS)} film`;
  const saving = estimate.buildSavingPct;
  if (range === undefined && !fasterChecks) return `${scenes} (the default)`;
  if (saving === 0) return `${scenes}; about the default build time`;
  return saving > 0
    ? `${scenes}; roughly ${String(saving)} % faster build than the default`
    : `${scenes}; roughly ${String(-saving)} % slower build than the default`;
}

/** One line after the storyboard: "42 shots for 10:42 · 3.9/min · range 3–5". */
export function shotsSummary(shots: number, durationS: number, range: ShotsPerMinute): string {
  const perMinute = durationS > 0 ? (shots * 60) / durationS : 0;
  return `${String(shots)} shots for ${filmClock(durationS)} · ${perMinute.toFixed(1)}/min · range ${formatShotRange(range)}`;
}
