/**
 * Characters and mascot on fake-claude (PLAN.md#12.20, ADR-025): with the pack and a mascot the
 * storyboard prompt carries the cast and mascot rules and a storyboard with sparse, impersonal
 * mascot shots passes; a mascot standing in for a named person (Isaac Newton) costs one repair
 * turn; a classic project gets neither the sections nor a mascot.
 */
import { storyboardFileSchema, type StoryboardShot } from '@reelforge/shared';
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

const GOLDEN = JSON.parse(goldenFile('storyboard.json')) as { version: 1; shots: StoryboardShot[] };

function storyboard(marks: Readonly<Record<string, StoryboardShot['mascot']>>): string {
  const shots = GOLDEN.shots.map((shot) =>
    marks[shot.id] === undefined ? shot : { ...shot, mascot: marks[shot.id] },
  );
  return JSON.stringify({ ...GOLDEN, shots }, null, 2);
}

const CARRIER = { role: 'carrier' as const, action: 'places the glass of water on the table' };
const POINTER = { role: 'pointer' as const, action: 'points at the colours of the spectrum' };
const SPARSE = storyboard({ s02_glass: CARRIER, s05_spectrum: POINTER });

function useCharacters(dir: string, settings: Record<string, string>): void {
  const project = JSON.parse(readProject(dir, 'project.json')) as Record<string, unknown>;
  // voxel-only: the golden storyboard has no rolls (the look rules are not under test here).
  writeProject(
    dir,
    'project.json',
    JSON.stringify({ ...project, lookMode: 'voxel-only', ...settings }, null, 2),
  );
}

async function setup(name: string, steps: readonly Step[]) {
  const dir = await projects.create(name, ['script.txt', 'timing/words.json']);
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

describe('characters and mascot stages', { timeout: 60_000 }, () => {
  it('storyboard: sparse impersonal mascot shots pass with the pack and Bean', async () => {
    const { dir, harness, runner } = await setup('mascot storyboard', [
      writes({ 'storyboard.json': SPARSE }),
    ]);
    useCharacters(dir, { characters: 'pack', mascot: 'bean' });
    const result = await runner.run({ stage: 'storyboard' });
    expect(result.ok && result.value.metrics['repairs']).toBe(0);
    const prompt = harness.specs[0]?.prompt ?? '';
    expect(prompt).toContain('Characters (this project uses the character pack)');
    expect(prompt).toContain('Mascot (Bean, `bean`, chosen by the user for this channel;');
    const written = storyboardFileSchema.parse(JSON.parse(readProject(dir, 'storyboard.json')));
    expect(written.shots.find((shot) => shot.id === 's05_spectrum')?.mascot).toEqual(POINTER);
  });

  it('storyboard: a mascot playing Isaac Newton is repaired', async () => {
    const newton = storyboard({ s02_glass: CARRIER, s07_newton: POINTER });
    const { dir, harness, runner } = await setup('mascot impersonation', [
      writes({ 'storyboard.json': newton }),
      writes({ 'storyboard.json': SPARSE }),
    ]);
    useCharacters(dir, { characters: 'pack', mascot: 'bean' });
    const result = await runner.run({ stage: 'storyboard' });
    expect(result.ok && result.value.metrics['repairs']).toBe(1);
    const repair = harness.specs[1]?.prompt ?? '';
    expect(repair).toContain('mascot-impersonation');
    expect(repair).toContain('"Isaac Newton" (a named person)');
  });

  it('storyboard: a classic project gets no character sections and no mascot', async () => {
    const { dir, harness, runner } = await setup('mascot classic', [
      writes({ 'storyboard.json': SPARSE }),
      writes({ 'storyboard.json': JSON.stringify(GOLDEN, null, 2) }),
    ]);
    // The test template is classic without a mascot (testing/project.ts).
    useCharacters(dir, {});
    const result = await runner.run({ stage: 'storyboard' });
    expect(result.ok && result.value.metrics['repairs']).toBe(1);
    expect(harness.specs[0]?.prompt).not.toContain('Characters (this project');
    expect(harness.specs[0]?.prompt).not.toContain('Mascot (');
    expect(harness.specs[1]?.prompt).toContain('mascot-without-choice');
  });
});
