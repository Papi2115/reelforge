/** Script stage on fake-claude: research + script turns, validation, repair, models, commits. */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { ECONOMY_HINT, PipelineStateStore } from '@reelforge/claude-bridge';
import { genrePresetScriptTone, scriptReportSchema } from '@reelforge/shared';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { StageRunner } from './runner.js';
import { DEFAULT_STAGE_SETTINGS } from './settings.js';
import { FakeClaudeHarness, writes, type Step } from './testing/fake-claude.js';
import { TestProjects, goldenFile, readProject, writeProject } from './testing/project.js';
import type { StageEvent } from './types.js';

const projects = new TestProjects();
const harnesses: FakeClaudeHarness[] = [];
afterEach(async () => {
  await Promise.all(harnesses.splice(0).map((harness) => harness.dispose()));
});
afterAll(() => {
  projects.dispose();
});

const RESEARCH = writes({ 'research.md': goldenFile('research.md') }, 'Saved research.md.');
const SCRIPT = writes(
  { 'beats.md': goldenFile('beats.md'), 'script.txt': goldenFile('script.txt') },
  'Word count: 84.',
);
const BAD_SCRIPT = writes({
  'beats.md': goldenFile('beats.md'),
  'script.txt': '# Rainbow\n\n[VISUAL: a glass] Water bends light.',
});

async function setup(name: string, steps: readonly Step[], settings = DEFAULT_STAGE_SETTINGS) {
  const dir = await projects.create(name, ['brief.json']);
  const harness = new FakeClaudeHarness(steps);
  harnesses.push(harness);
  const runner = new StageRunner({
    projectDir: dir,
    claude: harness.runner,
    guard: harness.guard,
    settings,
    git: projects.git,
  });
  const events: StageEvent[] = [];
  runner.on('event', (event) => events.push(event));
  return { dir, harness, runner, events };
}

describe('script stage', { timeout: 60_000 }, () => {
  it('researches, writes beats + script, reports words and duration, commits each turn', async () => {
    const { dir, harness, runner, events } = await setup('script ok', [RESEARCH, SCRIPT]);
    const result = await runner.run({ stage: 'script' });
    expect(result.ok && result.value).toMatchObject({
      stage: 'script',
      message: '84 words, about 0:34 at 150 wpm',
      metrics: { wordCount: 84, targetWords: 75, estimatedSeconds: 33.6, repairs: 0 },
      outputs: ['research.md', 'beats.md', 'script.txt'],
    });
    expect(readProject(dir, 'script.txt')).toBe(goldenFile('script.txt'));
    expect(
      scriptReportSchema.parse(JSON.parse(readProject(dir, '.reelforge/reports/script.json'))),
    ).toMatchObject({ wordCount: 84, researchSources: expect.any(Number) as number });

    expect(
      harness.specs.map((spec) => [spec.stage, spec.purpose, spec.newSession, spec.model]),
    ).toEqual([
      ['research', 'script', true, 'sonnet'],
      ['script', 'script', false, 'sonnet'],
    ]);
    expect(harness.specs[0]?.prompt).toContain('You are the researcher');
    expect(harness.specs[1]?.prompt).toContain('about 75 words');
    expect(path.resolve(harness.specs[0]?.projectDir ?? '')).toBe(path.resolve(dir));

    const commits = await projects.history(dir);
    expect(commits.slice(0, 2).map((entry) => [entry.kind, entry.step, entry.subject])).toEqual([
      ['claude-turn', 'script', 'Claude turn: script'],
      ['claude-turn', 'script', 'Claude turn: research'],
    ]);
    const state = await new PipelineStateStore().read(dir);
    expect(state.ok && state.value.stages['script']?.status).toBe('done');
    expect(events.map((event) => event.type)).toEqual(
      expect.arrayContaining(['started', 'step', 'claude', 'committed', 'done']),
    );
  });

  it('repairs an invalid script once and succeeds', async () => {
    const { harness, runner } = await setup('script repair', [RESEARCH, BAD_SCRIPT, SCRIPT]);
    const result = await runner.run({ stage: 'script' });
    expect(result.ok && result.value.metrics['repairs']).toBe(1);
    const repair = harness.specs[2]?.prompt ?? '';
    expect(repair).toContain("does not pass the app's checks");
    expect(repair).toContain('markdown-heading');
    expect(repair).toContain('word-count');
    expect(harness.specs[2]).toMatchObject({ stage: 'script', newSession: false });
  });

  it('fails with the issues when the repair does not fix the script', async () => {
    const { dir, runner } = await setup('script repair fails', [RESEARCH, BAD_SCRIPT, BAD_SCRIPT]);
    const result = await runner.run({ stage: 'script' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('validation');
    expect(result.error.issues?.some((line) => line.startsWith('stage-direction'))).toBe(true);
    const state = await new PipelineStateStore().read(dir);
    expect(state.ok && state.value.stages['script']?.status).toBe('failed');
  });

  it('uses Sonnet + the short-turn hint in Economy mode and per-stage models otherwise', async () => {
    const economy = await setup('script economy', [RESEARCH, SCRIPT], {
      ...DEFAULT_STAGE_SETTINGS,
      economy: true,
      models: { research: 'opus', script: 'opus' },
    });
    expect((await economy.runner.run({ stage: 'script' })).ok).toBe(true);
    expect(economy.harness.specs.map((spec) => spec.model)).toEqual(['sonnet', 'sonnet']);
    expect(economy.harness.specs[0]?.appendSystemPrompt).toBe(ECONOMY_HINT);

    const custom = await setup('script models', [RESEARCH, SCRIPT], {
      ...DEFAULT_STAGE_SETTINGS,
      models: { research: 'haiku', script: 'opus' },
    });
    expect((await custom.runner.run({ stage: 'script' })).ok).toBe(true);
    expect(custom.harness.models).toEqual(['haiku', 'opus']);
    expect(custom.harness.specs[0]?.appendSystemPrompt).toBeUndefined();
  });

  it("adds the genre preset's tone hint to the brief's tone (PLAN.md#13.8)", async () => {
    const plain = await setup('script no preset', [RESEARCH, SCRIPT]);
    expect((await plain.runner.run({ stage: 'script' })).ok).toBe(true);
    expect(plain.harness.specs[1]?.prompt).toContain('Tone: friendly, hands-on ·');

    const preset = await setup('script preset', [RESEARCH, SCRIPT]);
    const project = JSON.parse(readProject(preset.dir, 'project.json')) as Record<string, unknown>;
    writeProject(
      preset.dir,
      'project.json',
      JSON.stringify({ ...project, genrePreset: 'finance' }, null, 2),
    );
    expect((await preset.runner.run({ stage: 'script' })).ok).toBe(true);
    const hint = genrePresetScriptTone({ genrePreset: 'finance' }) ?? '';
    expect(preset.harness.specs[1]?.prompt).toContain(`Tone: friendly, hands-on; genre: ${hint} ·`);
    // The research prompt does not change.
    expect(preset.harness.specs[0]?.prompt).toBe(plain.harness.specs[0]?.prompt);
  });

  it('refuses to start without a brief and says why', async () => {
    const dir = await projects.create('script no brief');
    const runner = new StageRunner({ projectDir: dir, git: projects.git });
    const result = await runner.run({ stage: 'script' });
    expect(!result.ok && result.error).toEqual({
      kind: 'not-ready',
      message: 'brief.json is missing: fill in the brief.',
      issues: ['brief.json is missing: fill in the brief.'],
    });
    expect((await runner.readiness()).script.ready).toBe(false);
  });

  it('stops as blocked when Claude is not logged in', async () => {
    const { dir, runner } = await setup('script blocked', ['not-logged-in']);
    const result = await runner.run({ stage: 'script' });
    expect(!result.ok && result.error.kind).toBe('blocked');
    expect(existsSync(path.join(dir, 'script.txt'))).toBe(false);
    const state = await new PipelineStateStore().read(dir);
    expect(state.ok && state.value.stages['script']?.status).toBe('blocked');
  });
});
