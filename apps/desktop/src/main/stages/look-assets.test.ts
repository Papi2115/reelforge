/** "Look assets" of a world film: the report, the storyboard check and the designed names. */
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { WorldAssetsReport, WorldCastFile } from '@reelforge/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { lookAssetList, readLookAssets, storyboardChangedSince } from './look-assets.js';
import { readStageReports } from './stage-reports.js';

const STORYBOARD = JSON.stringify({ version: 1, shots: [] });
const sha = (text: string): string => createHash('sha256').update(text).digest('hex');

function report(storyboard: string): WorldAssetsReport {
  return {
    version: 1,
    world: 'comic',
    storyboardHash: sha(storyboard),
    status: 'warning',
    attempts: 2,
    files: ['assets/comic/keeper.json', 'assets/comic/lighthouse.json'],
    ids: ['keeper', 'lighthouse'],
    findings: ['lighthouse is hard to read at thumbnail size'],
    notes: [],
    updatedAt: '2026-10-07T10:00:00.000Z',
  };
}

const CAST: WorldCastFile = {
  version: 1,
  world: 'comic',
  entries: [
    {
      id: 'keeper',
      kind: 'character',
      name: 'The lighthouse keeper',
      file: 'assets/comic/keeper.json',
      shots: [],
    },
  ],
};

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function project(style: string, files: Readonly<Record<string, string>>): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'rf look assets ż '));
  dirs.push(dir);
  const all = {
    'project.json': JSON.stringify({
      version: 1,
      title: 'T',
      language: 'en',
      style,
      fps: 30,
      seed: 1,
    }),
    ...files,
  };
  for (const [relative, content] of Object.entries(all)) {
    const file = path.join(dir, ...relative.split('/'));
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, content, 'utf8');
  }
  return dir;
}

describe('lookAssetList', () => {
  it('lists the cast by name, then the files the cast does not name', () => {
    expect(
      lookAssetList(CAST, ['assets/comic/keeper.json', 'assets/comic/lighthouse.json']),
    ).toEqual([
      {
        id: 'keeper',
        name: 'The lighthouse keeper',
        kind: 'character',
        file: 'assets/comic/keeper.json',
      },
      { id: 'lighthouse', name: 'lighthouse', kind: null, file: 'assets/comic/lighthouse.json' },
    ]);
    expect(lookAssetList(null, [])).toEqual([]);
  });
});

describe('storyboardChangedSince', () => {
  it('compares the storyboard the set was designed for with the one on disk', () => {
    expect(storyboardChangedSince(report(STORYBOARD), STORYBOARD)).toBe(false);
    expect(storyboardChangedSince(report(STORYBOARD), `${STORYBOARD}\n`)).toBe(true);
    expect(storyboardChangedSince(null, STORYBOARD)).toBe(false);
    expect(storyboardChangedSince(report(STORYBOARD), null)).toBe(false);
  });
});

describe('readLookAssets', () => {
  it('reads the report, the cast and the asset folder of a world film', async () => {
    const dir = project('comic', {
      'storyboard.json': STORYBOARD,
      '.reelforge/world-assets.json': JSON.stringify(report(STORYBOARD)),
      'assets/cast.json': JSON.stringify(CAST),
      'assets/comic/keeper.json': '{}',
      'assets/comic/lighthouse.json': '{}',
      'assets/comic/notes.txt': 'not an asset',
    });
    const look = await readLookAssets(dir, 'comic');
    expect(look).toMatchObject({ world: 'comic', storyboardChanged: false });
    expect(look?.report?.status).toBe('warning');
    expect(look?.assets.map((asset) => asset.name)).toEqual([
      'The lighthouse keeper',
      'lighthouse',
    ]);
  });

  it('is empty before the first design and null for other styles', async () => {
    const dir = project('comic', {});
    expect(await readLookAssets(dir, 'comic')).toEqual({
      world: 'comic',
      report: null,
      storyboardChanged: false,
      assets: [],
    });
    expect(await readLookAssets(dir, 'voxel-pixel-crisp640')).toBeNull();
    expect(await readLookAssets(dir, undefined)).toBeNull();
  });

  it('reaches the panels through the stage reports (voxel projects: none)', async () => {
    const world = project('sketchbook', {});
    expect((await readStageReports(world)).lookAssets).toMatchObject({ world: 'sketchbook' });
    const voxel = project('voxel-pixel-crisp640', {});
    expect(await readStageReports(voxel)).toMatchObject({ lookAssets: null, voiceTiming: null });
  });
});
