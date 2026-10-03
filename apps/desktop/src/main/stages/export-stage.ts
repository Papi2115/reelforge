/**
 * "Video exported" as a pipeline stage (PLAN.md#4.7, #6.8): the app's export (render windows +
 * ffmpeg, default preset 1080p30, encoder/workers from the settings) run from the sidebar, with
 * dependency gating (storyboard, scenes and the mix must exist and be up to date), progress mapped
 * to a stage step + percent, and the status persisted in pipeline.json like every other stage
 * (running -> done | failed | idle when stopped; a crash leaves `running`, recovered as interrupted).
 */
import { plural } from '../../shared/plural.js';
import path from 'node:path';
import type { PipelineStateStore } from '@reelforge/claude-bridge';
import type { ExportProgress } from '@reelforge/pipeline';
import { FILES, STAGE_TITLES, STAGE_UPSTREAM, type ProjectSnapshot } from '@reelforge/stages';
import type { ExportOutcome } from '../../shared/export-contract.js';
import type { StageErrorInfo } from '../../shared/stages-contract.js';
import type { Logger } from '../logger.js';

/** Why the export cannot start now (empty when it can). */
export function exportReasons(snapshot: ProjectSnapshot): string[] {
  const reasons: string[] = [];
  if (snapshot.project.status !== 'ok') reasons.push('project.json is missing or invalid.');
  if (snapshot.stages['export']?.status === 'running')
    reasons.push('Video exported is already running.');
  if (!snapshot.files.has(FILES.storyboard)) {
    reasons.push(`${FILES.storyboard} is missing: run Storyboard first.`);
  }
  if (!snapshot.hasSceneFiles) reasons.push('No scenes yet: run Scenes built first.');
  if (!snapshot.files.has(FILES.mix)) {
    reasons.push(`${FILES.mix} is missing: run Sound design mixed first.`);
  }
  for (const upstream of STAGE_UPSTREAM.export) {
    const state = snapshot.stages[upstream];
    const title = STAGE_TITLES[upstream];
    if (state?.status === 'running') reasons.push(`${title} is still running.`);
    else if (state?.stale === true) {
      const why = state.staleReason === undefined ? '' : ` (${state.staleReason})`;
      reasons.push(`${title} is out of date${why}: run it again first.`);
    }
  }
  return reasons;
}

export interface ExportStep {
  readonly label: string;
  /** Whole-stage completion 0..100; null = unchanged. */
  readonly percent: number | null;
}

/** Share of the bar the frame rendering takes (the rest: planning, mux, thumbnail). */
const RENDER_FROM = 5;
const RENDER_TO = 90;

/** Export progress -> the stage's step line and percent (null: nothing to show). */
export function exportStep(event: ExportProgress): ExportStep | null {
  switch (event.type) {
    case 'plan':
      return {
        label: `Planning: ${plural(event.shots, 'shot')}, ${String(event.cachedShots)} cached, ${event.encoder}`,
        percent: event.framesToRender === 0 ? RENDER_TO : RENDER_FROM,
      };
    case 'frame': {
      const share = event.framesToRender === 0 ? 1 : event.renderedFrames / event.framesToRender;
      const eta = event.etaS === null ? '' : ` · ${String(Math.ceil(event.etaS))} s left`;
      return {
        label: `Rendering ${event.shotId} (${String(event.renderedFrames)}/${String(event.framesToRender)} frames${eta})`,
        percent: RENDER_FROM + (RENDER_TO - RENDER_FROM) * Math.min(1, share),
      };
    }
    case 'mux':
      return { label: 'Encoding and adding the audio', percent: 92 };
    case 'thumbnail':
      return { label: 'Thumbnail', percent: 97 };
    case 'done':
      return { label: 'Done', percent: 100 };
    default:
      return null;
  }
}

/** `out/<title>.mp4` relative to the project when it is inside it. */
export function projectRelative(dir: string, file: string): string {
  const relative = path.relative(dir, file);
  return relative.startsWith('..') || path.isAbsolute(relative)
    ? file
    : relative.split(path.sep).join('/');
}

export type ExportStageResult =
  | { readonly status: 'done'; readonly message: string }
  | { readonly status: 'cancelled' }
  | { readonly status: 'failed'; readonly error: StageErrorInfo };

export interface ExportStageOptions {
  /** Starts the app's export (ExportController.start with a progress listener). */
  readonly start: (listener: (event: ExportProgress) => void) => Promise<ExportOutcome>;
  readonly cancel: () => void;
  readonly store: PipelineStateStore;
  readonly log: Logger;
}

function failure(kind: string, message: string): ExportStageResult {
  return { status: 'failed', error: { kind, message, issues: [] } };
}

function resultOf(dir: string, outcome: ExportOutcome): ExportStageResult {
  switch (outcome.status) {
    case 'done': {
      const cached = outcome.cachedShots.length;
      return {
        status: 'done',
        message: `${projectRelative(dir, outcome.output)} (${String(outcome.height)}p, ${outcome.durationS.toFixed(1)} s, ${outcome.encoder}${cached > 0 ? `, ${plural(cached, 'shot')} cached` : ''})`,
      };
    }
    case 'cancelled':
      return { status: 'cancelled' };
    case 'busy':
      return failure('busy', 'Another export is running.');
    case 'no-project':
      return failure('not-ready', 'No project is open.');
    case 'failed':
      return failure(outcome.kind, outcome.message);
  }
}

/** Runs the export of `dir` as the stage `export` and persists its status. */
export async function runExportStage(
  options: ExportStageOptions,
  dir: string,
  onStep: (step: ExportStep) => void,
): Promise<ExportStageResult> {
  const persist = async (
    status: 'running' | 'done' | 'failed' | 'idle',
    message?: string,
  ): Promise<void> => {
    const written = await options.store.setStage(dir, 'export', status, message);
    if (!written.ok) options.log.warn(`pipeline.json (export): ${written.error.message}`);
  };
  await persist('running');
  let result: ExportStageResult;
  try {
    result = resultOf(
      dir,
      await options.start((event) => {
        const step = exportStep(event);
        if (step !== null) onStep(step);
      }),
    );
  } catch (error) {
    result = failure('internal', error instanceof Error ? error.message : String(error));
  }
  if (result.status === 'done') await persist('done', result.message);
  else if (result.status === 'cancelled') await persist('idle');
  else await persist('failed', result.error.message);
  return result;
}
