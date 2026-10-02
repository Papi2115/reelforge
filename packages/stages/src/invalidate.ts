/**
 * After a stage changes its output, everything downstream that already produced something is
 * marked stale in pipeline.json (outputs kept; "Redo" clears the flag). E.g. a replaced voice-over
 * makes Audio cleaned, Words timed, Storyboard, Scenes built, … stale; scene files stay untouched
 * and keep working because they reference words through anchors.
 */
import type { JsonFileError, PipelineStateStore, Result } from '@reelforge/claude-bridge';
import type { PipelineState, StageState } from '@reelforge/shared';
import { downstreamOf, type PipelineStage } from './ids.js';
import { STAGE_OUTPUT_FILES } from './paths.js';
import type { ProjectSnapshot } from './snapshot.js';

function hasOutputs(stage: PipelineStage, snapshot: ProjectSnapshot): boolean {
  if (stage === 'scenes') return snapshot.hasSceneFiles;
  if (stage === 'voiceover') return snapshot.voiceover !== undefined;
  return STAGE_OUTPUT_FILES[stage].some((file) => snapshot.files.has(file));
}

/** Downstream stages of `stage` that ran or have output files (the ones to mark stale). */
export function stagesToInvalidate(
  stage: PipelineStage,
  snapshot: ProjectSnapshot,
): PipelineStage[] {
  return downstreamOf(stage).filter((candidate) => {
    const state = snapshot.stages[candidate];
    const ran = state !== undefined && state.status !== 'idle';
    return ran || hasOutputs(candidate, snapshot);
  });
}

export function markStale(
  state: PipelineState,
  stages: readonly PipelineStage[],
  reason: string,
  stamp: string,
): PipelineState {
  const next: Record<string, StageState> = { ...state.stages };
  for (const stage of stages) {
    const current = next[stage];
    next[stage] = {
      ...(current ?? { status: 'idle' }),
      updatedAt: stamp,
      stale: true,
      staleReason: reason,
    };
  }
  return { ...state, stages: next };
}

export function invalidateDownstream(
  store: PipelineStateStore,
  projectDir: string,
  stages: readonly PipelineStage[],
  reason: string,
  now: () => Date,
): Promise<Result<PipelineState, JsonFileError>> {
  return store.update(projectDir, (state) => markStale(state, stages, reason, now().toISOString()));
}
