import { mkdir, mkdtemp, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { rememberRecentProject } from '@reelforge/project';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ProjectOpenResult } from '../../shared/project-contract.js';
import { createLogger } from '../logger.js';
import { ProjectLibrary } from './project-library.js';
import { renameSubject } from './project-rename.js';

const AT = '2026-10-09T10:00:00.000Z';

let root: string;
let recentFile: string;
let pictures: string[];
let opened: string[];
let shown: string[];
let commits: { dir: string; message: string; paths: readonly string[] }[];
let lineDirs: string[];
let current: string | undefined;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'reelforge home ś-'));
  recentFile = path.join(root, 'user data', 'recent-projects.json');
  pictures = [];
  opened = [];
  shown = [];
  commits = [];
  lineDirs = [];
  current = undefined;
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
  return dir;
}

function library(): ProjectLibrary {
  return new ProjectLibrary({
    recentFile,
    lineDirs: () => Promise.resolve(lineDirs),
    thumbnail: (file) => {
      pictures.push(path.basename(file));
      return Promise.resolve(`data:image/jpeg;base64,${path.basename(file)}`);
    },
    openKnown: (dir): Promise<ProjectOpenResult> => {
      opened.push(dir);
      return Promise.resolve({ status: 'cancelled' });
    },
    currentDir: () => current,
    openPath: (dir) => {
      shown.push(dir);
      return Promise.resolve('');
    },
    commit: (dir, message, paths) => {
      commits.push({ dir, message, paths });
      return Promise.resolve(true);
    },
    log: createLogger(() => undefined),
  });
}

describe('ProjectLibrary', () => {
  it('lists the recent projects and the production line films as cards', async () => {
    const film = await project('Heist night', { channelId: 'crime', genrePreset: 'true-crime' });
    await writeJson(path.join(film, '.reelforge', 'pipeline.json'), {
      version: 1,
      updatedAt: AT,
      stages: { script: { status: 'done', updatedAt: AT, approvedAt: AT } },
      queue: [],
    });
    await writeJson(path.join(film, 'storyboard.json'), {
      shots: [{ t1: 12.5 }, { t1: 64.25 }],
    });
    await mkdir(path.join(film, 'publish'));
    await writeFile(path.join(film, 'publish', 'thumbnail.png'), 'png');
    const short = await project('Heist short', { kind: 'short', parentProject: film });
    const gone = path.join(root, 'Projects', 'Gone');
    const line = await project('Line film');
    lineDirs = [line];
    for (const dir of [gone, short, film]) {
      await rememberRecentProject(recentFile, { dir, title: path.basename(dir) });
    }

    const cards = await library().list();
    expect(cards.map((card) => card.title)).toEqual([
      'Heist night',
      'Heist short',
      'Gone',
      'Line film',
    ]);
    const [heist, heistShort, missing, lineFilm] = cards;
    expect(heist).toMatchObject({
      channelId: 'crime',
      genrePreset: 'true-crime',
      style: 'voxel-pixel-crisp640',
      kind: 'film',
      parentDir: null,
      durationS: 64.25,
      thumbnail: 'data:image/jpeg;base64,thumbnail.png',
      exists: true,
      problem: null,
      fromLine: false,
    });
    expect(heist?.steps.slice(0, 2)).toEqual([
      { step: 'script', state: 'done' },
      { step: 'voice', state: 'needs-you' },
    ]);
    expect(heist?.openedAt).not.toBeNull();
    expect(heistShort).toMatchObject({ kind: 'short', parentDir: path.resolve(film) });
    expect(missing).toMatchObject({ exists: false, title: 'Gone', thumbnail: null });
    expect(lineFilm).toMatchObject({ fromLine: true, openedAt: null, title: 'Line film' });
  });

  it('reuses a card until one of its files changes', async () => {
    const film = await project('Cached');
    await mkdir(path.join(film, 'out'));
    await writeFile(path.join(film, 'out', 'thumb.png'), 'png');
    await rememberRecentProject(recentFile, { dir: film, title: 'Cached' });
    const projects = library();

    await projects.list();
    await projects.list();
    expect(pictures).toEqual(['thumb.png']);

    const later = new Date(Date.now() + 60_000);
    await writeJson(path.join(film, 'project.json'), {
      version: 1,
      title: 'Cached again',
      language: 'en',
      style: 'voxel-pixel-crisp640',
      fps: 30,
      seed: 7,
    });
    await utimes(path.join(film, 'project.json'), later, later);
    const [card] = await projects.list();
    expect(card?.title).toBe('Cached again');
    // The picture did not change: it comes from the picture cache.
    expect(pictures).toEqual(['thumb.png']);
  });

  it('acts only on folders of the list', async () => {
    const film = await project('Known');
    await rememberRecentProject(recentFile, { dir: film, title: 'Known' });
    const stranger = await project('Stranger');
    const projects = library();

    expect(await projects.open(stranger)).toMatchObject({ status: 'error' });
    expect(await projects.showFolder(stranger)).toMatchObject({ status: 'error' });
    expect(await projects.rename(stranger, 'Mine now')).toMatchObject({ status: 'error' });
    expect(opened).toEqual([]);
    expect(shown).toEqual([]);

    // Windows paths compare without case.
    await projects.open(process.platform === 'win32' ? film.toUpperCase() : film);
    expect(opened).toEqual([film]);
    expect(await projects.showFolder(film)).toEqual({ status: 'ok' });
    expect(shown).toEqual([film]);
  });

  it('renames a project in project.json, keeping its other fields, and commits it', async () => {
    const film = await project('Old name', { someFutureField: { keep: true } });
    await rememberRecentProject(recentFile, { dir: film, title: 'Old name' });
    const projects = library();

    expect(await projects.rename(film, '  New name  ')).toEqual({ status: 'ok' });
    const saved = JSON.parse(await readFile(path.join(film, 'project.json'), 'utf8')) as Record<
      string,
      unknown
    >;
    expect(saved['title']).toBe('New name');
    expect(saved['someFutureField']).toEqual({ keep: true });
    expect(commits).toEqual([
      { dir: film, message: 'Project renamed: New name', paths: ['project.json'] },
    ]);

    current = film;
    expect(await projects.rename(film, 'Newer')).toEqual({
      status: 'error',
      message: 'Close the project before renaming it.',
    });
  });

  it('keeps commit subjects short', () => {
    expect(renameSubject('x'.repeat(200)).length).toBeLessThanOrEqual(100);
  });
});
