import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { rememberRecentProject } from '@reelforge/project';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createLogger } from '../logger.js';
import { OverviewService, thumbnailTarget, type PictureInfo } from './overview-service.js';
import { ProjectLibrary } from './project-library.js';

const AT = '2026-10-09T10:00:00.000Z';

let root: string;
let recentFile: string;
let picked: string | undefined;
let shown: string[];
let commits: { message: string; paths: readonly string[] }[];

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'reelforge overview ś-'));
  recentFile = path.join(root, 'user data', 'recent-projects.json');
  picked = undefined;
  shown = [];
  commits = [];
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true, maxRetries: 5 });
});

async function writeJson(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value, null, 2));
}

async function project(name: string, extra: Record<string, unknown> = {}): Promise<string> {
  const dir = path.join(root, 'Projects', name);
  await writeJson(path.join(dir, 'project.json'), {
    version: 1,
    title: name,
    language: 'en',
    style: 'voxel-pixel-crisp640',
    fps: 30,
    seed: 7,
    ...extra,
  });
  await rememberRecentProject(recentFile, { dir, title: name });
  return dir;
}

/** Pictures are "<width>x<height>" text files in these tests. */
async function readPicture(file: string): Promise<PictureInfo | null> {
  const match = /^(\d+)x(\d+)$/.exec(await readFile(file, 'utf8'));
  if (match === null) return null;
  return {
    dataUrl: `data:${path.basename(file)}`,
    width: Number(match[1]),
    height: Number(match[2]),
  };
}

function service(): OverviewService {
  const log = createLogger(() => undefined);
  const library = new ProjectLibrary({
    recentFile,
    openKnown: () => Promise.resolve({ status: 'cancelled' }),
    currentDir: () => undefined,
    openPath: () => Promise.resolve(''),
    commit: () => Promise.resolve(true),
    log,
  });
  return new OverviewService({
    library,
    picture: readPicture,
    pickImage: () => Promise.resolve(picked),
    showItem: (file) => {
      shown.push(file);
    },
    commit: (_dir, message, paths) => {
      commits.push({ message, paths });
      return Promise.resolve(true);
    },
    log,
  });
}

describe('OverviewService', () => {
  it('reads a film with its thumbnail, facts and Shorts', async () => {
    const film = await project('Heist night');
    await writeFile(path.join(film, 'script.txt'), 'Once upon a vault.');
    await mkdir(path.join(film, 'publish'));
    await writeFile(path.join(film, 'publish', 'thumbnail.jpg'), '1280x720');
    await writeJson(path.join(film, '.reelforge', 'voiceover.json'), {
      version: 1,
      file: 'audio/vo.original.wav',
      sha256: 'a'.repeat(64),
      sourceName: 'elevenlabs-voiceover.wav',
      importedAt: AT,
      durationS: 60,
    });
    await writeJson(path.join(film, 'storyboard.json'), { shots: [{ t1: 30 }, { t1: 61 }] });
    await mkdir(path.join(film, 'scenes'));
    await writeFile(path.join(film, 'scenes', 's1.js'), '');
    await mkdir(path.join(film, 'out'));
    await writeFile(path.join(film, 'out', 'heist.mp4'), 'mp4');
    const short = (lengthS: number): Record<string, unknown> => ({
      kind: 'short',
      format: 'portrait',
      parentProject: { folder: film, title: 'Heist night' },
      short: { lengthS, captions: false, endCardText: 'Full video on YT: Crime' },
    });
    await project('Heist short 60', short(60));
    const short30 = await project('Heist short 30', short(30));

    const result = await service().overview(film);
    if (result.status !== 'ok') throw new Error(result.message);
    const { overview } = result;
    expect(overview.card).toMatchObject({ kind: 'film', hasScript: true, durationS: 61 });
    expect(overview.thumbnail).toEqual({
      fileName: 'thumbnail.jpg',
      picture: 'data:thumbnail.jpg',
      width: 1280,
      height: 720,
      bytes: 8,
    });
    expect(overview.facts).toMatchObject({
      voice: 'elevenlabs',
      shots: 2,
      scenesBuilt: 1,
      exportFile: 'heist.mp4',
    });
    expect(overview.shortsSupported).toBe(true);
    expect(overview.parent).toBeNull();
    expect(overview.shorts.map((entry) => entry.short?.lengthS)).toEqual([30, 60]);

    const ofShort = await service().overview(short30);
    if (ofShort.status !== 'ok') throw new Error(ofShort.message);
    expect(ofShort.overview.card).toMatchObject({
      kind: 'short',
      parentDir: path.resolve(film),
      parentTitle: 'Heist night',
      short: { lengthS: 30, captions: false, endCardText: 'Full video on YT: Crime' },
    });
    expect(ofShort.overview.parent).toEqual({ dir: film, title: 'Heist night', known: true });
    expect(ofShort.overview.shorts).toEqual([]);
    expect(ofShort.overview.facts.voice).toBe('none');
  });

  it('refuses folders that are not in the Home list', async () => {
    const result = await service().overview(path.join(root, 'elsewhere'));
    expect(result).toEqual({
      status: 'error',
      message: 'This project is not in your list any more.',
    });
    expect(await service().uploadThumbnail(path.join(root, 'elsewhere'))).toMatchObject({
      status: 'error',
    });
  });

  it('uploads, replaces and removes the one thumbnail', async () => {
    const film = await project('Comic film', { style: 'game-b1' });
    const overview = service();
    expect(await overview.uploadThumbnail(film)).toEqual({ status: 'cancelled' });

    picked = path.join(root, 'picked.png');
    await writeFile(picked, '640x360');
    const first = await overview.uploadThumbnail(film);
    if (first.status !== 'ok') throw new Error('upload failed');
    expect(first.overview.thumbnail).toMatchObject({ fileName: 'thumbnail.png', width: 640 });
    expect(first.overview.shortsSupported).toBe(false);

    picked = path.join(root, 'better.JPEG');
    await writeFile(picked, '1280x720');
    const second = await overview.uploadThumbnail(film);
    if (second.status !== 'ok') throw new Error('replace failed');
    expect(second.overview.thumbnail).toMatchObject({ fileName: 'thumbnail.jpg', width: 1280 });
    expect(existsSync(path.join(film, 'publish', 'thumbnail.png'))).toBe(false);
    expect(existsSync(path.join(film, 'publish', 'thumbnail.jpg.tmp'))).toBe(false);

    const removed = await overview.removeThumbnail(film);
    if (removed.status !== 'ok') throw new Error('remove failed');
    expect(removed.overview.thumbnail).toBeNull();
    expect(commits.map((commit) => commit.message)).toEqual([
      'Thumbnail uploaded',
      'Thumbnail uploaded',
      'Thumbnail removed',
    ]);
    expect(commits[0]?.paths).toContain('publish/thumbnail.png');
  });

  it('refuses files that are not PNG or JPEG pictures', async () => {
    const film = await project('Picky');
    picked = path.join(root, 'notes.txt');
    await writeFile(picked, '1280x720');
    expect(await service().uploadThumbnail(film)).toEqual({
      status: 'error',
      message: 'Pick a PNG or JPEG picture.',
    });
    picked = path.join(root, 'broken.png');
    await writeFile(picked, 'not a picture');
    expect(await service().uploadThumbnail(film)).toEqual({
      status: 'error',
      message: 'This file is not a PNG or JPEG picture.',
    });
    expect(commits).toEqual([]);
  });

  it('shows the newest export in its folder', async () => {
    const film = await project('Exported');
    expect(await service().showExport(film)).toEqual({
      status: 'error',
      message: 'There is no export yet.',
    });
    await mkdir(path.join(film, 'out'));
    await writeFile(path.join(film, 'out', 'final.mp4'), 'mp4');
    expect(await service().showExport(film)).toEqual({ status: 'ok' });
    expect(shown).toEqual([path.join(film, 'out', 'final.mp4')]);
  });
});

describe('thumbnailTarget', () => {
  it('keeps PNG and JPEG (as .jpg) only', () => {
    expect(thumbnailTarget('C:\\a\\b.PNG')).toBe('publish/thumbnail.png');
    expect(thumbnailTarget('/x/y.jpeg')).toBe('publish/thumbnail.jpg');
    expect(thumbnailTarget('/x/y.webp')).toBeUndefined();
  });
});
