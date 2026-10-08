/**
 * Research-aware QA on fake-claude (real run Comic 1, s07): the critic and the fix turn get the
 * project's research notes; a critic `fact-conflict:` note (the storyboard contradicts the research)
 * is a ⚠ for the user and never starts a fix turn that flips research-correct data back. Without
 * `research.md` the prompts carry no research section (as before).
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { autocommit } from '@reelforge/project';
import { scenesReportSchema, type ShotBuildRecord } from '@reelforge/shared';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { StageRunner } from './runner.js';
import { DEFAULT_STAGE_SETTINGS } from './settings.js';
import { FakeClaudeHarness } from './testing/fake-claude.js';
import {
  CRITIC_OK,
  buildRule,
  criticRule,
  filmShots,
  fixRule,
  sceneSource,
  writeFilm,
  type FilmShot,
} from './testing/film.js';
import { readProject, TestProjects } from './testing/project.js';
import { ScriptedFrameRenderer } from './testing/scripted-renderer.js';

const projects = new TestProjects();
const harnesses: FakeClaudeHarness[] = [];
afterEach(async () => {
  await Promise.all(harnesses.splice(0).map((harness) => harness.dispose()));
});
afterAll(() => {
  projects.dispose();
});

const RESEARCH = `# Research: the Piltdown Man hoax

## Key facts
- Fluorine testing (1949) showed the jaw had far less fluorine than the skull — https://en.wikipedia.org/wiki/Piltdown_Man
- Exposed in 1953: an altered orangutan jaw with a modern human cranium — https://en.wikipedia.org/wiki/Piltdown_Man
`;
const CONFLICT =
  'fact-conflict: intent puts the skull gauge low and the jaw high; research says the jaw had far less fluorine';

type Rule = ReturnType<typeof buildRule>;

async function run(name: string, research: boolean, rules: (shot: FilmShot) => Rule[]) {
  const shots = filmShots(1);
  const [shot] = shots;
  if (shot === undefined) throw new Error('no shot');
  const dir = await projects.create(name);
  writeFilm(dir, shots);
  if (research) writeFileSync(path.join(dir, 'research.md'), RESEARCH);
  expect((await autocommit(dir, 'Storyboard', { kind: 'manual', git: projects.git })).ok).toBe(
    true,
  );
  const harness = new FakeClaudeHarness({
    version: 1,
    rules: [buildRule(shot, sceneSource(shot)), ...rules(shot)],
    default: { scenario: 'tools-write', reply: CRITIC_OK },
  });
  harnesses.push(harness);
  const runner = new StageRunner({
    projectDir: dir,
    claude: harness.runner,
    guard: harness.guard,
    git: projects.git,
    scenes: { frames: new ScriptedFrameRenderer() },
    settings: DEFAULT_STAGE_SETTINGS,
  });
  const result = await runner.run({ stage: 'scenes' });
  expect(result.ok).toBe(true);
  const report = scenesReportSchema.parse(
    JSON.parse(readProject(dir, '.reelforge/scenes-report.json')),
  );
  const record: ShotBuildRecord | undefined = report.shots[0];
  const prompts = (stage: string): string[] =>
    harness.specs.filter((spec) => spec.stage === stage).map((spec) => spec.prompt);
  return { record, prompts };
}

describe('research-aware critic and fix turns', { timeout: 120_000 }, () => {
  it('keeps a research-correct shot: a fact conflict is a warning, not a fix turn', async () => {
    const { record, prompts } = await run('fact conflict', true, (shot) => [
      criticRule(shot, 'build-r0', 'off-intent', CONFLICT),
    ]);
    const [critic] = prompts('critic');
    expect(critic).toContain('Research notes of the project (the facts; condensed):');
    expect(critic).toContain(
      '- Fluorine testing (1949) showed the jaw had far less fluorine than the skull\n',
    );
    expect(critic).not.toContain('https://');
    expect(critic).toContain('trust the research notes');
    expect(prompts('scene-fix')).toEqual([]);
    expect(record?.status).toBe('warning');
    expect(record?.fixIterations).toBe(0);
    expect(record?.findings).toEqual([
      {
        source: 'critic',
        severity: 'warning',
        fatal: false,
        message: `the frame critic found a fact conflict (storyboard vs research notes; check the facts before publishing): ${CONFLICT}`,
      },
    ]);
  });

  it('gives the fix turn the research notes and tells it they win', async () => {
    const { record, prompts } = await run('fix with research', true, (shot) => [
      criticRule(shot, 'build-r0', 'clipped', 'the caption is cut by the right edge'),
      fixRule(shot, 1, sceneSource(shot)),
    ]);
    const [fix] = prompts('scene-fix');
    expect(fix).toContain('Research notes of the project (the facts; condensed):');
    expect(fix).toContain('jaw had far less fluorine than the skull');
    expect(fix).toContain('start your reply with `fact-conflict:`');
    expect(record?.status).toBe('ok');
  });

  it('adds no research section when the project has no research notes', async () => {
    const { record, prompts } = await run('no research', false, (shot) => [
      criticRule(shot, 'build-r0', 'clipped', 'the caption is cut by the right edge'),
      fixRule(shot, 1, sceneSource(shot)),
    ]);
    const all = [...prompts('critic'), ...prompts('scene-fix')];
    expect(all).toHaveLength(3);
    for (const prompt of all) {
      expect(prompt).not.toContain('Research notes');
      expect(prompt).not.toContain('fact-conflict');
    }
    expect(prompts('critic')[0]).toContain('Shot intent: Number one lands on the desk.');
    expect(prompts('critic')[0]).toMatch(/Style: [^\n]+\n\nFor each image decide/);
    expect(record?.status).toBe('ok');
  });
});
