/**
 * `reelforge people-preview` / `places-preview` (PLAN.md#14.8) through the real engine harness
 * (Playwright Chromium + SwiftShader) on a copy of the fixture project: the sample person and
 * place render as Grim Ink contact sheets on the world's ink stage, every check passes.
 */
import { readFileSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { computeFrameStats, decodePng } from '@reelforge/engine/cli';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { copyFixtureProject, runCli, type TempProject } from '../../src/testing/fixture.js';

const EXAMPLES = path.resolve(import.meta.dirname, '..', '..', '..', 'kit', 'examples', 'c-cam');
const BAKER = readFileSync(path.join(EXAMPLES, 'people', 'nightBaker.js'), 'utf8');
const ROOM = readFileSync(path.join(EXAMPLES, 'places', 'bakeryBackRoom.js'), 'utf8');

interface PreviewReport {
  readonly sheet: string;
  readonly checks: readonly { id: string; ok: boolean; message: string }[];
}

let project: TempProject;

beforeAll(async () => {
  project = await copyFixtureProject();
  await mkdir(path.join(project.root, 'kit-ext', 'people'), { recursive: true });
  await mkdir(path.join(project.root, 'kit-ext', 'places'), { recursive: true });
  await project.write('kit-ext/people/nightBaker.js', BAKER);
  await project.write('kit-ext/places/bakeryBackRoom.js', ROOM);
});

afterAll(async () => {
  await project.remove();
});

describe('reelforge people-preview / places-preview', () => {
  it.each([
    ['people-preview', 'nightBaker', 1],
    ['places-preview', 'bakeryBackRoom', 2],
  ] as const)('%s %s renders a sheet that passes every check', async (command, id, rows) => {
    const run = await runCli(project.root, command, id, '--json');
    expect(run.stderr).toBe('');
    const report = JSON.parse(run.stdout) as PreviewReport;
    expect(report.checks.filter((check) => !check.ok)).toEqual([]);
    expect(run.code).toBe(0);
    const sheet = decodePng(await readFile(report.sheet));
    expect(sheet.width).toBeGreaterThan(1900);
    expect(sheet.height).toBeGreaterThan(rows * 540);
    expect(computeFrameStats(sheet.data).dominantColorShare).toBeLessThan(0.8);
  });

  it('reports a module that does not load', async () => {
    await project.write(
      'kit-ext/people/nightBaker.js',
      BAKER.replace('headScale: 1.1,', 'headScale: -1,'),
    );
    const broken = await runCli(project.root, 'people-preview', 'nightBaker');
    expect(broken.code).toBe(1);
    expect(broken.stdout).toMatch(/failed to load: .*headScale/);
    await project.write('kit-ext/people/nightBaker.js', BAKER);
  });
});
