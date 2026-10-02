/**
 * LimitGuard (PLAN.md#5.4): one per app (a subscription limit is account-wide). On a usage-limit
 * turn it pauses (the SessionManager stops starting turns, work queues stop dispatching), decides
 * until when (CLI `resetsAt` > reset time parsed from the message > backoff 15/30/60/120/240 min
 * with jitter), halves concurrency, and resumes by itself once the time has come (or manually).
 * Successful turns restore concurrency step by step. It never stops anything silently: every
 * transition is an event.
 */
import { EventEmitter } from 'node:events';
import type { PauseUntilSource } from '@reelforge/shared';
import { MAX_TIMER_MS, systemClock, type Clock } from './clock.js';
import type { LimitSignal } from './limits.js';
import { localTimeZone, parseResetTime } from './reset-time.js';
import type { TurnOutcome } from './turn.js';

export interface PauseInfo {
  readonly reason: 'limit' | 'manual';
  /** Epoch ms. */
  readonly pausedAt: number;
  /** Epoch ms of the automatic resume; undefined = manual pause (user resumes). */
  readonly until: number | undefined;
  readonly untilSource: PauseUntilSource | undefined;
  readonly consecutiveLimits: number;
  readonly rateLimitType: string | undefined;
  readonly message: string | undefined;
}

export interface LimitGuardOptions {
  /** Concurrency when nothing went wrong. Default 1. */
  readonly maxConcurrency?: number;
  readonly clock?: Clock;
  /** [0,1) source for backoff jitter. Default Math.random (bridge code, not a scene). */
  readonly random?: () => number;
  /** Backoff steps in minutes when no reset time is known. Default 15, 30, 60, 120, 240. */
  readonly backoffMinutes?: readonly number[];
  /** Max extra wait as a fraction of the backoff step. Default 0.2. */
  readonly jitterRatio?: number;
  /** Added after a known reset time (clock skew, server lag). Default 60 s. */
  readonly resetSlackMs?: number;
  /** Successful turns needed to raise concurrency by one again. Default 3. */
  readonly recoverAfter?: number;
  /** Zone for reset times without one (`resets 5am`). Default: system zone. */
  readonly timeZone?: string;
}

export type ResumeCause = 'reset-time' | 'manual' | 'restored-expired';

export interface LimitGuardEvents {
  paused: [PauseInfo];
  resumed: [{ readonly cause: ResumeCause; readonly pause: PauseInfo }];
  concurrency: [number];
}

export const DEFAULT_BACKOFF_MINUTES: readonly number[] = [15, 30, 60, 120, 240];

export class LimitGuard extends EventEmitter<LimitGuardEvents> {
  private readonly clock: Clock;
  private readonly random: () => number;
  private readonly maxConcurrency: number;
  private currentPause: PauseInfo | undefined;
  private currentConcurrency: number;
  private consecutive = 0;
  private successes = 0;
  private cancelTimer: (() => void) | undefined;

  constructor(private readonly options: LimitGuardOptions = {}) {
    super();
    this.clock = options.clock ?? systemClock;
    this.random = options.random ?? Math.random;
    this.maxConcurrency = Math.max(1, options.maxConcurrency ?? 1);
    this.currentConcurrency = this.maxConcurrency;
  }

  get paused(): boolean {
    return this.currentPause !== undefined;
  }

  get pause(): PauseInfo | undefined {
    return this.currentPause;
  }

  get concurrency(): number {
    return this.currentConcurrency;
  }

  /** Feeds a finished turn: limit failures pause, successes count towards recovery. */
  observe(outcome: TurnOutcome): void {
    if (outcome.status === 'failed' && outcome.failure === 'limit') this.reportLimit(outcome.limit);
    else if (outcome.status === 'completed') this.reportSuccess();
  }

  reportLimit(signal: LimitSignal | undefined): PauseInfo {
    const now = this.clock.now();
    const newIncident = this.currentPause?.reason !== 'limit';
    const before = this.currentConcurrency;
    if (newIncident) {
      this.consecutive += 1;
      this.successes = 0;
      // Lowered silently first: nothing may start between the drop and the pause.
      this.currentConcurrency = Math.max(1, Math.floor(before / 2));
    }
    const { until, source } = this.resumeTime(signal, now);
    const previous = this.currentPause;
    const pause: PauseInfo = {
      reason: 'limit',
      pausedAt: previous?.reason === 'limit' ? previous.pausedAt : now,
      until: previous?.until === undefined ? until : Math.max(previous.until, until),
      untilSource:
        previous?.until !== undefined && previous.until > until ? previous.untilSource : source,
      consecutiveLimits: this.consecutive,
      rateLimitType: signal?.rateLimitType ?? previous?.rateLimitType,
      message: signal?.message ?? previous?.message,
    };
    this.enterPause(pause);
    if (this.currentConcurrency !== before) this.emit('concurrency', this.currentConcurrency);
    return pause;
  }

  reportSuccess(): void {
    this.consecutive = 0;
    if (this.currentConcurrency >= this.maxConcurrency) return;
    this.successes += 1;
    if (this.successes < (this.options.recoverAfter ?? 3)) return;
    this.successes = 0;
    this.setConcurrency(this.currentConcurrency + 1);
  }

  /** User pause without an automatic resume. */
  pauseManually(): PauseInfo {
    const pause: PauseInfo = {
      reason: 'manual',
      pausedAt: this.clock.now(),
      until: undefined,
      untilSource: undefined,
      consecutiveLimits: this.consecutive,
      rateLimitType: undefined,
      message: undefined,
    };
    this.enterPause(pause);
    return pause;
  }

  /** Manual resume ("try now"). No-op when not paused. */
  resume(): void {
    this.leavePause('manual');
  }

  /**
   * Re-applies a pause persisted before a restart. An expired pause resumes right away (still
   * emitted, so listeners can clear their persisted copy).
   */
  restore(pause: PauseInfo, concurrency: number): void {
    this.consecutive = pause.consecutiveLimits;
    this.setConcurrency(Math.min(this.maxConcurrency, Math.max(1, concurrency)));
    if (pause.until !== undefined && pause.until <= this.clock.now()) {
      this.emit('resumed', { cause: 'restored-expired', pause });
      return;
    }
    this.enterPause(pause);
  }

  /** Cancels the pending resume timer (app shutdown). The pause state is kept. */
  dispose(): void {
    this.cancelTimer?.();
    this.cancelTimer = undefined;
  }

  private resumeTime(
    signal: LimitSignal | undefined,
    now: number,
  ): { until: number; source: PauseUntilSource } {
    const slack = this.options.resetSlackMs ?? 60_000;
    const reported = signal?.resetsAt === undefined ? undefined : signal.resetsAt * 1000;
    if (reported !== undefined && reported > now) {
      return { until: reported + slack, source: 'reset-time' };
    }
    const parsed = parseResetTime(signal?.message, now, this.options.timeZone ?? localTimeZone());
    if (parsed !== undefined && parsed > now)
      return { until: parsed + slack, source: 'reset-text' };
    const steps = this.options.backoffMinutes ?? DEFAULT_BACKOFF_MINUTES;
    const minutes = steps[Math.min(this.consecutive, steps.length) - 1] ?? steps.at(-1) ?? 15;
    const base = minutes * 60_000;
    const jitter = Math.floor(this.random() * (this.options.jitterRatio ?? 0.2) * base);
    return { until: now + base + jitter, source: 'backoff' };
  }

  private enterPause(pause: PauseInfo): void {
    this.currentPause = pause;
    this.dispose();
    this.emit('paused', pause);
    this.armTimer();
  }

  private armTimer(): void {
    const until = this.currentPause?.until;
    if (until === undefined) return;
    const remaining = until - this.clock.now();
    if (remaining <= 0) {
      this.leavePause('reset-time');
      return;
    }
    this.cancelTimer = this.clock.setTimer(
      () => {
        this.cancelTimer = undefined;
        this.armTimer();
      },
      Math.min(remaining, MAX_TIMER_MS),
    );
  }

  private leavePause(cause: ResumeCause): void {
    const pause = this.currentPause;
    if (pause === undefined) return;
    this.dispose();
    this.currentPause = undefined;
    this.emit('resumed', { cause, pause });
  }

  private setConcurrency(value: number): void {
    if (value === this.currentConcurrency) return;
    this.currentConcurrency = value;
    this.emit('concurrency', value);
  }
}
