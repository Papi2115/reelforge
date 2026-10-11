/**
 * `render:frames --scene` finds the Grim Ink people and places a scene can see (PLAN.md#14.12):
 * next to it (people/, places/: the kit's examples) and in its project (../kit-ext/), camelCase
 * file names only, the first of a kind and name winning; and a scene render runs at its world's
 * frame rate (Grim Ink 24) while a manifest keeps its own.
 */
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { sceneInkModules } from './render-frames-modules.js';
import { withWorldFps } from './render-frames.js';

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'reelforge ink modules '));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function write(relative: string, text: string): Promise<void> {
  const file = path.join(root, relative);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, text);
}

describe('render:frames people and places', () => {
  it('loads the modules next to the scene and in its project, camelCase names only', async () => {
    await write('project/scenes/s01.js', 'export const meta = {};');
    await write('project/scenes/people/oldBaker.js', 'export const person = { id: "near" };');
    await write('project/kit-ext/people/oldBaker.js', 'export const person = { id: "far" };');
    await write('project/kit-ext/people/nightPorter.js', 'export const person = {};');
    await write('project/kit-ext/places/boilerRoom.js', 'export const place = {};');
    await write('project/kit-ext/places/Bad-Name.js', 'export const place = {};');
    await write('project/kit-ext/places/notes.txt', 'not a module');
    const modules = await sceneInkModules(path.join(root, 'project', 'scenes', 's01.js'));
    expect(modules.map((module) => [module.kind, module.name, module.file])).toEqual([
      ['people', 'oldBaker', 'kit-ext/people/oldBaker.js'],
      ['people', 'nightPorter', 'kit-ext/people/nightPorter.js'],
      ['places', 'boilerRoom', 'kit-ext/places/boilerRoom.js'],
    ]);
    expect(modules[0]?.source).toContain('near');
  });

  it('finds nothing for a scene without modules', async () => {
    await write('alone/s01.js', 'export const meta = {};');
    expect(await sceneInkModules(path.join(root, 'alone', 's01.js'))).toEqual([]);
  });

  it('renders a scene at its world frame rate', () => {
    const manifest = { version: 1 as const, fps: 30, seed: 1, shots: [] };
    expect(withWorldFps({ ...manifest, style: 'c-cam' }).fps).toBe(24);
    expect(withWorldFps({ ...manifest, style: 'comic' }).fps).toBe(30);
    expect(withWorldFps(manifest).fps).toBe(30);
  });
});
