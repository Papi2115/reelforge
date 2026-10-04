/**
 * The Assets panel's actions (PLAN.md#12.12) and the Library dialog (#12.19) in main: import own
 * files (picker or drop), describe, remove, save to the library; search / favourite / tag / use a
 * library entry in another project; library pictures over the media protocol.
 */
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readCatalogue } from '@reelforge/cli/assets';
import { tinyPng } from '@reelforge/cli/assets-testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { libraryMediaUrl } from '../../shared/library-contract.js';
import { createLogger } from '../logger.js';
import { resolveLibraryMedia } from '../project-media.js';
import { AssetActions, importMessage } from './asset-actions.js';
import { AssetsService } from './assets-service.js';
import { LibraryService } from './library-service.js';

const STAMP = '2026-10-04T12:00:00.000Z';
const log = createLogger(() => undefined);
let root: string;
let projectA: string;
let projectB: string;
let library: string;
let open: string | undefined;
let commits: string[];
let picked: readonly string[] | undefined;
let saveOwn: boolean;

async function project(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, 'project.json'),
    JSON.stringify({
      version: 1,
      title: 'T',
      language: 'en',
      style: 'voxel-pixel-crisp640',
      fps: 30,
      seed: 1,
      researchMode: 'off',
    }),
  );
}

function actions(): AssetActions {
  return new AssetActions({
    projectDir: () => open,
    libraryDir: library,
    saveOwnToLibrary: () => saveOwn,
    pickFiles: () => Promise.resolve(picked),
    commit: (_dir, message) => {
      commits.push(message);
      return Promise.resolve();
    },
    changed: () => undefined,
    now: () => new Date(STAMP),
    log,
  });
}

function libraryService(): LibraryService {
  return new LibraryService({
    libraryDir: library,
    projectDir: () => open,
    commit: (_dir, message) => {
      commits.push(message);
      return Promise.resolve();
    },
    changed: () => undefined,
    now: () => new Date(STAMP),
    log,
  });
}

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'rf own assets ż '));
  projectA = path.join(root, 'Project A');
  projectB = path.join(root, 'Project B');
  library = path.join(root, 'library');
  await Promise.all([project(projectA), project(projectB)]);
  await writeFile(path.join(root, 'desk photo.png'), tinyPng(12, 8));
  await writeFile(path.join(root, 'notes.txt'), 'hello');
  open = projectA;
  commits = [];
  picked = undefined;
  saveOwn = false;
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('AssetActions', () => {
  it('imports picked and dropped files, reports failures and commits', async () => {
    const service = actions();
    expect(await service.import({})).toEqual({ status: 'cancelled', message: null });
    picked = [path.join(root, 'desk photo.png'), path.join(root, 'notes.txt')];
    const result = await service.import({});
    expect(result.status).toBe('ok');
    expect(result.message).toMatch(/^Added 1 file; could not add notes\.txt: notes\.txt: only png/);
    expect(commits).toEqual(['Assets: added 1 own file']);
    const again = await service.import({ paths: [path.join(root, 'desk photo.png')] });
    expect(again).toEqual({
      status: 'ok',
      message: 'No file added; 1 was already in the project.',
    });
    const [record] = (await readCatalogue(projectA)).assets;
    expect(record).toMatchObject({
      id: 'own-desk-photo',
      source: 'own',
      description: 'desk photo',
    });
    const state = await new AssetsService({
      projectDir: () => open,
      fetchApproved: () => Promise.resolve({ status: 'ok', message: null }),
      changed: () => undefined,
      log,
      libraryDir: library,
    }).state();
    expect(state.status === 'ok' && state.assets[0]).toMatchObject({
      own: true,
      description: 'desk photo',
      width: 12,
      inLibrary: false,
      licence: { verified: true },
    });
    expect(state.status === 'ok' && state.credits.markdown).toContain('(no external assets used)');
  });

  it('describes, saves to the library, takes out of it and removes an asset', async () => {
    saveOwn = true;
    const service = actions();
    await service.import({ paths: [path.join(root, 'desk photo.png')] });
    expect(existsSync(path.join(library, 'library.json'))).toBe(true);
    expect(await service.edit({ id: 'own-desk-photo', description: 'my desk at night' })).toEqual({
      status: 'ok',
      message: null,
    });
    expect((await readCatalogue(projectA)).assets[0]?.description).toBe('my desk at night');
    expect((await service.setInLibrary({ id: 'own-desk-photo', save: false })).message).toBe(
      'Removed from the asset library.',
    );
    expect((await libraryService().state({})).status === 'ok').toBe(true);
    expect(await service.setInLibrary({ id: 'nope', save: true })).toEqual({
      status: 'error',
      message: 'No asset "nope".',
    });
    expect((await service.remove('own-desk-photo')).status).toBe('ok');
    expect((await readCatalogue(projectA)).assets).toEqual([]);
    open = undefined;
    expect((await actions().remove('x')).status).toBe('error');
  });

  it('words the import result', () => {
    expect(importMessage(2, 0, [])).toBe('Added 2 files.');
    expect(importMessage(0, 2, ['a.txt: no'])).toBe(
      'No file added; 2 were already in the project; could not add a.txt: no.',
    );
  });
});

describe('LibraryService', () => {
  it('searches, favourites, tags and uses an entry in another project (no download)', async () => {
    await actions().import({ paths: [path.join(root, 'desk photo.png')] });
    await actions().setInLibrary({ id: 'own-desk-photo', save: true });
    const service = libraryService();
    const first = await service.state({});
    if (first.status !== 'ok') throw new Error('library state failed');
    const [entry] = first.entries;
    expect(entry).toMatchObject({
      assetId: 'own-desk-photo',
      group: 'own',
      originProject: 'Project A',
      inProject: true,
      image: `${entry?.sha256 ?? ''}.png`,
    });
    if (entry === undefined) return;
    await service.edit({ sha256: entry.sha256, favorite: true, tags: ['Desk', 'night '] });
    const tagged = await service.state({ tag: 'desk', favorites: true });
    expect(tagged.status === 'ok' && tagged.entries.map((item) => item.tags)).toEqual([
      ['desk', 'night'],
    ]);
    expect(tagged.status === 'ok' && tagged.tags).toEqual(['desk', 'night']);
    open = projectB;
    const before = await service.state({ text: 'desk' });
    expect(before.status === 'ok' && before.entries[0]?.inProject).toBe(false);
    expect(await service.use(entry.sha256)).toEqual({
      status: 'ok',
      message: 'Added to this project as own-desk-photo.',
    });
    expect((await readCatalogue(projectB)).assets[0]).toMatchObject({
      source: 'own',
      fromLibrary: true,
      approved: true,
    });
    expect(commits).toContain('Assets: own-desk-photo from the library');
    expect((await service.use(entry.sha256)).message).toBe(
      'Already in this project as own-desk-photo.',
    );
    expect((await service.remove(entry.sha256)).status).toBe('ok');
    expect((await service.use(entry.sha256)).status).toBe('error');
  });

  it('moves a damaged index aside and reports it', async () => {
    await mkdir(library, { recursive: true });
    await writeFile(path.join(library, 'library.json'), '{"version": 9}');
    const state = await libraryService().state({});
    expect(state.status === 'ok' && state.problem).toContain('moved to library.corrupt-');
    expect(state.status === 'ok' && state.total).toBe(0);
  });
});

describe('library pictures on the media protocol', () => {
  it('serves strict file names from the library files folder only', () => {
    const name = `${'b'.repeat(64)}.png`;
    const resolved = resolveLibraryMedia(library, libraryMediaUrl(name, 320));
    expect(resolved).toEqual({
      ok: true,
      value: {
        file: path.join(library, 'files', name),
        contentType: 'image/png',
        thumbnailWidth: 320,
      },
    });
    const webp = resolveLibraryMedia(library, `reelforge-media://library/${'c'.repeat(64)}.webp`);
    expect(webp.ok && webp.value.thumbnailWidth).toBeUndefined();
    for (const bad of [
      'reelforge-media://library/..%2Flibrary.json',
      'reelforge-media://library/files/x.png',
      `reelforge-media://library/${'b'.repeat(64)}.mp4`,
      `reelforge-media://project/${name}`,
    ]) {
      expect(resolveLibraryMedia(library, bad).ok, bad).toBe(false);
    }
    expect(resolveLibraryMedia(undefined, libraryMediaUrl(name, 1)).ok).toBe(false);
  });
});
