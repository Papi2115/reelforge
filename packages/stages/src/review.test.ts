/**
 * Whole-video review modes (PLAN.md#7.6) on fake-claude + the scripted renderer: triage → plan →
 * fixes → re-QA, and phone legibility. The sync-check mode needs real anchors: test/review.test.ts.
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import type { FakeClaudeScript } from '@reelforge/fake-claude';
import { autocommit } from '@reelforge/project';
import { scenesReportSchema } from '@reelforge/shared';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
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
import { TestProjects, readProject } from './testing/project.js';
import { ScriptedFrameRenderer } from './testing/scripted-renderer.js';

const projects = new TestProjects();
const harnesses: FakeClaudeHarness[] = [];
afterEach(async () => {
  await Promise.all(harnesses.splice(0).map((harness) => harness.dispose()));
});
afterAll(() => {
  projects.dispose();
});

async function setup(name: string, variants: readonly SceneVariant[], script: FakeClaudeScript) {
  const dir = await projects.create(name);
  const shots = filmShots(variants.length);
  writeFilm(dir, shots);
  shots.forEach((shot, index) => {
    writeFileSync(path.join(dir, ...shot.scene.split('/')), sceneSource(shot, variants[index]));
  });
  expect((await autocommit(dir, 'Scenes', { kind: 'manual', git: projects.git })).ok).toBe(true);
  const harness = new FakeClaudeHarness(script);
  harnesses.push(harness);
  const runner = new StageRunner({
    projectDir: dir,
    claude: harness.runner,
    guard: harness.guard,
    git: projects.git,
    scenes: { frames: new ScriptedFrameRenderer() },
  });
  return { dir, shots, harness, runner };
}

const shotAt = (shots: readonly FilmShot[], index: number): FilmShot => {
  const shot = shots[index];
  if (shot === undefined) throw new Error(`no shot ${String(index)}`);
  return shot;
};

describe('whole-video review', { timeout: 60_000 }, () => {
  it('fix what looks wrong: code checks + Haiku triage → Sonnet plan → Opus fixes → re-QA', async () => {
    const shots = filmShots(3);
    const fixed = (index: number, marker: string) => ({
      ...writes({ [shotAt(shots, index).scene]: sceneSource(shotAt(shots, index)) }, 'Done.'),
      promptIncludes: marker,
    });
    const { dir, harness, runner } = await setup('review wrong', ['ok', 'overlap', 'ok'], {
      version: 1,
      rules: [
        {
          scenario: 'tools-write',
          reply: '{"suspects":[{"shot":"s03","reason":"title cut off at the right edge"}]}',
          promptIncludes: '.reelforge/frames/qa/review/sheet-1.png',
        },
        {
          scenario: 'tools-write',
          reply: JSON.stringify({
            fixes: [
              { shot: 's02', change: 'Move the clashing card below the title (CHANGE-S02).' },
              { shot: 's03', change: 'Pull the title inward (CHANGE-S03).' },
            ],
          }),
          promptIncludes: 'You plan fixes',
        },
        fixed(1, 'CHANGE-S02'),
        fixed(2, 'CHANGE-S03'),
      ],
      default: { scenario: 'tools-write', reply: CRITIC_OK },
    });
    const result = await runner.run({ stage: 'scenes', action: 'fix-what-looks-wrong' });
    expect(result.ok && result.value).toMatchObject({
      message: 'Review (fix-what-looks-wrong): 2 shots flagged, 2 fixed (2 ✓)',
      metrics: { flagged: 2, fixed: 2, ok: 2 },
    });
    expect(result.ok && result.value.outputs).toContain('.reelforge/frames/qa/review/sheet-1.png');
    const turns = harness.specs.map((spec) => [spec.stage, spec.model]);
    expect(turns.slice(0, 2)).toEqual([
      ['critic', 'haiku'],
      ['storyboard', 'sonnet'],
    ]);
    expect(turns.filter(([stage]) => stage === 'scene-fix')).toEqual([
      ['scene-fix', 'opus'],
      ['scene-fix', 'opus'],
    ]);
    // The plan saw the code finding (overlap) and the triage's suspect.
    expect(harness.specs[1]?.prompt).toContain('card-overlap');
    expect(harness.specs[1]?.prompt).toContain('title cut off at the right edge');
    expect(readProject(dir, 'scenes/s02.js')).toBe(sceneSource(shotAt(shots, 1)));
    const report = scenesReportSchema.parse(
      JSON.parse(readProject(dir, '.reelforge/scenes-report.json')),
    );
    expect(report.shots.map((entry) => [entry.shotId, entry.status, entry.fixIterations])).toEqual([
      ['s02', 'ok', 1],
      ['s03', 'ok', 1],
    ]);
    const subjects = (await projects.history(dir)).map((entry) => entry.subject);
    expect(subjects).toEqual(expect.arrayContaining(['Scene s02 fixed ✓']));
  });

  it('reports a clean video without fix turns', async () => {
    const { harness, runner } = await setup('review clean', ['ok', 'ok'], {
      version: 1,
      default: { scenario: 'tools-write', reply: '{"suspects":[]}' },
    });
    const result = await runner.run({ stage: 'scenes', action: 'fix-what-looks-wrong' });
    expect(result.ok && result.value.message).toBe(
      'Review (fix-what-looks-wrong): 0 shots flagged, 0 fixed',
    );
    expect(harness.specs.map((spec) => spec.stage)).toEqual(['critic']);
  });

  it('phone legibility: fixes only shots whose text is too small, then re-checks them', async () => {
    const shots = filmShots(2);
    const { dir, harness, runner } = await setup('review phone', ['small-text', 'ok'], {
      version: 1,
      rules: [
        {
          ...writes({ 'scenes/s01.js': sceneSource(shotAt(shots, 0)) }, 'Raised the title scale.'),
          promptIncludes: 'easier to read on a phone',
        },
      ],
      default: { scenario: 'tools-write', reply: CRITIC_OK },
    });
    const result = await runner.run({ stage: 'scenes', action: 'phone-legibility' });
    expect(result.ok && result.value.message).toBe(
      'Review (phone-legibility): 1 shot flagged, 1 fixed (1 ✓)',
    );
    expect(harness.specs.map((spec) => spec.stage)).toEqual(['scene-fix', 'critic']);
    expect(harness.specs[0]?.prompt).toContain('text at scale 1 is 7 px high');
    expect(readProject(dir, 'scenes/s01.js')).not.toContain('scale: 1');
  });
});
