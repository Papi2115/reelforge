/**
 * Pure builders of the pipeline sidebar state (PLAN.md#6.8): which stages the app can start (one
 * line each in STAGE_RUNS), the stage infos (pipeline.json + files + gating + this session's
 * errors), the script acceptance gate (PLAN.md#7.1) and the crash recovery of pipeline.json.
 */
import type { PipelineStateStore } from '@reelforge/claude-bridge';
import type { PipelineState, StageState } from '@reelforge/shared';
import {
  canRun,
  downstreamOf,
  isStageId,
  PIPELINE_STAGES,
  STAGE_OUTPUT_FILES,
  stagesToInvalidate,
  type PipelineStage,
  type ProjectSnapshot,
  type StageError,
  type StageRequest,
} from '@reelforge/stages';
import type { StageErrorInfo, StageInfo } from '../../shared/stages-contract.js';
import type { Logger } from '../logger.js';
import { exportReasons } from './export-stage.js';

/** What the app queues: a runner stage, or the export (run by the app's render backend). */
export type AppStageRequest = StageRequest | { readonly stage: 'export' };

/**
 * What the sidebar can start, per stage: the Run request, or `replace-only` (the voice-over needs
 * a recording: Replace / Record). Every pipeline stage is registered.
 */
export const STAGE_RUNS: Readonly<Record<PipelineStage, AppStageRequest | 'replace-only'>> = {
  script: { stage: 'script' },
  voiceover: 'replace-only',
  clean: { stage: 'clean' },
  words: { stage: 'words' },
  storyboard: { stage: 'storyboard' },
  scenes: { stage: 'scenes' },
  'sound-cues': { stage: 'sound-cues' },
  mix: { stage: 'mix' },
  export: { stage: 'export' },
};

export function runRequestFor(stage: PipelineStage): AppStageRequest | undefined {
  const run = STAGE_RUNS[stage];
  return run === 'replace-only' ? undefined : run;
}

/**
 * The quiet final review (PLAN.md#11.5) that follows a successful whole-film Scenes build when the
 * setting is on (a "Rebuild this shot" or a review run is not followed by one).
 */
export function followUpReview(
  request: AppStageRequest,
  enabled: boolean,
): AppStageRequest | undefined {
  if (!enabled || request.stage !== 'scenes') return undefined;
  if ((request.action ?? 'build') !== 'build' || request.shots !== undefined) return undefined;
  return { stage: 'scenes', action: 'final-review', trigger: 'auto' };
}

export const INTERRUPTED_MESSAGE = 'Interrupted: the app closed while it was running.';
export const INTERRUPTED_PAUSE_MESSAGE =
  'Interrupted: the app closed while it waited for the usage limit to reset.';
export const APPROVAL_REASON = 'Approve the script first (Script written → Open → Approve script).';

/** Gating reasons + the script approval for `stage` (Run/Redo and the sidebar). */
export function gateReasons(stage: PipelineStage, snapshot: ProjectSnapshot): string[] {
  return readinessOf(stage, snapshot).reasons;
}

/** Stages that read the script (directly or not) wait for the user's approval of it. */
export function approvalReasons(stage: PipelineStage, snapshot: ProjectSnapshot): string[] {
  if (!downstreamOf('script').includes(stage)) return [];
  return snapshot.stages['script']?.approvedAt === undefined ? [APPROVAL_REASON] : [];
}

/**
 * pipeline.json after an app restart: nothing is in flight, so `running` and `paused` stages
 * become `failed` + `interrupted` (they can be run again). Returns the ids it changed.
 */
export function recoverInterrupted(
  state: PipelineState,
  stamp: string,
): { readonly state: PipelineState; readonly recovered: string[] } {
  const stages: Record<string, StageState> = { ...state.stages };
  const recovered: string[] = [];
  for (const [id, current] of Object.entries(stages)) {
    if (current.status !== 'running' && current.status !== 'paused') continue;
    stages[id] = {
      ...current,
      status: 'failed',
      interrupted: true,
      message: current.status === 'paused' ? INTERRUPTED_PAUSE_MESSAGE : INTERRUPTED_MESSAGE,
      updatedAt: stamp,
    };
    recovered.push(id);
  }
  return { state: { ...state, stages }, recovered };
}

export function stageHasOutput(
  stage: PipelineStage,
  snapshot: ProjectSnapshot,
  hasVideo: boolean,
): boolean {
  switch (stage) {
    case 'voiceover':
      return snapshot.voiceover !== undefined;
    case 'scenes':
      return snapshot.hasSceneFiles;
    case 'export':
      return hasVideo;
    default:
      return STAGE_OUTPUT_FILES[stage].some((file) => snapshot.files.has(file));
  }
}

export function errorInfo(error: StageError): StageErrorInfo {
  return { kind: error.kind, message: error.message, issues: [...(error.issues ?? [])] };
}

export interface StageInfoInput {
  readonly snapshot: ProjectSnapshot;
  /** An exported video exists in out/. */
  readonly hasVideo: boolean;
  readonly errors: ReadonlyMap<PipelineStage, StageErrorInfo>;
  readonly warnings: ReadonlyMap<PipelineStage, readonly string[]>;
}

function readinessOf(
  stage: PipelineStage,
  snapshot: ProjectSnapshot,
): { ready: boolean; reasons: string[] } {
  const readiness = isStageId(stage) ? canRun(stage, snapshot).reasons : exportReasons(snapshot);
  const reasons = [...readiness, ...approvalReasons(stage, snapshot)];
  return { ready: reasons.length === 0, reasons };
}

export function buildStageInfos(input: StageInfoInput): StageInfo[] {
  const { snapshot } = input;
  return PIPELINE_STAGES.map((stage): StageInfo => {
    const state = snapshot.stages[stage];
    const run = STAGE_RUNS[stage];
    const readiness = readinessOf(stage, snapshot);
    return {
      stage,
      status: state?.status ?? null,
      message: state?.message ?? null,
      updatedAt: state?.updatedAt ?? null,
      stale: state?.stale === true,
      staleReason: state?.staleReason ?? null,
      interrupted: state?.interrupted === true,
      approvedAt: state?.approvedAt ?? null,
      hasOutput: stageHasOutput(stage, snapshot, input.hasVideo),
      registered: true,
      runnable: run !== 'replace-only',
      ready: readiness.ready,
      reasons: readiness.reasons,
      invalidates: stagesToInvalidate(stage, snapshot),
      error: input.errors.get(stage) ?? null,
      warnings: [...(input.warnings.get(stage) ?? [])],
    };
  });
}

/** Applies `recoverInterrupted` to pipeline.json of `dir` and logs what it did. */
export async function recoverPipeline(
  store: PipelineStateStore,
  dir: string,
  stamp: string,
  log: Logger,
): Promise<void> {
  const read = await store.read(dir);
  if (!read.ok) {
    log.warn(`pipeline.json of ${dir}: ${read.error.message}`);
    return;
  }
  if (recoverInterrupted(read.value, stamp).recovered.length === 0) return;
  let recovered: string[] = [];
  const updated = await store.update(dir, (state) => {
    const next = recoverInterrupted(state, stamp);
    recovered = next.recovered;
    return next.state;
  });
  if (!updated.ok) log.warn(`pipeline.json not recovered: ${updated.error.message}`);
  else log.info(`interrupted stage(s) after a restart: ${recovered.join(', ')}`);
}
