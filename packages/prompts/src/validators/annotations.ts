/**
 * Annotation plans of a storyboard (PLAN.md#11.8): every phrase must be spoken inside its shot
 * (scenes time the marks with it), and the plan must vary: no form three times in a row within
 * 20 s, at most 8 marks per minute, at least 3 different forms per busy minute of a ≥ 2 min film.
 */
import type { AnnotationPlan, StoryboardShot, WordsFile } from '@reelforge/shared';
import { issue, type ValidationIssue } from './issues.js';

export interface AnnotationRules {
  /** The same form may follow itself this many times in a row (inside `runWindowS`). Default 2. */
  readonly maxKindRun: number;
  readonly runWindowS: number;
  /** Most marks in any 60 s window. Default 8. */
  readonly maxPerMinute: number;
  /** Films this long (s) need `minKindsPerMinute` forms in every minute with 3+ marks. */
  readonly varietyFromS: number;
  readonly minKindsPerMinute: number;
}

export const DEFAULT_ANNOTATION_RULES: AnnotationRules = {
  maxKindRun: 2,
  runWindowS: 20,
  maxPerMinute: 8,
  varietyFromS: 120,
  minKindsPerMinute: 3,
};

/** Window of the `annotation-density` rule, seconds. */
export const ANNOTATION_DENSITY_WINDOW_S = 60;
const MINUTE_S = ANNOTATION_DENSITY_WINDOW_S;

/**
 * Rules that only say "too many / too repetitive marks": dropping marks always satisfies them, so
 * the storyboard stage may trim instead of failing (variety is a warning and needs no fix).
 */
export const ANNOTATION_COUNT_CODES: readonly string[] = ['annotation-density', 'annotation-run'];
/** A phrase may start this much before its shot (a word boundary cut). */
const PHRASE_SLACK_S = 0.05;

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

interface SpokenToken {
  readonly token: string;
  readonly t: number;
}

/** Start times of every occurrence of `phrase` in the words (normalized token sequence). */
export function phraseTimes(phrase: string, spoken: readonly SpokenToken[]): number[] {
  const wanted = tokens(phrase);
  if (wanted.length === 0) return [];
  const times: number[] = [];
  for (let start = 0; start + wanted.length <= spoken.length; start += 1) {
    if (wanted.every((token, offset) => spoken[start + offset]?.token === token)) {
      times.push(spoken[start]?.t ?? 0);
    }
  }
  return times;
}

function spokenTokens(words: WordsFile): SpokenToken[] {
  return words.words.flatMap((word) => tokens(word.text).map((token) => ({ token, t: word.t })));
}

/** An annotation plan placed at the time its phrase is spoken inside its shot. */
export interface TimedPlan {
  readonly plan: AnnotationPlan;
  readonly t: number;
  readonly path: string;
  readonly shotId: string;
  readonly shotIndex: number;
  /** Index in the shot's `annotations`. */
  readonly index: number;
}

function phraseIssues(
  shots: readonly StoryboardShot[],
  words: WordsFile | undefined,
): { issues: ValidationIssue[]; timed: TimedPlan[] } {
  const spoken = words === undefined ? undefined : spokenTokens(words);
  const issues: ValidationIssue[] = [];
  const timed: TimedPlan[] = [];
  shots.forEach((shot, shotIndex) => {
    (shot.annotations ?? []).forEach((plan, index) => {
      const path = `shots[${String(shotIndex)}].annotations[${String(index)}]`;
      if (spoken === undefined) {
        timed.push({ plan, t: shot.t0, path, shotId: shot.id, shotIndex, index });
        return;
      }
      const times = phraseTimes(plan.phrase, spoken);
      const inside = times.find((t) => t >= shot.t0 - PHRASE_SLACK_S && t < shot.t1);
      if (inside !== undefined) {
        timed.push({ plan, t: inside, path, shotId: shot.id, shotIndex, index });
        return;
      }
      issues.push(
        times.length === 0
          ? issue(
              'error',
              'annotation-phrase-missing',
              `${shot.id}: annotation phrase "${plan.phrase}" is not spoken (copy the exact words from words.json)`,
              `${path}.phrase`,
            )
          : issue(
              'error',
              'annotation-phrase-outside-shot',
              `${shot.id}: annotation phrase "${plan.phrase}" is spoken at ${times.map((t) => t.toFixed(2)).join(', ')} s, outside the shot (${shot.t0.toFixed(2)}–${shot.t1.toFixed(2)} s); plan it in the shot where it is said`,
              `${path}.phrase`,
            ),
      );
    });
  });
  return { issues, timed: timed.sort((first, second) => first.t - second.t) };
}

/**
 * The marks the variety rules count (source chips left out), at their phrase times, sorted by
 * time (stable: shot order on ties); plans whose phrase is not spoken in their shot are left out.
 */
export function timedAnnotationPlans(
  shots: readonly StoryboardShot[],
  words: WordsFile | undefined,
): TimedPlan[] {
  return phraseIssues(shots, words).timed.filter((entry) => entry.plan.kind !== 'source-chip');
}

function runIssues(timed: readonly TimedPlan[], rules: AnnotationRules): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  timed.forEach((entry, index) => {
    const run = timed.slice(Math.max(0, index - rules.maxKindRun), index + 1);
    const first = run[0];
    if (
      run.length === rules.maxKindRun + 1 &&
      first !== undefined &&
      run.every((other) => other.plan.kind === entry.plan.kind) &&
      entry.t - first.t <= rules.runWindowS
    ) {
      issues.push(
        issue(
          'error',
          'annotation-run',
          `${entry.shotId}: "${entry.plan.kind}" ${String(rules.maxKindRun + 1)} times in a row within ${(entry.t - first.t).toFixed(1)} s (max ${String(rules.maxKindRun)} within ${String(rules.runWindowS)} s); pick another form for the same meaning`,
          entry.path,
        ),
      );
    }
  });
  return issues;
}

function densityIssues(timed: readonly TimedPlan[], rules: AnnotationRules): ValidationIssue[] {
  for (const entry of timed) {
    const inMinute = timed.filter((other) => other.t >= entry.t && other.t < entry.t + MINUTE_S);
    if (inMinute.length > rules.maxPerMinute) {
      return [
        issue(
          'error',
          'annotation-density',
          `${String(inMinute.length)} annotations within one minute from ${entry.t.toFixed(1)} s (max ${String(rules.maxPerMinute)}); keep the strongest, let the picture breathe`,
          entry.path,
        ),
      ];
    }
  }
  return [];
}

function varietyIssues(
  timed: readonly TimedPlan[],
  durationS: number,
  rules: AnnotationRules,
): ValidationIssue[] {
  if (durationS < rules.varietyFromS) return [];
  const issues: ValidationIssue[] = [];
  for (let start = 0; start < durationS; start += MINUTE_S) {
    const inMinute = timed.filter((entry) => entry.t >= start && entry.t < start + MINUTE_S);
    const kinds = new Set(inMinute.map((entry) => entry.plan.kind));
    if (inMinute.length >= rules.minKindsPerMinute && kinds.size < rules.minKindsPerMinute) {
      issues.push(
        issue(
          'warning',
          'annotation-variety',
          `minute ${String(start / MINUTE_S + 1)} uses only ${[...kinds].join(', ')} for ${String(inMinute.length)} annotations (aim for ${String(rules.minKindsPerMinute)}+ different forms)`,
          inMinute[0]?.path,
        ),
      );
    }
  }
  return issues;
}

/** Annotation-plan checks of a storyboard; `words` enables the phrase checks. */
export function checkAnnotationPlans(
  shots: readonly StoryboardShot[],
  words: WordsFile | undefined,
  rules: Partial<AnnotationRules> = {},
): ValidationIssue[] {
  const merged = { ...DEFAULT_ANNOTATION_RULES, ...rules };
  const { issues, timed: all } = phraseIssues(shots, words);
  // A source chip credits a claim (PLAN.md#12.18); it is not a mark the variety rules count.
  const timed = all.filter((entry) => entry.plan.kind !== 'source-chip');
  const durationS = shots.at(-1)?.t1 ?? 0;
  return [
    ...issues,
    ...runIssues(timed, merged),
    ...densityIssues(timed, merged),
    ...varietyIssues(timed, durationS, merged),
  ];
}
