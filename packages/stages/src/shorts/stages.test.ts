/** A short's Script and Storyboard stages on fake-claude (PLAN.md#13.18). */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { scriptReportSchema, storyboardFileSchema } from '@reelforge/shared';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { StageRunner } from '../runner.js';
import { FakeClaudeHarness, writes, type Step } from '../testing/fake-claude.js';
import { TestProjects, goldenFile, readProject, writeProject } from '../testing/project.js';
import { runShortStage } from './index.js';
import {
  SHORT_HOOKS,
  SHORT_SCRIPT,
  createFilm,
  createShorts,
  shortStoryboard,
  syntheticWords,
} from './testing.js';

const projects = new TestProjects();
const harnesses: FakeClaudeHarness[] = [];
afterEach(async () => {
  await Promise.all(harnesses.splice(0).map((harness) => harness.dispose()));
});
afterAll(() => {
  projects.dispose();
});

const TEASER = writes(
  { 'script.txt': SHORT_SCRIPT, 'hooks.md': SHORT_HOOKS },
  'Word count: 75. Chosen hook: 1.',
);

async function setup(name: string, steps: readonly Step[]) {
  const filmDir = await createFilm(projects, `${name} film`);
  const [short] = await createShorts(projects, filmDir, name);
  if (short === undefined) throw new Error('no short');
  const harness = new FakeClaudeHarness(steps);
  harnesses.push(harness);
  const runner = new StageRunner({
    projectDir: short.dir,
    claude: harness.runner,
    guard: harness.guard,
    git: projects.git,
  });
  return { filmDir, dir: short.dir, harness, runner };
}

describe('short script stage', { timeout: 60_000 }, () => {
  it('writes the teaser and hooks in one turn from the film, without research', async () => {
    const { filmDir, dir, harness, runner } = await setup('short script', [TEASER]);
    const result = await runShortStage(runner, 'script');
    expect(result.ok && result.value).toMatchObject({
      stage: 'script',
      message: '75 words, about 29 s of narration for the 30 s short',
      metrics: { wordCount: 75, targetWords: 73, repairs: 0, lengthS: 30 },
      outputs: ['research.md', 'script.txt', 'hooks.md'],
    });
    expect(harness.specs.map((spec) => [spec.stage, spec.purpose, spec.model])).toEqual([
      ['script', 'script', 'sonnet'],
    ]);
    const prompt = harness.specs[0]?.prompt ?? '';
    expect(prompt).toContain('teases the full film "A rainbow in a glass of water"');
    expect(prompt).toContain('of the channel Voxplain');
    expect(prompt).toContain(goldenFile('script.txt').trim());
    expect(prompt).toContain('<beats>');
    expect(prompt).toContain('The other short of this film (60 s) takes the angle');
    // The film's research comes along for the claims check and the critic.
    expect(readProject(dir, 'research.md')).toBe(readProject(filmDir, 'research.md'));
    expect(
      scriptReportSchema.parse(JSON.parse(readProject(dir, '.reelforge/reports/script.json'))),
    ).toMatchObject({ wordCount: 75, targetWords: 73, estimatedSeconds: 28.8 });
  });

  it('repairs a teaser with a call to action once', async () => {
    const bad = writes({
      'script.txt': SHORT_SCRIPT.replace('The full answer', 'Subscribe! The full answer'),
      'hooks.md': '1. Only one hook.\n',
    });
    const { harness, runner } = await setup('short repair', [bad, TEASER]);
    const result = await runShortStage(runner, 'script');
    expect(result.ok && result.value.metrics['repairs']).toBe(1);
    const repair = harness.specs[1]?.prompt ?? '';
    expect(repair).toContain('short-forbidden-phrase');
    expect(repair).toContain('hooks.md: hooks-count');
  });

  it('refuses a film', async () => {
    const filmDir = await createFilm(projects, 'not a short');
    const runner = new StageRunner({ projectDir: filmDir, git: projects.git });
    const result = await runShortStage(runner, 'script');
    expect(!result.ok && result.error.kind).toBe('invalid-input');
  });
});

describe('short storyboard stage', { timeout: 60_000 }, () => {
  async function withNarration(name: string, steps: readonly Step[]) {
    const context = await setup(name, steps);
    const words = syntheticWords(SHORT_SCRIPT);
    writeProject(context.dir, 'script.txt', SHORT_SCRIPT);
    mkdirSync(path.join(context.dir, 'timing'), { recursive: true });
    writeProject(context.dir, 'timing/words.json', JSON.stringify(words, null, 2));
    return { ...context, words };
  }

  it('uses the short rules and appends the 2 s end card after the narration', async () => {
    const words = syntheticWords(SHORT_SCRIPT);
    const board = shortStoryboard(words, 6);
    const { dir, harness, runner } = await withNarration('short board', [
      writes({ 'storyboard.json': board }, '12 shots.'),
    ]);
    const result = await runShortStage(runner, 'storyboard');
    expect(result.ok, JSON.stringify(result)).toBe(true);
    const prompt = harness.specs[0]?.prompt ?? '';
    expect(prompt).toContain('This is a vertical YouTube SHORT (9:16 portrait, about 30 s)');
    expect(prompt).toContain('Shot length 1.5–3 s');
    expect(prompt).not.toContain('Typical shot length 3–8 s');
    expect(prompt).toContain('a fixed 2 s shot "Full video on YT: Voxplain"');
    expect(prompt).not.toContain('Scenes per minute');

    const storyboard = storyboardFileSchema.parse(JSON.parse(readProject(dir, 'storyboard.json')));
    expect(storyboard.shots).toHaveLength(13);
    const narrationEnd = storyboard.shots[11]?.t1 ?? 0;
    expect(storyboard.shots.at(-1)).toMatchObject({
      id: 'end_card',
      t0: narrationEnd,
      t1: Math.round((narrationEnd + 2) * 1000) / 1000,
      endCard: true,
      scene: 'scenes/end_card.js',
    });
  });

  it('repairs a storyboard cut like a film (slow shots, long hook)', async () => {
    const words = syntheticWords(SHORT_SCRIPT);
    const { harness, runner } = await withNarration('short slow board', [
      writes({ 'storyboard.json': shortStoryboard(words, 12) }),
      writes({ 'storyboard.json': shortStoryboard(words, 6) }),
    ]);
    const result = await runShortStage(runner, 'storyboard');
    expect(result.ok && result.value.metrics['repairs']).toBe(1);
    const repair = harness.specs[1]?.prompt ?? '';
    expect(repair).toContain('short-hook-length');
    expect(repair).toContain('shot-length');
  });
});
