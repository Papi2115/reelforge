/**
 * Faster checks (ADR-027) on fake-claude with the scripted frame renderer: the same 8-shot film
 * built twice, once as before and once with `fasterChecks: true` in project.json. The faster run
 * asks the Haiku critic only on sampled shots (index 0, 4) and shots with code findings, and stops
 * after one fix turn per shot; its turn counts are asserted against the standard run.
 */
import { LimitGuard } from '@reelforge/claude-bridge';
import { autocommit } from '@reelforge/project';
import type { FakeClaudeScript } from '@reelforge/fake-claude';
import { scenesReportSchema } from '@reelforge/shared';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { StageRunner } from './runner.js';
import { finding } from './scenes/checks.js';
import { needsFinalFix } from './scenes/final-review.js';
import { criticSampled } from './scenes/qa.js';
import { DEFAULT_SCENE_SETTINGS, DEFAULT_STAGE_SETTINGS, fasterSceneSettings } from './settings.js';
import { FakeClaudeHarness, writes } from './testing/fake-claude.js';
import {
  CRITIC_OK,
  buildRule,
  criticRule,
  filmShots,
  sceneSource,
  writeFilm,
  type FilmShot,
} from './testing/film.js';
import { TestProjects, readProject, writeProject } from './testing/project.js';
import { ScriptedFrameRenderer } from './testing/scripted-renderer.js';

const projects = new TestProjects();
const harnesses: FakeClaudeHarness[] = [];
afterEach(async () => {
  await Promise.all(harnesses.splice(0).map((harness) => harness.dispose()));
});
afterAll(() => {
  projects.dispose();
});

/** Any fix turn of `shot` (the request names it whatever the iteration limit). */
function anyFix(shot: FilmShot, content: string) {
  return {
    ...writes({ [shot.scene]: content }, 'Fixed.'),
    promptIncludes: `for shot ${shot.id} (`,
  };
}

/**
 * s03: lint error, fixed by the first fix. s04: overlapping cards that need two fixes. s06: the
 * critic calls it clipped (a fix makes it ok). Everything else builds clean.
 */
function film(shots: readonly FilmShot[]): FakeClaudeScript {
  const at = (index: number): FilmShot => {
    const found = shots[index];
    if (found === undefined) throw new Error(`no shot ${String(index)}`);
    return found;
  };
  const [s03, s04, s06] = [at(2), at(3), at(5)];
  return {
    version: 1,
    rules: [
      ...shots
        .filter((shot) => shot !== s03 && shot !== s04)
        .map((shot) => buildRule(shot, sceneSource(shot))),
      buildRule(s03, sceneSource(s03, 'lint')),
      anyFix(s03, sceneSource(s03)),
      buildRule(s04, sceneSource(s04, 'overlap')),
      {
        ...writes({ [s04.scene]: sceneSource(s04) }, 'Fixed.'),
        promptIncludes: `QA fix 2/2 for shot ${s04.id} `,
      },
      anyFix(s04, sceneSource(s04, 'overlap')),
      criticRule(s06, 'build-r0', 'clipped', 'title cut at the right edge'),
      anyFix(s06, sceneSource(s06)),
    ],
    default: { scenario: 'tools-write', reply: CRITIC_OK },
  };
}

async function build(name: string, fasterChecks: boolean) {
  const shots = filmShots(8);
  const dir = await projects.create(name);
  writeFilm(dir, shots);
  if (fasterChecks) {
    const project = JSON.parse(readProject(dir, 'project.json')) as Record<string, unknown>;
    writeProject(dir, 'project.json', JSON.stringify({ ...project, fasterChecks: true }, null, 2));
  }
  const saved = await autocommit(dir, 'Storyboard', { kind: 'manual', git: projects.git });
  expect(saved.ok).toBe(true);
  const guard = new LimitGuard({ maxConcurrency: 2 });
  const harness = new FakeClaudeHarness(film(shots), { concurrency: 2, guard });
  harnesses.push(harness);
  const runner = new StageRunner({
    projectDir: dir,
    claude: harness.runner,
    guard: harness.guard,
    git: projects.git,
    scenes: { frames: new ScriptedFrameRenderer() },
    settings: { ...DEFAULT_STAGE_SETTINGS, scenes: { ...DEFAULT_SCENE_SETTINGS, concurrency: 2 } },
  });
  const result = await runner.run({ stage: 'scenes' });
  expect(result.ok).toBe(true);
  const count = (stage: string): number =>
    harness.specs.filter((spec) => spec.stage === stage).length;
  const report = scenesReportSchema.parse(
    JSON.parse(readProject(dir, '.reelforge/scenes-report.json')),
  );
  return {
    builds: count('scene-build'),
    fixes: count('scene-fix'),
    critics: count('critic'),
    total: harness.specs.length,
    status: Object.fromEntries(report.shots.map((entry) => [entry.shotId, entry.status])),
  };
}

describe('faster checks', { timeout: 120_000 }, () => {
  it('derive lighter scene settings', () => {
    expect(fasterSceneSettings(DEFAULT_SCENE_SETTINGS)).toEqual({
      ...DEFAULT_SCENE_SETTINGS,
      maxFixIterations: 1,
      maxNewProps: 4,
      criticEvery: 4,
      propAngles: [0, 90],
      skipLegibilityOnlyFixes: true,
    });
    const economy = { ...DEFAULT_SCENE_SETTINGS, maxFixIterations: 0, maxNewProps: 2 };
    expect(fasterSceneSettings(economy)).toMatchObject({ maxFixIterations: 0, maxNewProps: 2 });
  });

  it('sample the critic and skip legibility-only final fixes', () => {
    const shots = filmShots(8);
    const faster = { settings: fasterSceneSettings(DEFAULT_SCENE_SETTINGS), shots };
    const standard = { settings: DEFAULT_SCENE_SETTINGS, shots };
    const warning = finding('legibility', 'warning', 'small text');
    const sampled = shots.filter((shot) => criticSampled(faster, shot, []));
    expect(sampled.map((shot) => shot.id)).toEqual(['s01', 's05']);
    expect(criticSampled(faster, { id: 's02' }, [warning])).toBe(true);
    expect(shots.every((shot) => criticSampled(standard, shot, []))).toBe(true);
    const legibility = [finding('legibility', 'error', 'scale 1 text')];
    const blank = [...legibility, finding('blank', 'error', 'blank frame')];
    expect(needsFinalFix(standard, legibility)).toBe(true);
    expect(needsFinalFix(faster, legibility)).toBe(false);
    expect(needsFinalFix(faster, blank)).toBe(true);
    expect(needsFinalFix(faster, [warning])).toBe(false);
  });

  it('build the same film with fewer critic and fix turns', async () => {
    const standard = await build('standard checks', false);
    const faster = await build('faster checks', true);
    // Standard: 8 builds; fixes s03 1, s04 2, s06 1; critic on every clean round (9).
    expect(standard).toMatchObject({ builds: 8, fixes: 4, critics: 9, total: 21 });
    expect(Object.values(standard.status).every((status) => status === 'ok')).toBe(true);
    // Faster: critic only on s01 and s05 (sampled); one fix for s03 and s04, none for s06.
    expect(faster).toMatchObject({ builds: 8, fixes: 2, critics: 2, total: 12 });
    expect(faster.status).toMatchObject({ s03: 'ok', s04: 'warning', s06: 'ok' });
  });
});
