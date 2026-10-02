import { describe, expect, it } from 'vitest';
import { LimitGuard, type PauseInfo, type ResumeCause } from './limit-guard.js';
import type { LimitSignal } from './limits.js';
import { ManualClock } from './testing/manual-clock.js';
import { fakeOutcome } from './testing/outcomes.js';

const T0 = Date.UTC(2026, 9, 2, 3, 0);
const MIN = 60_000;

function signal(fields: Partial<LimitSignal> = {}): LimitSignal {
  return {
    source: 'text',
    rateLimitType: undefined,
    resetsAt: undefined,
    message: undefined,
    ...fields,
  };
}

function setup(options: { maxConcurrency?: number; random?: () => number } = {}): {
  clock: ManualClock;
  guard: LimitGuard;
  paused: PauseInfo[];
  resumed: ResumeCause[];
  concurrency: number[];
} {
  const clock = new ManualClock(T0);
  const guard = new LimitGuard({
    clock,
    random: options.random ?? (() => 0),
    timeZone: 'UTC',
    ...(options.maxConcurrency === undefined ? {} : { maxConcurrency: options.maxConcurrency }),
  });
  const paused: PauseInfo[] = [];
  const resumed: ResumeCause[] = [];
  const concurrency: number[] = [];
  guard.on('paused', (pause) => paused.push(pause));
  guard.on('resumed', (event) => resumed.push(event.cause));
  guard.on('concurrency', (value) => concurrency.push(value));
  return { clock, guard, paused, resumed, concurrency };
}

describe('LimitGuard: when to resume', () => {
  it('uses the CLI resetsAt (+60 s slack) and resumes by itself at that time', () => {
    const { clock, guard, resumed } = setup();
    const resetsAt = T0 / 1000 + 2 * 3600;
    const pause = guard.reportLimit(signal({ resetsAt, rateLimitType: 'five_hour' }));
    expect(pause).toMatchObject({
      reason: 'limit',
      until: resetsAt * 1000 + MIN,
      untilSource: 'reset-time',
      consecutiveLimits: 1,
      rateLimitType: 'five_hour',
    });
    expect(guard.paused).toBe(true);
    clock.advance(2 * 60 * MIN);
    expect(guard.paused).toBe(true);
    clock.advance(MIN);
    expect(guard.paused).toBe(false);
    expect(resumed).toEqual(['reset-time']);
  });

  it('falls back to the reset time in the message, then to backoff', () => {
    const text = setup();
    expect(
      text.guard.reportLimit(signal({ message: "You've hit your usage limit · resets 5am (UTC)" })),
    ).toMatchObject({ until: Date.UTC(2026, 9, 2, 5, 1), untilSource: 'reset-text' });
    const backoff = setup();
    expect(
      backoff.guard.reportLimit(signal({ message: 'API Error: Rate limit reached' })),
    ).toMatchObject({ until: T0 + 15 * MIN, untilSource: 'backoff' });
    const stale = setup();
    expect(stale.guard.reportLimit(signal({ resetsAt: T0 / 1000 - 10 })).untilSource).toBe(
      'backoff',
    );
  });

  it('backs off 15 -> 30 -> 60 min with jitter while limits repeat; a success resets it', () => {
    const { clock, guard } = setup({ random: () => 0.5 });
    const waits: number[] = [];
    for (let incident = 0; incident < 3; incident += 1) {
      const pause = guard.reportLimit(undefined);
      waits.push((pause.until ?? 0) - clock.now());
      clock.advance((pause.until ?? 0) - clock.now());
      expect(guard.paused).toBe(false);
    }
    // 10% jitter at random() = 0.5 (ratio 0.2).
    expect(waits).toEqual([16.5 * MIN, 33 * MIN, 66 * MIN]);
    guard.reportSuccess();
    expect((guard.reportLimit(undefined).until ?? 0) - clock.now()).toBe(16.5 * MIN);
  });

  it('a second limit during the same pause keeps the incident and the later time', () => {
    const { guard, paused } = setup();
    guard.reportLimit(signal({ resetsAt: T0 / 1000 + 3600 }));
    const second = guard.reportLimit(signal({ resetsAt: T0 / 1000 + 600 }));
    expect(second.consecutiveLimits).toBe(1);
    expect(second.until).toBe(T0 + 3600_000 + MIN);
    expect(paused).toHaveLength(2);
  });

  it('manual pause waits for resume(); resume() works on limit pauses too', () => {
    const { clock, guard, resumed } = setup();
    guard.pauseManually();
    clock.advance(10 * 3_600_000);
    expect(guard.paused).toBe(true);
    guard.resume();
    guard.reportLimit(undefined);
    guard.resume();
    expect(guard.paused).toBe(false);
    expect(resumed).toEqual(['manual', 'manual']);
    expect(clock.pending).toBe(0);
  });
});

describe('LimitGuard: concurrency and restore', () => {
  it('halves concurrency per incident and recovers one step per 3 successes', () => {
    const { guard, concurrency } = setup({ maxConcurrency: 4 });
    guard.reportLimit(undefined);
    guard.resume();
    guard.reportLimit(undefined);
    guard.resume();
    expect(guard.concurrency).toBe(1);
    for (let index = 0; index < 6; index += 1) guard.reportSuccess();
    expect(guard.concurrency).toBe(3);
    expect(concurrency).toEqual([2, 1, 2, 3]);
  });

  it('lowers concurrency before announcing the pause, never leaving a start window', () => {
    const { guard } = setup({ maxConcurrency: 2 });
    const seen: [boolean, number][] = [];
    guard.on('concurrency', () => seen.push([guard.paused, guard.concurrency]));
    guard.reportLimit(undefined);
    expect(seen).toEqual([[true, 1]]);
  });

  it('restores a persisted pause (timer re-armed) or resumes at once when it expired', () => {
    const live = setup({ maxConcurrency: 4 });
    const pause: PauseInfo = {
      reason: 'limit',
      pausedAt: T0 - MIN,
      until: T0 + 30 * MIN,
      untilSource: 'backoff',
      consecutiveLimits: 2,
      rateLimitType: undefined,
      message: undefined,
    };
    live.guard.restore(pause, 2);
    expect(live.guard.paused).toBe(true);
    expect(live.guard.concurrency).toBe(2);
    live.clock.advance(30 * MIN);
    expect(live.resumed).toEqual(['reset-time']);
    const expired = setup();
    expired.guard.restore({ ...pause, until: T0 - 1 }, 1);
    expect(expired.guard.paused).toBe(false);
    expect(expired.resumed).toEqual(['restored-expired']);
  });

  it('observe(): limit outcomes pause, completed outcomes count as successes', () => {
    const { guard } = setup();
    guard.observe(fakeOutcome());
    guard.observe(fakeOutcome({ status: 'failed', failure: 'api' }));
    expect(guard.paused).toBe(false);
    guard.observe(fakeOutcome({ status: 'failed', failure: 'limit', limit: signal() }));
    expect(guard.paused).toBe(true);
  });

  it('dispose() cancels the resume timer but keeps the pause', () => {
    const { clock, guard } = setup();
    guard.reportLimit(undefined);
    guard.dispose();
    expect(clock.pending).toBe(0);
    clock.advance(24 * 3_600_000);
    expect(guard.paused).toBe(true);
  });
});
