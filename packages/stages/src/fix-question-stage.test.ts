/**
 * Unattended fix turns never wait for an answer (real run Game B2 1, s08: the final-review fix
 * ended with "Should I go ahead, or undo these edits?"): a fix reply whose last paragraph is a
 * question makes the shot ⚠; world projects' fix prompts also say never to ask (built-in styles
 * keep the prompt text as it was).
 */
import { autocommit } from '@reelforge/project';
import { scenesReportSchema } from '@reelforge/shared';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { StageRunner } from './runner.js';
import { DEFAULT_STAGE_SETTINGS } from './settings.js';
import { FakeClaudeHarness, writes } from './testing/fake-claude.js';
import { buildRule, criticRule, filmShots, sceneSource, writeFilm } from './testing/film.js';
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

const QUESTION = 'Should I go ahead, or undo these edits?';
const OK_NOTE = JSON.stringify({
  frames: [
    { path: 'sheet.png', verdict: 'ok', note: 'focal: the number; traces: smudge, tape, note' },
  ],
});

async function run(name: string, style: string | undefined, reply: string) {
  const shots = filmShots(1);
  const [shot] = shots;
  if (shot === undefined) throw new Error('no shot');
  const dir = await projects.create(name, [], style === undefined ? {} : { style });
  writeFilm(dir, shots);
  expect((await autocommit(dir, 'Storyboard', { kind: 'manual', git: projects.git })).ok).toBe(
    true,
  );
  const harness = new FakeClaudeHarness({
    version: 1,
    rules: [
      buildRule(shot, sceneSource(shot)),
      criticRule(shot, 'build-r0', 'clipped', 'the number is cut by the right edge'),
      {
        ...writes({ [shot.scene]: sceneSource(shot) }, reply),
        promptIncludes: `QA fix 1/2 for shot ${shot.id} `,
      },
    ],
    default: { scenario: 'tools-write', reply: OK_NOTE },
  });
  harnesses.push(harness);
  const runner = new StageRunner({
    projectDir: dir,
    claude: harness.runner,
    guard: harness.guard,
    git: projects.git,
    scenes: { frames: new ScriptedFrameRenderer() },
    settings: { ...DEFAULT_STAGE_SETTINGS, experimentalWorlds: true },
  });
  expect((await runner.run({ stage: 'scenes' })).ok).toBe(true);
  const report = scenesReportSchema.parse(
    JSON.parse(readProject(dir, '.reelforge/scenes-report.json')),
  );
  const fixes = harness.specs.filter((spec) => spec.stage === 'scene-fix');
  return { record: report.shots[0], fixes };
}

describe('fix turns that ask a question', { timeout: 120_000 }, () => {
  it('mark the shot ⚠ instead of passing it silently', async () => {
    const { record, fixes } = await run('asks', undefined, `Moved the number left.\n\n${QUESTION}`);
    expect(fixes).toHaveLength(1);
    expect(record?.status).toBe('warning');
    expect(record?.findings).toEqual([
      {
        source: 'claude',
        severity: 'warning',
        fatal: false,
        message: `fix turn asked a question instead of finishing ("${QUESTION}"); its edits are in place unconfirmed: check the shot.`,
      },
    ]);
    // Built-in style: the fix prompt is the text it always was.
    expect(fixes[0]?.prompt).not.toContain('Never ask the user a question');
    expect(fixes[0]?.prompt.trimEnd()).toMatch(/what you verified\.$/);
  });

  it('pass a shot whose fix reply only reports', async () => {
    const { record } = await run('reports', undefined, 'Moved the number left. Verified frames.');
    expect(record?.status).toBe('ok');
  });

  it("tell a world project's fix turn never to ask", async () => {
    const { fixes } = await run('world asks', 'comic', 'Moved it.');
    expect(fixes[0]?.prompt.trimEnd()).toMatch(
      /what you verified\. Never ask the user a question; decide, apply the fix and finish with the report\.$/,
    );
  });
});
