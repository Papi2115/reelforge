/** Project props in the CLI without a browser: kit-docs, lint, prop-preview args, turntable checks. */
import { readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { lintScene } from '@reelforge/engine';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseAngles } from '../commands/prop-preview.js';
import { readProjectFiles } from '../project/files.js';
import { isolatedManifest, renderSetup } from '../project/shots.js';
import { copyFixtureProject, runCli, type TempProject } from '../testing/fixture.js';
import { parsePropMetrics, turntableChecks } from './checks.js';
import { METRICS_CUE, turntableSource, turntableTimes } from './turntable.js';

const FRIDGE = readFileSync(
  path.resolve(import.meta.dirname, '..', '..', '..', 'kit', 'examples', 'kit-ext', 'fridge.js'),
  'utf8',
);

let project: TempProject;

beforeEach(async () => {
  project = await copyFixtureProject();
  await mkdir(path.join(project.root, 'kit-ext', 'props'), { recursive: true });
});

afterEach(async () => {
  await project.remove();
});

describe('project props in the CLI', () => {
  it('lists project props in kit-docs (marked project-local) and documents the module', async () => {
    await project.write('kit-ext/props/fridge.js', FRIDGE);
    await project.write('kit-ext/props/Broken-Name.js', FRIDGE);
    await project.write('kit-ext/props/lamp.js', 'export const prop = (');
    const all = await runCli(project.root, 'kit-docs');
    expect(all.code).toBe(0);
    expect(all.stdout).toMatch(
      /kit\.props\.fridge\(\{ body\?: .*\}\) \(project-local, kit-ext\/props\) — Kitchen fridge/,
    );
    expect(all.stdout).toContain('ignored: kit-ext/props/Broken-Name.js');
    expect(all.stdout).toContain('not loadable: kit-ext/props/lamp.js');
    const one = await runCli(project.root, 'kit-docs', 'fridge');
    expect(one.stdout).toContain('handle — front of the lower door handle');
    const docs = await runCli(project.root, 'kit-docs', 'prop-module');
    expect(docs.stdout).toContain('export const prop = {');
    expect(docs.stdout).toContain('reelforge prop-preview <name>');
  });

  it('lints prop modules in prop mode, also by default', async () => {
    await project.write(
      'kit-ext/props/fridge.js',
      FRIDGE.replace('const s = 1 / 22;', 'const s = Math.random();'),
    );
    const run = await runCli(project.root, 'lint');
    expect(run.code).toBe(1);
    expect(run.stdout).toContain('ok      scenes/s01_title.js');
    expect(run.stdout).toMatch(/kit-ext\/props\/fridge\.js:\d+:\d+ {2}error {2}no-random/);
    await project.write('kit-ext/props/fridge.js', FRIDGE);
    expect((await runCli(project.root, 'lint', 'kit-ext/props/fridge.js')).code).toBe(0);
  });

  it('puts the project props into every render manifest', async () => {
    await project.write('kit-ext/props/fridge.js', FRIDGE);
    const files = await readProjectFiles(project.root);
    const setup = renderSetup(files);
    const manifest = isolatedManifest(setup, {
      id: 's01',
      t0: 0,
      t1: 1,
      file: 'scenes/s01_title.js',
      source: 'x',
      standalone: false,
    });
    expect(manifest.kitExtensions).toEqual([
      { name: 'fridge', file: 'kit-ext/props/fridge.js', source: FRIDGE },
    ]);
  });

  it('renders props without timed words (a turntable resolves no anchors)', async () => {
    await project.write('timing/words.json', '{ "version": 1 }');
    const files = await readProjectFiles(project.root);
    expect(() => renderSetup(files)).toThrow('timing/words.json is invalid');
    expect(renderSetup(files, { withoutWords: true }).words).toBeUndefined();
  });

  it('prop-preview explains a missing prop and lint errors before rendering', async () => {
    const missing = await runCli(project.root, 'prop-preview', 'fridge');
    expect(missing.code).toBe(1);
    expect(missing.stdout).toContain('kit-ext/props/fridge.js does not exist');
    await project.write(
      'kit-ext/props/fridge.js',
      FRIDGE.replace("name: 'fridge'", "name: 'cooler'"),
    );
    const lint = await runCli(project.root, 'prop-preview', 'fridge');
    expect(lint.code).toBe(1);
    expect(lint.stdout).toContain('`prop.name` is "cooler" but the file is fridge.js');
    expect((await runCli(project.root, 'prop-preview')).code).toBe(2);
  });
});

describe('turntable', () => {
  it('generates a lint-clean scene and parses the angles', () => {
    expect(lintScene(turntableSource('fridge', [0, 90]), { filename: 'turntable.js' })).toEqual([]);
    expect(parseAngles(undefined)).toEqual([0, 90, 180, 270]);
    expect(parseAngles('0, 45')).toEqual([0, 45]);
    expect(() => parseAngles('a')).toThrow(/not a number/);
    expect(turntableTimes([0, 90])).toEqual([0.5, 1.5, 2.5]);
  });

  it('checks size, floating parts, blank views and determinism', () => {
    const image = (seed: number) => {
      const data = new Uint8Array(8 * 8 * 4);
      for (let index = 0; index < data.length; index += 1) data[index] = (index * seed) % 251;
      return { width: 8, height: 8, data };
    };
    const metrics = { size: [0.9, 1.8, 0.8], meshes: 2, voxels: 900, floatingParts: [] };
    const cues = [{ name: `${METRICS_CUE}${JSON.stringify(metrics)}` }];
    const frames = [
      { t: 0.5, image: image(3) },
      { t: 1.5, image: image(5) },
      { t: 2.5, image: image(3) },
    ];
    expect(parsePropMetrics(cues)).toEqual(metrics);
    expect(turntableChecks({ angles: [0, 90], frames, cues }).every((check) => check.ok)).toBe(
      true,
    );
    const huge = [
      {
        name: `${METRICS_CUE}${JSON.stringify({ ...metrics, size: [9, 1, 1], floatingParts: ['part 2 floats'] })}`,
      },
    ];
    const blank = { width: 8, height: 8, data: new Uint8Array(8 * 8 * 4) };
    const bad = turntableChecks({
      angles: [0, 90],
      frames: [
        { t: 0.5, image: blank },
        { t: 1.5, image: image(5) },
        { t: 2.5, image: image(7) },
      ],
      cues: huge,
    });
    expect(bad.filter((check) => !check.ok).map((check) => check.id)).toEqual([
      'size',
      'floating',
      'blank',
      'deterministic',
    ]);
    expect(turntableChecks({ angles: [0], frames, cues: [] })[0]?.id).toBe('metrics');
  });
});
