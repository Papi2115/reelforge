/**
 * Continuity links in the pipeline (PLAN.md#13.2, continuity.ts in @reelforge/shared): the
 * storyboard prompt section (project switch `continuityLinks`; off = the prompt is exactly as
 * before), the linked shots' `transitionIn` written from their links after validation, the
 * scene-build directive of both shots of a link and the "continuity" line of the final review.
 * Storyboards without links are never touched.
 */
import { ok, type Result } from '@reelforge/claude-bridge';
import { storyboardOutputSchema, type StoryboardOutput } from '@reelforge/prompts';
import {
  applyContinuityTransitions,
  continuityBudget,
  continuityDuration,
  plannedLinks,
  projectContinuityLinks,
  type ContinuityLink,
  type FinalReviewShot,
  type ProjectFile,
  type StoryboardShot,
} from '@reelforge/shared';
import { writeProjectJson } from './files.js';
import { FILES } from './paths.js';
import type { StageContext, StageError } from './types.js';

/** Storyboard prompt vars: the continuity section and the film's link budget (switch on only). */
export function storyboardContinuityVars(
  project: Pick<ProjectFile, 'continuityLinks'>,
  narrationEndS: number,
): Record<string, unknown> {
  if (!projectContinuityLinks(project)) return {};
  return { continuityLinks: true, continuityBudget: continuityBudget(narrationEndS) };
}

/** Writes the linked shots' `transitionIn` from their links into storyboard.json (no link: as is). */
export async function applyStoryboardContinuity(
  ctx: StageContext,
  storyboard: StoryboardOutput,
): Promise<Result<StoryboardOutput, StageError>> {
  const linked = applyContinuityTransitions(storyboard.shots);
  if (linked.changed.length === 0) return ok(storyboard);
  return writeProjectJson(ctx.projectDir, FILES.storyboard, storyboardOutputSchema, {
    ...storyboard,
    shots: linked.shots,
  });
}

function at(link: ContinuityLink): string {
  const anchor = link.anchor ?? { x: 0.5, y: 0.5 };
  return `x ${anchor.x.toFixed(2)}, y ${anchor.y.toFixed(2)}`;
}

/** What the outgoing shot of a link must do in its last second. */
function handOver(next: StoryboardShot, link: ContinuityLink, duration: number): string {
  const object = `"${link.object}"`;
  const end = {
    'zoom-through': `push the camera slowly toward ${object} in the last 1.5 s (the app zooms the rest of the way into it)`,
    'shared-object': `hold ${object} still at that spot and size for the last second`,
    'carry-environment': `keep the set and the camera still for the last second (the next shot continues the same place; only ${object} changes)`,
  }[link.kind];
  return `This shot hands over to ${next.id} through a ${link.kind} link: end with ${object} whole and unobstructed at ${at(link)} of the frame and ${end}. The scene keeps rendering up to ${duration.toFixed(2)} s past its end while the link plays: keep update(t) valid there.`;
}

/** What the incoming shot of a link must do in its first second. */
function takeOver(previous: StoryboardShot, link: ContinuityLink): string {
  const object = `"${link.object}"`;
  const start = {
    'zoom-through': `open framed on ${object}, large and centred in the frame (the link zooms into the frame centre), then move on`,
    'shared-object': `open with ${object} at that same spot and size as ${previous.id} ends, the camera still for the first second, then show the new place around it`,
    'carry-environment': `open in the same place and with the same camera as ${previous.id} ends (rebuild its set), only ${object} different`,
  }[link.kind];
  const place =
    link.kind === 'zoom-through' ? '' : `; ${object} sits at ${at(link)} of the frame at the cut`;
  return `This shot continues ${previous.id} through a ${link.kind} link: ${start}${place}.`;
}

/** Scene-build prompt vars of one shot: the directive of the links it starts or ends (or none). */
export function sceneContinuityVars(
  shots: readonly StoryboardShot[],
  shot: StoryboardShot,
): Record<string, string> {
  const index = shots.findIndex((candidate) => candidate.id === shot.id);
  const previous = shots[index - 1];
  const next = shots[index + 1];
  const lines: string[] = [];
  if (previous !== undefined && shot.continuity !== undefined) {
    lines.push(takeOver(previous, shot.continuity));
  }
  if (next?.continuity !== undefined) {
    lines.push(handOver(next, next.continuity, continuityDuration(next, next.continuity)));
  }
  return lines.length === 0 ? {} : { continuityDirective: lines.join(' ') };
}

/**
 * The final review's "continuity" line: links planned in the storyboard vs rendered (the link's
 * transition is in place and neither of its shots failed). No links = no line.
 */
export function continuityReviewNotes(
  shots: readonly StoryboardShot[],
  entries: readonly FinalReviewShot[],
): string[] {
  const links = plannedLinks(shots);
  if (links.length === 0) return [];
  const failed = new Set(
    entries.filter((entry) => entry.status === 'failed').map((entry) => entry.shotId),
  );
  const missing = links.filter(
    (link) => !link.wired || failed.has(link.fromShotId) || failed.has(link.toShotId),
  );
  const rendered = links.length - missing.length;
  const detail =
    missing.length === 0
      ? ''
      : ` (not rendered: ${missing.map((link) => `${link.fromShotId} -> ${link.toShotId}`).join(', ')})`;
  return [
    `continuity: ${String(links.length)} link${links.length === 1 ? '' : 's'} planned, ${String(rendered)} rendered${detail}`,
  ];
}
