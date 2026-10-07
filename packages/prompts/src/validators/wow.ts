/**
 * Storyboard checks of the wow transitions (ADR-028, `WOW_RULES`): none in the first 6 s (an
 * `enter-*` may open a `hook` shot), at most about one per 40 s (`wow-spacing` / `wow-budget`:
 * error closer than 25 s or above one per 25 s, warning closer than 40 s or above one per 40 s),
 * never two in a row unless the dives continue a `scaleSequence` (`wow-in-a-row`, chains of at
 * most `maxScaleSteps`), the same style not twice within 90 s (`wow-repeat`), the transition not
 * longer than its shot, and `focus` only where the style uses it. Storyboards without wow styles
 * get no issue.
 */
import {
  getTransitionStyle,
  isContinuityStyle,
  WOW_RULES,
  wowOccurrences,
  wowStyleOf,
  type StoryboardShot,
  type WowOccurrence,
} from '@reelforge/shared';
import { issue, type ValidationIssue } from './issues.js';

const where = (index: number): string => `shots[${String(index)}].transitionIn`;
const seconds = (value: number): string => `${value.toFixed(1)} s`;

function earlyIssues(
  shots: readonly StoryboardShot[],
  moments: readonly WowOccurrence[],
): ValidationIssue[] {
  return moments.flatMap((moment) => {
    if (moment.t >= WOW_RULES.hookS) return [];
    const hook = shots[moment.index]?.hook === true && moment.style.wow?.family === 'enter';
    if (hook) return [];
    return [
      issue(
        'error',
        'wow-early',
        `${moment.shotId}: no wow transition in the first ${String(WOW_RULES.hookS)} s (${moment.style.id} at ${seconds(moment.t)}); only an enter-* style may open a shot marked "hook": true`,
        `${where(moment.index)}.style`,
      ),
    ];
  });
}

function rowIssues(
  shots: readonly StoryboardShot[],
  moments: readonly WowOccurrence[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  let steps = 0;
  for (const moment of moments) {
    steps = moment.chained ? steps + 1 : 1;
    const previous = shots[moment.index - 1];
    if (!moment.chained && wowStyleOf(previous) !== undefined) {
      issues.push(
        issue(
          'error',
          'wow-in-a-row',
          `${previous?.id ?? '?'} and ${moment.shotId} both open with a wow transition; never two in a row (dive-in / dive-out may chain only over shots marked "scaleSequence": true)`,
          `${where(moment.index)}.style`,
        ),
      );
    }
    if (moment.chained && steps === WOW_RULES.maxScaleSteps + 1) {
      issues.push(
        issue(
          'warning',
          'wow-scale-sequence',
          `the scale sequence up to ${moment.shotId} chains more than ${String(WOW_RULES.maxScaleSteps)} dives`,
          `${where(moment.index)}.style`,
        ),
      );
    }
  }
  return issues;
}

function spacingIssues(moments: readonly WowOccurrence[], durationS: number): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const starts = moments.filter((moment) => !moment.chained);
  starts.forEach((moment, index) => {
    const before = starts[index - 1];
    if (before === undefined) return;
    const gap = moment.t - before.t;
    if (gap >= WOW_RULES.warnSpacingS) return;
    const severity = gap < WOW_RULES.errorSpacingS ? 'error' : 'warning';
    issues.push(
      issue(
        severity,
        'wow-spacing',
        `wow transitions ${seconds(gap)} apart (${before.shotId} -> ${moment.shotId}); keep them about ${String(WOW_RULES.warnSpacingS)}–90 s apart`,
        `${where(moment.index)}.style`,
      ),
    );
  });
  const errorBudget = Math.max(1, Math.floor(durationS / WOW_RULES.errorSpacingS));
  const warnBudget = Math.max(1, Math.floor(durationS / WOW_RULES.warnSpacingS));
  if (starts.length > warnBudget) {
    issues.push(
      issue(
        starts.length > errorBudget ? 'error' : 'warning',
        'wow-budget',
        `${String(starts.length)} wow transitions in ${seconds(durationS)}; at most ${String(warnBudget)} (about one per ${String(WOW_RULES.warnSpacingS)} s)`,
      ),
    );
  }
  return issues;
}

function repeatIssues(moments: readonly WowOccurrence[]): ValidationIssue[] {
  const starts = moments.filter((moment) => !moment.chained);
  return starts.flatMap((moment, index) => {
    const earlier = starts
      .slice(0, index)
      .find(
        (other) =>
          other.style.id === moment.style.id && moment.t - other.t < WOW_RULES.repeatWindowS,
      );
    return earlier === undefined
      ? []
      : [
          issue(
            'warning',
            'wow-repeat',
            `${moment.style.id} again ${seconds(moment.t - earlier.t)} after ${earlier.shotId}; a wow style should not repeat within ${String(WOW_RULES.repeatWindowS)} s`,
            `${where(moment.index)}.style`,
          ),
        ];
  });
}

function shotIssues(
  shots: readonly StoryboardShot[],
  moments: readonly WowOccurrence[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = moments.flatMap((moment) => {
    const shot = shots[moment.index];
    const transition = shot?.transitionIn;
    if (shot === undefined || transition === undefined || transition.type === 'cut') return [];
    return transition.duration > shot.t1 - shot.t0
      ? [
          issue(
            'error',
            'wow-too-long',
            `${moment.style.id} into ${shot.id} lasts ${String(transition.duration)} s, longer than the shot (${(shot.t1 - shot.t0).toFixed(2)} s)`,
            `${where(moment.index)}.duration`,
          ),
        ]
      : [];
  });
  shots.forEach((shot, index) => {
    const transition = shot.transitionIn;
    if (transition === undefined || transition.type === 'cut' || transition.focus === undefined) {
      return;
    }
    if (getTransitionStyle(transition.style)?.wow?.focus === true) return;
    // A continuity link renders with its anchor as the focus (ADR-030, `continuityTransition`).
    if (isContinuityStyle(transition.style)) return;
    issues.push(
      issue(
        'warning',
        'transition-focus',
        `${shot.id}: "focus" is used only by the enter-*, dive-*, shatter and cube-smash styles (it has ${transition.style ?? transition.type})`,
        `${where(index)}.focus`,
      ),
    );
  });
  return issues;
}

/** The wow-transition checks of a storyboard (see the module comment). */
export function checkWowTransitions(shots: readonly StoryboardShot[]): ValidationIssue[] {
  const moments = wowOccurrences(shots);
  const durationS = shots.at(-1)?.t1 ?? 0;
  return [
    ...earlyIssues(shots, moments),
    ...rowIssues(shots, moments),
    ...spacingIssues(moments, durationS),
    ...repeatIssues(moments),
    ...shotIssues(shots, moments),
  ];
}
