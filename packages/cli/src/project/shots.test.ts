import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readProjectFiles } from './files.js';
import { isolatedManifest, planForShot, renderSetup } from './shots.js';

const FIXTURE = path.resolve(import.meta.dirname, '..', '..', 'test', 'fixtures', 'project');

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'reelforge shots '));
  await cp(FIXTURE, root, { recursive: true });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true, maxRetries: 5 });
});

async function shotManifest(id: string) {
  const files = await readProjectFiles(root);
  return isolatedManifest(renderSetup(files), await planForShot(files, id));
}

describe('isolatedManifest and ambient variation (PLAN.md#12.8)', () => {
  it('leaves the manifest as before when project.json has no ambientVariation', async () => {
    const manifest = await shotManifest('s02');
    expect(manifest.ambientVariation).toBeUndefined();
    expect(manifest.shots.map((shot) => shot.ambient)).toEqual([undefined, undefined]);
  });

  it('carries the switch and the shot storyboard position when it is on', async () => {
    const file = path.join(root, 'project.json');
    const project = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>;
    await writeFile(file, JSON.stringify({ ...project, ambientVariation: true }));
    const manifest = await shotManifest('s02');
    expect(manifest.ambientVariation).toEqual({ enabled: true, seed: project['seed'] });
    // The padding shot has none; s02 keeps its real index and act (it crossfades in).
    expect(manifest.shots.map((shot) => shot.ambient)).toEqual([undefined, { index: 1, act: 1 }]);
  });

  it('renders standalone scenes (prop turntables, drafts) neutral even when it is on', async () => {
    const file = path.join(root, 'project.json');
    const project = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>;
    await writeFile(file, JSON.stringify({ ...project, ambientVariation: true }));
    const files = await readProjectFiles(root);
    const setup = renderSetup(files);
    expect(setup.ambientVariation).toEqual({ enabled: true, seed: project['seed'] });
    const manifest = isolatedManifest(setup, {
      id: 'turntable',
      t0: 0,
      t1: 5,
      file: '.reelforge/props/turntable.js',
      source: 'export const meta = {};',
      standalone: true,
    });
    expect(manifest.ambientVariation).toBeUndefined();
    expect(manifest.shots.map((shot) => shot.ambient)).toEqual([undefined]);
  });
});
