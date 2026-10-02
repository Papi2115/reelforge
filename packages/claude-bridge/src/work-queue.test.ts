import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pipelineStateSchema, usageFileSchema, type PipelineState } from '@reelforge/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { DEBUG_DIR } from './debug-dump.js';
import { LimitGuard } from './limit-guard.js';
import { pipelineFilePath } from './pipeline-state-store.js';
import { waitFor } from './testing/fake-claude.js';
import { Harness } from './testing/manager-harness.js';
import { ManualClock } from './testing/manual-clock.js';
import { UsageLedger, usageFilePath } from './usage-ledger.js';
import { WorkQueue, type WorkQueueEvent } from './work-queue.js';

const harness = new Harness();
afterEach(async () => {
  await harness.dispose();
});

const T0 = Date.UTC(2026, 9, 2, 3, 0);
const MIN = 60_000;
const SHOTS = [1, 2, 3, 4, 5, 6].map((n) => ({
  id: `shot-0${String(n)}`,
  prompt: `Build the scene for shot ${String(n)}`,
  newSession: true,
}));

const readPipeline = (projectDir: string): PipelineState =>
  pipelineStateSchema.parse(JSON.parse(readFileSync(pipelineFilePath(projectDir), 'utf8')));

const statuses = (state: PipelineState): string[] =>
  state.queue.map((item) => `${item.id}:${item.status}`);

/** One "app process": clock, guard, ledger, manager and the scene-build queue of a project. */
function appInstance(
  projectDir: string,
  vars: Record<string, string>,
  startMs: number,
): { clock: ManualClock; guard: LimitGuard; queue: WorkQueue; events: WorkQueueEvent[] } {
  const clock = new ManualClock(startMs);
  const now = (): Date => new Date(clock.now());
  const guard = new LimitGuard({ clock, timeZone: 'UTC' });
  const { manager } = harness.manager(vars, { guard, usage: new UsageLedger({ now }), now });
  const queue = new WorkQueue({ manager, guard, projectDir, stage: 'scene-build', now });
  const events: WorkQueueEvent[] = [];
  queue.on('event', (event) => events.push(event));
  return { clock, guard, queue, events };
}

function writeScript(steps: unknown[]): string {
  const script = path.join(harness.temps.make('rf script '), 'script.json');
  writeFileSync(script, JSON.stringify({ version: 1, sequence: steps }));
  return script;
}

const started = (events: readonly WorkQueueEvent[]): string[] =>
  events.flatMap((event) => (event.type === 'item-started' ? [event.id] : []));

describe('WorkQueue: usage limit in the middle of building 6 scene jobs', () => {
  it('pauses at job 4, survives a restart, resumes after the reset; jobs 1-3 never re-run', async () => {
    const resetsAt = T0 / 1000 + 2 * 3600;
    // Calls 1-3 ok, call 4 hits the limit, 5-7 ok; an 8th call would crash (and show up).
    const script = writeScript([
      'ok',
      'ok',
      'ok',
      { scenario: 'rate-limit', resetsAt },
      'ok',
      'ok',
      'ok',
      'crash',
    ]);
    const vars = { FAKE_CLAUDE_SCRIPT: script };
    const projectDir = harness.project();

    // --- first app run ---
    const first = appInstance(projectDir, vars, T0);
    expect((await first.queue.add(SHOTS)).ok).toBe(true);
    const firstRun = first.queue.run();
    expect(await waitFor(() => first.events.some((event) => event.type === 'paused'), 20_000)).toBe(
      true,
    );
    expect(first.guard.pause?.until).toBe(resetsAt * 1000 + MIN);
    await first.queue.stop(); // app shutdown while paused
    const firstSummary = await firstRun;
    first.guard.dispose();
    expect(firstSummary.ok && firstSummary.value).toMatchObject({
      status: 'stopped',
      done: ['shot-01', 'shot-02', 'shot-03'],
      pending: ['shot-04', 'shot-05', 'shot-06'],
    });
    expect(started(first.events)).toEqual(['shot-01', 'shot-02', 'shot-03', 'shot-04']);
    const persisted = readPipeline(projectDir);
    expect(statuses(persisted)).toEqual([
      'shot-01:done',
      'shot-02:done',
      'shot-03:done',
      'shot-04:pending',
      'shot-05:pending',
      'shot-06:pending',
    ]);
    expect(persisted.queue[3]).toMatchObject({ attempts: 0, limitHits: 1 });
    expect(persisted.pause).toMatchObject({
      reason: 'limit',
      pausedUntil: new Date(resetsAt * 1000 + MIN).toISOString(),
      untilSource: 'reset-time',
      rateLimitType: 'five_hour',
      concurrency: 1,
    });
    expect(persisted.stages['scene-build']?.status).toBe('paused');
    const usage = usageFileSchema.parse(
      JSON.parse(readFileSync(usageFilePath(projectDir), 'utf8')),
    );
    expect(usage.stages['scene-build']?.['opus']).toMatchObject({ turns: 4, limitHits: 1 });
    const dumps = readdirSync(path.join(projectDir, DEBUG_DIR));
    expect(dumps.filter((name) => name.endsWith('.jsonl'))).toHaveLength(1);
    expect(dumps).toContain('.gitignore');

    // --- restart: brand-new instances, 10 minutes later ---
    const second = appInstance(projectDir, vars, T0 + 10 * MIN);
    const secondRun = second.queue.run();
    expect(await waitFor(() => second.guard.paused)).toBe(true);
    expect(second.clock.pending).toBe(1);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(started(second.events)).toEqual([]); // still before the reset time
    second.clock.advance(resetsAt * 1000 + MIN - (T0 + 10 * MIN));
    const secondSummary = await secondRun;
    expect(secondSummary.ok && secondSummary.value).toMatchObject({
      status: 'done',
      done: SHOTS.map((shot) => shot.id),
      failed: [],
      pending: [],
    });
    expect(started(second.events)).toEqual(['shot-04', 'shot-05', 'shot-06']);
    expect(second.events.find((event) => event.type === 'resumed')).toEqual({
      type: 'resumed',
      cause: 'reset-time',
    });
    const final = readPipeline(projectDir);
    expect(final.pause).toBeUndefined();
    expect(final.stages['scene-build']?.status).toBe('done');
    expect(
      final.queue.every((item) => item.status === 'done' && item.sessionId !== undefined),
    ).toBe(true);
    expect(readFileSync(`${script}.state`, 'utf8')).toBe('7'); // exactly 7 CLI calls
  }, 60_000);
});

describe('WorkQueue: recovery and failures', () => {
  it('an item left "running" by an app crash runs again; done items do not', async () => {
    const projectDir = harness.project();
    const at = new Date(T0).toISOString();
    const item = (id: string, status: 'done' | 'running' | 'pending') => ({
      id,
      stage: 'scene-build',
      prompt: `Build ${id}`,
      status,
      attempts: status === 'pending' ? 0 : 1,
      limitHits: 0,
      createdAt: at,
      updatedAt: at,
    });
    const state: PipelineState = {
      version: 1,
      updatedAt: at,
      stages: { 'scene-build': { status: 'running', updatedAt: at } },
      queue: [item('shot-01', 'done'), item('shot-02', 'running'), item('shot-03', 'pending')],
    };
    mkdirSync(path.dirname(pipelineFilePath(projectDir)), { recursive: true });
    writeFileSync(pipelineFilePath(projectDir), JSON.stringify(state));
    const app = appInstance(projectDir, {}, T0);
    const summary = await app.queue.run();
    expect(summary.ok && summary.value.status).toBe('done');
    expect(started(app.events)).toEqual(['shot-02', 'shot-03']);
    expect(readPipeline(projectDir).queue.map((entry) => entry.attempts)).toEqual([1, 2, 1]);
  }, 30_000);

  it('retries a crashed item once, then marks it failed and finishes the others', async () => {
    const script = writeScript(['crash', 'ok', 'crash']);
    const projectDir = harness.project();
    const app = appInstance(projectDir, { FAKE_CLAUDE_SCRIPT: script }, T0);
    await app.queue.add(SHOTS.slice(0, 2));
    const summary = await app.queue.run();
    // shot-01: crash -> retried at once -> ok; shot-02: crash, crash (sequence sticks) -> failed.
    expect(summary.ok && summary.value).toMatchObject({
      status: 'failed',
      done: ['shot-01'],
      failed: ['shot-02'],
    });
    expect(app.events.filter((event) => event.type === 'item-requeued')).toMatchObject([
      { id: 'shot-01', reason: 'retry' },
      { id: 'shot-02', reason: 'retry' },
    ]);
    expect(readPipeline(projectDir).queue[1]).toMatchObject({ attempts: 2, status: 'failed' });
    expect(readPipeline(projectDir).stages['scene-build']?.status).toBe('failed');
  }, 30_000);

  it('blocks (does not burn through items) when the CLI is not logged in', async () => {
    const projectDir = harness.project();
    const app = appInstance(projectDir, { FAKE_CLAUDE_SCENARIO: 'not-logged-in' }, T0);
    await app.queue.add(SHOTS.slice(0, 3));
    const summary = await app.queue.run();
    expect(summary.ok && summary.value).toMatchObject({
      status: 'blocked',
      pending: ['shot-01', 'shot-02', 'shot-03'],
    });
    expect(started(app.events)).toEqual(['shot-01']);
    expect(readPipeline(projectDir).stages['scene-build']).toMatchObject({ status: 'blocked' });
  }, 30_000);

  it('adding the same ids again keeps their state (no duplicate jobs)', async () => {
    const projectDir = harness.project();
    const app = appInstance(projectDir, {}, T0);
    await app.queue.add(SHOTS.slice(0, 1));
    await app.queue.run();
    const again = await app.queue.add(SHOTS.slice(0, 2));
    expect(again.ok && again.value.map((entry) => `${entry.id}:${entry.status}`)).toEqual([
      'shot-01:done',
      'shot-02:pending',
    ]);
  }, 30_000);
});
