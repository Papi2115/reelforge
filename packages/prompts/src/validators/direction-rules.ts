/**
 * The numbers and shared checks of the Grim Ink direction rules (PLAN.md#14.16; measured on the
 * concept films, docs/worlds/c-cam-DIRECTION.md §2-§3): used by the plan validator (direction.ts)
 * and by the storyboard check against the plan (direction-storyboard.ts).
 */
import { CLOSE_FRAMINGS, type FramingStep } from '@reelforge/shared';
import { issue, type ValidationIssue } from './issues.js';

/** The numbers of the direction rules (measured on the concept films, c-cam-DIRECTION.md §2). */
export const DIRECTION_RULES = {
  /** Framings per beat / per storyboard shot (the depth rule). */
  minFramings: 2,
  maxFramings: 5,
  /** The title frame shot: one or two framings. */
  titleMaxFramings: 2,
  /** The payoff beat's middle sits at or after this share of the runtime. */
  payoffFrom: 0.7,
  /** Close + ECU framings: at least this share of all framings. */
  minCloseShare: 0.25,
  /** A person in this many shots plays the gag in at least this many of them. */
  minGagShots: 3,
  /** Distinct beats of a gag arc (setup, escalations, payoff). */
  minArcBeats: 3,
  minAccidents: 1,
  titleMaxWords: 6,
  /** The title frame shot's length (s). */
  titleMinS: 1.5,
  titleMaxS: 3,
  /** Beats may end this long after the narration (s). */
  tailS: 1,
} as const;

const err = (code: string, message: string, path?: string): ValidationIssue =>
  issue('error', code, message, path);

/** Close and ECU framings among the steps. */
export function closeFramings(steps: readonly FramingStep[]): FramingStep[] {
  return steps.filter((step) => CLOSE_FRAMINGS.includes(step.framing));
}

/** `why` missing on a close / ECU framing (one issue per framing). */
export function whyIssues(steps: readonly FramingStep[], path: string): ValidationIssue[] {
  return steps.flatMap((step, index) =>
    CLOSE_FRAMINGS.includes(step.framing) && step.why === undefined
      ? [
          err(
            'direction-why',
            `the ${step.framing} framing of "${step.subject}" has no "why": say what it tells (information, emotion, cause -> effect, consequence) or make it wider`,
            `${path}[${String(index)}]`,
          ),
        ]
      : [],
  );
}

/** Close + ECU share below the rule over all the given progressions. */
export function closeShareIssues(
  progressions: readonly (readonly FramingStep[])[],
  path: string,
): ValidationIssue[] {
  const all = progressions.flat();
  if (all.length === 0) return [];
  const share = closeFramings(all).length / all.length;
  if (share >= DIRECTION_RULES.minCloseShare) return [];
  const percent = Math.round(share * 100);
  return [
    err(
      'direction-all-wide',
      `only ${String(percent)} % of the framings are close-ups or ECUs (at least ${String(DIRECTION_RULES.minCloseShare * 100)} %): cut in to the object the narration names (ECU) and to the reaction (close) on the beats`,
      path,
    ),
  ];
}
