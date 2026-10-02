/**
 * One queued stage run of the StageService (PLAN.md#6.8): the script approval check at start, then
 * the StageRunner (runner stages) or the app's export (export-stage.ts), reduced to a RunOutcome.
 */
import type { PipelineStateStore } from '@reelforge/claude-bridge';
import { readProjectSnapshot, type StageRunner } from '@reelforge/stages';
import type { StageErrorInfo, StageRunView } from '../../shared/stages-contract.js';
import type { Logger } from '../logger.js';
import { runExportStage, type ExportStageOptions } from './export-stage.js';
import type { StageRun } from './stage-run.js';
import { approvalReasons, errorInfo, type AppStageRequest } from './stage-state.js';

/** How a run ended. */
export type RunOutcome =
  | { readonly status: 'done'; readonly message: string; readonly warnings: readonly string[] }
  | { readonly status: 'cancelled' }
  | { readonly status: 'failed'; readonly error: StageErrorInfo };

/** Follows one queued run (its live view while it runs, then the outcome). */
export interface RunObserver {
  readonly onView: (view: StageRunView) => void;
  readonly onDone: (outcome: RunOutcome) => void;
}

export type ExportRun = Pick<ExportStageOptions, 'start' | 'cancel'>;

export interface ExecutionContext {
  readonly dir: string;
  readonly runner: StageRunner;
  readonly request: AppStageRequest;
  readonly run: StageRun;
  readonly exportRun: ExportRun | undefined;
  readonly store: PipelineStateStore;
  readonly log: Logger;
  /** The run's view changed outside runner events (export progress). */
  readonly onChange: () => void;
}

/** StageRun scope of a request (scene runs: review mode and target shots). */
export function runScope(
  request: AppStageRequest,
): { readonly action: string | null; readonly shots: readonly string[] | null } | undefined {
  if (request.stage !== 'scenes') return undefined;
  return { action: request.action ?? null, shots: request.shots ?? null };
}

async function executeRunner(
  context: ExecutionContext,
  request: Exclude<AppStageRequest, { stage: 'export' }>,
): Promise<RunOutcome> {
  const outcome = await context.runner.run(request);
  if (outcome.ok) {
    return { status: 'done', message: outcome.value.message, warnings: [...context.run.warnings] };
  }
  if (outcome.error.kind === 'cancelled') return { status: 'cancelled' };
  return { status: 'failed', error: errorInfo(outcome.error) };
}

async function executeExport(context: ExecutionContext): Promise<RunOutcome> {
  if (context.exportRun === undefined) {
    return {
      status: 'failed',
      error: { kind: 'missing-tool', message: 'Export is not available.', issues: [] },
    };
  }
  const outcome = await runExportStage(
    { ...context.exportRun, store: context.store, log: context.log },
    context.dir,
    (step) => {
      context.run.setStep(step.label, step.percent);
      context.onChange();
    },
  );
  return outcome.status === 'done'
    ? { status: 'done', message: outcome.message, warnings: [] }
    : outcome;
}

export async function executeQueued(context: ExecutionContext): Promise<RunOutcome> {
  const stage = context.request.stage;
  const snapshot = await readProjectSnapshot(context.dir, context.store);
  const approval = approvalReasons(stage, snapshot);
  if (approval.length > 0) {
    return {
      status: 'failed',
      error: { kind: 'not-ready', message: approval.join(' '), issues: [] },
    };
  }
  context.log.info(`running ${stage} in ${context.dir}`);
  return context.request.stage === 'export'
    ? executeExport(context)
    : executeRunner(context, context.request);
}
