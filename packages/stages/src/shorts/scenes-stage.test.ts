/**
 * "Scenes built" of a SHORT (PLAN.md#13.18) on fake-claude with the scripted frame renderer: the
 * narration shots are built by Claude with the short's prompt section, a scene that copies the
 * parent film's scene byte for byte gets a QA error and a fix turn, and the end card is written
 * by the app (no build, critic or fix turn) and passes its code QA.
 */
import { LimitGuard } from '@reelforge/claude-bridge';
import { autocommit } from '@reelforge/project';
import {
  endCardShot,
  scenesReportSchema,
  storyboardFileSchema,
  type ProjectFile,
} from '@reelforge/shared';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { StageRunner } from '../runner.js';
import { DEFAULT_SCENE_SETTINGS, DEFAULT_STAGE_SETTINGS } from '../settings.js';
import { FakeClaudeHarness, writes } from '../testing/fake-claude.js';
import { CRITIC_OK, buildRule, filmShots, sceneSource, writeFilm } from '../testing/film.js';
import { TestProjects, readProject, writeProject } from '../testing/project.js';
import { ScriptedFrameRenderer } from '../testing/scripted-renderer.js';
import { END_CARD_SCENE_MARKER } from './end-card-scene.js';

const projects = new TestProjects();
const harnesses: FakeClaudeHarness[] = [];
afterEach(async () => {
  await Promise.all(harnesses.splice(0).map((harness) => harness.dispose()));
});
afterAll(() => {
  projects.dispose();
});

const END_CARD_TEXT = 'Full video on YT: Voxplain';

async function shortProject(): Promise<{ dir: string; shots: ReturnType<typeof filmShots> }> {
  const shots = filmShots(3);
  const parentDir = await projects.create('parent film');
  writeFilm(parentDir, shots);
  const [, second] = shots;
  if (second === undefined) throw new Error('no s02');
  writeProject(parentDir, second.scene, sceneSource(second));

  const dir = await projects.create('short of the film');
  writeFilm(dir, shots);
  const storyboard = storyboardFileSchema.parse(JSON.parse(readProject(dir, 'storyboard.json')));
  const lastT1 = storyboard.shots.at(-1)?.t1 ?? 0;
  const withCard = {
    ...storyboard,
    shots: [...storyboard.shots, endCardShot(lastT1, END_CARD_TEXT)],
  };
  writeProject(dir, 'storyboard.json', JSON.stringify(withCard, null, 2));
  const project = JSON.parse(readProject(dir, 'project.json')) as ProjectFile;
  const short: ProjectFile = {
    ...project,
    format: 'portrait',
    kind: 'short',
    parentProject: { folder: parentDir, title: 'Parent film' },
    short: { lengthS: 30, captions: true, endCardText: END_CARD_TEXT },
  };
  writeProject(dir, 'project.json', JSON.stringify(short, null, 2));
  const saved = await autocommit(dir, 'Storyboard', { kind: 'manual', git: projects.git });
  expect(saved.ok).toBe(true);
  return { dir, shots };
}

describe('scenes of a short', { timeout: 120_000 }, () => {
  it('builds new scenes with the short rules and writes the end card without Claude', async () => {
    const { dir, shots } = await shortProject();
    const [first, second, third] = shots;
    if (first === undefined || second === undefined || third === undefined)
      throw new Error('shots');
    const rebuilt = `${sceneSource(second)}// rebuilt as a new scene for the short\n`;
    const harness = new FakeClaudeHarness(
      {
        version: 1,
        rules: [
          { ...writes({ [second.scene]: rebuilt }, 'Fixed.'), promptIncludes: 'for shot s02 (' },
          buildRule(first, sceneSource(first)),
          // A byte copy of the parent film's s02.
          buildRule(second, sceneSource(second)),
          buildRule(third, sceneSource(third)),
        ],
        default: { scenario: 'tools-write', reply: CRITIC_OK },
      },
      { guard: new LimitGuard({ maxConcurrency: 1 }) },
    );
    harnesses.push(harness);
    const runner = new StageRunner({
      projectDir: dir,
      claude: harness.runner,
      guard: harness.guard,
      git: projects.git,
      scenes: { frames: new ScriptedFrameRenderer(1) },
      settings: {
        ...DEFAULT_STAGE_SETTINGS,
        scenes: { ...DEFAULT_SCENE_SETTINGS, concurrency: 1 },
      },
    });
    const result = await runner.run({ stage: 'scenes' });
    expect(result.ok).toBe(true);

    const builds = harness.specs.filter((spec) => spec.stage === 'scene-build');
    expect(builds).toHaveLength(3);
    for (const spec of builds) {
      expect(spec.prompt).toContain('This shot belongs to a vertical YouTube SHORT');
      expect(spec.prompt).toContain('word-by-word captions');
      expect(spec.prompt).not.toContain('Write `scenes/end_card.js`');
    }
    const fixes = harness.specs.filter((spec) => spec.prompt.includes('QA fix'));
    expect(fixes).toHaveLength(1);
    expect(fixes[0]?.prompt).toContain('is a copy of scenes/s02.js of the full film');

    const scene = readProject(dir, 'scenes/end_card.js');
    expect(scene.startsWith(END_CARD_SCENE_MARKER)).toBe(true);
    expect(scene).toContain('kit.fx.endCard({ format: "portrait"');
    expect(scene).toContain('ctx.text.title("Full video on YT:"');
    expect(scene).toContain('ctx.text.title("Voxplain"');
    const report = scenesReportSchema.parse(
      JSON.parse(readProject(dir, '.reelforge/scenes-report.json')),
    );
    const status = Object.fromEntries(report.shots.map((entry) => [entry.shotId, entry.status]));
    expect(status).toEqual({ s01: 'ok', s02: 'ok', s03: 'ok', end_card: 'ok' });
    const card = report.shots.find((entry) => entry.shotId === 'end_card');
    expect(card?.critic).toEqual([]);
    expect(card?.fixIterations).toBe(0);
    expect(card?.notes).toContain('end card written by the app (no Claude turn)');
  });
});
