/**
 * The user's own files (PLAN.md#12.12): import by content (magic bytes), dedupe by sha256, licence
 * `own` (verified, never credited), editable title/description, removal; `reelforge assets list`
 * shows them with their description. No network anywhere.
 */
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { assetsFileSchema } from '@reelforge/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { copyFixtureProject, runCli, type TempProject } from '../testing/fixture.js';
import { creditsMarkdown } from './credits.js';
import { editAssetText, importOwnAsset, verifyMediaBytes } from './own.js';
import { removeFromCatalogue } from './store.js';
import { tinyMp4, tinyPng } from './testing/server.js';

const NOW = (): Date => new Date('2026-10-04T12:00:00.000Z');

let project: TempProject;
let inbox: string;

beforeEach(async () => {
  project = await copyFixtureProject();
  inbox = await mkdtemp(path.join(tmpdir(), 'reelforge own ż '));
});

afterEach(async () => {
  await project.remove();
  await rm(inbox, { recursive: true, force: true });
});

async function userFile(name: string, bytes: Buffer): Promise<string> {
  const file = path.join(inbox, name);
  await writeFile(file, bytes);
  return file;
}

async function catalogue(): Promise<ReturnType<typeof assetsFileSchema.parse>> {
  return assetsFileSchema.parse(
    JSON.parse(await readFile(path.join(project.root, 'assets.json'), 'utf8')),
  );
}

describe('own assets', () => {
  it('imports an image as an own, verified, approved asset with its size and a description', async () => {
    const file = await userFile('Nokia_3310-front.png', tinyPng(32, 24));
    const outcome = await importOwnAsset(project.root, { file }, 'off', NOW);
    expect(outcome.existing).toBe(false);
    expect(outcome.record).toMatchObject({
      id: 'own-nokia-3310-front',
      kind: 'image',
      source: 'own',
      licence: { id: 'own', url: null, verified: true },
      approved: true,
      mode: 'off',
      width: 32,
      height: 24,
      title: 'Nokia_3310-front',
      description: 'Nokia 3310 front',
      file: '.reelforge/assets/own-nokia-3310-front.png',
      fetchedAt: '2026-10-04T12:00:00.000Z',
    });
    expect(
      existsSync(path.join(project.root, '.reelforge', 'assets', 'own-nokia-3310-front.png')),
    ).toBe(true);
    expect((await catalogue()).assets).toEqual([outcome.record]);
  });

  it('stores the same bytes once and gives a second file with the same name a new id', async () => {
    const first = await importOwnAsset(
      project.root,
      { file: await userFile('logo.png', tinyPng(8, 8)) },
      'ask',
      NOW,
    );
    const again = await importOwnAsset(
      project.root,
      { file: await userFile('copy of logo.png', tinyPng(8, 8)) },
      'ask',
      NOW,
    );
    expect(again).toEqual({ record: first.record, existing: true });
    const otherDir = await mkdtemp(path.join(inbox, 'c'));
    await writeFile(path.join(otherDir, 'logo.png'), tinyPng(9, 9));
    const second = await importOwnAsset(
      project.root,
      { file: path.join(otherDir, 'logo.png'), title: 'Logo v2', description: 'the blue logo' },
      'ask',
      NOW,
    );
    expect(second.record).toMatchObject({ id: 'own-logo-2', title: 'Logo v2' });
    expect(second.record.description).toBe('the blue logo');
    expect((await catalogue()).assets.map((asset) => asset.id)).toEqual(['own-logo', 'own-logo-2']);
  });

  it('accepts videos by content and refuses files that only look like media', async () => {
    const video = await importOwnAsset(
      project.root,
      { file: await userFile('clip.mp4', tinyMp4()) },
      'off',
      NOW,
    );
    expect(video.record).toMatchObject({ kind: 'video', mime: 'video/mp4', width: null });
    const fake = await userFile('photo.png', Buffer.from('<svg onload="alert(1)"></svg>'));
    await expect(importOwnAsset(project.root, { file: fake }, 'off', NOW)).rejects.toThrow(
      /not an allowed media file/,
    );
    const script = await userFile('run.bat', Buffer.from('echo hi'));
    await expect(importOwnAsset(project.root, { file: script }, 'off', NOW)).rejects.toThrow(
      /only png, jpg/,
    );
    const huge = Buffer.concat([tinyPng(1, 1), Buffer.alloc(26 * 1024 * 1024)]);
    expect(() => verifyMediaBytes(huge, 'huge.png')).toThrow(/too large/);
    expect((await catalogue()).assets.map((asset) => asset.id)).toEqual(['own-clip']);
  });

  it('edits the title and description (cleaned) and removes an asset with its file', async () => {
    const { record } = await importOwnAsset(
      project.root,
      { file: await userFile('desk.png', tinyPng(4, 4)) },
      'off',
      NOW,
    );
    const edited = await editAssetText(project.root, record.id, {
      title: 'My <b>desk</b>',
      description: 'the desk‮ at night',
    });
    expect(edited).toMatchObject({ title: 'My desk', description: 'the desk at night' });
    const cleared = await editAssetText(project.root, record.id, { description: '' });
    expect(cleared.description).toBeUndefined();
    await expect(editAssetText(project.root, 'nope', { title: 'x' })).rejects.toThrow(/no asset/);
    expect((await removeFromCatalogue(project.root, record.id))?.id).toBe(record.id);
    expect(existsSync(path.join(project.root, record.file))).toBe(false);
    expect((await catalogue()).assets).toEqual([]);
  });

  it('never credits own files and lists them with their description', async () => {
    const { record } = await importOwnAsset(
      project.root,
      { file: await userFile('nokia.png', tinyPng(4, 4)), description: 'my Nokia on the desk' },
      'off',
      NOW,
    );
    expect(creditsMarkdown([record])).toBe('Credits\n\n(no external assets used)\n');
    const list = await runCli(project.root, 'assets', 'list');
    expect(list.code).toBe(0);
    expect(list.stdout).toContain("1 are the user's own files");
    expect(list.stdout).toContain('- own-nokia  image image/png 4x4');
    expect(list.stdout).toContain("the user's own file  licence own");
    expect(list.stdout).toContain('description: "my Nokia on the desk"');
    const credits = await runCli(project.root, 'assets', 'credits', '--all');
    expect(credits.stdout).toContain('credits for 0 assets');
    expect(credits.stdout).toContain('(no external assets used)');
  });
});

describe('reelforge validate: assigned assets', () => {
  it('rejects shot asset ids that are not in assets.json', async () => {
    await importOwnAsset(
      project.root,
      { file: await userFile('desk.png', tinyPng(4, 4)) },
      'off',
      NOW,
    );
    const file = path.join(project.root, 'storyboard.json');
    const storyboard = JSON.parse(await readFile(file, 'utf8')) as {
      shots: Record<string, unknown>[];
    };
    storyboard.shots = storyboard.shots.map((shot, index) => ({
      ...shot,
      assets: index === 0 ? ['own-desk'] : ['own-ghost'],
    }));
    await writeFile(file, JSON.stringify(storyboard, null, 2));
    const run = await runCli(project.root, 'validate');
    expect(run.code).toBe(1);
    expect(run.stdout).toContain('assigns asset "own-ghost", which is not in assets.json');
    expect(run.stdout).not.toContain('"own-desk", which');
  });
});
