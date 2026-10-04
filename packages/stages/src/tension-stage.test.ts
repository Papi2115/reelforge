/**
 * Tension map in the Storyboard stage (PLAN.md#12.22) on fake-claude: Claude proposes the curve
 * first and the storyboard prompt gets it; a curve the user drew is never replaced by a re-run;
 * the `tension` action replaces it on request, keeps the stage status and pins locked shots; a
 * turn that writes no curve leaves the storyboard to go on without one.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PipelineStateStore } from '@reelforge/claude-bridge';
import { tensionFileSchema, type TensionFile } from '@reelforge/shared';
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

const GOLDEN_TENSION = goldenFile('tension.json');
const GOLDEN_STORYBOARD = goldenFile('storyboard.json');
/** End of the last word of the golden narration. */
const NARRATION_S = 36.705;

const USER_CURVE: TensionFile = {
  version: 1,
  source: 'user',
  points: [
    { t: 0, v: 0.1 },
    { t: 20, v: 0.9 },
    { t: NARRATION_S, v: 0.3 },
  ],
};

async function setup(name: string, steps: readonly Step[], files: readonly string[] = []) {
  const dir = await projects.create(name, ['script.txt', 'timing/words.json', ...files], {
    tensionMap: 'auto',
  });
  // The golden storyboard predates looks (no rolls): the film is made in voxel-only.
  const project = JSON.parse(readProject(dir, 'project.json')) as Record<string, unknown>;
  writeProject(dir, 'project.json', JSON.stringify({ ...project, lookMode: 'voxel-only' }));
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

function readTension(dir: string): TensionFile {
  return tensionFileSchema.parse(JSON.parse(readProject(dir, 'tension.json')));
}

describe('tension map in the storyboard stage', { timeout: 60_000 }, () => {
  it('Claude proposes the curve first, then the storyboard is paced by it', async () => {
    const { dir, harness, runner } = await setup('tension proposed', [
      writes({ 'tension.json': GOLDEN_TENSION }, 'Hook, calm setup, peak at 0:27.'),
      writes({ 'storyboard.json': GOLDEN_STORYBOARD }),
    ]);
    const result = await runner.run({ stage: 'storyboard' });
    expect(result.ok).toBe(true);
    expect(harness.specs.map((spec) => spec.stage)).toEqual(['storyboard', 'storyboard']);
    expect(harness.specs[0]?.prompt).toContain('Write `tension.json`');
    expect(harness.specs[0]?.prompt).toContain(`the last at ${NARRATION_S.toFixed(1)}`);
    expect(harness.models).toEqual(['sonnet', 'sonnet']);
    const storyboardPrompt = harness.specs[1]?.prompt ?? '';
    expect(storyboardPrompt).toContain('Tension map (`tension.json`');
    expect(storyboardPrompt).toContain('peak "red versus violet"');
    expect(storyboardPrompt).toMatch(/target shot length ~\d\.\d s/);
    const curve = readTension(dir);
    expect(curve.source).toBe('claude');
    expect(curve.points.at(-1)?.t).toBe(NARRATION_S);
    expect(curve.segments?.map((segment) => segment.kind)).toContain('peak');
    const commits = await projects.history(dir);
    expect(commits.map((entry) => [entry.kind, entry.step])).toContainEqual([
      'claude-turn',
      'storyboard',
    ]);
  });

  it('never replaces a curve the user drew; the storyboard reads it as it is', async () => {
    const { dir, harness, runner } = await setup('tension user', [
      writes({ 'storyboard.json': GOLDEN_STORYBOARD }),
    ]);
    writeProject(dir, 'tension.json', JSON.stringify(USER_CURVE, null, 2));
    const before = readProject(dir, 'tension.json');
    const result = await runner.run({ stage: 'storyboard' });
    expect(result.ok).toBe(true);
    expect(harness.specs).toHaveLength(1);
    expect(harness.specs[0]?.prompt).toContain('Tension map (`tension.json`');
    expect(readProject(dir, 'tension.json')).toBe(before);
  });

  it('goes on without a curve when the tension turn writes none', async () => {
    const { dir, harness, runner } = await setup('tension none', [
      { scenario: 'tools-write', reply: 'I could not map it.', writes: [] },
      writes({ 'storyboard.json': GOLDEN_STORYBOARD }),
    ]);
    const result = await runner.run({ stage: 'storyboard' });
    expect(result.ok && result.value.warnings[0]).toMatch(
      /^no tension curve: tension\.json was not written/,
    );
    expect(harness.specs).toHaveLength(2);
    expect(harness.specs[1]?.prompt).not.toContain('Tension map');
    expect(() => readProject(dir, 'tension.json')).toThrow();
  });

  it('"Propose with Claude" replaces the curve, keeps the stage status and pins locked shots', async () => {
    const { dir, harness, runner } = await setup(
      'tension action',
      [writes({ 'tension.json': GOLDEN_TENSION })],
      ['storyboard.json'],
    );
    writeProject(dir, 'tension.json', JSON.stringify(USER_CURVE, null, 2));
    writeProject(
      dir,
      'locks.json',
      JSON.stringify({
        version: 1,
        shots: [{ shotId: 's04_rainbow', lockedAt: '2026-10-04T08:00:00.000Z' }],
      }),
    );
    const store = new PipelineStateStore();
    const before = await store.read(dir);
    const result = await runner.run({ stage: 'storyboard', action: 'tension' });
    expect(result.ok && result.value).toMatchObject({
      outputs: ['tension.json'],
      commitMessage: expect.stringMatching(
        /^Tension: proposed by Claude \(7 points, peak 0\.85 at 0:27\)$/,
      ) as unknown,
    });
    expect(harness.specs).toHaveLength(1);
    const curve = readTension(dir);
    expect(curve.source).toBe('claude');
    // s04_rainbow (11.675-19.295 s) keeps the mean tension it had under the user's curve.
    expect(curve.pins).toEqual([{ shotId: 's04_rainbow', v: 0.719 }]);
    const after = await store.read(dir);
    expect(after.ok && after.value.stages['storyboard']?.status).toBe(
      before.ok ? (before.value.stages['storyboard']?.status ?? 'idle') : 'idle',
    );
    const storyboard = readFileSync(path.join(dir, 'storyboard.json'), 'utf8');
    expect(storyboard).toBe(GOLDEN_STORYBOARD);
  });

  it('refuses to propose over a locked curve', async () => {
    const { dir, harness, runner } = await setup('tension locked', []);
    writeProject(dir, 'tension.json', JSON.stringify({ ...USER_CURVE, locked: true }, null, 2));
    const result = await runner.run({ stage: 'storyboard', action: 'tension' });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.message).toMatch(/locked/);
    expect(harness.specs).toHaveLength(0);
  });
});
