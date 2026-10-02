/**
 * Scenes built on fake-claude with a scripted frame renderer (no browser): the 8-shot film,
 * per-shot jobs in pipeline.json, a usage limit mid-build (pause → resume, and resume after a
 * restart without redoing finished shots), concurrency, cancellation, a persistent lint error (✗),
 * missing props. The same 8-shot scenario on the real engine: test/scenes-build.test.ts.
 */
import { LimitGuard, PipelineStateStore } from '@reelforge/claude-bridge';
import { autocommit } from '@reelforge/project';
import type { FakeClaudeScript } from '@reelforge/fake-claude';
import { scenesReportSchema, type ShotBuildRecord } from '@reelforge/shared';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { StageRunner } from './runner.js';
import type { MissingPropsHandler } from './scenes/tools.js';
import { DEFAULT_SCENE_SETTINGS, DEFAULT_STAGE_SETTINGS } from './settings.js';
import { FakeClaudeHarness } from './testing/fake-claude.js';
import {
  CRITIC_OK,
  EIGHT_SHOT_FIXES,
  EIGHT_SHOT_STATUSES,
  buildRule,
  eightShotScript,
  filmShots,
  fixRule,
  sceneSource,
  writeFilm,
  type FilmShot,
} from './testing/film.js';
import { ManualClock } from './testing/manual-clock.js';
import { TestProjects, readProject } from './testing/project.js';
import { ScriptedFrameRenderer } from './testing/scripted-renderer.js';
import type { StageEvent } from './types.js';

const projects = new TestProjects();
const harnesses: FakeClaudeHarness[] = [];
afterEach(async () => {
  await Promise.all(harnesses.splice(0).map((harness) => harness.dispose()));
});
afterAll(() => {
  projects.dispose();
});

/** fake-claude's `rate-limit` reset time (epoch s). */
const FAKE_RESETS_AT = 1_790_902_800;

interface Setup {
  readonly count: number;
  readonly script: (shots: readonly FilmShot[]) => FakeClaudeScript;
  readonly concurrency?: number;
  readonly clock?: ManualClock;
  readonly onMissingProps?: MissingPropsHandler;
  readonly dir?: string;
  /** Successful turns before the guard raises its concurrency again (default 3). */
  readonly recoverAfter?: number;
}

async function setup(name: string, options: Setup) {
  const shots = filmShots(options.count);
  const dir = options.dir ?? (await projects.create(name));
  if (options.dir === undefined) {
    writeFilm(dir, shots);
    const saved = await autocommit(dir, 'Storyboard', { kind: 'manual', git: projects.git });
    expect(saved.ok).toBe(true);
  }
  const guard = new LimitGuard({
    maxConcurrency: 2,
    ...(options.clock === undefined ? {} : { clock: options.clock }),
    ...(options.recoverAfter === undefined ? {} : { recoverAfter: options.recoverAfter }),
  });
  const harness = new FakeClaudeHarness(options.script(shots), { concurrency: 2, guard });
  harnesses.push(harness);
  const renderer = new ScriptedFrameRenderer();
  const runner = new StageRunner({
    projectDir: dir,
    claude: harness.runner,
    guard: harness.guard,
    git: projects.git,
    scenes: { frames: renderer, onMissingProps: options.onMissingProps },
    settings: {
      ...DEFAULT_STAGE_SETTINGS,
      scenes: { ...DEFAULT_SCENE_SETTINGS, concurrency: options.concurrency ?? 2 },
    },
  });
  const events: StageEvent[] = [];
  runner.on('event', (event) => events.push(event));
  return { dir, shots, harness, renderer, runner, events };
}

function report(dir: string): Map<string, ShotBuildRecord> {
  const parsed = scenesReportSchema.parse(
    JSON.parse(readProject(dir, '.reelforge/scenes-report.json')),
  );
  return new Map(parsed.shots.map((entry) => [entry.shotId, entry]));
}

/** Most shot jobs running at once, from the shot events. */
function maxParallelShots(events: readonly StageEvent[]): number {
  let active = 0;
  let max = 0;
  for (const event of events) {
    if (event.type !== 'shot') continue;
    active += event.state === 'started' ? 1 : -1;
    max = Math.max(max, active);
  }
  return max;
}

function builds(harness: FakeClaudeHarness, shot: FilmShot): number {
  return harness.specs.filter((spec) => spec.prompt.includes(`Write \`${shot.scene}\``)).length;
}

function nextEvent(runner: StageRunner, type: StageEvent['type']): Promise<StageEvent> {
  return new Promise((resolve) => {
    const listener = (event: StageEvent): void => {
      if (event.type !== type) return;
      runner.off('event', listener);
      resolve(event);
    };
    runner.on('event', listener);
  });
}

const allOk = (shots: readonly FilmShot[]): FakeClaudeScript => ({
  version: 1,
  rules: shots.map((shot) => buildRule(shot, sceneSource(shot))),
  default: { scenario: 'tools-write', reply: CRITIC_OK },
});

describe('scenes stage', { timeout: 120_000 }, () => {
  it('builds an 8-shot film without intervention: fixes, lint repair, ⚠ for a missing prop', async () => {
    const { dir, shots, harness, runner, events } = await setup('eight shots', {
      count: 8,
      script: eightShotScript,
    });
    const result = await runner.run({ stage: 'scenes' });
    expect(result.ok && result.value).toMatchObject({
      message: '8 shots: 7 ✓, 1 ⚠',
      metrics: { ok: 7, warning: 1, failed: 0, fixIterations: 4, missingProps: 1, built: 8 },
    });
    const records = report(dir);
    expect(Object.fromEntries([...records].map(([id, entry]) => [id, entry.status]))).toEqual(
      EIGHT_SHOT_STATUSES,
    );
    for (const [id, fixes] of Object.entries(EIGHT_SHOT_FIXES)) {
      expect(records.get(id)?.fixIterations, id).toBe(fixes);
    }
    expect(records.get('s07')?.findings).toEqual([
      expect.objectContaining({ source: 'missing-prop', severity: 'warning' }),
    ]);
    expect(records.get('s07')?.notes).toEqual(['missing props prism: kit extension skipped']);
    expect(readProject(dir, 'scenes/s03.js')).toBe(sceneSource(shots[2] as FilmShot));
    // Models per turn kind: Opus builds/fixes, Haiku critic; every scene turn in a fresh session.
    const specs = harness.specs;
    expect(
      new Set(specs.filter((spec) => spec.stage === 'critic').map((spec) => spec.model)),
    ).toEqual(new Set(['haiku']));
    expect(
      new Set(specs.filter((spec) => spec.stage !== 'critic').map((spec) => spec.model)),
    ).toEqual(new Set(['opus']));
    expect(specs.every((spec) => spec.newSession)).toBe(true);
    expect(specs.filter((spec) => spec.stage === 'scene-fix')).toHaveLength(4);
    expect(maxParallelShots(events)).toBe(2);
    // Autocommits as shots finish ("Scene sNN built ✓"); with 2 shots in flight a commit may
    // also carry the other shot's file, so every scene is in some shot commit.
    const expected = Object.entries(EIGHT_SHOT_STATUSES).map(
      ([id, status]) => `Scene ${id} built ${status === 'ok' ? '✓' : '⚠'}`,
    );
    const shotCommits = (await projects.history(dir)).filter((entry) =>
      entry.subject.startsWith('Scene s'),
    );
    expect(shotCommits.length).toBeGreaterThan(0);
    for (const entry of shotCommits) {
      expect(expected).toContain(entry.subject);
      expect([entry.kind, entry.step]).toEqual(['pipeline-step', 'scenes']);
    }
    const committed = new Set(shotCommits.flatMap((entry) => entry.files.map((file) => file.path)));
    for (const shot of shots) expect(committed.has(shot.scene), shot.scene).toBe(true);
    const state = await new PipelineStateStore().read(dir);
    expect(state.ok && state.value.queue.map((item) => item.status)).toEqual(
      Array.from({ length: 8 }, () => 'done'),
    );
    expect(state.ok && state.value.stages['scenes']?.status).toBe('done');
  });

  it('ends ✗ and fails the stage when a lint error survives two fixes', async () => {
    const { dir, harness, runner } = await setup('lint stays', {
      count: 1,
      concurrency: 1,
      script: ([shot]) => ({
        version: 1,
        rules:
          shot === undefined
            ? []
            : [
                buildRule(shot, sceneSource(shot, 'lint')),
                fixRule(shot, 1, sceneSource(shot, 'lint')),
                fixRule(shot, 2, sceneSource(shot, 'lint')),
              ],
      }),
    });
    const result = await runner.run({ stage: 'scenes' });
    expect(!result.ok && result.error).toMatchObject({
      kind: 'quality',
      message: '1 of 1 shots failed QA: s01',
    });
    const record = report(dir).get('s01');
    expect(record).toMatchObject({ status: 'failed', fixIterations: 2 });
    expect(record?.findings[0]).toMatchObject({ source: 'lint', fatal: true });
    // The critic never ran on a scene that does not lint.
    expect(harness.specs.map((spec) => spec.stage)).toEqual([
      'scene-build',
      'scene-fix',
      'scene-fix',
    ]);
  });

  it('builds the shot again when the missing prop was added to the kit', async () => {
    const decisions: string[][] = [];
    const { dir, harness, runner } = await setup('kit extension', {
      count: 1,
      onMissingProps: (names) => {
        decisions.push([...names]);
        return Promise.resolve('added');
      },
      script: ([shot]) => ({
        version: 1,
        sequence:
          shot === undefined
            ? []
            : [
                { ...buildRule(shot, sceneSource(shot), 'Built.\nMISSING: prism') },
                { ...buildRule(shot, sceneSource(shot), 'Built with the new prism.') },
                { scenario: 'tools-write', reply: CRITIC_OK },
              ],
      }),
    });
    const result = await runner.run({ stage: 'scenes' });
    expect(result.ok).toBe(true);
    expect(decisions).toEqual([['prism']]);
    expect(builds(harness, filmShots(1)[0] as FilmShot)).toBe(2);
    expect(report(dir).get('s01')).toMatchObject({ status: 'ok', missingProps: [] });
  });

  it('runs the build turns of two shots at the same time (detached sessions)', async () => {
    const two = await setup('concurrency two', { count: 2, script: allOk });
    expect((await two.runner.run({ stage: 'scenes' })).ok).toBe(true);
    let running = 0;
    let peak = 0;
    for (const event of two.harness.lifecycle) {
      if (event.stage !== 'scene-build') continue;
      if (event.type === 'started') running += 1;
      if (event.type === 'finished') running -= 1;
      peak = Math.max(peak, running);
    }
    expect(peak).toBe(2);
  });

  it('respects the concurrency setting', async () => {
    const one = await setup('concurrency one', { count: 4, concurrency: 1, script: allOk });
    expect((await one.runner.run({ stage: 'scenes' })).ok).toBe(true);
    expect(maxParallelShots(one.events)).toBe(1);
    expect(one.renderer.maxActive).toBe(1);
  });

  it('pauses on a usage limit, halves the concurrency and resumes without redoing shots', async () => {
    const clock = new ManualClock((FAKE_RESETS_AT - 3600) * 1000);
    const limited = (shots: readonly FilmShot[]): FakeClaudeScript => ({
      ...allOk(shots),
      rules: shots.map((shot) =>
        shot.id === 's02'
          ? { scenario: 'rate-limit', promptIncludes: `Write \`${shot.scene}\`` }
          : buildRule(shot, sceneSource(shot)),
      ),
    });
    const { dir, shots, harness, runner, events } = await setup('limit', {
      count: 4,
      clock,
      script: limited,
      recoverAfter: 100,
    });
    const paused = nextEvent(runner, 'paused');
    const running = runner.run({ stage: 'scenes' });
    await paused;
    const state = await new PipelineStateStore().read(dir);
    expect(state.ok && state.value.stages['scenes']?.status).toBe('paused');
    expect(harness.guard.concurrency).toBe(1);
    harness.setScript(allOk(shots));
    clock.advance(2 * 3600 * 1000);
    const result = await running;
    expect(result.ok && result.value.message).toBe('4 shots: 4 ✓');
    for (const shot of shots)
      expect(builds(harness, shot), shot.id).toBe(shot.id === 's02' ? 2 : 1);
    // After the limit (concurrency halved to 1) a shot only starts when none is running.
    let active = 0;
    let afterLimit = false;
    for (const event of events) {
      if (event.type === 'paused') afterLimit = true;
      if (event.type !== 'shot') continue;
      if (event.state === 'started' && afterLimit) expect(active).toBe(0);
      active += event.state === 'started' ? 1 : -1;
    }
    expect(result.ok && result.value.usage?.limitHits).toBe(1);
  });

  it('continues an interrupted build after a restart: finished shots are not built again', async () => {
    const clock = new ManualClock((FAKE_RESETS_AT - 3600) * 1000);
    const limited = (shots: readonly FilmShot[]): FakeClaudeScript => ({
      ...allOk(shots),
      rules: shots.map((shot) =>
        shot.id === 's02'
          ? { scenario: 'rate-limit', promptIncludes: `Write \`${shot.scene}\`` }
          : buildRule(shot, sceneSource(shot)),
      ),
    });
    const first = await setup('restart', { count: 3, concurrency: 1, clock, script: limited });
    const paused = nextEvent(first.runner, 'paused');
    const running = first.runner.run({ stage: 'scenes' });
    await paused;
    first.runner.cancel(); // the app closes while paused
    const stopped = await running;
    expect(!stopped.ok && stopped.error.kind).toBe('cancelled');
    const state = await new PipelineStateStore().read(first.dir);
    expect(state.ok && state.value.queue.map((item) => [item.id, item.status])).toEqual([
      ['s01', 'done'],
      ['s02', 'pending'],
      ['s03', 'pending'],
    ]);
    expect(state.ok && state.value.pause).toBeDefined();

    clock.advance(2 * 3600 * 1000);
    const second = await setup('restart', {
      count: 3,
      concurrency: 1,
      clock,
      script: allOk,
      dir: first.dir,
    });
    const result = await second.runner.run({ stage: 'scenes' });
    expect(result.ok && result.value.message).toBe('3 shots: 3 ✓ (resumed, 1 already built)');
    expect(second.harness.specs.some((spec) => spec.prompt.includes('Write `scenes/s01.js`'))).toBe(
      false,
    );
    expect([...report(first.dir).keys()]).toEqual(['s01', 's02', 's03']);
    const after = await new PipelineStateStore().read(first.dir);
    expect(after.ok && after.value.pause).toBeUndefined();
  });

  it('cancels a running build: the process is killed and the shot is left for the next run', async () => {
    const { dir, harness, runner, events } = await setup('cancel', {
      count: 2,
      concurrency: 1,
      script: () => ({ version: 1, default: 'hang' }),
    });
    const started = nextEvent(runner, 'claude');
    const running = runner.run({ stage: 'scenes' });
    await started;
    runner.cancel();
    const result = await running;
    expect(!result.ok && result.error.kind).toBe('cancelled');
    await harness.manager.whenIdle();
    const state = await new PipelineStateStore().read(dir);
    expect(state.ok && state.value.stages['scenes']?.status).toBe('idle');
    expect(state.ok && state.value.queue.map((item) => item.status)).toEqual([
      'pending',
      'pending',
    ]);
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'shot', shotId: 's01', state: 'requeued' }),
    );
  });

  it('refuses to run without a storyboard or a frame renderer', async () => {
    const dir = await projects.create('no storyboard');
    const runner = new StageRunner({ projectDir: dir, git: projects.git, autocommit: false });
    const result = await runner.run({ stage: 'scenes' });
    expect(!result.ok && result.error.kind).toBe('not-ready');
    writeFilm(dir, filmShots(1));
    const harness = new FakeClaudeHarness([]);
    harnesses.push(harness);
    const noFrames = new StageRunner({
      projectDir: dir,
      claude: harness.runner,
      autocommit: false,
    });
    const missing = await noFrames.run({ stage: 'scenes' });
    expect(!missing.ok && missing.error).toMatchObject({ kind: 'missing-tool' });
    const unknown = await new StageRunner({
      projectDir: dir,
      claude: harness.runner,
      scenes: { frames: new ScriptedFrameRenderer() },
      autocommit: false,
    }).run({ stage: 'scenes', shots: ['s09'] });
    expect(!unknown.ok && unknown.error.kind).toBe('invalid-input');
  });
});
