/** Storyboard on fake-claude: validation + repair, stubs, missing props, limit pause, cancel. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PipelineStateStore } from '@reelforge/claude-bridge';
import { lintScene } from '@reelforge/engine';
import { storyboardFileSchema, storyboardReportSchema } from '@reelforge/shared';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { StageRunner } from './runner.js';
import { SCENE_STUB_MARKER } from './stages/scene-stub.js';
import { continuationPrompt } from './turns.js';
import { FakeClaudeHarness, writes, type Step } from './testing/fake-claude.js';
import { ManualClock } from './testing/manual-clock.js';
import { TestProjects, goldenFile, readProject } from './testing/project.js';
import type { StageEvent } from './types.js';

const projects = new TestProjects();
const harnesses: FakeClaudeHarness[] = [];
afterEach(async () => {
  await Promise.all(harnesses.splice(0).map((harness) => harness.dispose()));
});
afterAll(() => {
  projects.dispose();
});

const GOLDEN = goldenFile('storyboard.json');
const WITH_MISSING = JSON.stringify(
  { ...(JSON.parse(GOLDEN) as Record<string, unknown>), missingProps: ['prism', 'flashlight'] },
  null,
  2,
);
const THREE_IN_A_ROW = GOLDEN.replace(
  '"treatment": "data-chart-3d"',
  '"treatment": "3d-reconstruction"',
);
/** Annotation plan per shot of the golden storyboard (PLAN.md#11.8): varied forms on real phrases. */
const PLANS: Readonly<Record<string, readonly object[]>> = {
  s01_hook: [
    { kind: 'big-text', phrase: 'quick experiment', text: 'TRY THIS', reason: 'emphasis' },
  ],
  s02_glass: [
    { kind: 'pin', phrase: 'glass of water', target: 'glass', text: 'WATER', reason: 'name' },
  ],
  s03_flashlight: [
    { kind: 'arrow', phrase: 'at an angle', target: 'flashlight beam', reason: 'place' },
  ],
  s04_rainbow: [{ kind: 'ring', phrase: 'tiny rainbow', target: 'rainbow', reason: 'emphasis' }],
  s05_spectrum: [
    { kind: 'callout', phrase: 'white light', text: 'MIX OF COLOURS', reason: 'definition' },
  ],
  s06_red_violet: [
    {
      kind: 'bracket',
      phrase: 'violet bends the most',
      target: 'red and violet rays',
      reason: 'comparison',
    },
  ],
  s07_newton: [
    { kind: 'pin', phrase: 'Isaac Newton', target: 'Newton', text: 'ISAAC NEWTON', reason: 'name' },
    { kind: 'counter', phrase: '1672', text: '1672', reason: 'number' },
  ],
};

function planned(plans: Readonly<Record<string, readonly object[]>>): string {
  const storyboard = JSON.parse(GOLDEN) as { shots: { id: string }[] };
  const shots = storyboard.shots.map((shot) => ({ ...shot, annotations: plans[shot.id] ?? [] }));
  return JSON.stringify({ ...storyboard, shots }, null, 2);
}

/** fake-claude's `rate-limit` reset time (epoch s). */
const FAKE_RESETS_AT = 1_790_902_800;

async function setup(name: string, steps: readonly Step[], clock?: ManualClock) {
  const dir = await projects.create(name, [
    'script.txt',
    'timing/words.json',
    'scenes/s06_red_violet.js',
  ]);
  const harness = new FakeClaudeHarness(steps, clock === undefined ? {} : { clock });
  harnesses.push(harness);
  const runner = new StageRunner({
    projectDir: dir,
    claude: harness.runner,
    guard: harness.guard,
    git: projects.git,
  });
  const events: StageEvent[] = [];
  runner.on('event', (event) => events.push(event));
  return { dir, harness, runner, events };
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

describe('storyboard stage', { timeout: 60_000 }, () => {
  it('writes a valid storyboard, stub scenes for new shots, missing props, and commits', async () => {
    const { dir, harness, runner } = await setup('storyboard ok', [
      writes({ 'storyboard.json': WITH_MISSING }),
    ]);
    const result = await runner.run({ stage: 'storyboard' });
    expect(result.ok && result.value).toMatchObject({
      message: '7 shots, 6 treatments, 2 missing props',
      metrics: { shots: 7, missingProps: 2, stubs: 6, repairs: 0 },
      warnings: ['missing props: prism, flashlight'],
    });
    expect(harness.specs[0]).toMatchObject({
      stage: 'storyboard',
      purpose: 'main',
      model: 'sonnet',
    });
    expect(harness.specs[0]?.prompt).toContain('styles/voxel-pixel-crisp640/STYLE.md');
    // The existing scene is kept; the others are lint-clean placeholders.
    expect(readProject(dir, 'scenes/s06_red_violet.js')).toBe(
      goldenFile('scenes/s06_red_violet.js'),
    );
    const stub = readFileSync(path.join(dir, 'scenes', 's01_hook.js'), 'utf8');
    expect(stub.startsWith(SCENE_STUB_MARKER)).toBe(true);
    expect(
      lintScene(stub, { filename: 'scenes/s01_hook.js' }).filter((d) => d.severity === 'error'),
    ).toEqual([]);
    const report = storyboardReportSchema.parse(
      JSON.parse(readProject(dir, '.reelforge/reports/storyboard.json')),
    );
    expect(report.stubs).toHaveLength(6);

    const commits = await projects.history(dir);
    expect(commits.slice(0, 2).map((entry) => [entry.kind, entry.step])).toEqual([
      ['pipeline-step', 'storyboard'],
      ['claude-turn', 'storyboard'],
    ]);
    expect(commits[0]?.subject).toBe('Storyboard: 7 shots, 6 treatments, 2 missing props');
    expect(commits[0]?.files).toHaveLength(6);
  });

  it('repairs a treatment used three times in a row', async () => {
    const { harness, runner } = await setup('storyboard repair', [
      writes({ 'storyboard.json': THREE_IN_A_ROW }),
      writes({ 'storyboard.json': GOLDEN }),
    ]);
    const result = await runner.run({ stage: 'storyboard' });
    expect(result.ok && result.value.metrics['repairs']).toBe(1);
    expect(harness.specs[1]?.prompt).toContain('treatment-run');
  });

  it('keeps an annotation plan with varied forms, repairs one that repeats a form or misses a phrase', async () => {
    const repeated = planned({
      ...PLANS,
      s02_glass: [{ kind: 'ring', phrase: 'a glass of water', reason: 'place' }],
      s03_flashlight: [{ kind: 'ring', phrase: 'flashlight', reason: 'place' }],
      s05_spectrum: [{ kind: 'callout', phrase: 'white lights', reason: 'definition' }],
    });
    const { dir, harness, runner } = await setup('storyboard annotations', [
      writes({ 'storyboard.json': repeated }),
      writes({ 'storyboard.json': planned(PLANS) }),
    ]);
    const result = await runner.run({ stage: 'storyboard' });
    expect(result.ok && result.value.metrics).toMatchObject({ repairs: 1, annotations: 8 });
    expect(harness.specs[0]?.prompt).toContain('`definition` (a term is explained) → `callout`');
    const repair = harness.specs[1]?.prompt ?? '';
    expect(repair).toContain('annotation-run');
    expect(repair).toContain('annotation phrase "white lights" is not spoken');
    const written = storyboardFileSchema.parse(JSON.parse(readProject(dir, 'storyboard.json')));
    const kinds = written.shots.flatMap((shot) =>
      (shot.annotations ?? []).map((plan) => plan.kind),
    );
    expect(new Set(kinds).size).toBeGreaterThanOrEqual(6);
  });

  it('pauses on a usage limit mid-stage, persists it, resumes at the reset time and finishes', async () => {
    const clock = new ManualClock((FAKE_RESETS_AT - 3600) * 1000);
    const { dir, harness, runner, events } = await setup(
      'storyboard limit',
      ['rate-limit', writes({ 'storyboard.json': GOLDEN })],
      clock,
    );
    const paused = nextEvent(runner, 'paused');
    const running = runner.run({ stage: 'storyboard' });
    const pause = await paused;
    expect(pause).toMatchObject({
      stage: 'storyboard',
      until: new Date((FAKE_RESETS_AT + 60) * 1000).toISOString(),
    });
    const state = await new PipelineStateStore().read(dir);
    expect(state.ok && state.value.stages['storyboard']?.status).toBe('paused');
    expect(state.ok && state.value.pause?.pausedUntil).toBe(
      pause.type === 'paused' ? pause.until : '',
    );

    clock.advance(2 * 3600 * 1000);
    const result = await running;
    expect(result.ok).toBe(true);
    expect(events.map((event) => event.type)).toEqual(
      expect.arrayContaining(['paused', 'resumed', 'done']),
    );
    expect(harness.specs[1]?.prompt).toBe(continuationPrompt(harness.specs[0]?.prompt ?? ''));
    expect(harness.specs[1]?.newSession).toBe(false);
    const after = await new PipelineStateStore().read(dir);
    expect(after.ok && after.value.pause).toBeUndefined();
    expect(after.ok && after.value.stages['storyboard']?.status).toBe('done');
    expect(result.ok && result.value.usage?.limitHits).toBe(1);
  });

  it('cancels a running turn (process killed) and leaves the stage idle', async () => {
    const { dir, harness, runner } = await setup('storyboard cancel', ['hang']);
    const started = nextEvent(runner, 'claude');
    const running = runner.run({ stage: 'storyboard' });
    await started;
    runner.cancel();
    const result = await running;
    expect(!result.ok && result.error.kind).toBe('cancelled');
    await harness.manager.whenIdle();
    const finished = harness.lifecycle.find((event) => event.type === 'finished');
    expect(finished?.type === 'finished' && finished.outcome.status).toBe('cancelled');
    const state = await new PipelineStateStore().read(dir);
    expect(state.ok && state.value.stages['storyboard']?.status).toBe('idle');
    expect(runner.running).toBeUndefined();
  });

  it('refuses to run while another stage runs', async () => {
    const { runner } = await setup('storyboard busy', ['hang']);
    const started = nextEvent(runner, 'claude');
    const first = runner.run({ stage: 'storyboard' });
    await started;
    const second = await runner.run({ stage: 'sound-cues' });
    expect(!second.ok && second.error.kind).toBe('busy');
    runner.cancel();
    expect((await first).ok).toBe(false);
  });
});
