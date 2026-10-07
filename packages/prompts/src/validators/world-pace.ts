/**
 * Pace checks of a world whose pages flow into each other (worlds/pace.ts, Comic): never the same
 * page-native transition on two transitions in a row (`transition-repeat`, cuts between them do
 * not break the row), and never `dryCutRun` plain cuts in a row where no shot is linked
 * (`continuity`) and none flows (`dry-run`: the intent says the page flows down, across or
 * diagonally, or a thread carries one thing across its panels). The looser non-cut budget and the
 * denser continuity links are the rhythm and continuity checks with the pace's numbers
 * (storyboard.ts). Every finding is an error, so the storyboard's repair turn fixes it.
 */
import { continuityKindOf, type StoryboardShot } from '@reelforge/shared';
import type { WorldPace } from '../worlds/pace.js';
import { issue, type ValidationIssue } from './issues.js';

/** An intent that plans a flowing page or a carried thread (the scene builds `page.flow`/`thread`). */
const FLOWING =
  /\b(?:flows?|unfolds?|reads?|runs?)\s+(?:down(?:ward)?|across|diagonal(?:ly)?)\b|\bthread(?:s|ed)?\b|\bcarried across\b/i;

export function flowingIntent(intent: string): boolean {
  return FLOWING.test(intent);
}

/** How a shot enters: carried (a link, a page-native transition or a flowing page) or a plain cut. */
function carried(shot: StoryboardShot): boolean {
  const transition = shot.transitionIn;
  return (
    shot.continuity !== undefined ||
    (transition !== undefined && transition.type !== 'cut') ||
    flowingIntent(shot.intent)
  );
}

function repeatIssues(shots: readonly StoryboardShot[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  let previous: { readonly id: string; readonly style: string } | undefined;
  shots.forEach((shot, index) => {
    const transition = shot.transitionIn;
    if (transition === undefined || transition.type === 'cut') return;
    if (continuityKindOf(transition) !== undefined || transition.style === undefined) return;
    if (previous?.style === transition.style) {
      issues.push(
        issue(
          'error',
          'transition-repeat',
          `${previous.id} and ${shot.id} both open with ${transition.style}; never the same transition twice in a row: pick the one that fits what the narration does here`,
          `shots[${String(index)}].transitionIn.style`,
        ),
      );
    }
    previous = { id: shot.id, style: transition.style };
  });
  return issues;
}

function dryRunIssues(shots: readonly StoryboardShot[], run: number): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  let start = -1;
  let reported = false;
  shots.forEach((shot, index) => {
    if (index === 0 || carried(shot)) {
      start = -1;
      reported = false;
      return;
    }
    if (start < 0) start = index;
    const first = shots[start] ?? shot;
    if (!reported && index - start + 1 >= run) {
      reported = true;
      issues.push(
        issue(
          'error',
          'dry-run',
          `${first.id}…${shot.id}: ${String(run)} plain cuts in a row, nothing carried from page to page; let one of them flow: a page-native transition that fits the narration, a "continuity" link through the thing the narration follows, or a page that flows down or across (say "the page flows down/across" in its intent) or carries one thing across its panels (say "thread: <the thing>")`,
          `shots[${String(index)}].transitionIn`,
        ),
      );
    }
  });
  return issues;
}

/** The pace checks of a world film (none without a pace). */
export function checkWorldPace(
  shots: readonly StoryboardShot[],
  pace: WorldPace | undefined,
): ValidationIssue[] {
  if (pace === undefined) return [];
  return [...repeatIssues(shots), ...dryRunIssues(shots, pace.dryCutRun)];
}
