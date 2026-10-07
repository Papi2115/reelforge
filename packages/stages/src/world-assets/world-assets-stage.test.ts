/**
 * World assets on fake-claude (PLAN.md#13.15 phase 2), in each of the four worlds: a forest film's
 * Scenes build first runs the world-assets turn (its prompt: the world's grammar, never a
 * showcase), the turn writes assets/<world>/*.json + assets/cast.json (and what it writes
 * elsewhere is put back), QA by code + the critic on contact sheets pass, the set is committed
 * ("World assets built ✓") and reaches every render manifest (ctx.worldAssets); the scenes that
 * draw the film's ranger pass QA, a scene drawing an undefined id fails QA with the readable
 * message and its fix turn repairs it. A voxel film never runs the step.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { planServiceShot } from '@reelforge/cli/service';
import { videoWorldAssets } from '@reelforge/engine';
import { loadPrompt } from '@reelforge/prompts';
import { autocommit } from '@reelforge/project';
import {
  scenesReportSchema,
  WORLD_ASSET_WORLDS,
  worldAssetsReportSchema,
  type WorldAssetWorld,
} from '@reelforge/shared';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { StageRunner } from '../runner.js';
import { DEFAULT_STAGE_SETTINGS, type StageSettings } from '../settings.js';
import { FakeClaudeHarness, writes } from '../testing/fake-claude.js';
import { buildRule, filmShots, fixRule, writeFilm, sceneSource } from '../testing/film.js';
import { readProject, TestProjects, writeProject } from '../testing/project.js';
import { ScriptedFrameRenderer } from '../testing/scripted-renderer.js';
import { FOREST_FILES, forestCast, forestScene } from '../testing/world-films.js';

const projects = new TestProjects();
const harnesses: FakeClaudeHarness[] = [];
afterEach(async () => {
  await Promise.all(harnesses.splice(0).map((harness) => harness.dispose()));
});
afterAll(() => {
  projects.dispose();
});

const SETTINGS: StageSettings = { ...DEFAULT_STAGE_SETTINGS, experimentalWorlds: true };
const CRAFT_OK = JSON.stringify({
  frames: [
    {
      path: 'sheet.png',
      verdict: 'ok',
      note: 'focal: the ranger; traces: a wobble, a pause, a smudge',
    },
  ],
});

function runner(dir: string, harness: FakeClaudeHarness): StageRunner {
  return new StageRunner({
    projectDir: dir,
    claude: harness.runner,
    guard: harness.guard,
    git: projects.git,
    settings: SETTINGS,
    scenes: { frames: new ScriptedFrameRenderer() },
  });
}

async function forestFilm(world: WorldAssetWorld, name: string) {
  const dir = await projects.create(name, [], { style: world });
  const shots = filmShots(2);
  writeFilm(dir, shots);
  writeProject(dir, 'script.txt', shots.map((shot) => shot.phrase).join('. '));
  expect((await autocommit(dir, 'Storyboard', { kind: 'manual', git: projects.git })).ok).toBe(
    true,
  );
  return { dir, shots };
}

describe.each(WORLD_ASSET_WORLDS)('world assets of a %s film', { timeout: 180_000 }, (world) => {
  it('are designed before the scenes, checked, committed and reach the scenes', async () => {
    const { dir, shots } = await forestFilm(world, `forest ${world}`);
    const [first, second] = shots;
    if (first === undefined || second === undefined) throw new Error('two shots');
    const harness = new FakeClaudeHarness({
      version: 1,
      rules: [
        {
          // The turn also tries to rewrite a scene and leave a note: both are put back.
          ...writes({
            ...FOREST_FILES[world],
            'assets/cast.json': forestCast(world, ['s01', 's02']),
            'scenes/s01.js': '// overwritten by the world-assets turn',
            'notes.txt': 'scratch',
          }),
          promptIncludes: 'production designer',
        },
        buildRule(first, forestScene(world, first, 'ranger')),
        // s02 draws an asset nobody defined; its fix turn draws the ranger instead.
        buildRule(second, forestScene(world, second, 'wolf')),
        fixRule(second, 1, forestScene(world, second, 'ranger')),
      ],
      default: { scenario: 'tools-write', reply: CRAFT_OK },
    });
    harnesses.push(harness);
    const stages = runner(dir, harness);
    const warnings: string[] = [];
    stages.on('event', (event) => {
      if (event.type === 'warning') warnings.push(event.message);
    });
    const scenes = await stages.run({ stage: 'scenes' });
    if (!scenes.ok) throw new Error(JSON.stringify(scenes.error));

    const design = harness.specs.find((spec) => spec.prompt.includes('production designer'));
    expect(design?.stage).toBe('scene-build');
    expect(design?.prompt).toContain(`\`assets/${world}/*.json\``);
    expect(design?.prompt).toContain('a style GRAMMAR, not a catalogue');
    // The step's own wording names no showcase topic (the world's grammar text is its own).
    expect(loadPrompt('world-assets').template).not.toMatch(/E\.T\.|cartridge|Apollo|warehouse/);
    const report = worldAssetsReportSchema.parse(
      JSON.parse(readProject(dir, '.reelforge/world-assets.json')),
    );
    expect(report).toMatchObject({ world, status: 'built', attempts: 1 });
    expect(report.ids).toContain('ranger');
    expect(existsSync(path.join(dir, 'notes.txt'))).toBe(false);
    expect(readProject(dir, 'scenes/s01.js')).toContain("export const meta = { id: 's01'");
    expect(warnings.join('\n')).toMatch(/changed notes\.txt; change discarded/);
    expect(warnings.join('\n')).toMatch(/changed scenes\/s01\.js; change discarded/);
    const subjects = (await projects.history(dir)).map((entry) => entry.subject);
    expect(subjects).toContain('World assets built ✓');

    const fix = harness.specs.find((spec) => spec.prompt.includes('QA fix 1/2 for shot s02'));
    expect(fix?.prompt).toContain(
      `asset "wolf" is not defined: define it in assets/${world}/<file>.json`,
    );
    const shotsReport = scenesReportSchema.parse(
      JSON.parse(readProject(dir, '.reelforge/scenes-report.json')),
    );
    // Both pass QA (the anti-slop guards may leave ⚠ warnings; no error is left).
    expect(shotsReport.shots.map((entry) => entry.shotId)).toEqual(['s01', 's02']);
    for (const entry of shotsReport.shots) {
      expect(entry.status).not.toBe('failed');
      expect(entry.findings.filter((item) => item.severity === 'error')).toEqual([]);
    }
    expect(shotsReport.shots[1]?.fixIterations).toBe(1);

    // Every render (frames, preview service, export) gets the same files as ctx.worldAssets.
    const { manifest } = await planServiceShot({ projectDir: dir, shot: 's01' });
    expect(manifest.worldAssets?.files.map((entry) => entry.file)).toEqual(
      Object.keys(FOREST_FILES[world]).sort(),
    );
    expect(videoWorldAssets(world, manifest.worldAssets)?.ids.all).toContain('ranger');

    // A second build of the same storyboard keeps the set (no new turn).
    const before = harness.specs.length;
    const again = await runner(dir, harness).run({ stage: 'scenes', shots: ['s01'] });
    expect(again.ok).toBe(true);
    expect(
      harness.specs.slice(before).some((spec) => spec.prompt.includes('production designer')),
    ).toBe(false);
  });
});

describe('world assets QA', { timeout: 180_000 }, () => {
  it('sends the QA findings to one fix turn and keeps a set that still fails with ⚠', async () => {
    const { dir } = await forestFilm('game-b2', 'broken assets');
    const broken = JSON.stringify({
      version: 1,
      world: 'game-b2',
      sprites: { fern: { rows: ['gX'], legend: { g: 'sage' } } },
    });
    const harness = new FakeClaudeHarness({
      version: 1,
      rules: [
        {
          ...writes({ 'assets/game-b2/forest.json': broken }),
          promptIncludes: 'production designer',
        },
      ],
      default: { scenario: 'tools-write', reply: CRAFT_OK },
    });
    harnesses.push(harness);
    const done = await runner(dir, harness).run({ stage: 'scenes', action: 'world-assets' });
    if (!done.ok) throw new Error(JSON.stringify(done.error));
    const turns = harness.specs.filter((spec) => spec.prompt.includes('production designer'));
    expect(turns).toHaveLength(2);
    expect(turns[1]?.prompt).toContain('This is fix 2');
    expect(turns[1]?.prompt).toMatch(/assets\/game-b2\/forest\.json: .*fern.*"X"/);
    expect(turns[1]?.prompt).toContain('assets/cast.json was not written');
    expect(done.value.message).toMatch(/none designed/);
    const report = worldAssetsReportSchema.parse(
      JSON.parse(readProject(dir, '.reelforge/world-assets.json')),
    );
    expect(report.status).toBe('failed');
  });

  it('never runs for a voxel film (no turn, no files, nothing in the manifest)', async () => {
    const dir = await projects.create('voxel film');
    const shots = filmShots(1);
    writeFilm(dir, shots);
    const [shot] = shots;
    if (shot === undefined) throw new Error('one shot');
    expect((await autocommit(dir, 'Storyboard', { kind: 'manual', git: projects.git })).ok).toBe(
      true,
    );
    const harness = new FakeClaudeHarness({
      version: 1,
      rules: [buildRule(shot, sceneSource(shot))],
      default: { scenario: 'tools-write', reply: CRAFT_OK },
    });
    harnesses.push(harness);
    const scenes = await runner(dir, harness).run({ stage: 'scenes' });
    expect(scenes.ok).toBe(true);
    expect(harness.specs.some((spec) => spec.prompt.includes('production designer'))).toBe(false);
    expect(existsSync(path.join(dir, '.reelforge', 'world-assets.json'))).toBe(false);
    expect(existsSync(path.join(dir, 'assets'))).toBe(false);
    const { manifest } = await planServiceShot({ projectDir: dir, shot: shot.id });
    expect(manifest).not.toHaveProperty('worldAssets');
    const action = await runner(dir, harness).run({ stage: 'scenes', action: 'world-assets' });
    expect(action.ok).toBe(false);
  });
});
