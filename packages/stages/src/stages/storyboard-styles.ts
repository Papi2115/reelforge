/**
 * Storyboard helpers (PLAN.md#7.3): in `mixed` projects the transition-kit styles the storyboard
 * left out (ADR-011; a world's project gets the world's page-native styles, PLAN.md#13.6), and the
 * treatment mix for the report.
 */
import { ok, type Result } from '@reelforge/claude-bridge';
import { storyboardOutputSchema, type StoryboardOutput } from '@reelforge/prompts';
import { assignTransitionStyles } from '@reelforge/shared';
import { writeProjectJson } from '../files.js';
import { FILES } from '../paths.js';
import type { StageContext, StageError } from '../types.js';
import { assignWorldTransitions, worldTransitionOptions, type LookSetup } from '../worlds.js';

/** Fills the missing transition styles and writes storyboard.json back when any changed. */
export async function assignStyles(
  ctx: StageContext,
  storyboard: StoryboardOutput,
  seed: number,
  setup: LookSetup,
): Promise<Result<StoryboardOutput, StageError>> {
  const assigned =
    setup.world === undefined
      ? assignTransitionStyles(storyboard.shots, seed)
      : assignWorldTransitions(storyboard.shots, worldTransitionOptions(setup.world), seed);
  if (assigned.changed.length === 0) return ok(storyboard);
  return writeProjectJson(ctx.projectDir, FILES.storyboard, storyboardOutputSchema, {
    ...storyboard,
    shots: assigned.shots,
  });
}

export function treatmentCounts(storyboard: StoryboardOutput): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const shot of storyboard.shots) counts[shot.treatment] = (counts[shot.treatment] ?? 0) + 1;
  return counts;
}
