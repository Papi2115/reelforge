/**
 * The global asset library (PLAN.md#12.19): an asset of project A is used in project B without any
 * request; entries are deduplicated by sha256; source, licence and the unverified flag survive the
 * trip; the index is written atomically and a damaged one is moved aside; search filters; the CLI
 * `assets library search|use` works in research mode off with zero requests.
 */
import { existsSync } from 'node:fs';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { assetLibraryFileSchema, assetsFileSchema, type AssetRecord } from '@reelforge/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { copyFixtureProject, runCliWith, type TempProject } from '../../testing/fixture.js';
import { importOwnAsset } from '../own.js';
import type { AssetRuntime } from '../runtime.js';
import { addToCatalogue } from '../store.js';
import { startAssetServer, tinyPng, type AssetTestServer } from '../testing/server.js';
import {
  addToLibrary,
  editLibraryEntry,
  findLibraryEntry,
  libraryKey,
  removeFromLibrary,
  searchLibrary,
  useLibraryEntry,
} from './library.js';
import { libraryIndexFile, readLibrary } from './store.js';

const NOW = (): Date => new Date('2026-10-04T12:00:00.000Z');

let projectA: TempProject;
let projectB: TempProject;
let library: string;
let server: AssetTestServer;

beforeEach(async () => {
  projectA = await copyFixtureProject();
  projectB = await copyFixtureProject();
  library = await mkdtemp(path.join(tmpdir(), 'reelforge library ż '));
  server = await startAssetServer();
});

afterEach(async () => {
  await server.close();
  await Promise.all([projectA.remove(), projectB.remove()]);
  await rm(library, { recursive: true, force: true });
});

/** A downloaded (unverified, full-auto) asset in project A, as fetch-asset leaves it. */
async function downloaded(root: string): Promise<AssetRecord> {
  const bytes = tinyPng(6, 5);
  await writeFile(path.join(root, 'web.png'), bytes);
  const own = await importOwnAsset(root, { file: path.join(root, 'web.png') }, 'full-auto', NOW);
  const record: AssetRecord = {
    ...own.record,
    id: 'web-moon',
    source: 'web',
    sourceUrl: 'https://example.org/moon.png',
    downloadUrl: 'https://example.org/moon.png',
    title: 'Moon',
    author: 'unknown',
    licence: { id: 'unverified', url: null, verified: false },
    approved: false,
  };
  await addToCatalogue(root, record);
  return record;
}

async function catalogueOf(root: string): Promise<AssetRecord[]> {
  return assetsFileSchema.parse(JSON.parse(await readFile(path.join(root, 'assets.json'), 'utf8')))
    .assets;
}

function runtime(): AssetRuntime {
  return { ...server.runtime(), library: { dir: library, saveDownloaded: () => false } };
}

describe('asset library', () => {
  it('makes an asset of project A available in project B without any request', async () => {
    const record = await downloaded(projectA.root);
    const added = await addToLibrary(library, { projectRoot: projectA.root, record, now: NOW });
    expect(added.existing).toBe(false);
    expect(added.entry).toMatchObject({
      sha256: record.sha256,
      file: `${record.sha256}.png`,
      assetId: 'web-moon',
      source: 'web',
      licence: { id: 'unverified', verified: false },
      favorite: false,
      tags: [],
      originProject: 'my project',
    });
    const used = await useLibraryEntry(library, projectB.root, added.entry, {
      approved: true,
      mode: 'off',
      now: NOW,
    });
    expect(used.record).toMatchObject({
      id: 'web-moon',
      source: 'web',
      sourceUrl: 'https://example.org/moon.png',
      licence: { id: 'unverified', verified: false },
      sha256: record.sha256,
      fromLibrary: true,
      mode: 'off',
    });
    expect(await readFile(path.join(projectB.root, used.record.file))).toEqual(
      await readFile(path.join(projectA.root, record.file)),
    );
    expect(await catalogueOf(projectB.root)).toEqual([used.record]);
    const again = await useLibraryEntry(library, projectB.root, added.entry, {
      approved: true,
      mode: 'off',
      now: NOW,
    });
    expect(again).toEqual({ record: used.record, existing: true });
    expect(server.requests).toEqual([]);
  });

  it('dedupes by sha256 and keeps the first metadata', async () => {
    const record = await downloaded(projectA.root);
    const first = await addToLibrary(library, { projectRoot: projectA.root, record, now: NOW });
    const second = await addToLibrary(library, {
      projectRoot: projectA.root,
      record: { ...record, id: 'other-name', title: 'Other' },
      now: NOW,
    });
    expect(second).toEqual({ entry: first.entry, existing: true });
    expect(await readdir(path.join(library, 'files'))).toEqual([first.entry.file]);
    const index = assetLibraryFileSchema.parse(
      JSON.parse(await readFile(libraryIndexFile(library), 'utf8')),
    );
    expect(index.entries).toHaveLength(1);
  });

  it('refuses a project file that changed since it was recorded', async () => {
    const record = await downloaded(projectA.root);
    await writeFile(path.join(projectA.root, record.file), tinyPng(7, 7));
    await expect(
      addToLibrary(library, { projectRoot: projectA.root, record, now: NOW }),
    ).rejects.toThrow(/changed since it was added/);
    expect(existsSync(libraryIndexFile(library))).toBe(false);
  });

  it('moves a damaged index aside and starts empty (no write while only reading)', async () => {
    await writeFile(libraryIndexFile(library), '{ not json');
    const peek = await readLibrary(library);
    expect(peek.library.entries).toEqual([]);
    expect(peek.problem).toContain('damaged');
    expect(existsSync(libraryIndexFile(library))).toBe(true);
    const record = await downloaded(projectA.root);
    await addToLibrary(library, { projectRoot: projectA.root, record, now: NOW });
    const names = await readdir(library);
    expect(names).toContain('library.corrupt-2026-10-04T12-00-00-000Z.json');
    expect((await readLibrary(library)).library.entries).toHaveLength(1);
    expect(names.filter((name) => name.endsWith('.tmp'))).toEqual([]);
  });

  it('favourites, tags, searches and removes entries', async () => {
    const web = await downloaded(projectA.root);
    await writeFile(path.join(projectA.root, 'logo.png'), tinyPng(3, 3));
    const own = await importOwnAsset(
      projectA.root,
      { file: path.join(projectA.root, 'logo.png'), description: 'channel logo' },
      'off',
      NOW,
    );
    const webEntry = (
      await addToLibrary(library, { projectRoot: projectA.root, record: web, now: NOW })
    ).entry;
    const ownEntry = (
      await addToLibrary(library, { projectRoot: projectA.root, record: own.record, now: NOW })
    ).entry;
    await editLibraryEntry(library, ownEntry.sha256, {
      favorite: true,
      tags: [' Branding! ', 'branding', ''],
    });
    const { library: index } = await readLibrary(library);
    expect(searchLibrary(index, {}).map((entry) => entry.assetId)).toEqual([
      'own-logo',
      'web-moon',
    ]);
    expect(searchLibrary(index, { text: 'channel' }).map((entry) => entry.assetId)).toEqual([
      'own-logo',
    ]);
    expect(searchLibrary(index, { tag: 'Branding' })).toHaveLength(1);
    expect(searchLibrary(index, { licence: 'unverified' }).map((entry) => entry.assetId)).toEqual([
      'web-moon',
    ]);
    expect(searchLibrary(index, { licence: 'own', favorites: true })).toHaveLength(1);
    expect(searchLibrary(index, { kind: 'video' })).toEqual([]);
    expect(index.entries.find((entry) => entry.assetId === 'own-logo')?.tags).toEqual(['branding']);
    expect(findLibraryEntry(index, libraryKey(webEntry))?.assetId).toBe('web-moon');
    expect(findLibraryEntry(index, 'own-logo')?.sha256).toBe(ownEntry.sha256);
    expect(await removeFromLibrary(library, webEntry.sha256)).toBe(true);
    expect(await readdir(path.join(library, 'files'))).toEqual([ownEntry.file]);
    expect(await removeFromLibrary(library, webEntry.sha256)).toBe(false);
  });

  it('CLI: search and use in research mode off with zero requests; refused without a library', async () => {
    const record = await downloaded(projectA.root);
    const { entry } = await addToLibrary(library, { projectRoot: projectA.root, record, now: NOW });
    const search = await runCliWith(
      projectB.root,
      { assets: runtime() },
      'assets',
      'library',
      'search',
      '--query',
      'moon',
    );
    expect(search.code).toBe(0);
    expect(search.stdout).toContain('asset library: 1 of 1 match');
    expect(search.stdout).toContain(`1. ${libraryKey(entry)}  web-moon  image 6x5`);
    expect(search.stdout).toContain('licence unverified (UNVERIFIED)');
    expect(search.stdout).toContain('--- BEGIN UNTRUSTED EXTERNAL DATA');
    const use = await runCliWith(
      projectB.root,
      { assets: runtime() },
      'assets',
      'library',
      'use',
      libraryKey(entry),
      '--as',
      'moon',
    );
    expect(use.code).toBe(0);
    expect(use.stdout).toContain('copied from the library: moon -> .reelforge/assets/moon.png');
    const [copied] = await catalogueOf(projectB.root);
    expect(copied).toMatchObject({ id: 'moon', approved: false, fromLibrary: true, mode: 'off' });
    expect(server.requests).toEqual([]);
    const unknown = await runCliWith(
      projectB.root,
      { assets: runtime() },
      'assets',
      'library',
      'use',
      'deadbeef00',
    );
    expect(unknown.code).toBe(1);
    expect(unknown.stdout).toContain('no single library asset matches');
    const outside = await runCliWith(
      projectB.root,
      { assets: server.runtime() },
      'assets',
      'library',
      'search',
    );
    expect(outside.code).toBe(1);
    expect(outside.stdout).toContain('the asset library is not available here');
  });
});
