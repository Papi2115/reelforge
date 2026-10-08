/**
 * SessionManager (PLAN.md#5.2): one Claude Code session per project + side sessions (script/QA),
 * model per stage, `--resume`, FIFO queue with global concurrency and per-session serialization,
 * cancellation (kill tree), timeouts/idle watchdog, crash recovery via `.reelforge/sessions.json`.
 * 5.4/5.7: limit guard, usage, debug dumps, Economy, stage permissions, lost-session fallback.
 */
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import path from 'node:path';
import type { SessionPurpose, SessionRecord } from '@reelforge/shared';
import { buildTurnArgs, type TurnFlags } from './args.js';
import { AsyncChannel } from './channel.js';
import type { StreamEvent } from './events.js';
import { resolveBashGuardHookPath } from './permissions.js';
import { err, ok, type Result } from './result.js';
import {
  cancelledOutcome,
  defaultContinuation,
  FINAL_STATUSES,
  isCancelled,
  isStage,
  withoutSessionId,
  type Job,
} from './session-jobs.js';
import { SessionStore, type SessionMutator, type StoreError } from './session-store.js';
import type {
  InterruptedTurn,
  ResumeError,
  SessionManagerOptions,
  TurnHandle,
  TurnLifecycleBody,
  TurnLifecycleEvent,
  TurnRef,
  TurnRequest,
} from './session-types.js';
import { startTurn, type RunningTurn, type TurnOutcome } from './turn.js';
import { afterTurn, isAuditEvent } from './turn-hooks.js';
import { usageSnapshotOf, withoutEarlierTurns } from './turn-usage.js';
import { prepareTurn, resolveModel, type PreparedTurn } from './turn-request.js';

export class SessionManager extends EventEmitter<{ turn: [TurnLifecycleEvent] }> {
  private readonly queue: Job[] = [];
  private readonly active = new Map<string, Job>();
  private readonly busyKeys = new Set<string>();
  private readonly store = new SessionStore();
  private readonly options: SessionManagerOptions;

  /** Throws when a bash guard runtime is configured but its hook script cannot be found. */
  constructor(options: SessionManagerOptions) {
    super();
    const permissions = options.permissions;
    this.options =
      permissions === undefined || permissions === false
        ? options
        : {
            ...options,
            permissions: {
              ...permissions,
              hookScriptPath: resolveBashGuardHookPath(permissions),
            },
          };
    options.guard?.on('resumed', () => {
      this.pump();
    });
    options.guard?.on('concurrency', () => {
      this.pump();
    });
  }

  /** Queues a turn; it starts when a slot is free and its session is not busy. */
  enqueue(request: TurnRequest): TurnHandle {
    const purpose = request.purpose ?? 'main';
    const resolvedDir = path.resolve(request.projectDir);
    let settle: (outcome: TurnOutcome) => void = () => undefined;
    const outcome = new Promise<TurnOutcome>((resolve) => (settle = resolve));
    let release: () => void = () => undefined;
    const done = new Promise<void>((resolve) => (release = resolve));
    const turnId = randomUUID();
    const dirKey = process.platform === 'win32' ? resolvedDir.toLowerCase() : resolvedDir;
    const job: Job = {
      turnId,
      projectDir: resolvedDir,
      purpose,
      stage: request.stage,
      request,
      key: request.detached === true ? `${dirKey}|detached|${turnId}` : `${dirKey}|${purpose}`,
      model: resolveModel(request, this.options),
      channel: new AsyncChannel<StreamEvent>(),
      settle,
      done,
      release,
      running: undefined,
      cancelled: false,
      finished: false,
    };
    this.queue.push(job);
    this.emitTurn(job, { type: 'queued' });
    this.pump();
    return {
      turnId: job.turnId,
      projectDir: job.projectDir,
      purpose,
      stage: job.stage,
      outcome,
      cancel: async () => {
        await this.cancel(job.turnId);
      },
      [Symbol.asyncIterator]: () => job.channel[Symbol.asyncIterator](),
    };
  }

  /** Cancels a queued or running turn (running: kills the whole process tree). */
  async cancel(turnId: string): Promise<boolean> {
    const index = this.queue.findIndex((job) => job.turnId === turnId);
    const queued = index === -1 ? undefined : this.queue.splice(index, 1)[0];
    if (queued !== undefined) {
      this.finish(queued, cancelledOutcome());
      queued.release();
      return true;
    }
    const job = this.active.get(turnId);
    if (job === undefined) return false;
    job.cancelled = true;
    await job.running?.cancel();
    return true;
  }

  async cancelAll(): Promise<void> {
    const ids = [...this.queue, ...this.active.values()].map((job) => job.turnId);
    await Promise.all(ids.map((id) => this.cancel(id)));
  }

  /** Resolves when nothing is queued or running (all child processes reaped). */
  async whenIdle(): Promise<void> {
    while (this.queue.length > 0 || this.active.size > 0) {
      await Promise.all([...this.active.values(), ...this.queue].map((job) => job.done));
    }
  }

  getSession(
    projectDir: string,
    purpose: SessionPurpose = 'main',
  ): Promise<Result<SessionRecord | undefined, StoreError>> {
    return this.store.get(path.resolve(projectDir), purpose);
  }

  /** Turns that did not finish (process crash, timeout, app crash while running). */
  async listInterrupted(projectDir: string): Promise<Result<InterruptedTurn[], StoreError>> {
    const resolvedDir = path.resolve(projectDir);
    const file = await this.store.read(resolvedDir);
    if (!file.ok) return file;
    const activeIds = new Set(this.active.keys());
    const turns: InterruptedTurn[] = [];
    for (const purpose of ['main', 'script', 'qa'] as const) {
      const record = file.value.sessions[purpose];
      const pending = record?.pendingTurn;
      if (pending === undefined || activeIds.has(pending.turnId)) continue;
      turns.push({ projectDir: resolvedDir, purpose, sessionId: record?.sessionId, pending });
    }
    return ok(turns);
  }

  /** Re-runs an interrupted turn in its stored session (`--resume`) with a continuation prompt. */
  async resumeInterrupted(
    projectDir: string,
    purpose: SessionPurpose = 'main',
    options: { readonly prompt?: string } = {},
  ): Promise<Result<TurnHandle, ResumeError>> {
    const interrupted = await this.listInterrupted(projectDir);
    if (!interrupted.ok) return err({ kind: 'store', error: interrupted.error });
    const turn = interrupted.value.find((candidate) => candidate.purpose === purpose);
    if (turn === undefined) {
      const running = [...this.active.values()].find(
        (job) =>
          !job.finished &&
          job.request.detached !== true &&
          job.purpose === purpose &&
          job.projectDir === path.resolve(projectDir),
      );
      return err(
        running === undefined
          ? { kind: 'nothing-to-resume' }
          : { kind: 'still-running', turnId: running.turnId },
      );
    }
    const { pending } = turn;
    const continuation = this.options.continuationPrompt ?? defaultContinuation;
    return ok(
      this.enqueue({
        projectDir,
        purpose,
        stage: isStage(pending.stage) ? pending.stage : 'chat',
        model: pending.model === 'opus' || pending.model === 'haiku' ? pending.model : 'sonnet',
        prompt: options.prompt ?? continuation(pending),
      }),
    );
  }

  private pump(): void {
    const { guard } = this.options;
    if (guard?.paused === true) return;
    const concurrency = Math.min(
      Math.max(1, this.options.concurrency ?? 1),
      guard?.concurrency ?? Number.POSITIVE_INFINITY,
    );
    while (this.active.size < concurrency) {
      const index = this.queue.findIndex((job) => !this.busyKeys.has(job.key));
      const job = index === -1 ? undefined : this.queue.splice(index, 1)[0];
      if (job === undefined) return;
      this.active.set(job.turnId, job);
      this.busyKeys.add(job.key);
      void this.run(job).finally(() => {
        this.active.delete(job.turnId);
        this.busyKeys.delete(job.key);
        job.release();
        this.pump();
      });
    }
  }

  private async run(job: Job): Promise<void> {
    const { request } = job;
    const now = (): string => (this.options.now?.() ?? new Date()).toISOString();
    const fresh = request.newSession === true || request.detached === true;
    const stored =
      request.detached === true ? undefined : await this.store.get(job.projectDir, job.purpose);
    if (stored?.ok === false) this.warn(job, stored.error);
    const resume = fresh || stored?.ok !== true ? undefined : stored.value?.sessionId;
    // The CLI reports session totals on --resume: this turn's share is the difference.
    const baseline =
      resume === undefined || stored?.ok !== true ? undefined : stored.value?.usageSnapshot;
    await this.persist(job, (record) => ({
      ...(request.newSession === true
        ? {}
        : { sessionId: record?.sessionId, usageSnapshot: record?.usageSnapshot }),
      model: job.model,
      updatedAt: now(),
      pendingTurn: {
        turnId: job.turnId,
        stage: job.stage,
        model: job.model,
        prompt: request.prompt,
        startedAt: now(),
        state: 'running',
      },
    }));
    if (job.cancelled) {
      await this.persist(job, (record) => record && { ...record, pendingTurn: undefined });
      this.finish(job, cancelledOutcome());
      return;
    }
    const prepared = prepareTurn(request, this.options, job.model, job.projectDir);
    const toolEvents: StreamEvent[] = [];
    let running = this.launch(job, { ...prepared.flags, resume }, toolEvents, now);
    let outcome = await running.outcome;
    if (resume !== undefined && outcome.failure === 'session-not-found') await running.exited;
    if (resume !== undefined && outcome.failure === 'session-not-found' && !isCancelled(job)) {
      this.emitTurn(job, { type: 'session-reset', missingSessionId: resume });
      await this.persist(job, withoutSessionId);
      toolEvents.length = 0;
      running = this.launch(job, { ...prepared.flags, resume: undefined }, toolEvents, now);
      outcome = await running.outcome;
    }
    const reported = outcome;
    outcome = withoutEarlierTurns(reported, baseline);
    const reason =
      outcome.failure === undefined ? outcome.status : `${outcome.status}:${outcome.failure}`;
    await this.persist(job, (record) => {
      const sessionId =
        outcome.status === 'billing-guard'
          ? record?.sessionId
          : (outcome.sessionId ?? record?.sessionId);
      const pending = record?.pendingTurn;
      const keepPending = !FINAL_STATUSES.has(outcome.status) && pending?.turnId === job.turnId;
      return {
        sessionId,
        model: job.model,
        updatedAt: now(),
        pendingTurn: keepPending ? { ...pending, state: 'interrupted', reason } : undefined,
        usageSnapshot: usageSnapshotOf(reported, record?.usageSnapshot),
      };
    });
    await this.afterTurn(job, outcome, prepared, toolEvents);
    this.finish(job, outcome);
    await running.exited;
  }

  private launch(
    job: Job,
    flags: TurnFlags,
    toolEvents: StreamEvent[],
    now: () => string,
  ): RunningTurn {
    const { request } = job;
    const running = startTurn({
      launcher: this.options.launcher,
      args: buildTurnArgs(flags),
      prompt: request.prompt,
      cwd: job.projectDir,
      env: this.options.env ?? process.env,
      extraEnv: this.options.extraEnv?.(job.projectDir),
      timeoutMs: request.timeoutMs ?? this.options.turnTimeoutMs ?? 30 * 60_000,
      idleTimeoutMs: request.idleTimeoutMs ?? this.options.idleTimeoutMs ?? 5 * 60_000,
      exitGraceMs: this.options.exitGraceMs,
      reduce:
        this.options.framePaths === undefined ? undefined : { framePaths: this.options.framePaths },
      onEvent: (event) => {
        job.channel.push(event);
        if (isAuditEvent(event)) toolEvents.push(event);
        this.emitTurn(job, { type: 'stream', event });
        if (event.kind === 'init') {
          void this.persist(job, (record) => ({
            ...record,
            sessionId: event.sessionId,
            model: job.model,
            updatedAt: now(),
          }));
        }
      },
    });
    job.running = running;
    this.emitTurn(job, {
      type: 'started',
      pid: running.pid,
      model: job.model,
      resumedSessionId: flags.resume,
    });
    return running;
  }

  private afterTurn(
    job: Job,
    outcome: TurnOutcome,
    prepared: PreparedTurn,
    toolEvents: readonly StreamEvent[],
  ): Promise<void> {
    return afterTurn({
      projectDir: job.projectDir,
      turnId: job.turnId,
      stage: job.stage,
      model: job.model,
      outcome,
      toolEvents,
      policy: prepared.policy,
      guard: this.options.guard,
      usage: this.options.usage,
      debugDumps: this.options.debugDumps ?? true,
      now: this.options.now?.() ?? new Date(),
      emit: (body) => {
        this.emitTurn(job, body);
      },
    });
  }

  /** Detached turns are never stored (they do not own the purpose's session slot). */
  private async persist(job: Job, mutate: SessionMutator): Promise<void> {
    if (job.request.detached === true) return;
    const updated = await this.store.update(job.projectDir, job.purpose, mutate);
    if (!updated.ok) this.warn(job, updated.error);
  }

  private finish(job: Job, outcome: TurnOutcome): void {
    job.finished = true;
    this.emitTurn(job, { type: 'finished', outcome });
    job.channel.close();
    job.settle(outcome);
  }

  private warn(job: Job, error: StoreError): void {
    this.emitTurn(job, {
      type: 'warning',
      message: `sessions.json ${error.kind}: ${error.message}`,
    });
  }

  private emitTurn(job: Job, body: TurnLifecycleBody): void {
    const ref: TurnRef = {
      turnId: job.turnId,
      projectDir: job.projectDir,
      purpose: job.purpose,
      stage: job.stage,
    };
    this.emit('turn', { ...ref, ...body });
  }
}
