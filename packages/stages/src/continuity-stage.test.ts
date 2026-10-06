/**
 * Continuity links in the storyboard and scenes stages on fake-claude (PLAN.md#13.2): switch,
 * prompt, wiring, and the directive in the fix turns of both linked shots.
 */
import { autocommit } from '@reelforge/project';
import { storyboardFileSchema } from '@reelforge/shared';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { StageRunner } from './runner.js';
import { FakeClaudeHarness, writes, type Step } from './testing/fake-claude.js';
import { eightShotScript, filmShots, writeFilm } from './testing/film.js';
import { TestProjects, goldenFile, readProject, writeProject } from './testing/project.js';
import { ScriptedFrameRenderer } from './testing/scripted-renderer.js';

const projects = new TestProjects();
const harnesses: FakeClaudeHarness[] = [];
afterEach(async () => {
  await Promise.all(harnesses.splice(0).map((harness) => harness.dispose()));
});
afterAll(() => {
  projects.dispose();
});

const GOLDEN = goldenFile('storyboard.json');
const LINK = { kind: 'shared-object', object: 'glass', anchor: { x: 0.5, y: 0.55 } };

/** The golden storyboard with s02_glass -> s03_flashlight linked through the glass. */
function linked(): string {
  const storyboard = JSON.parse(GOLDEN) as { shots: { id: string }[] };
  const shots = storyboard.shots.map((shot) =>
    shot.id === 's03_flashlight' ? { ...shot, continuity: LINK } : shot,
  );
  return JSON.stringify({ ...storyboard, shots }, null, 2);
}

async function setup(name: string, steps: readonly Step[], continuityLinks?: boolean) {
  const dir = await projects.create(name, ['script.txt', 'timing/words.json']);
  const projectFile = JSON.parse(readProject(dir, 'project.json')) as Record<string, unknown>;
  delete projectFile['lookMode'];
  if (continuityLinks !== undefined) projectFile['continuityLinks'] = continuityLinks;
  writeProject(dir, 'project.json', JSON.stringify(projectFile, null, 2));
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

describe('continuity links in the storyboard stage', { timeout: 60_000 }, () => {
  it('leaves the prompt and the storyboard as before with the switch off', async () => {
    const { dir, harness, runner } = await setup('continuity off', [
      writes({ 'storyboard.json': GOLDEN }),
    ]);
    const result = await runner.run({ stage: 'storyboard' });
    expect(result.ok).toBe(true);
    expect(harness.specs[0]?.prompt).not.toContain('Continuity links');
    expect(readProject(dir, 'storyboard.json')).toBe(GOLDEN);
  });

  it('asks for links with the switch on and writes the linked transition', async () => {
    const { dir, harness, runner } = await setup(
      'continuity on',
      [writes({ 'storyboard.json': linked() })],
      true,
    );
    const result = await runner.run({ stage: 'storyboard' });
    expect(result.ok).toBe(true);
    const prompt = harness.specs[0]?.prompt ?? '';
    expect(prompt).toContain('Continuity links (on for this project');
    expect(prompt).toContain('at most 1 links in this film');
    const written = storyboardFileSchema.parse(JSON.parse(readProject(dir, 'storyboard.json')));
    const flashlight = written.shots.find((shot) => shot.id === 's03_flashlight');
    expect(flashlight?.continuity).toEqual(LINK);
    expect(flashlight?.transitionIn).toEqual({
      type: 'crossfade',
      duration: 0.6,
      style: 'continuity-shared-object',
      focus: LINK.anchor,
    });
  });
});

describe('continuity links in the scenes stage', { timeout: 120_000 }, () => {
  it('hands both linked shots the directive in their fix turns', async () => {
    const dir = await projects.create('continuity scenes');
    const shots = filmShots(8);
    writeFilm(dir, shots);
    // s03 (fixed once for lint) hands over to s04 (fixed once for overlapping cards).
    const storyboard = JSON.parse(readProject(dir, 'storyboard.json')) as {
      shots: { id: string }[];
    };
    const linkedShots = storyboard.shots.map((shot) =>
      shot.id === 's04' ? { ...shot, continuity: LINK } : shot,
    );
    writeProject(
      dir,
      'storyboard.json',
      JSON.stringify({ ...storyboard, shots: linkedShots }, null, 2),
    );
    expect((await autocommit(dir, 'Storyboard', { kind: 'manual', git: projects.git })).ok).toBe(
      true,
    );
    const harness = new FakeClaudeHarness(eightShotScript(shots), { concurrency: 2 });
    harnesses.push(harness);
    const runner = new StageRunner({
      projectDir: dir,
      claude: harness.runner,
      guard: harness.guard,
      git: projects.git,
      scenes: { frames: new ScriptedFrameRenderer() },
    });
    const result = await runner.run({ stage: 'scenes' });
    expect(result.ok).toBe(true);
    const fixes = harness.specs.filter((spec) => spec.stage === 'scene-fix');
    const fixOf = (id: string): string =>
      fixes.find((spec) => spec.prompt.includes(`for shot ${id} `))?.prompt ?? '';
    expect(fixOf('s03')).toContain('This shot hands over to s04 through a shared-object link');
    expect(fixOf('s04')).toContain('This shot continues s03 through a shared-object link');
    expect(fixOf('s05')).not.toContain('Continuity link');
    expect(fixOf('s08')).not.toContain('Continuity link');
  });
});
