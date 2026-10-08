/**
 * Storyboard checks of the continuity links (PLAN.md#13.2, continuity.ts in @reelforge/shared):
 * never on the first shot (`continuity-first`), a continuity style in `transitionIn` only on a
 * linked shot (`continuity-style`; the stage writes it from the link), rare — about one per 45 s, or
 * per the world's pace (worlds/pace.ts, Comic: one per ~18 s) — (`continuity-spacing`,
 * `continuity-budget`) — and the object named in both shots' intents
 * (`continuity-object`), so both scenes build it. Storyboards without links get no issue.
 */
import {
  continuityBudget,
  continuityKindOf,
  CONTINUITY_RULES,
  type StoryboardShot,
} from '@reelforge/shared';
import { paceContinuityBudget } from '../worlds/pace.js';
import { issue, type ValidationIssue } from './issues.js';

const where = (index: number): string => `shots[${String(index)}].continuity`;

/** Lower-case word stems of an object name (`cartridges` -> `cartridge`), 3+ letters. */
function stems(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 3)
    .map((word) => (word.length > 4 && word.endsWith('s') ? word.slice(0, -1) : word));
}

function namesObject(intent: string, object: string): boolean {
  const lower = intent.toLowerCase();
  return stems(object).some((stem) => lower.includes(stem));
}

function shotIssues(shots: readonly StoryboardShot[]): ValidationIssue[] {
  return shots.flatMap((shot, index): ValidationIssue[] => {
    const link = shot.continuity;
    const previous = shots[index - 1];
    const styled = continuityKindOf(shot.transitionIn);
    if (link === undefined) {
      return styled === undefined
        ? []
        : [
            issue(
              'error',
              'continuity-style',
              `${shot.id}: transitionIn names a continuity style but the shot has no "continuity" link; add the link (the app writes its transition) or use another style`,
              `shots[${String(index)}].transitionIn.style`,
            ),
          ];
    }
    if (previous === undefined) {
      return [
        issue(
          'error',
          'continuity-first',
          `${shot.id}: the first shot cannot continue a previous one; remove its "continuity"`,
          where(0),
        ),
      ];
    }
    const named =
      namesObject(previous.intent, link.object) && namesObject(shot.intent, link.object);
    return named
      ? []
      : [
          issue(
            'warning',
            'continuity-object',
            `${previous.id} -> ${shot.id}: name the linked object "${link.object}" in both intents so both scenes build it`,
            `${where(index)}.object`,
          ),
        ];
  });
}

function rarityIssues(shots: readonly StoryboardShot[], everyS: number): ValidationIssue[] {
  const linked = shots.flatMap((shot, index) =>
    shot.continuity === undefined || index === 0 ? [] : [{ shot, index }],
  );
  const issues: ValidationIssue[] = [];
  linked.forEach(({ shot, index }, order) => {
    const before = linked[order - 1];
    if (before === undefined) return;
    const gap = shot.t0 - before.shot.t0;
    if (gap < everyS) {
      issues.push(
        issue(
          'warning',
          'continuity-spacing',
          `${before.shot.id} and ${shot.id} are linked ${gap.toFixed(1)} s apart; keep continuity links rare (about one per ${String(everyS)} s) for the moments the narration really carries across`,
          where(index),
        ),
      );
    }
  });
  const durationS = shots.at(-1)?.t1 ?? 0;
  const budget =
    everyS === CONTINUITY_RULES.spacingS
      ? continuityBudget(durationS)
      : paceContinuityBudget(durationS, everyS);
  if (linked.length > budget) {
    issues.push(
      issue(
        'warning',
        'continuity-budget',
        `${String(linked.length)} continuity links in ${durationS.toFixed(0)} s (at most ${String(budget)}); keep the strongest and cut the others`,
        'shots',
      ),
    );
  }
  return issues;
}

/**
 * Continuity link checks of a storyboard (its linked transitions already written); `everyS` = a
 * world's link pace (default: the rule's one per 45 s).
 */
export function checkContinuity(
  shots: readonly StoryboardShot[],
  everyS: number = CONTINUITY_RULES.spacingS,
): ValidationIssue[] {
  return [...shotIssues(shots), ...rarityIssues(shots, everyS)];
}
