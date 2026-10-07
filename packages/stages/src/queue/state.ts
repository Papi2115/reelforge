/**
 * The pure state machine of one film in the production line (PLAN.md#13.9): the current step is
 * the first step not `done`/`skipped`; the item's status is derived from the step states (only
 * `paused`, the user's hold, is set by hand). Every transition returns a new item.
 */
import {
  MAX_QUEUE_HISTORY,
  MAX_QUEUE_WARNINGS,
  QUEUE_STEPS,
  type QueueItem,
  type QueueItemStatus,
  type QueueStep,
  type QueueStepState,
} from '@reelforge/shared';
import type { QueueStepOutcome } from './types.js';

type Progress = QueueItem['stageProgress'];

/** Steps before (and including) the script acceptance gate. */
export const PRE_APPROVAL_STEPS: readonly QueueStep[] = ['project', 'brief', 'script', 'approval'];

export function isBuildStep(step: QueueStep): boolean {
  return !PRE_APPROVAL_STEPS.includes(step);
}

const EXPORT_STEPS: readonly QueueStep[] = ['export', 'publish'];

function finished(state: QueueStepState | undefined): boolean {
  return state?.state === 'done' || state?.state === 'skipped';
}

/** The first step that is not done or skipped; undefined = the film is finished. */
export function currentStep(item: Pick<QueueItem, 'stageProgress'>): QueueStep | undefined {
  return QUEUE_STEPS.find((step) => !finished(item.stageProgress[step]));
}

/** Status from the step states (never `paused`). */
export function derivedStatus(progress: Progress): QueueItemStatus {
  if (QUEUE_STEPS.some((step) => progress[step]?.state === 'failed')) return 'failed';
  const step = currentStep({ stageProgress: progress });
  if (step === undefined) return 'done';
  const state = progress[step]?.state;
  if (state === 'waiting') return step === 'voiceover' ? 'needs-voice' : 'needs-approval';
  if (step === 'project' && state === undefined) return 'queued';
  if (step === 'project' || step === 'brief') return 'brief';
  if (step === 'script' || step === 'approval') return 'scripting';
  return EXPORT_STEPS.includes(step) ? 'exporting' : 'building';
}

/** The item has started building (a step after the approval gate finished). */
export function buildStarted(item: Pick<QueueItem, 'stageProgress'>): boolean {
  return QUEUE_STEPS.some((step) => isBuildStep(step) && finished(item.stageProgress[step]));
}

/** What the line can do with an item. */
export type ItemActivity = 'held' | 'done' | 'failed' | 'waiting' | 'ready';

export function itemActivity(item: QueueItem): ItemActivity {
  if (item.status === 'paused') return 'held';
  const status = derivedStatus(item.stageProgress);
  if (status === 'done' || status === 'failed') return status;
  const step = currentStep(item);
  return step !== undefined && item.stageProgress[step]?.state === 'waiting' ? 'waiting' : 'ready';
}

function withHistory(item: QueueItem, at: string, step?: QueueStep, message?: string): QueueItem {
  const entry = {
    at,
    status: item.status,
    ...(step === undefined ? {} : { step }),
    ...(message === undefined ? {} : { message: message.slice(0, 2_000) }),
  };
  return { ...item, updatedAt: at, history: [...item.history, entry].slice(-MAX_QUEUE_HISTORY) };
}

/** Re-derives the status; a change of status is written to the history. */
function withStatus(item: QueueItem, at: string, step?: QueueStep, message?: string): QueueItem {
  const status = item.status === 'paused' ? 'paused' : derivedStatus(item.stageProgress);
  if (status === item.status && item.history.length > 0) return { ...item, updatedAt: at };
  return withHistory({ ...item, status }, at, step, message);
}

function setStep(progress: Progress, step: QueueStep, state: QueueStepState | undefined): Progress {
  if (state !== undefined) return { ...progress, [step]: state };
  return Object.fromEntries(Object.entries(progress).filter(([key]) => key !== step));
}

function stepState(
  state: QueueStepState['state'],
  at: string,
  message: string | undefined,
): QueueStepState {
  return message === undefined ? { state, at } : { state, at, message: message.slice(0, 2_000) };
}

/** The step starts running (persisted so a crash is noticed and the step re-runs). */
export function startStep(item: QueueItem, step: QueueStep, at: string): QueueItem {
  return withStatus(
    {
      ...item,
      stageProgress: setStep(item.stageProgress, step, stepState('running', at, undefined)),
    },
    at,
    step,
  );
}

function addWarnings(item: QueueItem, warnings: readonly string[] | undefined): string[] {
  const added = (warnings ?? []).map((line) => line.slice(0, 2_000));
  return [...item.warnings, ...added].slice(0, MAX_QUEUE_WARNINGS);
}

/** Applies a step's outcome. limit / blocked / cancelled leave the step pending (it runs again). */
export function finishStep(
  item: QueueItem,
  step: QueueStep,
  outcome: QueueStepOutcome,
  at: string,
): QueueItem {
  switch (outcome.kind) {
    case 'done':
      return withStatus(
        {
          ...item,
          stageProgress: setStep(item.stageProgress, step, stepState('done', at, outcome.message)),
          warnings: addWarnings(item, outcome.warnings),
        },
        at,
        step,
        outcome.message,
      );
    case 'skipped':
    case 'waiting':
      return withStatus(
        {
          ...item,
          stageProgress: setStep(
            item.stageProgress,
            step,
            stepState(outcome.kind, at, outcome.message),
          ),
        },
        at,
        step,
        outcome.message,
      );
    case 'failed':
      return withStatus(
        {
          ...item,
          stageProgress: setStep(
            item.stageProgress,
            step,
            stepState('failed', at, outcome.message),
          ),
          error: { step, message: outcome.message.slice(0, 2_000) },
        },
        at,
        step,
        outcome.message,
      );
    case 'limit':
    case 'blocked':
    case 'cancelled':
      return withStatus(
        { ...item, stageProgress: setStep(item.stageProgress, step, undefined) },
        at,
        step,
      );
  }
}

/** After a crash: a step left `running` runs again. */
export function recoverItem(item: QueueItem, at: string): QueueItem {
  const running = QUEUE_STEPS.filter((step) => item.stageProgress[step]?.state === 'running');
  if (running.length === 0) return item;
  let progress = item.stageProgress;
  for (const step of running) progress = setStep(progress, step, undefined);
  const status = item.status === 'paused' ? 'paused' : derivedStatus(progress);
  return withHistory({ ...item, stageProgress: progress, status }, at, running[0], 'interrupted');
}

/** The user puts the item on hold (the line skips it). */
export function holdItem(item: QueueItem, at: string): QueueItem {
  if (item.status === 'paused') return item;
  return withHistory({ ...item, status: 'paused' }, at, undefined, 'on hold');
}

export function resumeItem(item: QueueItem, at: string): QueueItem {
  if (item.status !== 'paused') return item;
  return withHistory(
    { ...item, status: derivedStatus(item.stageProgress) },
    at,
    undefined,
    'resumed',
  );
}

/** "Try again": the failed step becomes pending, the error goes. */
export function retryItem(item: QueueItem, at: string): QueueItem {
  const failed = QUEUE_STEPS.filter((step) => item.stageProgress[step]?.state === 'failed');
  if (failed.length === 0) return item;
  let progress = item.stageProgress;
  for (const step of failed) progress = setStep(progress, step, undefined);
  const next: QueueItem = { ...item, stageProgress: progress };
  delete next.error;
  return withStatus(next, at, failed[0], 'retry');
}
