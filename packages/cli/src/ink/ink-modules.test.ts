/** Grim Ink people / places in the CLI without a browser (PLAN.md#14.8): reading, lint, docs, previews. */
import { readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { computeFrameStats } from '@reelforge/engine/raster';
import { lintScene } from '@reelforge/engine';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { describeInkModulesTopic } from '../commands/kit-docs-c-cam-people.js';
import { readProjectFiles } from '../project/files.js';
import { extensionsOfKind, readKitExtensions } from '../project/kit-ext.js';
import { isolatedManifest, renderSetup } from '../project/shots.js';
import { copyFixtureProject, runCli, type TempProject } from '../testing/fixture.js';
import {
  inkSheetChecks,
  inkSheetSource,
  inkSheetTimes,
  type InkPreviewKind,
  type InkSheetFrame,
} from './preview.js';

const EXAMPLES = path.resolve(import.meta.dirname, '..', '..', '..', 'kit', 'examples');
const BAKER = readFileSync(path.join(EXAMPLES, 'c-cam', 'people', 'nightBaker.js'), 'utf8');
const ROOM = readFileSync(path.join(EXAMPLES, 'c-cam', 'places', 'bakeryBackRoom.js'), 'utf8');
const FRIDGE = readFileSync(path.join(EXAMPLES, 'kit-ext', 'fridge.js'), 'utf8');

let project: TempProject;

beforeEach(async () => {
  project = await copyFixtureProject();
  for (const kind of ['props', 'people', 'places']) {
    await mkdir(path.join(project.root, 'kit-ext', kind), { recursive: true });
  }
});

afterEach(async () => {
  await project.remove();
});

function frame(t: number, value: number, noisy: boolean): InkSheetFrame {
  const data = new Uint8Array(16 * 16 * 4).map((_, index) =>
    noisy ? (index * 37 + value) % 251 : value,
  );
  return { t, image: { width: 16, height: 16, data } };
}

describe('Grim Ink modules in the CLI', () => {
  it('reads people and places with their kind next to the props', async () => {
    await project.write('kit-ext/props/fridge.js', FRIDGE);
    await project.write('kit-ext/people/nightBaker.js', BAKER);
    await project.write('kit-ext/places/bakeryBackRoom.js', ROOM);
    await project.write('kit-ext/people/Night-Baker.js', BAKER);
    const files = await readKitExtensions(project.root);
    expect(files.extensions.map((entry) => [entry.kind, entry.name])).toEqual([
      [undefined, 'fridge'],
      ['people', 'nightBaker'],
      ['places', 'bakeryBackRoom'],
    ]);
    expect(files.ignored).toEqual(['kit-ext/people/Night-Baker.js']);
    expect(extensionsOfKind(files.extensions, 'people')).toHaveLength(1);
    const setup = renderSetup(await readProjectFiles(project.root), { withoutWords: true });
    const manifest = isolatedManifest(setup, {
      id: 's01',
      t0: 0,
      t1: 2,
      file: 'scenes/x.js',
      source: 'x',
      standalone: true,
    });
    expect(manifest.kitExtensions?.map((entry) => entry.file)).toEqual([
      'kit-ext/props/fridge.js',
      'kit-ext/people/nightBaker.js',
      'kit-ext/places/bakeryBackRoom.js',
    ]);
    const docs = await runCli(project.root, 'kit-docs', 'props');
    expect(docs.stdout).not.toContain('nightBaker');
  });

  it('refuses too many or too large modules', async () => {
    await project.write('kit-ext/places/huge.js', `// ${'x'.repeat(70 * 1024)}`);
    await expect(readKitExtensions(project.root)).rejects.toThrow(
      /huge\.js is 71 KB \(at most 64 KB\)/,
    );
    await project.remove();
    project = await copyFixtureProject();
    await mkdir(path.join(project.root, 'kit-ext', 'people'), { recursive: true });
    for (let index = 0; index < 25; index += 1) {
      await project.write(`kit-ext/people/p${String(index)}.js`, 'export const person = {};');
    }
    await expect(readKitExtensions(project.root)).rejects.toThrow(/25 modules \(at most 24\)/);
  });

  it('lints them by path (reelforge lint, default files included)', async () => {
    await project.write(
      'kit-ext/people/nightBaker.js',
      BAKER.replace('ink.blob(SHIRT', 'g.fillText("x", 0, 0); ink.blob(SHIRT'),
    );
    await project.write('kit-ext/places/bakeryBackRoom.js', ROOM);
    const run = await runCli(project.root, 'lint');
    expect(run.code).toBe(1);
    expect(run.stdout).toMatch(/kit-ext\/people\/nightBaker\.js:\d+:\d+ {2}error {2}ink-grammar/);
    expect(run.stdout).toContain('ok      kit-ext/places/bakeryBackRoom.js');
  });

  it('explains a missing module, a lint error and a bad id in the previews', async () => {
    const missing = await runCli(project.root, 'people-preview', 'nightBaker');
    expect(missing.code).toBe(1);
    expect(missing.stdout + missing.stderr).toContain(
      'kit-ext/people/nightBaker.js does not exist',
    );
    await project.write(
      'kit-ext/places/bakeryBackRoom.js',
      ROOM.replace('ink.crack(240', 'Date.now(); ink.crack(240'),
    );
    const lint = await runCli(project.root, 'places-preview', 'kit.places.bakeryBackRoom');
    expect(lint.code).toBe(1);
    expect(lint.stdout).toMatch(/error {2}no-wall-clock/);
    expect((await runCli(project.root, 'people-preview')).code).toBe(2);
  });

  it('generates lint-clean sheet scenes and checks pages by code', () => {
    for (const kind of ['people', 'places'] as const satisfies readonly InkPreviewKind[]) {
      const source = inkSheetSource(kind, 'nightBaker');
      const errors = lintScene(source, { filename: 'sheet.js' }).filter(
        (diagnostic) => diagnostic.severity === 'error',
      );
      expect(errors).toEqual([]);
    }
    expect(inkSheetTimes('people')).toEqual([0.5, 1.5, 2.5]);
    const good = [frame(0.5, 1, true), frame(1.5, 2, true), frame(2.5, 1, true)];
    expect(inkSheetChecks('people', good).every((check) => check.ok)).toBe(true);
    expect(computeFrameStats(good[0]?.image.data ?? new Uint8Array()).uniqueColors).toBeGreaterThan(
      2,
    );
    const bad = [frame(0.5, 1, true), frame(1.5, 9, false), frame(2.5, 3, true)];
    expect(inkSheetChecks('people', bad).map((check) => check.ok)).toEqual([false, false]);
  });

  it('documents both modules in kit-docs', async () => {
    const people = describeInkModulesTopic('people') ?? '';
    expect(people).toContain('export const person = {');
    expect(people).toContain('reelforge people-preview <id>');
    expect(describeInkModulesTopic('places')).toContain('export const place = {');
    expect(describeInkModulesTopic('props')).toBeUndefined();
    const run = await runCli(project.root, 'kit-docs', 'places');
    expect(run.code).toBe(0);
    expect(run.stdout).toContain('reelforge places-preview <id>');
    expect(people.length).toBeLessThan(6000);
  });
});
