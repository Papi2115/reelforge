/**
 * The production line under trouble: usage limits (its own pause and the guard's), app close and
 * crash in the middle of a step, a broken Claude, the one-line-per-app lock, schedules (run until
 * a time, quiet hours) and a film put on hold while its step runs.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { LINE_LOCK_FILE, LINE_STATE_FILE } from '@reelforge/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { FILM_STEPS, LineHarness, ManualLimitSignal, lineState } from '../testing/queue.js';
import type { QueueStepContext, QueueStepOutcome } from './types.js';

const harnesses: LineHarness[] = [];
function harness(): LineHarness {
  const created = new LineHarness();
  harnesses.push(created);
  return created;
}
afterEach(() => {
  for (const created of harnesses.splice(0)) created.dispose();
});

/** A step that runs until it is aborted (then reports `cancelled`, like the StageRunner). */
function untilAborted(ctx: QueueStepContext, started: () => void): Promise<QueueStepOutcome> {
  started();
  return new Promise((resolve) => {
    ctx.signal.addEventListener('abort', () => {
      resolve({ kind: 'cancelled' });
    });
  });
}

describe('production line resilience', () => {
  it('pauses the whole line on a usage limit until the reset, then resumes by itself', async () => {
    const line = harness();
    await line.store.setOptions('voxplain', { autoApproveScript: true });
    const [id = ''] = await line.add('voxplain', 'Limits');
    let hits = 0;
    const resetAt = line.clock.now() + 3_600_000;
    line.executor.behaviour = (step) => {
      if (step !== 'scenes' || hits > 0) return undefined;
      hits += 1;
      return { kind: 'limit', message: 'usage limit', until: resetAt };
    };
    const runner = line.runner({ lock: false });
    const paused = lineState(runner, 'limit');
    const run = runner.start();
    await paused;
    const lineFile = JSON.parse(readFileSync(path.join(line.dir, LINE_STATE_FILE), 'utf8')) as {
      limitPause?: { until?: string };
    };
    expect(lineFile.limitPause?.until).toBe(new Date(resetAt).toISOString());
    expect((await line.item('voxplain', id)).stageProgress.scenes).toBeUndefined();
    line.clock.advance(3_600_000);
    expect(await run).toEqual({ ok: true, value: 'idle' });
    expect((await line.item('voxplain', id)).status).toBe('done');
    expect(line.notifications.map((note) => note.kind)).toEqual(
      expect.arrayContaining(['line-paused', 'line-resumed', 'done']),
    );
  });

  it("waits while the guard's limit pause lasts and goes on when it resumes", async () => {
    const line = harness();
    await line.store.setOptions('voxplain', { autoApproveScript: true });
    const [id = ''] = await line.add('voxplain', 'Guarded');
    const limits = new ManualLimitSignal();
    limits.set({ until: line.clock.now() + 60_000, message: 'limit (guard)' });
    const runner = line.runner({ lock: false, limits });
    const paused = lineState(runner, 'limit');
    const run = runner.start();
    await paused;
    expect(line.executor.calls).toEqual([]);
    limits.set(undefined);
    expect(await run).toEqual({ ok: true, value: 'idle' });
    expect((await line.item('voxplain', id)).status).toBe('done');
  });

  it('a persisted limit pause survives a restart', async () => {
    const line = harness();
    await line.store.setOptions('voxplain', { autoApproveScript: true });
    await line.add('voxplain', 'After restart');
    const until = new Date(line.clock.now() + 600_000).toISOString();
    await line.store.updateLine((state) => ({
      ...state,
      limitPause: { since: new Date(line.clock.now()).toISOString(), until },
    }));
    const runner = line.runner({ lock: false });
    const paused = lineState(runner, 'limit');
    const run = runner.start();
    await paused;
    expect(line.executor.calls).toEqual([]);
    line.clock.advance(600_000);
    expect(await run).toEqual({ ok: true, value: 'idle' });
    expect(line.executor.calls.length).toBeGreaterThan(0);
  });

  it('closing the app mid-step loses nothing: the step runs again after the restart', async () => {
    const line = harness();
    await line.store.setOptions('voxplain', { autoApproveScript: true });
    const [id = ''] = await line.add('voxplain', 'Closed mid-build');
    let started!: () => void;
    const inScenes = new Promise<void>((resolve) => {
      started = resolve;
    });
    line.executor.behaviour = (step, ctx) =>
      step === 'scenes' ? untilAborted(ctx, started) : undefined;
    const runner = line.runner();
    const run = runner.start();
    await inScenes;
    expect((await line.item('voxplain', id)).stageProgress.scenes?.state).toBe('running');
    await runner.stop();
    expect(await run).toEqual({ ok: true, value: 'stopped' });
    const stopped = await line.item('voxplain', id);
    expect(stopped.stageProgress.scenes).toBeUndefined();
    expect(stopped.stageProgress.storyboard?.state).toBe('done');
    runner.dispose();
    // A new app session (new store and runner on the same files) continues at Scenes built.
    line.executor.behaviour = undefined;
    line.executor.calls.length = 0;
    const store = line.newStore();
    expect(await line.runner({ store }).start()).toEqual({ ok: true, value: 'idle' });
    expect(line.executor.stepsOf(id)).toEqual(FILM_STEPS.slice(FILM_STEPS.indexOf('scenes')));
  });

  it('after a crash a step left running runs again', async () => {
    const line = harness();
    await line.store.setOptions('voxplain', { autoApproveScript: true });
    const [id = ''] = await line.add('voxplain', 'Crashed');
    const at = new Date(line.clock.now()).toISOString();
    await line.store.updateItem('voxplain', id, (item) => ({
      ...item,
      projectPath: path.join(line.dir, 'films', id),
      stageProgress: {
        ...Object.fromEntries(
          FILM_STEPS.slice(0, FILM_STEPS.indexOf('mix')).map((step) => [
            step,
            { state: 'done', at },
          ]),
        ),
        project: { state: 'done', at },
        mix: { state: 'running', at },
      },
    }));
    await line.runner({ lock: false }).start();
    expect(line.executor.stepsOf(id)).toEqual(['mix', 'export', 'seo', 'publish']);
    const item = await line.item('voxplain', id);
    expect(item.status).toBe('done');
    expect(item.history.some((entry) => entry.message === 'interrupted')).toBe(true);
  });

  it('a broken Claude stops the line without failing the film', async () => {
    const line = harness();
    const [id = ''] = await line.add('voxplain', 'Logged out');
    line.executor.behaviour = (step) =>
      step === 'brief' ? { kind: 'blocked', message: 'not logged in' } : undefined;
    expect(await line.runner({ lock: false }).start()).toEqual({ ok: true, value: 'blocked' });
    const item = await line.item('voxplain', id);
    expect(item.status).toBe('brief');
    expect(item.stageProgress.brief).toBeUndefined();
    expect(line.notifications.at(-1)).toMatchObject({
      kind: 'line-blocked',
      message: 'not logged in',
    });
  });

  it('one line per app: a second runner is refused, a dead owner’s lock is taken over', async () => {
    const line = harness();
    await line.add('voxplain', 'Locked');
    let started!: () => void;
    const inBrief = new Promise<void>((resolve) => {
      started = resolve;
    });
    line.executor.behaviour = (step, ctx) =>
      step === 'brief' ? untilAborted(ctx, started) : undefined;
    const first = line.runner();
    const run = first.start();
    await inBrief;
    const second = await line.runner().start();
    expect(second.ok).toBe(false);
    expect(await first.start()).toEqual({ ok: false, error: 'the line is already running' });
    await first.stop();
    await run;
    writeFileSync(
      path.join(line.dir, LINE_LOCK_FILE),
      JSON.stringify({ pid: 999_999, token: 'x', since: new Date().toISOString() }),
    );
    line.executor.behaviour = undefined;
    const takeover = await line.runner({ lock: { isAlive: () => false } }).start();
    expect(takeover).toEqual({ ok: true, value: 'idle' });
  });

  it('runs until a time and sleeps through quiet hours', async () => {
    const line = harness();
    await line.store.setOptions('voxplain', { autoApproveScript: true });
    const [id = ''] = await line.add('voxplain', 'Scheduled');
    const late = await line.runner({ lock: false }).start({
      runUntil: { kind: 'time', at: line.clock.now() },
    });
    expect(late).toEqual({ ok: true, value: 'time' });
    expect(line.executor.calls).toEqual([]);
    let minute = 23 * 60;
    const runner = line.runner({
      lock: false,
      quietHours: { start: '22:00', end: '07:00' },
      localMinute: () => minute,
    });
    const quiet = lineState(runner, 'quiet');
    const run = runner.start();
    await quiet;
    expect(line.executor.calls).toEqual([]);
    minute = 7 * 60;
    line.clock.advance(8 * 3_600_000);
    expect(await run).toEqual({ ok: true, value: 'idle' });
    expect((await line.item('voxplain', id)).status).toBe('done');
  });

  it('putting a film on hold stops its running step; it resumes later from that step', async () => {
    const line = harness();
    await line.store.setOptions('voxplain', { autoApproveScript: true });
    const [held = '', other = ''] = await line.add('voxplain', 'Held', 'Other');
    let started!: () => void;
    const inWords = new Promise<void>((resolve) => {
      started = resolve;
    });
    line.executor.behaviour = (step, ctx) =>
      step === 'words' && ctx.item.id === held ? untilAborted(ctx, started) : undefined;
    const run = line.runner({ lock: false }).start();
    await inWords;
    await line.store.hold('voxplain', held);
    expect(await run).toEqual({ ok: true, value: 'idle' });
    expect((await line.item('voxplain', held)).status).toBe('paused');
    expect((await line.item('voxplain', other)).status).toBe('done');
    line.executor.behaviour = undefined;
    await line.store.resume('voxplain', held);
    await line.runner({ lock: false }).start();
    expect((await line.item('voxplain', held)).status).toBe('done');
  });
});
