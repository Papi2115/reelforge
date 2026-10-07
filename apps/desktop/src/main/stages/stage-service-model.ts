/**
 * StageService's options and its per-project pipelines (stage-service.ts): the project key, the
 * queued runs grouped by Run click, the active run, and the errors/warnings shown in the sidebar.
 */
import path from 'node:path';
import type { LimitGuard, PipelineStateStore } from '@reelforge/claude-bridge';
import type { PipelineStage, StageEvent, StageRunner } from '@reelforge/stages';
import type { StageErrorInfo, StagesState } from '../../shared/stages-contract.js';
import type { Logger } from '../logger.js';
import type { ExportRun, RunObserver } from './stage-execution.js';
import type { StageRun } from './stage-run.js';
import type { AppStageRequest } from './stage-state.js';

export interface StageServiceOptions {
  /** A runner for a project folder (claude, audio tools, settings, guard, store, autocommit). */
  readonly createRunner: (projectDir: string) => StageRunner;
  /** "Video exported": the app's export with a progress listener, and its cancel. */
  readonly exportRun?: ExportRun;
  /** Shared with the runners (per-file serialized writes of pipeline.json). */
  readonly store: PipelineStateStore;
  /** The app's account-wide guard (the chat shows the same pause). */
  readonly guard: LimitGuard;
  readonly push: (state: StagesState) => void;
  readonly log: Logger;
  /** Settings → "Run final review after building scenes" (default off here, on in the app). */
  readonly finalReview?: () => boolean;
  /** Epoch ms. */
  readonly now?: () => number;
  readonly pushDelayMs?: number;
}

export interface QueuedRun {
  readonly request: AppStageRequest;
  readonly group: number;
  readonly observer?: RunObserver | undefined;
}

export interface ProjectPipeline {
  readonly dir: string;
  readonly runner: StageRunner;
  readonly queue: QueuedRun[];
  active: { readonly run: StageRun; readonly item: QueuedRun } | undefined;
  readonly errors: Map<PipelineStage, StageErrorInfo>;
  readonly warnings: Map<PipelineStage, readonly string[]>;
  idle: Promise<void>;
}

/** Events after which the project files / pipeline.json are read again. */
export const REFRESH_EVENTS = new Set<StageEvent['type']>([
  'started',
  'paused',
  'resumed',
  'done',
  'failed',
]);

export function projectKey(dir: string): string {
  const resolved = path.resolve(dir);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

/** An empty pipeline of `dir` on `runner` (nothing queued, nothing active). */
export function emptyPipeline(dir: string, runner: StageRunner): ProjectPipeline {
  return {
    dir,
    runner,
    queue: [],
    active: undefined,
    errors: new Map(),
    warnings: new Map(),
    idle: Promise.resolve(),
  };
}

/** Drops every queued run of `group` (their observers hear `cancelled`). */
export function dropGroup(pipeline: ProjectPipeline, group: number): void {
  const kept = pipeline.queue.filter((item) => item.group !== group);
  for (const item of pipeline.queue) {
    if (item.group === group) item.observer?.onDone({ status: 'cancelled' });
  }
  pipeline.queue.splice(0, pipeline.queue.length, ...kept);
}
