/**
 * WorkQueue (PLAN.md#5.4): runs one stage's persistent work items (e.g. one scene-build job per
 * shot) through the SessionManager, at most `guard.concurrency` at a time. Every transition is
 * written to `.reelforge/pipeline.json`, so after a usage limit and/or a restart only unfinished
 * items run again. Limit hits put the item back to `pending` and pause the (account-wide) guard;
 * the pause is persisted and restored on the next `run()`.
 */
import { EventEmitter } from 'node:events';
import type { PipelinePause, PipelineState, StageRunStatus, WorkItem } from '@reelforge/shared';
import type { JsonFileError } from './json-file.js';
import type { LimitGuard, PauseInfo, ResumeCause } from './limit-guard.js';
import {
  PipelineStateStore,
  applyItemPatch,
  type WorkItemPatch,
  type WorkItemSpec,
} from './pipeline-state-store.js';
import { ok, type Result } from './result.js';
import type { SessionManager } from './session-manager.js';
import type { Stage, TurnHandle, TurnRequest } from './session-types.js';
import type { TurnOutcome } from './turn.js';

export interface WorkQueueOptions {
  readonly manager: SessionManager;
  readonly guard: LimitGuard;
  readonly projectDir: string;
  readonly stage: Stage;
  readonly store?: PipelineStateStore;
  /** Turns per item before it is marked `failed` (limit hits do not count). Default 2. */
  readonly maxAttempts?: number;
  /** Extra request fields per item (system prompt, timeouts, ...). */
  readonly requestFor?: (
    item: WorkItem,
  ) => Partial<Omit<TurnRequest, 'projectDir' | 'stage' | 'prompt'>>;
  readonly now?: () => Date;
}

export type WorkQueueEvent =
  | { readonly type: 'item-started'; readonly id: string; readonly turnId: string }
  | { readonly type: 'item-done'; readonly id: string }
  | {
      readonly type: 'item-requeued';
      readonly id: string;
      readonly reason: 'limit' | 'retry' | 'stopped' | 'blocked';
      readonly message: string;
    }
  | { readonly type: 'item-failed'; readonly id: string; readonly error: string }
  | { readonly type: 'paused'; readonly pause: PipelinePause }
  | { readonly type: 'resumed'; readonly cause: ResumeCause }
  | { readonly type: 'warning'; readonly message: string };

export type RunStatus = 'done' | 'failed' | 'blocked' | 'stopped';

export interface RunSummary {
  readonly status: RunStatus;
  readonly done: readonly string[];
  readonly failed: readonly string[];
  readonly pending: readonly string[];
  readonly message: string | undefined;
}

/** Outcomes that say "the environment is broken", not "this item is broken". */
const BLOCKING_STATUSES = new Set<TurnOutcome['status']>(['billing-guard', 'spawn-failed']);

export function toPipelinePause(info: PauseInfo, concurrency: number): PipelinePause {
  return {
    reason: info.reason,
    pausedAt: new Date(info.pausedAt).toISOString(),
    ...(info.until === undefined ? {} : { pausedUntil: new Date(info.until).toISOString() }),
    ...(info.untilSource === undefined ? {} : { untilSource: info.untilSource }),
    consecutiveLimits: info.consecutiveLimits,
    concurrency,
    ...(info.rateLimitType === undefined ? {} : { rateLimitType: info.rateLimitType }),
    ...(info.message === undefined ? {} : { message: info.message }),
  };
}

export function fromPipelinePause(pause: PipelinePause): PauseInfo {
  return {
    reason: pause.reason,
    pausedAt: Date.parse(pause.pausedAt),
    until: pause.pausedUntil === undefined ? undefined : Date.parse(pause.pausedUntil),
    untilSource: pause.untilSource,
    consecutiveLimits: pause.consecutiveLimits,
    rateLimitType: pause.rateLimitType,
    message: pause.message,
  };
}

export class WorkQueue extends EventEmitter<{ event: [WorkQueueEvent] }> {
  private readonly store: PipelineStateStore;
  private readonly items = new Map<string, WorkItem>();
  private readonly inFlight = new Map<string, TurnHandle>();
  private writes: Promise<unknown> = Promise.resolve();
  private finishRun: ((status: RunStatus) => void) | undefined;
  private stopping = false;
  private blocked: string | undefined;
  private current: Promise<Result<RunSummary, JsonFileError>> | undefined;

  private readonly onPaused = (pause: PauseInfo): void => {
    this.persistPause(pause);
  };
  private readonly onResumed = (event: { readonly cause: ResumeCause }): void => {
    this.write((store, dir) => store.setPause(dir, undefined));
    this.writeStage('running');
    this.emitEvent({ type: 'resumed', cause: event.cause });
    this.dispatch();
  };
  private readonly onConcurrency = (): void => {
    this.dispatch();
  };

  constructor(private readonly options: WorkQueueOptions) {
    super();
    this.store = options.store ?? new PipelineStateStore(options.now);
  }

  /** Items of this stage in queue order (in-memory view of pipeline.json). */
  list(): WorkItem[] {
    return [...this.items.values()];
  }

  /** Queues items not known yet; already known ids (done or not) are left untouched. */
  async add(specs: readonly WorkItemSpec[]): Promise<Result<WorkItem[], JsonFileError>> {
    const updated = await this.store.addItems(this.options.projectDir, this.options.stage, specs);
    if (!updated.ok) return updated;
    this.syncFrom(updated.value);
    return ok(this.list());
  }

  /**
   * Runs pending items until none is left, the run is blocked (auth/billing/spawn) or `stop()`ed.
   * Re-applies a persisted pause first (waits for its reset time, or resumes if it is over).
   * A second call while running returns the same run.
   */
  run(): Promise<Result<RunSummary, JsonFileError>> {
    this.current ??= this.runOnce().finally(() => {
      this.current = undefined;
    });
    return this.current;
  }

  private async runOnce(): Promise<Result<RunSummary, JsonFileError>> {
    const { guard, projectDir, stage } = this.options;
    const recovered = await this.store.recoverRunning(projectDir, stage);
    if (!recovered.ok) return recovered;
    this.syncFrom(recovered.value);
    this.stopping = false;
    this.blocked = undefined;
    guard.on('paused', this.onPaused);
    guard.on('resumed', this.onResumed);
    guard.on('concurrency', this.onConcurrency);
    const finished = new Promise<RunStatus>((resolve) => (this.finishRun = resolve));
    const stored = recovered.value.pause;
    if (guard.pause !== undefined) this.persistPause(guard.pause);
    else if (stored !== undefined) guard.restore(fromPipelinePause(stored), stored.concurrency);
    if (!guard.paused) this.writeStage('running');
    this.dispatch();
    const status = await finished;
    guard.off('paused', this.onPaused);
    guard.off('resumed', this.onResumed);
    guard.off('concurrency', this.onConcurrency);
    const summary = this.summary(status);
    this.writeStage(this.finalStageStatus(status), summary.message);
    await this.writes;
    return ok(summary);
  }

  /** Stops dispatching and cancels in-flight turns (their items go back to `pending`). */
  async stop(): Promise<void> {
    this.stopping = true;
    await Promise.all([...this.inFlight.values()].map((handle) => handle.cancel()));
    this.dispatch();
  }

  private dispatch(): void {
    if (this.finishRun === undefined) return;
    const idle = this.inFlight.size === 0;
    if (this.stopping || this.blocked !== undefined) {
      if (idle) this.finish(this.stopping ? 'stopped' : 'blocked');
      return;
    }
    if (this.options.guard.paused) return; // `onResumed` dispatches again
    for (const item of this.items.values()) {
      if (this.inFlight.size >= this.options.guard.concurrency) break;
      if (item.status === 'pending' && !this.inFlight.has(item.id)) this.start(item);
    }
    if (this.inFlight.size === 0) {
      this.finish(this.list().some((item) => item.status === 'failed') ? 'failed' : 'done');
    }
  }

  private start(item: WorkItem): void {
    const { manager, projectDir, stage } = this.options;
    const handle = manager.enqueue({
      projectDir,
      stage,
      prompt: item.prompt,
      ...(item.purpose === undefined ? {} : { purpose: item.purpose }),
      ...(item.newSession === undefined ? {} : { newSession: item.newSession }),
      ...this.options.requestFor?.(item),
    });
    this.inFlight.set(item.id, handle);
    this.patch(item.id, { status: 'running', attempts: item.attempts + 1 });
    this.emitEvent({ type: 'item-started', id: item.id, turnId: handle.turnId });
    void handle.outcome.then((outcome) => {
      this.applyOutcome(item.id, outcome);
      this.inFlight.delete(item.id);
      this.dispatch();
    });
  }

  private applyOutcome(id: string, outcome: TurnOutcome): void {
    const item = this.items.get(id);
    if (item === undefined) return;
    const uncounted = Math.max(0, item.attempts - 1);
    const requeue = (reason: 'limit' | 'stopped' | 'blocked', patch: WorkItemPatch): void => {
      this.patch(id, { status: 'pending', attempts: uncounted, ...patch });
      this.emitEvent({ type: 'item-requeued', id, reason, message: outcome.message });
    };
    if (outcome.status === 'completed') {
      const finishedAt = (this.options.now?.() ?? new Date()).toISOString();
      this.patch(id, {
        status: 'done',
        sessionId: outcome.sessionId,
        finishedAt,
        lastError: undefined,
      });
      this.emitEvent({ type: 'item-done', id });
    } else if (outcome.status === 'failed' && outcome.failure === 'limit') {
      requeue('limit', { limitHits: item.limitHits + 1, lastError: outcome.message });
    } else if (outcome.status === 'cancelled') {
      requeue('stopped', {});
    } else if (BLOCKING_STATUSES.has(outcome.status) || outcome.failure === 'auth') {
      this.blocked = `${outcome.status}${outcome.failure === undefined ? '' : `:${outcome.failure}`}: ${outcome.message}`;
      requeue('blocked', { lastError: outcome.message });
    } else if (item.attempts >= (this.options.maxAttempts ?? 2)) {
      this.patch(id, { status: 'failed', lastError: outcome.message });
      this.emitEvent({ type: 'item-failed', id, error: outcome.message });
    } else {
      this.patch(id, { status: 'pending', lastError: outcome.message });
      this.emitEvent({ type: 'item-requeued', id, reason: 'retry', message: outcome.message });
    }
  }

  private persistPause(info: PauseInfo): void {
    const pause = toPipelinePause(info, this.options.guard.concurrency);
    this.write((store, dir) => store.setPause(dir, pause));
    this.writeStage('paused', info.message ?? `paused (${info.reason})`);
    void this.writes.then(() => {
      this.emitEvent({ type: 'paused', pause });
    });
  }

  private finish(status: RunStatus): void {
    const resolve = this.finishRun;
    this.finishRun = undefined;
    resolve?.(status);
  }

  private summary(status: RunStatus): RunSummary {
    const ids = (wanted: WorkItem['status']): string[] =>
      this.list()
        .filter((item) => item.status === wanted)
        .map((item) => item.id);
    const failed = ids('failed');
    const message =
      status === 'blocked'
        ? this.blocked
        : failed.length > 0
          ? `failed: ${failed.join(', ')}`
          : undefined;
    return { status, done: ids('done'), failed, pending: ids('pending'), message };
  }

  private finalStageStatus(status: RunStatus): StageRunStatus {
    if (status === 'stopped') return this.options.guard.paused ? 'paused' : 'idle';
    return status;
  }

  private patch(id: string, patch: WorkItemPatch): void {
    const item = this.items.get(id);
    if (item === undefined) return;
    const { stage, projectDir } = this.options;
    this.items.set(id, applyItemPatch(item, patch));
    this.write((store) => store.patchItem(projectDir, stage, id, patch));
  }

  private writeStage(status: StageRunStatus, message?: string): void {
    this.write((store, dir) => store.setStage(dir, this.options.stage, status, message));
  }

  /** Serialized persistence; failures surface as warnings (in-memory state stays authoritative). */
  private write(
    operation: (
      store: PipelineStateStore,
      projectDir: string,
    ) => Promise<Result<PipelineState, JsonFileError>>,
  ): void {
    this.writes = this.writes.then(async () => {
      const result = await operation(this.store, this.options.projectDir);
      if (!result.ok) {
        this.emitEvent({
          type: 'warning',
          message: `pipeline.json ${result.error.kind}: ${result.error.message}`,
        });
      }
    });
  }

  private syncFrom(state: PipelineState): void {
    this.items.clear();
    for (const item of state.queue) {
      if (item.stage === this.options.stage) this.items.set(item.id, item);
    }
  }

  private emitEvent(event: WorkQueueEvent): void {
    this.emit('event', event);
  }
}
