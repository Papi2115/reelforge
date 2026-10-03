/**
 * Final review (PLAN.md#11.5) on fake-claude + the scripted renderer: a clean film costs one
 * batched Haiku turn and no Opus turn; a broken shot gets one fix and ends ✓ with a single
 * "Final review" commit; locked shots are only reported; a usage limit pauses and resumes; a
 * stopped review leaves "Scenes built" done.
 */
import { LimitGuard, PipelineStateStore } from '@reelforge/claude-bridge';
import type { FakeClaudeScript } from '@reelforge/fake-claude';
import { autocommit } from '@reelforge/project';
import { finalReviewSchema, scenesReportSchema, type FinalReview } from '@reelforge/shared';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { setShotsLocked } from './locks.js';
import { StageRunner } from './runner.js';
import { FakeClaudeHarness, writes } from './testing/fake-claude.js';
import {
  CRITIC_OK,
  filmShots,
  sceneSource,
  writeFilm,
  type FilmShot,
  type SceneVariant,
} from './testing/film.js';
import { ManualClock } from './testing/manual-clock.js';
import { TestProjects, readProject, writeProject } from './testing/project.js';
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
const TRIAGE_SHEET = '.reelforge/frames/qa/final/sheet-1.png';
const NO_SUSPECTS = {
  scenario: 'tools-write',
  reply: '{"suspects":[]}',
  promptIncludes: TRIAGE_SHEET,
} as const;

interface Options {
  readonly locked?: readonly string[];
  readonly clock?: ManualClock;
}

async function setup(
  name: string,
  variants: readonly SceneVariant[],
  script: (shots: readonly FilmShot[]) => FakeClaudeScript,
  options: Options = {},
) {
  const dir = await projects.create(name);
  const shots = filmShots(variants.length);
  writeFilm(dir, shots);
  shots.forEach((shot, index) => {
    writeProject(dir, shot.scene, sceneSource(shot, variants[index]));
  });
  if (options.locked !== undefined) {
    expect((await setShotsLocked(dir, options.locked, true, new Date())).ok).toBe(true);
  }
  expect((await autocommit(dir, 'Scenes', { kind: 'manual', git: projects.git })).ok).toBe(true);
  const guard = new LimitGuard({
    maxConcurrency: 2,
    ...(options.clock === undefined ? {} : { clock: options.clock }),
  });
  const harness = new FakeClaudeHarness(script(shots), { concurrency: 2, guard });
  harnesses.push(harness);
  const runner = new StageRunner({
    projectDir: dir,
    claude: harness.runner,
    guard,
    git: projects.git,
    scenes: { frames: new ScriptedFrameRenderer() },
  });
  const events: StageEvent[] = [];
  runner.on('event', (event) => events.push(event));
  return { dir, shots, harness, runner, events };
}

function finalReport(dir: string): FinalReview {
  return finalReviewSchema.parse(JSON.parse(readProject(dir, '.reelforge/final-review.json')));
}

const fixOf = (shot: FilmShot, content: string) => ({
  ...writes({ [shot.scene]: content }, 'Fixed.'),
  promptIncludes: `Final review of shot ${shot.id} `,
});

describe('final review', { timeout: 120_000 }, () => {
  it('clean film: code checks + one batched critic turn, no Opus turn, all ✓', async () => {
    const { dir, harness, runner, events } = await setup('final clean', ['ok', 'ok', 'ok'], () => ({
      version: 1,
      rules: [NO_SUSPECTS],
    }));
    const result = await runner.run({ stage: 'scenes', action: 'final-review', trigger: 'auto' });
    expect(result.ok && result.value).toMatchObject({
      message: 'Review done: 3 ✓',
      changed: false,
      metrics: { ok: 3, warning: 0, failed: 0, fixed: 0, locked: 0, syncProblems: 0 },
    });
    expect(harness.specs.map((spec) => [spec.stage, spec.model])).toEqual([['critic', 'haiku']]);
    expect(harness.specs[0]?.prompt).toContain(TRIAGE_SHEET);
    const report = finalReport(dir);
    expect(report).toMatchObject({ trigger: 'auto', counts: { ok: 3, fixed: 0 } });
    expect(report.shots.map((entry) => entry.status)).toEqual(['ok', 'ok', 'ok']);
    const steps = events.flatMap((event) => (event.type === 'step' ? [event.label] : []));
    expect(steps).toEqual(expect.arrayContaining(['Reviewing… 1/3', 'Reviewing… 3/3']));
  });

  it('one broken shot: one Opus fix → ✓, one "Final review" commit', async () => {
    const { dir, shots, harness, runner } = await setup(
      'final fix',
      ['ok', 'overlap', 'ok'],
      (film) => ({
        version: 1,
        rules: [NO_SUSPECTS, fixOf(film[1] as FilmShot, sceneSource(film[1] as FilmShot))],
        default: { scenario: 'tools-write', reply: CRITIC_OK },
      }),
    );
    const result = await runner.run({ stage: 'scenes', action: 'final-review' });
    expect(result.ok && result.value).toMatchObject({
      message: 'Review done: 3 ✓; fixed 1 shot',
      changed: true,
      metrics: { fixed: 1 },
    });
    expect(harness.specs.map((spec) => [spec.stage, spec.model])).toEqual([
      ['critic', 'haiku'],
      ['scene-fix', 'opus'],
      ['critic', 'haiku'],
    ]);
    expect(harness.specs[1]?.prompt).toContain('card-overlap');
    expect(readProject(dir, 'scenes/s02.js')).toBe(sceneSource(shots[1] as FilmShot));
    const report = finalReport(dir);
    expect(report.shots[1]).toMatchObject({ shotId: 's02', status: 'ok', autoFixed: true });
    const scenes = scenesReportSchema.parse(
      JSON.parse(readProject(dir, '.reelforge/scenes-report.json')),
    );
    expect(scenes.shots.find((entry) => entry.shotId === 's02')).toMatchObject({
      status: 'ok',
      fixIterations: 1,
    });
    const subjects = (await projects.history(dir)).map((entry) => entry.subject);
    expect(subjects[0]).toBe('Final review: fixed 1 shot');
    expect(subjects.filter((subject) => subject.startsWith('Scene s02'))).toEqual([]);
  });

  it('reports locked shots without changing them', async () => {
    const { dir, shots, harness, runner } = await setup(
      'final locked',
      ['ok', 'overlap'],
      () => ({
        version: 1,
        rules: [NO_SUSPECTS],
        default: { scenario: 'tools-write', reply: CRITIC_OK },
      }),
      { locked: ['s02'] },
    );
    const result = await runner.run({ stage: 'scenes', action: 'final-review' });
    expect(result.ok && result.value.message).toBe('Review done: 1 ✓, 1 ⚠; 1 locked');
    expect(harness.specs.map((spec) => spec.stage)).toEqual(['critic']);
    expect(readProject(dir, 'scenes/s02.js')).toBe(sceneSource(shots[1] as FilmShot, 'overlap'));
    expect(finalReport(dir).shots[1]).toMatchObject({
      status: 'warning',
      locked: true,
      autoFixed: false,
      outOfSync: false,
    });
  });

  it('pauses on a usage limit and resumes the review', async () => {
    const clock = new ManualClock((FAKE_RESETS_AT - 3600) * 1000);
    const { dir, harness, runner } = await setup(
      'final limit',
      ['ok', 'ok'],
      () => ({
        version: 1,
        rules: [{ scenario: 'rate-limit', promptIncludes: TRIAGE_SHEET }],
      }),
      { clock },
    );
    const paused = new Promise<void>((resolve) => {
      runner.on('event', (event) => {
        if (event.type === 'paused') resolve();
      });
    });
    const running = runner.run({ stage: 'scenes', action: 'final-review' });
    await paused;
    harness.setScript({ version: 1, rules: [NO_SUSPECTS] });
    clock.advance(2 * 3600 * 1000);
    const result = await running;
    expect(result.ok && result.value.message).toBe('Review done: 2 ✓');
    expect(result.ok && result.value.usage?.limitHits).toBe(1);
    expect(finalReport(dir).counts.ok).toBe(2);
  });

  it('a stopped review leaves "Scenes built" as it was', async () => {
    const { dir, runner } = await setup('final stop', ['ok', 'ok'], () => ({
      version: 1,
      rules: [NO_SUSPECTS],
    }));
    const store = new PipelineStateStore();
    expect((await store.setStage(dir, 'scenes', 'done', '2 shots: 2 ✓')).ok).toBe(true);
    runner.on('event', (event) => {
      if (event.type === 'step' && event.label.startsWith('Reviewing')) runner.cancel();
    });
    const result = await runner.run({ stage: 'scenes', action: 'final-review' });
    expect(!result.ok && result.error.kind).toBe('cancelled');
    const state = await store.read(dir);
    expect(state.ok && state.value.stages['scenes']).toMatchObject({
      status: 'done',
      message: '2 shots: 2 ✓',
    });
  });
});
