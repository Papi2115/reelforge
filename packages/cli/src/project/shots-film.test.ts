/**
 * PLAN.md#14.19: a manifest that renders one storyboard shot carries the film's place of it
 * (`ctx.film`), and the project's Grim Ink libraries (`kit-ext/lib`) are read with the other
 * project modules, under the same limits.
 */
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { INK_MODULE_LIMITS } from '@reelforge/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readProjectFiles } from './files.js';
import { extensionsOfKind, readKitExtensions } from './kit-ext.js';
import { isolatedManifest, planForShot, renderSetup } from './shots.js';

const FIXTURE = path.resolve(import.meta.dirname, '..', '..', 'test', 'fixtures', 'project');

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'reelforge film '));
  await cp(FIXTURE, root, { recursive: true });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true, maxRetries: 5 });
});

describe('isolated manifests and ctx.film (PLAN.md#14.19)', () => {
  it("carries the storyboard's length, shot count and the shot's index", async () => {
    const files = await readProjectFiles(root);
    if (files.storyboard.status !== 'ok') throw new Error('fixture storyboard');
    const shots = files.storyboard.data.shots;
    const plan = await planForShot(files, 's02');
    const index = shots.findIndex((shot) => shot.id === 's02');
    expect(plan.film).toEqual({ index, count: shots.length, duration: shots.at(-1)?.t1 });
    const manifest = isolatedManifest(renderSetup(files), plan);
    expect(manifest.film).toEqual({ duration: shots.at(-1)?.t1, shotCount: shots.length });
    expect(manifest.shots.map((shot) => shot.filmIndex)).toEqual([undefined, index]);
  });

  it('leaves a standalone scene without a film place', async () => {
    const files = await readProjectFiles(root);
    const manifest = isolatedManifest(renderSetup(files), {
      id: 'draft',
      t0: 0,
      t1: 5,
      file: 'scenes/draft.js',
      source: 'export const meta = {};',
      standalone: true,
    });
    expect(manifest.film).toBeUndefined();
    expect(manifest.shots[0]?.filmIndex).toBeUndefined();
  });
});

describe('Grim Ink libraries in kit-ext (PLAN.md#14.19)', () => {
  it('reads kit-ext/lib/<name>.js as kind lib', async () => {
    await mkdir(path.join(root, 'kit-ext', 'lib'), { recursive: true });
    await writeFile(path.join(root, 'kit-ext', 'lib', 'crowd.js'), 'export const lib = {};\n');
    await writeFile(path.join(root, 'kit-ext', 'lib', 'Bad-Name.js'), 'export const lib = {};\n');
    const files = await readKitExtensions(root);
    expect(extensionsOfKind(files.extensions, 'lib')).toEqual([
      {
        name: 'crowd',
        file: 'kit-ext/lib/crowd.js',
        source: 'export const lib = {};\n',
        kind: 'lib',
      },
    ]);
    expect(files.ignored).toContain('kit-ext/lib/Bad-Name.js');
  });

  it('limits a library like a person or a place', async () => {
    await mkdir(path.join(root, 'kit-ext', 'lib'), { recursive: true });
    const big = `export const lib = {};\n//${'x'.repeat(INK_MODULE_LIMITS.maxBytes)}\n`;
    await writeFile(path.join(root, 'kit-ext', 'lib', 'huge.js'), big);
    await expect(readKitExtensions(root)).rejects.toThrow(/kit-ext\/lib\/huge\.js is 161 KB/);
  });
});
