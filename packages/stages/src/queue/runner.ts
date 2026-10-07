/**
 * QueueRunner (PLAN.md#13.9, ADR-034): the production line. One per app (lock file). It works
 * the channels' queues one step at a time (so at most one film builds at once): project → brief
 * → script → approval gate → voice-over → … → export → publish kit. Waiting films do not block
 * the others, a failed film does not stop the line, a Claude usage limit pauses the whole line
 * until the reset and resumes by itself; every step state is persisted, so after a crash or an
 * app close the line resumes where it stopped. All dependencies are injected.
 */
import { EventEmitter } from 'node:events';
import { err, ok, systemClock, type Clock, type Result } from '@reelforge/claude-bridge';
import type { ProductionQueue, QueueItem } from '@reelforge/shared';
import { LineBook } from './line-book.js';
import { acquireLineLock, type LineLock, type LineLockOptions } from './lock.js';
import {
  queueItemKey,
  nextLineStep,
  quietRemainingMs,
  systemLocalMinute,
  type LineCandidate,
} from './schedule.js';
import { finishStep, startStep } from './state.js';
import type { QueueChangeOrigin, QueueStore } from './store.js';
import { describeError, stepNotification } from './transitions.js';
import { Waker } from './waker.js';
import type {
  LineEnd,
  LineStatus,
  QueueNotification,
  QueueNotifier,
  QueueProjectFactory,
  QueueRunnerEvents,
  QueueStepExecutor,
  QueueStepOutcome,
  QuietHours,
  RunUntil,
  UsageLimitSignal,
  UsageLimitState,
} from './types.js';

export interface QueueRunnerOptions {
  readonly store: QueueStore;
  readonly projects: QueueProjectFactory;
  readonly executor: QueueStepExecutor;
  readonly clock?: Clock;
  /** The account-wide usage-limit state (`limitSignalFromGuard`). */
  readonly limits?: UsageLimitSignal | undefined;
  readonly notifier?: QueueNotifier | undefined;
  readonly quietHours?: QuietHours | undefined;
  /** Minutes since local midnight (tests); default: the system time zone. */
  readonly localMinute?: (epochMs: number) => number;
  /** No new script while this many films wait for approval. Default 5. */
  readonly maxPendingApprovals?: number;
  /** Pause after a usage limit without a known reset time. Default 15 min. */
  readonly limitBackoffMs?: number;
  /** `runUntil: time`: how often waiting films are re-checked while nothing else can run. 60 s. */
  readonly pollMs?: number;
  /** The one-line-per-app lock (`false`: none, tests). */
  readonly lock?: LineLockOptions | false;
  /** Channel order (default: the queue files, by id). */
  readonly channelIds?: () => Promise<readonly string[]>;
}

export interface StartOptions {
  readonly runUntil?: RunUntil;
}

interface ActiveStep {
  readonly channelId: string;
  readonly itemId: string;
  readonly controller: AbortController;
}

const DEFAULT_BACKOFF_MS = 15 * 60_000;

export class QueueRunner extends EventEmitter<QueueRunnerEvents> {
  private readonly clock: Clock;
  private running: Promise<Result<LineEnd, string>> | undefined;
  private stopping = false;
  private active: ActiveStep | undefined;
  private readonly waker: Waker;
  private readonly book: LineBook;
  private status: LineStatus = { state: 'stopped' };
  private readonly checkedGates = new Set<string>();
  private readonly unreadable = new Set<string>();
  private readonly onChanged = (queue: ProductionQueue, origin: QueueChangeOrigin): void => {
    this.emit('queue', queue);
    if (origin === 'user') this.userChanged(queue);
  };

  constructor(private readonly options: QueueRunnerOptions) {
    super();
    this.clock = options.clock ?? systemClock;
    this.waker = new Waker(this.clock);
    this.book = new LineBook(
      options.store,
      this.clock,
      options.limitBackoffMs ?? DEFAULT_BACKOFF_MS,
      (notification) => {
        this.notify(notification);
      },
    );
    options.store.on('changed', this.onChanged);
  }

  get isRunning(): boolean {
    return this.running !== undefined;
  }

  get lineStatus(): LineStatus {
    return this.status;
  }

  /** Runs the line until `runUntil` (default: idle), `stop()` or a blocked Claude. */
  start(options: StartOptions = {}): Promise<Result<LineEnd, string>> {
    if (this.running !== undefined) return Promise.resolve(err('the line is already running'));
    this.stopping = false;
    const run = this.execute(options.runUntil ?? { kind: 'idle' });
    this.running = run;
    void run.finally(() => {
      if (this.running === run) this.running = undefined;
    });
    return run;
  }

  /** Aborts the running step (it runs again next time), persists and releases the lock. */
  async stop(): Promise<void> {
    const run = this.running;
    if (run === undefined) return;
    this.stopping = true;
    this.active?.controller.abort();
    this.waker.wake();
    await run;
  }

  /** Something changed outside the queue files (approval in the app, imported voice): re-check. */
  poke(): void {
    this.checkedGates.clear();
    this.waker.wake();
  }

  /** Approves an item's script through the executor (the app's gate) and wakes the line. */
  async approveScript(channelId: string, itemId: string): Promise<Result<void, string>> {
    const queue = await this.options.store.read(channelId);
    if (!queue.ok) return err(queue.error.message);
    const item = queue.value.items.find((candidate) => candidate.id === itemId);
    if (item?.projectPath === undefined) return err('this film has no project yet');
    const approved = await this.options.executor.approveScript(item.projectPath);
    if (approved.ok) this.poke();
    return approved;
  }

  /** Detaches from the store (the app is closing; call `stop()` first). */
  dispose(): void {
    this.options.store.off('changed', this.onChanged);
  }

  private async execute(runUntil: RunUntil): Promise<Result<LineEnd, string>> {
    let lock: LineLock | undefined;
    if (this.options.lock !== false) {
      const acquired = await acquireLineLock(this.options.store.queuesDir, this.options.lock);
      if (!acquired.ok) return acquired;
      lock = acquired.value;
    }
    const unsubscribe = this.options.limits?.subscribe((state) => {
      void this.limitChanged(state);
    });
    try {
      await this.recover();
      return ok(await this.loop(runUntil));
    } catch (error) {
      return err(`the production line stopped: ${describeError(error)}`);
    } finally {
      unsubscribe?.();
      this.setStatus({ state: 'stopped' });
      await lock?.release().catch((error: unknown) => {
        this.notify({ kind: 'failed', message: `lock not released: ${describeError(error)}` });
      });
    }
  }

  private async loop(runUntil: RunUntil): Promise<LineEnd> {
    for (;;) {
      if (this.stopping) return 'stopped';
      const now = this.clock.now();
      if (runUntil.kind === 'time' && now >= runUntil.at) return 'time';
      const pause = await this.currentPause(now);
      if (pause !== undefined) {
        this.setStatus({ state: 'limit', until: pause.until, message: pause.message });
        await this.sleep(pause.until, runUntil);
        continue;
      }
      const localMinute = (this.options.localMinute ?? systemLocalMinute)(now);
      const quiet = quietRemainingMs(this.options.quietHours, localMinute, now);
      if (quiet > 0) {
        this.setStatus({ state: 'quiet', until: now + quiet });
        await this.sleep(now + quiet, runUntil);
        continue;
      }
      const queues = await this.loadQueues();
      const candidate = nextLineStep(queues, {
        lastChannelId: this.book.lastChannelId,
        maxPendingApprovals: this.options.maxPendingApprovals ?? 5,
        checkedGates: this.checkedGates,
      });
      if (candidate === undefined) {
        if (runUntil.kind === 'idle') {
          this.notify({ kind: 'line-idle', message: 'Nothing left the line can do on its own.' });
          return 'idle';
        }
        const next = now + (this.options.pollMs ?? 60_000);
        this.setStatus({ state: 'waiting', until: next });
        await this.sleep(next, runUntil);
        this.checkedGates.clear();
        continue;
      }
      const queue = queues.find(
        (candidateQueue) => candidateQueue.channelId === candidate.channelId,
      );
      const outcome = await this.runStep(candidate, queue?.autoApproveScript ?? false, queue);
      if (outcome.kind === 'blocked') {
        this.notify({ kind: 'line-blocked', message: outcome.message });
        return 'blocked';
      }
    }
  }

  private async runStep(
    candidate: LineCandidate,
    autoApproveScript: boolean,
    queue: ProductionQueue | undefined,
  ): Promise<QueueStepOutcome> {
    const { channelId, item, step, kind } = candidate;
    const { store } = this.options;
    if (kind === 'gate') this.checkedGates.add(queueItemKey(channelId, item.id));
    else await this.book.serve(channelId);
    const controller = new AbortController();
    this.active = { channelId, itemId: item.id, controller };
    this.setStatus({ state: 'running', current: { channelId, itemId: item.id, step } });
    if (kind === 'work') {
      await store.updateItem(
        channelId,
        item.id,
        (current) => startStep(current, step, this.stamp()),
        'line',
      );
    }
    this.emit('step', { channelId, itemId: item.id, step, phase: 'started' });
    const targetMinutes = item.targetMinutes ?? queue?.defaultTargetMinutes ?? 8;
    const run = await this.execStep(candidate, autoApproveScript, targetMinutes, controller.signal);
    this.active = undefined;
    const outcome: QueueStepOutcome =
      controller.signal.aborted && run.outcome.kind !== 'done'
        ? { kind: 'cancelled' }
        : run.outcome;
    this.emit('step', { channelId, itemId: item.id, step, phase: 'finished', outcome });
    if (outcome.kind === 'limit' && this.options.limits?.current() === undefined) {
      await this.book.pauseUntil(outcome.until, outcome.message); // else the guard's pause rules
    }
    // A gate re-check writes only when the gate opened or the step failed: a gate that stays
    // closed (or is interrupted) changes nothing (no history, no repeated notification).
    const opened =
      outcome.kind === 'done' || outcome.kind === 'skipped' || outcome.kind === 'failed';
    if (kind === 'gate' && !opened) return outcome;
    if (kind === 'work') this.checkedGates.clear();
    const updated = await store.updateItem(
      channelId,
      item.id,
      (current) => {
        const next = finishStep(current, step, outcome, this.stamp());
        return run.projectPath === undefined ? next : { ...next, projectPath: run.projectPath };
      },
      'line',
    );
    if (updated.ok) {
      const notification = stepNotification(channelId, item, updated.value, step, outcome);
      if (notification !== undefined) this.notify(notification);
    }
    return outcome;
  }

  private async execStep(
    candidate: LineCandidate,
    autoApproveScript: boolean,
    targetMinutes: number,
    signal: AbortSignal,
  ): Promise<{ outcome: QueueStepOutcome; projectPath?: string }> {
    const { channelId, item, step } = candidate;
    try {
      if (step === 'project') {
        const made = await this.options.projects.create({ channelId, item, targetMinutes, signal });
        return made.ok
          ? {
              outcome: { kind: 'done', message: 'project created' },
              projectPath: made.value.projectPath,
            }
          : { outcome: { kind: 'failed', message: made.error } };
      }
      if (item.projectPath === undefined) {
        return { outcome: { kind: 'failed', message: 'the film has no project folder' } };
      }
      const outcome = await this.options.executor.run(step, {
        channelId,
        item,
        projectDir: item.projectPath,
        autoApproveScript,
        targetMinutes,
        signal,
        stageEvent: (event) => {
          this.emit('stage', { channelId, itemId: item.id, event });
        },
        progress: (label, percent) => {
          this.emit('progress', { channelId, itemId: item.id, step, label, percent });
        },
      });
      return { outcome };
    } catch (error) {
      return { outcome: { kind: 'failed', message: `unexpected error: ${describeError(error)}` } };
    }
  }

  /** Crash recovery: steps left `running` run again; the persisted limit pause comes back. */
  private async recover(): Promise<void> {
    await this.book.load();
    for (const channelId of await this.channelIds()) await this.options.store.recover(channelId);
  }

  private async channelIds(): Promise<readonly string[]> {
    if (this.options.channelIds !== undefined) return this.options.channelIds();
    const ids = await this.options.store.channelIds();
    return ids.ok ? ids.value : [];
  }

  private async loadQueues(): Promise<ProductionQueue[]> {
    const queues: ProductionQueue[] = [];
    for (const channelId of await this.channelIds()) {
      const queue = await this.options.store.read(channelId);
      if (queue.ok) {
        queues.push(queue.value);
        this.unreadable.delete(channelId);
      } else if (!this.unreadable.has(channelId)) {
        this.unreadable.add(channelId);
        this.notify({
          kind: 'failed',
          channelId,
          message: `queue unreadable: ${queue.error.message}`,
        });
      }
    }
    return queues;
  }

  /** The guard's pause, else the line's own (after a limit outcome without a guard). */
  private async currentPause(now: number): Promise<UsageLimitState | undefined> {
    return this.options.limits?.current() ?? (await this.book.ownPause(now));
  }

  private async limitChanged(state: UsageLimitState | undefined): Promise<void> {
    await this.book.guardChanged(state);
    if (state !== undefined) {
      this.setStatus({
        ...this.status,
        state: 'limit',
        until: state.until,
        message: state.message,
      });
      return;
    }
    if (this.active !== undefined) {
      this.setStatus({ ...this.status, state: 'running', until: undefined, message: undefined });
    }
    this.waker.wake();
  }

  private userChanged(queue: ProductionQueue): void {
    const active = this.active;
    if (active?.channelId === queue.channelId) {
      const item: QueueItem | undefined = queue.items.find(
        (candidate) => candidate.id === active.itemId,
      );
      // Removed or put on hold while its step runs: the step stops (it reruns on resume).
      if (item === undefined || item.status === 'paused') active.controller.abort();
    }
    this.poke();
  }

  private sleep(untilMs: number | undefined, runUntil: RunUntil): Promise<void> {
    if (this.stopping) return Promise.resolve();
    return this.waker.sleep([untilMs, runUntil.kind === 'time' ? runUntil.at : undefined]);
  }

  private setStatus(status: LineStatus): void {
    this.status = status;
    this.emit('line', status);
  }

  private notify(notification: QueueNotification): void {
    this.options.notifier?.notify(notification);
  }

  private stamp(): string {
    return new Date(this.clock.now()).toISOString();
  }
}
