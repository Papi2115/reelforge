import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ok } from '@reelforge/claude-bridge';
import { listRecentProjects, rememberRecentProject } from '@reelforge/project';
import { DEFAULT_SHORT_ANGLES, MAX_SHORT_ANGLE_LENGTH } from '@reelforge/shared';
import type { CreateShortsRequest } from '@reelforge/stages';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createLogger } from '../logger.js';
import { ProjectLibrary } from './project-library.js';
import { shortAngles, ShortsService } from './shorts-service.js';

let root: string;
let recentFile: string;
let requests: CreateShortsRequest[];
let commits: string[];

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'reelforge shorts ś-'));
  recentFile = path.join(root, 'user data', 'recent-projects.json');
  requests = [];
  commits = [];
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true, maxRetries: 5 });
});

async function project(name: string, extra: Record<string, unknown> = {}): Promise<string> {
  const dir = path.join(root, 'Films', name);
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, 'project.json'),
    JSON.stringify({
      version: 1,
      title: name,
      language: 'en',
      style: 'voxel-pixel-crisp640',
      fps: 30,
      seed: 7,
      channelId: 'crime',
      ...extra,
    }),
  );
  await rememberRecentProject(recentFile, { dir, title: name });
  return dir;
}

function service(): ShortsService {
  const log = createLogger(() => undefined);
  return new ShortsService({
    library: new ProjectLibrary({
      recentFile,
      openKnown: () => Promise.resolve({ status: 'cancelled' }),
      currentDir: () => undefined,
      openPath: () => Promise.resolve(''),
      commit: () => Promise.resolve(true),
      log,
    }),
    channelsFile: path.join(root, 'user data', 'channels.json'),
    recentFile,
    templateDir: path.join(root, 'template'),
    stylesDir: path.join(root, 'styles'),
    createShorts: (request) => {
      requests.push(request);
      const made = ([30, 60] as const).map((lengthS) => ({
        lengthS,
        dir: path.join(request.projectsRoot, `Short ${String(lengthS)}`),
        title: `Short ${String(lengthS)}s`,
        copied: [],
      }));
      return Promise.resolve(ok(made));
    },
    commit: (_dir, message) => {
      commits.push(message);
      return Promise.resolve(true);
    },
    log,
  });
}

describe('shortAngles', () => {
  it('keeps the built-in angles without a hint', () => {
    expect(shortAngles(undefined)).toBeUndefined();
    expect(shortAngles('   ')).toBeUndefined();
  });

  it('steers both built-in angles toward the hint (they stay different)', () => {
    const angles = shortAngles('the vault door');
    expect(angles?.[30]).toBe(`${DEFAULT_SHORT_ANGLES[30]}; steer it toward: the vault door`);
    expect(angles?.[60]?.startsWith(DEFAULT_SHORT_ANGLES[60])).toBe(true);
    expect(angles?.[30]).not.toBe(angles?.[60]);
    expect(shortAngles('x'.repeat(500))?.[60]?.length).toBe(MAX_SHORT_ANGLE_LENGTH);
  });
});

describe('ShortsService', () => {
  it('makes both Shorts next to the film and adds them to the Home list', async () => {
    const film = await project('Heist night');
    await writeFile(path.join(film, 'script.txt'), 'A script.');
    const result = await service().create({ dir: film, captions: true, angleHint: 'the vault' });
    expect(result).toEqual({
      status: 'ok',
      shorts: [
        { dir: path.join(root, 'Films', 'Short 30'), title: 'Short 30s', lengthS: 30 },
        { dir: path.join(root, 'Films', 'Short 60'), title: 'Short 60s', lengthS: 60 },
      ],
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      parentDir: film,
      projectsRoot: path.join(root, 'Films'),
      options: {
        captions: true,
        angles: shortAngles('the vault'),
        create: { templateDir: path.join(root, 'template'), stylesDir: path.join(root, 'styles') },
      },
    });
    const recent = await listRecentProjects(recentFile);
    if (!recent.ok) throw new Error(recent.error.message);
    expect(recent.value.slice(0, 2).map((entry) => [entry.title, entry.channelId])).toEqual([
      ['Short 30s', 'crime'],
      ['Short 60s', 'crime'],
    ]);
  });

  it('refuses a film without a script, a Short and an unknown folder', async () => {
    const film = await project('No script yet');
    expect(await service().create({ dir: film, captions: false })).toEqual({
      status: 'error',
      message: 'The film needs a script first.',
    });
    const short = await project('A short', { kind: 'short' });
    expect(await service().create({ dir: short, captions: false })).toMatchObject({
      status: 'error',
      message: 'A Short is made from a film, not from another Short.',
    });
    expect(await service().create({ dir: path.join(root, 'nope'), captions: false })).toMatchObject(
      { status: 'error' },
    );
    expect(requests).toEqual([]);
  });

  it('switches a Short’s captions in project.json (and refuses a film)', async () => {
    const short = await project('Heist short', {
      kind: 'short',
      format: 'portrait',
      parentProject: { folder: path.join(root, 'Films', 'Heist'), title: 'Heist' },
      short: { lengthS: 30, captions: false, endCardText: 'Full video on YT: Crime' },
    });
    expect(await service().setCaptions(short, true)).toEqual({ status: 'ok' });
    const saved: unknown = JSON.parse(await readFile(path.join(short, 'project.json'), 'utf8'));
    expect(saved).toMatchObject({ title: 'Heist short', short: { lengthS: 30, captions: true } });
    expect(commits).toEqual(['Short captions on']);

    const film = await project('Plain film');
    expect(await service().setCaptions(film, true)).toEqual({
      status: 'error',
      message: 'This project is not a Short.',
    });
  });
});
