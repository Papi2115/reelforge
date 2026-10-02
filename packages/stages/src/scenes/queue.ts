/**
 * Per-shot jobs of "Scenes built" as persistent work items in `.reelforge/pipeline.json`
 * (PLAN.md#5.4): a run started after a usage limit, a cancel or an app crash continues with the
 * unfinished shots and never redoes finished ones. Jobs run with bounded concurrency, re-read
 * before every start (the LimitGuard halves it after a limit hit).
 *
 * Unlike claude-bridge's WorkQueue (one turn per item) a job here is several turns plus renders.
 */
import { err, ok, type PipelineStateStore, type Result } from '@reelforge/claude-bridge';
import type { WorkItem } from '@reelforge/shared';
import { stageError, type StageError } from '../types.js';

/** Work-item stages in pipeline.json: shot builds and review fixes. */
export const SCENES_QUEUE = 'scenes';
export const REVIEW_QUEUE = 'scenes-review';

/** Job errors that stop the run and leave the item for the next one (not the item's fault). */
const STOPPING = new Set<StageError['kind']>([
  'cancelled',
  'blocked',
  'limit',
  'missing-tool',
  'tool',
]);

const describe = (error: { readonly message: string }): StageError =>
  stageError('io', `pipeline.json: ${error.message}`);

function newItem(queue: string, id: string, stamp: string): WorkItem {
  return {
    id,
    stage: queue,
    prompt: `${queue} ${id}`,
    status: 'pending',
    attempts: 0,
    limitHits: 0,
    createdAt: stamp,
    updatedAt: stamp,
  };
}

export interface PreparedQueue {
  /** Shot ids to run, in storyboard order. */
  readonly pending: readonly string[];
  /** Ids finished by an earlier, interrupted run (kept, not redone). */
  readonly finished: readonly string[];
  readonly resumed: boolean;
}

export interface PrepareQueue {
  readonly store: PipelineStateStore;
  readonly projectDir: string;
  readonly queue: string;
  readonly storyboardIds: readonly string[];
  /** Shots of a fresh run, in storyboard order. */
  readonly targets: readonly string[];
  /** Continue unfinished items of an interrupted run instead (when there are any). */
  readonly resume: boolean;
  readonly now: Date;
}

/**
 * Resumes an interrupted run (unfinished items left and `resume`) or starts a fresh one with
 * `targets`. Items of shots no longer in the storyboard are dropped.
 */
export async function prepareShotQueue(
  options: PrepareQueue,
): Promise<Result<PreparedQueue, StageError>> {
  const { queue, storyboardIds } = options;
  const stamp = options.now.toISOString();
  let prepared: PreparedQueue = { pending: [], finished: [], resumed: false };
  const updated = await options.store.update(options.projectDir, (state) => {
    const others = state.queue.filter((item) => item.stage !== queue);
    const known = new Set(storyboardIds);
    const existing = state.queue.filter((item) => item.stage === queue && known.has(item.id));
    const resume =
      options.resume &&
      existing.some((item) => item.status === 'pending' || item.status === 'running');
    const items = resume
      ? storyboardIds.map((id) => {
          const item =
            existing.find((candidate) => candidate.id === id) ?? newItem(queue, id, stamp);
          return item.status === 'running' ? { ...item, status: 'pending' as const } : item;
        })
      : options.targets.map((id) => newItem(queue, id, stamp));
    prepared = {
      pending: items.filter((item) => item.status === 'pending').map((item) => item.id),
      finished: items.filter((item) => item.status !== 'pending').map((item) => item.id),
      resumed: resume,
    };
    return { ...state, queue: [...others, ...items] };
  });
  return updated.ok ? ok(prepared) : err(describe(updated.error));
}

export interface ShotQueueRun {
  readonly store: PipelineStateStore;
  readonly projectDir: string;
  readonly queue: string;
  readonly ids: readonly string[];
  readonly signal: AbortSignal;
  /** Jobs allowed at once, asked before every start. */
  readonly concurrency: () => number;
  readonly now: () => Date;
  readonly job: (id: string) => Promise<Result<void, StageError>>;
  readonly onStart?: (id: string) => void;
  readonly onRequeue?: (id: string, error: StageError) => void;
  readonly onWarning?: (message: string) => void;
}

/** Runs the jobs; resolves the first stopping error (cancel, blocked, limit) after in-flight jobs end. */
export function runShotQueue(run: ShotQueueRun): Promise<Result<void, StageError>> {
  const waiting = [...run.ids];
  let active = 0;
  let stop: StageError | undefined;
  const patch = async (id: string, change: Parameters<PipelineStateStore['patchItem']>[3]) => {
    const written = await run.store.patchItem(run.projectDir, run.queue, id, change);
    if (!written.ok) run.onWarning?.(`pipeline.json: ${written.error.message}`);
  };
  const guarded = async (id: string): Promise<Result<void, StageError>> => {
    try {
      return await run.job(id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return err(stageError('io', `unexpected error in shot ${id}: ${message}`));
    }
  };
  const execute = async (id: string): Promise<void> => {
    await patch(id, { status: 'running' });
    run.onStart?.(id);
    const result = await guarded(id);
    if (result.ok) {
      await patch(id, {
        status: 'done',
        finishedAt: run.now().toISOString(),
        lastError: undefined,
      });
    } else if (STOPPING.has(result.error.kind)) {
      stop ??= result.error;
      await patch(id, { status: 'pending', lastError: result.error.message });
      run.onRequeue?.(id, result.error);
    } else {
      await patch(id, { status: 'failed', lastError: result.error.message });
    }
  };
  return new Promise((resolve) => {
    const pump = (): void => {
      if (run.signal.aborted) stop ??= stageError('cancelled', 'cancelled');
      while (stop === undefined && waiting.length > 0 && active < Math.max(1, run.concurrency())) {
        const id = waiting.shift();
        if (id === undefined) break;
        active += 1;
        void execute(id).finally(() => {
          active -= 1;
          pump();
        });
      }
      if (active === 0 && (stop !== undefined || waiting.length === 0)) {
        resolve(stop === undefined ? ok(undefined) : err(stop));
      }
    };
    pump();
  });
}
