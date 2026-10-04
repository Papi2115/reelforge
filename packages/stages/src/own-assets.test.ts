/**
 * "Own assets from A to Z" (PLAN.md#12.12) and the global asset library (#12.19) on fake-claude:
 * - research mode off with 3 own assets: the storyboard prompt lists them with the "kit + these
 *   assets only" rule, the storyboard assigns them (`shot.assets`, unknown ids are repaired), the
 *   scene builds get them as `shotAssets`, and the local source server sees zero requests;
 * - own + downloaded: one catalogue, own files never flagged and never credited, downloads saved
 *   to the library automatically and used by another project without any request.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  creditsMarkdown,
  importOwnAsset,
  readCatalogue,
  readLibrary,
  searchLibrary,
  useLibraryEntry,
  type AssetRuntime,
} from '@reelforge/cli/assets';
import {
  runAssetCommand,
  startAssetServer,
  tinyPng,
  type AssetTestServer,
} from '@reelforge/cli/assets-testing';
import { autocommit } from '@reelforge/project';
import type { ResearchMode } from '@reelforge/shared';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ClaudeRunner } from './claude.js';
import { StageRunner } from './runner.js';
import { FakeClaudeHarness, writes } from './testing/fake-claude.js';
import { CRITIC_OK, buildRule, filmShots, sceneSource, writeFilm } from './testing/film.js';
import { TestProjects, goldenFile, readProject, writeProject } from './testing/project.js';
import { ScriptedFrameRenderer } from './testing/scripted-renderer.js';

const projects = new TestProjects();
const harnesses: FakeClaudeHarness[] = [];
let server: AssetTestServer;
const NOW = (): Date => new Date('2026-10-04T12:00:00.000Z');

beforeEach(async () => {
  server = await startAssetServer();
});
afterEach(async () => {
  await Promise.all(harnesses.splice(0).map((harness) => harness.dispose()));
  await server.close();
});
afterAll(() => {
  projects.dispose();
});

const OWN = ['glass', 'rainbow', 'newton'] as const;

function runtime(library: string): AssetRuntime {
  return { ...server.runtime(), library: { dir: library, saveDownloaded: () => true } };
}

function setMode(dir: string, mode: ResearchMode, sources?: readonly string[]): void {
  const project = JSON.parse(readProject(dir, 'project.json')) as Record<string, unknown>;
  project['researchMode'] = mode;
  delete project['lookMode']; // voxel-only: the golden storyboard has no rolls/looks
  if (sources !== undefined) project['researchSources'] = sources;
  writeProject(dir, 'project.json', JSON.stringify(project, null, 2));
}

/** The user's three files, imported into the project as own assets. */
async function importOwn(dir: string): Promise<void> {
  const inbox = path.join(projects.root, `inbox-${path.basename(dir)}`);
  mkdirSync(inbox, { recursive: true });
  for (const [index, name] of OWN.entries()) {
    const file = path.join(inbox, `${name}.png`);
    writeFileSync(file, tinyPng(8 + index, 6));
    await importOwnAsset(dir, { file, description: `my ${name} photo` }, 'off', NOW);
  }
}

/** The golden storyboard with `assets` on three shots (JSON text). */
function assigned(ids: Readonly<Record<string, readonly string[]>>): string {
  const storyboard = JSON.parse(goldenFile('storyboard.json')) as {
    shots: Record<string, unknown>[];
  };
  const shots = storyboard.shots.map((shot) => {
    const assets = ids[String(shot['id'])];
    return assets === undefined ? shot : { ...shot, assets };
  });
  return JSON.stringify({ ...storyboard, shots }, null, 2);
}

const ASSIGNED = {
  s02_glass: ['own-glass'],
  s04_rainbow: ['own-rainbow'],
  s07_newton: ['own-newton'],
};

describe('own assets in research mode off', () => {
  it('storyboard assigns them, scene builds get them, zero network requests', async () => {
    const library = path.join(projects.root, 'library-off');
    const dir = await projects.create('own off', ['script.txt', 'timing/words.json']);
    setMode(dir, 'off');
    await importOwn(dir);
    const harness = new FakeClaudeHarness([
      writes({ 'storyboard.json': assigned({ ...ASSIGNED, s01_hook: ['own-ghost'] }) }),
      writes({ 'storyboard.json': assigned(ASSIGNED) }, 'Fixed the asset id.'),
    ]);
    harnesses.push(harness);
    const runner = new StageRunner({
      projectDir: dir,
      claude: harness.runner,
      guard: harness.guard,
      git: projects.git,
      assets: runtime(library),
    });
    const result = await runner.run({ stage: 'storyboard' });
    expect(result.ok && result.value.metrics).toMatchObject({ assignedAssets: 3, assetNeeds: 0 });
    const prompt = harness.specs[0]?.prompt ?? '';
    expect(prompt).toContain('Assets of this project (`assets.json`');
    expect(prompt).toContain('build every B-roll ONLY from the kit and these assets');
    for (const name of OWN) {
      expect(prompt).toContain(`- own-${name}  image`);
      expect(prompt).toContain(`"my ${name} photo"`);
    }
    expect(prompt).not.toContain('asset research is on');
    expect(prompt).not.toContain('reelforge assets library search');
    expect(prompt.indexOf('--- BEGIN UNTRUSTED')).toBeLessThan(prompt.indexOf('- own-glass'));
    // The unknown id was sent back for a repair.
    expect(harness.specs[1]?.prompt).toContain(
      'assigns asset "own-ghost", which is not in assets.json',
    );

    // Scenes built on a 3-shot film of the same project setup.
    const filmDir = await projects.create('own off film');
    setMode(filmDir, 'off');
    await importOwn(filmDir);
    const shots = filmShots(3);
    writeFilm(filmDir, shots);
    const storyboard = JSON.parse(readProject(filmDir, 'storyboard.json')) as {
      shots: Record<string, unknown>[];
    };
    storyboard.shots = storyboard.shots.map((shot, index) =>
      index === 1 ? shot : { ...shot, assets: [`own-${OWN[index] ?? 'glass'}`] },
    );
    writeProject(filmDir, 'storyboard.json', JSON.stringify(storyboard, null, 2));
    expect(
      (await autocommit(filmDir, 'Storyboard', { kind: 'manual', git: projects.git })).ok,
    ).toBe(true);
    const scenes = new FakeClaudeHarness({
      version: 1,
      rules: shots.map((shot) => buildRule(shot, sceneSource(shot))),
      default: { scenario: 'tools-write', reply: CRITIC_OK },
    });
    harnesses.push(scenes);
    const sceneRunner = new StageRunner({
      projectDir: filmDir,
      claude: scenes.runner,
      guard: scenes.guard,
      git: projects.git,
      scenes: { frames: new ScriptedFrameRenderer() },
      assets: runtime(library),
    });
    const built = await sceneRunner.run({ stage: 'scenes' });
    expect(built.ok).toBe(true);
    const buildPrompt = (scene: string): string =>
      scenes.specs.find((spec) => spec.prompt.includes(`Write \`${scene}\``))?.prompt ?? '';
    expect(buildPrompt('scenes/s01.js')).toContain(
      'Assets the storyboard assigned to this shot (show them',
    );
    expect(buildPrompt('scenes/s01.js')).toContain('- own-glass  image image/png 8x6');
    expect(buildPrompt('scenes/s03.js')).toContain('- own-newton  image');
    expect(buildPrompt('scenes/s01.js')).not.toContain('own-newton');
    expect(buildPrompt('scenes/s02.js')).not.toContain('Assets the storyboard assigned');
    expect(server.requests).toEqual([]);
  }, 120_000);
});

/** A turn that runs `reelforge` commands for real first (as Claude's Bash tool would). */
function commandsThen(
  harness: FakeClaudeHarness,
  root: AssetRuntime,
  argv: string[][],
): ClaudeRunner {
  return {
    run: async (spec, options) => {
      for (const command of argv) {
        const run = await runAssetCommand(spec.projectDir, root, command);
        if (run.code !== 0) throw new Error(run.text);
      }
      return harness.runner.run(spec, options);
    },
  };
}

describe('own and downloaded assets together', () => {
  it('one catalogue, own never flagged or credited, downloads shared through the library', async () => {
    const library = path.join(projects.root, 'library-mixed');
    const dir = await projects.create('own mixed', ['script.txt', 'timing/words.json']);
    setMode(dir, 'allowlist', ['wikimedia']);
    await importOwn(dir);
    const needs = [{ id: 'newton-portrait', kind: 'image', description: 'portrait of Newton' }];
    const withNeeds = JSON.parse(assigned(ASSIGNED)) as { shots: Record<string, unknown>[] };
    withNeeds.shots = withNeeds.shots.map((shot) =>
      shot['id'] === 's07_newton' ? { ...shot, assetNeeds: needs } : shot,
    );
    writeProject(dir, 'storyboard.json', JSON.stringify(withNeeds, null, 2));
    const harness = new FakeClaudeHarness([writes({}, 'Fetched newton-portrait.')]);
    harnesses.push(harness);
    const runner = new StageRunner({
      projectDir: dir,
      claude: commandsThen(harness, runtime(library), [
        ['fetch-asset', '--source', 'wikimedia', '--id', '105654713', '--as', 'newton-portrait'],
      ]),
      guard: harness.guard,
      git: projects.git,
      assets: runtime(library),
    });
    const fetched = await runner.run({ stage: 'assets' });
    expect(fetched.ok && fetched.value.metrics).toMatchObject({ fetched: 1, savedToLibrary: 1 });
    const catalogue = (await readCatalogue(dir)).assets;
    expect(catalogue.map((record) => [record.id, record.source, record.licence.verified])).toEqual([
      ['own-glass', 'own', true],
      ['own-rainbow', 'own', true],
      ['own-newton', 'own', true],
      ['newton-portrait', 'wikimedia', true],
    ]);
    const credits = creditsMarkdown(catalogue);
    expect(credits).toContain('Nokia 3310');
    expect(credits).not.toContain('own-');
    expect(credits).not.toContain('my glass photo');

    // Storyboard with research on: own and downloaded assets in one list, none flagged ⚠.
    const storyboardHarness = new FakeClaudeHarness([
      writes({ 'storyboard.json': JSON.stringify(withNeeds, null, 2) }),
    ]);
    harnesses.push(storyboardHarness);
    const storyboardRunner = new StageRunner({
      projectDir: dir,
      claude: storyboardHarness.runner,
      guard: storyboardHarness.guard,
      git: projects.git,
      assets: runtime(library),
    });
    expect((await storyboardRunner.run({ stage: 'storyboard' })).ok).toBe(true);
    const prompt = storyboardHarness.specs[0]?.prompt ?? '';
    expect(prompt).toContain('asset research is on for this project');
    expect(prompt).toContain("- own-glass  image 8x6  the user's own file");
    expect(prompt).toContain('- newton-portrait  image');
    expect(prompt).not.toContain('⚠');
    expect(prompt).not.toContain('ONLY from the kit');
    expect(prompt).toContain('reelforge assets library search');

    // Project B (research off) uses the library copy: no request at all.
    const requests = server.requests.length;
    const other = await projects.create('own mixed b');
    setMode(other, 'off');
    const { library: index } = await readLibrary(library);
    const [entry] = searchLibrary(index, { text: 'newton' });
    expect(entry?.assetId).toBe('newton-portrait');
    if (entry === undefined) return;
    const used = await useLibraryEntry(library, other, entry, {
      approved: true,
      mode: 'off',
      now: NOW,
    });
    expect(used.record).toMatchObject({
      id: 'newton-portrait',
      source: 'wikimedia',
      licence: { verified: true },
      fromLibrary: true,
    });
    expect(server.requests.length).toBe(requests);
  }, 120_000);
});
