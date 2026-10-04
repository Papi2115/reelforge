/**
 * The Storyboard stage's beat-sync step (PLAN.md#12.21): nothing at all with `beatSync` off;
 * with `auto` the grid is written, the cuts snapped and the storyboard validated again by the
 * stage's own check (`stage.ts`).
 */
import { ok, type Result } from '@reelforge/claude-bridge';
import { storyboardOutputSchema, type StoryboardOutput } from '@reelforge/prompts';
import {
  BEATS_FILE,
  projectBeatSync,
  type ProjectFile,
  type TensionFile,
  type WordsFile,
} from '@reelforge/shared';
import { writeProjectJson } from '../files.js';
import { FILES } from '../paths.js';
import type { Loaded } from '../snapshot.js';
import type { OutputCheck } from '../stages/repair.js';
import type { StageContext, StageError } from '../types.js';
import { syncStoryboardToBeats } from './stage.js';

/** With beat sync a boundary may sit this far into the pause before its word (validator rule). */
export const BEAT_SYNC_PAUSE_LEAD_S = 0.2;

/** Extra storyboard validation options with beat sync on (none when off: the 2.1 checks). */
export function beatSyncCheckOptions(project: Loaded<ProjectFile>): {
  readonly rules?: { readonly pauseLeadS: number };
} {
  return project.status === 'ok' && projectBeatSync(project.value) === 'auto'
    ? { rules: { pauseLeadS: BEAT_SYNC_PAUSE_LEAD_S } }
    : {};
}

export interface StoryboardBeatSync {
  readonly storyboard: StoryboardOutput;
  readonly warnings: readonly string[];
  /** Files the step wrote (none when off). */
  readonly outputs: readonly string[];
}

export async function storyboardBeatSync(
  ctx: StageContext,
  project: ProjectFile,
  storyboard: StoryboardOutput,
  words: WordsFile,
  tension: TensionFile | undefined,
  check: () => Promise<OutputCheck<StoryboardOutput>>,
): Promise<Result<StoryboardBeatSync, StageError>> {
  if (projectBeatSync(project) !== 'auto') return ok({ storyboard, warnings: [], outputs: [] });
  ctx.step('Snapping cuts to the beat', 85);
  const synced = await syncStoryboardToBeats({
    projectDir: ctx.projectDir,
    storyboard,
    words: words.words,
    styleId: project.style,
    tension: tension?.points,
    write: (value) =>
      writeProjectJson(ctx.projectDir, FILES.storyboard, storyboardOutputSchema, value),
    revalidate: async () => (await check()).problems,
  });
  if (!synced.ok) return synced;
  return ok({
    storyboard: synced.value.storyboard,
    warnings: synced.value.warnings,
    outputs: [BEATS_FILE],
  });
}
