/**
 * Storyboard with a shots-per-minute range (ADR-027) on fake-claude: the prompt states the range,
 * a storyboard with too many shots and a cut inside a sentence is repaired, and the stage message
 * opens with the one-line summary. Without a range nothing of it appears.
 */
import { storyboardFileSchema } from '@reelforge/shared';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { StageRunner } from './runner.js';
import { FakeClaudeHarness, writes, type Step } from './testing/fake-claude.js';
import { TestProjects, goldenFile, readProject, writeProject } from './testing/project.js';

const projects = new TestProjects();
const harnesses: FakeClaudeHarness[] = [];
afterEach(async () => {
  await Promise.all(harnesses.splice(0).map((harness) => harness.dispose()));
});
afterAll(() => {
  projects.dispose();
});

interface GoldenShot {
  readonly id: string;
  readonly t0: number;
  readonly t1: number;
  readonly [key: string]: unknown;
}

const GOLDEN = JSON.parse(goldenFile('storyboard.json')) as { shots: GoldenShot[] };
const ROLLS: Readonly<Record<string, readonly [string, string]>> = {
  s01_hook: ['C', 'retro-ui'],
  s02_glass: ['A', 'voxel'],
  s03_flashlight: ['A', 'voxel'],
  s04_rainbow: ['B', 'diorama'],
  s05_spectrum: ['C', 'blueprint'],
  s06_red_violet: ['B', 'retro-ui'],
  s07_newton: ['A', 'voxel'],
};

/** Golden shots with rolls and looks (a mixed project), without transitions. */
function tagged(shots: readonly GoldenShot[]): string {
  const tags = shots.map((shot) => {
    const [roll, look] = ROLLS[shot.id] ?? ['A', 'voxel'];
    const copy: Record<string, unknown> = { ...shot, roll, look };
    delete copy['transitionIn'];
    return copy;
  });
  return JSON.stringify({ version: 1, shots: tags }, null, 2);
}

/** 7 shots in 37 s (11.3/min) and s02 → s03 cuts after "table," inside a 5.4 s sentence. */
const SEVEN = tagged(GOLDEN.shots);

/** The same narration in 4 shots, each cut on a sentence start (6.5/min). */
function merged(): string {
  const byId = new Map(GOLDEN.shots.map((shot) => [shot.id, shot]));
  const span = (first: string, last: string): GoldenShot => {
    const start = byId.get(first);
    const end = byId.get(last);
    if (start === undefined || end === undefined) throw new Error('no shot');
    return { ...start, t1: end.t1 };
  };
  return tagged([
    span('s01_hook', 's01_hook'),
    span('s02_glass', 's03_flashlight'),
    span('s04_rainbow', 's05_spectrum'),
    span('s06_red_violet', 's07_newton'),
  ]);
}

async function setup(name: string, steps: readonly Step[], range: boolean) {
  const dir = await projects.create(name, ['script.txt', 'timing/words.json']);
  if (range) {
    const project = JSON.parse(readProject(dir, 'project.json')) as Record<string, unknown>;
    const withRange = { ...project, shotsPerMinute: { min: 5, max: 8 } };
    writeProject(dir, 'project.json', JSON.stringify(withRange, null, 2));
  }
  const harness = new FakeClaudeHarness(steps);
  harnesses.push(harness);
  const runner = new StageRunner({
    projectDir: dir,
    claude: harness.runner,
    guard: harness.guard,
    git: projects.git,
  });
  return { dir, harness, runner };
}

describe('storyboard with a shots-per-minute range', { timeout: 60_000 }, () => {
  it('repairs too many shots and a mid-sentence cut, then reports the range line', async () => {
    const { dir, harness, runner } = await setup(
      'range repair',
      [writes({ 'storyboard.json': SEVEN }), writes({ 'storyboard.json': merged() })],
      true,
    );
    const result = await runner.run({ stage: 'storyboard' });
    expect(result.ok && result.value.message).toBe(
      '4 shots for 0:37 · 6.5/min · range 5–8 · 4 shots, 4 treatments',
    );
    expect(result.ok && result.value.metrics['repairs']).toBe(1);
    const first = harness.specs[0]?.prompt ?? '';
    expect(first).toContain('Scenes per minute (the user chose 5–8 shots per minute');
    expect(first).toContain('about 3–5 shots for its 0:37');
    const repair = harness.specs[1]?.prompt ?? '';
    expect(repair).toContain('shots-per-minute');
    expect(repair).toContain('7 shots for 0:37');
    expect(repair).toContain('cut-mid-sentence');
    expect(repair).toContain('s02_glass → s03_flashlight cuts at 8.35 s inside the sentence');
    const written = storyboardFileSchema.parse(JSON.parse(readProject(dir, 'storyboard.json')));
    expect(written.shots).toHaveLength(4);
  });

  it('changes nothing without a range', async () => {
    const { harness, runner } = await setup(
      'no range',
      [writes({ 'storyboard.json': SEVEN })],
      false,
    );
    const result = await runner.run({ stage: 'storyboard' });
    expect(result.ok && result.value.message).toBe('7 shots, 6 treatments');
    expect(harness.specs).toHaveLength(1);
    expect(harness.specs[0]?.prompt).not.toContain('Scenes per minute');
  });
});
