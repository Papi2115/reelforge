/**
 * Junk in the world's asset folder (real run Game B2 #2: an empty `assets/game-b2/probe.json` was
 * committed with the film's set): empty files and files that define nothing are removed before
 * QA, misnamed files once the turns are done; real asset files and files with problems stay.
 */
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { WORLD_ASSET_WORLDS } from '@reelforge/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { FOREST_FILES } from '../testing/world-films.js';
import { droppedNote, dropJunkAssetFiles } from './junk.js';

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function project(files: Readonly<Record<string, string>>): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'reelforge junk '));
  dirs.push(dir);
  for (const [file, content] of Object.entries(files)) {
    const absolute = path.join(dir, ...file.split('/'));
    mkdirSync(path.dirname(absolute), { recursive: true });
    writeFileSync(absolute, content);
  }
  return dir;
}

const exists = (dir: string, file: string): boolean =>
  existsSync(path.join(dir, ...file.split('/')));

describe.each(WORLD_ASSET_WORLDS)('junk in assets/%s', (world) => {
  const folder = `assets/${world}`;
  // A Sketchbook file is one asset: a file without one is invalid (a finding), never empty.
  const stub = world === 'sketchbook' ? [] : [`${folder}/stub.json`];
  const files = {
    ...FOREST_FILES[world],
    [`${folder}/probe.json`]: '',
    [`${folder}/blank.json`]: ' \n\t\n',
    [`${folder}/stub.json`]: JSON.stringify({ version: 1, world }),
    [`${folder}/broken.json`]: '{ "version": 1, ',
    [`${folder}/Probe_Notes.json`]: '{}',
    [`${folder}/notes.txt`]: 'scratch',
    'assets/cast.json': '{}',
  };

  it('removes empty files and files that define nothing, keeps assets and findings', async () => {
    const dir = project(files);
    const dropped = await dropJunkAssetFiles(dir, world, { badNames: false });
    if (!dropped.ok) throw new Error(dropped.error.message);
    expect(dropped.value).toEqual([
      { file: `${folder}/blank.json`, reason: 'empty file' },
      { file: `${folder}/probe.json`, reason: 'empty file' },
      ...stub.map((file) => ({ file, reason: 'defines no asset' })),
    ]);
    expect(exists(dir, `${folder}/stub.json`)).toBe(stub.length === 0);
    for (const file of Object.keys(FOREST_FILES[world])) expect(exists(dir, file)).toBe(true);
    expect(exists(dir, `${folder}/broken.json`)).toBe(true);
    expect(exists(dir, `${folder}/Probe_Notes.json`)).toBe(true);
    expect(exists(dir, 'assets/cast.json')).toBe(true);
  });

  it('removes misnamed files only once the turns are done', async () => {
    const dir = project(files);
    const dropped = await dropJunkAssetFiles(dir, world, { badNames: true });
    if (!dropped.ok) throw new Error(dropped.error.message);
    expect(dropped.value.map((entry) => entry.file)).toEqual([
      `${folder}/Probe_Notes.json`,
      `${folder}/blank.json`,
      `${folder}/notes.txt`,
      `${folder}/probe.json`,
      ...stub,
    ]);
    expect(exists(dir, `${folder}/notes.txt`)).toBe(false);
    expect(exists(dir, `${folder}/broken.json`)).toBe(true);
  });
});

describe('dropJunkAssetFiles', () => {
  it('does nothing without an asset folder and words the summary line', async () => {
    const dir = project({ 'notes.txt': 'x' });
    const dropped = await dropJunkAssetFiles(dir, 'game-b2', { badNames: true });
    expect(dropped).toEqual({ ok: true, value: [] });
    expect(droppedNote({ file: 'assets/game-b2/probe.json', reason: 'empty file' })).toBe(
      'world assets: removed assets/game-b2/probe.json (empty file); it is not part of the set',
    );
  });
});
