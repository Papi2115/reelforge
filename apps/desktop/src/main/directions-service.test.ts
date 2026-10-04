/**
 * Live co-direction in main (PLAN.md#12.14): directions.json written atomically and committed per
 * command, locked shots refused, and the preview/export manifest carrying the directions.
 */
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { directionsFileSchema, parseDirectionCommand } from '@reelforge/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { directionCommitSubject, DirectionsService } from './directions-service.js';
import { createLogger } from './logger.js';
import { buildProjectManifest } from './project-manifest.js';

const PROJECT = {
  version: 1,
  title: 'Directed',
  language: 'en',
  style: 'voxel-pixel-crisp640',
  fps: 30,
  seed: 7,
};
const SCENE =
  'export const meta = { id: "s" };\nexport function build() { return null; }\nexport function update() {}\n';
const STORYBOARD = {
  version: 1,
  shots: [
    { id: 's01', t0: 0, t1: 4, treatment: 'title-card', intent: 'x', scene: 'scenes/s01.js' },
    { id: 's02', t0: 4, t1: 9, treatment: 'title-card', intent: 'x', scene: 'scenes/s02.js' },
  ],
};
const WORDS = {
  version: 1,
  words: [
    { text: 'Light', t: 0.5, tEnd: 0.9 },
    { text: 'bends', t: 4.5, tEnd: 5 },
  ],
};

let root: string;
let commits: string[];
let service: DirectionsService;

async function write(relative: string, value: unknown): Promise<void> {
  const file = path.join(root, ...relative.split('/'));
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, typeof value === 'string' ? value : JSON.stringify(value, null, 2));
}

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'reelforge directions ż-'));
  commits = [];
  service = new DirectionsService({
    projectDir: () => root,
    commit: (message) => {
      commits.push(message);
      return Promise.resolve(true);
    },
    log: createLogger(() => undefined),
  });
  await write('project.json', PROJECT);
  await write('storyboard.json', STORYBOARD);
  await write('timing/words.json', WORDS);
  await write('scenes/s01.js', SCENE);
  await write('scenes/s02.js', SCENE);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true, maxRetries: 5 });
});

describe('DirectionsService', () => {
  it('writes directions.json and commits each command', async () => {
    expect(await service.state()).toEqual({
      status: 'ok',
      directions: { version: 1, shots: {} },
      locked: [],
    });
    const result = await service.apply({
      shotId: 's02',
      next: { dim: -0.25 },
      command: 'ciemniej',
    });
    expect(result).toEqual({
      status: 'ok',
      directions: { version: 1, shots: { s02: { dim: -0.25 } } },
      committed: true,
    });
    const onDisk = directionsFileSchema.parse(
      JSON.parse(await readFile(path.join(root, 'directions.json'), 'utf8')),
    );
    expect(onDisk.shots).toEqual({ s02: { dim: -0.25 } });
    expect(commits).toEqual(['Direction s02: ciemniej']);
    // The same direction again changes nothing and makes no commit.
    const again = await service.apply({ shotId: 's02', next: { dim: -0.25 }, command: 'x' });
    expect(again).toMatchObject({ status: 'ok', committed: false });
    expect(commits).toHaveLength(1);
    const cleared = await service.apply({ shotId: 's02', next: null, command: 'reset' });
    expect(cleared).toMatchObject({ directions: { shots: {} }, committed: true });
  });

  it('refuses a locked shot and leaves it untouched', async () => {
    await write('locks.json', {
      version: 1,
      shots: [{ shotId: 's01', lockedAt: '2026-10-04T10:00:00.000Z' }],
    });
    const parsed = parseDirectionCommand('slower', {
      shot: { id: 's01', t0: 0, t1: 4 },
      current: undefined,
      words: WORDS.words,
      playhead: 1,
    });
    if (parsed.kind !== 'direction') throw new Error('expected a direction');
    const result = await service.apply({
      shotId: 's01',
      next: parsed.next ?? null,
      command: 'slower',
    });
    expect(result).toEqual({
      status: 'locked',
      shotId: 's01',
      message: 's01 is locked: unlock this shot to direct it',
    });
    expect(commits).toEqual([]);
    await expect(readFile(path.join(root, 'directions.json'), 'utf8')).rejects.toThrow();
    expect(await service.state()).toMatchObject({ locked: ['s01'] });
  });

  it('reports an invalid directions.json instead of overwriting it', async () => {
    await write('directions.json', { version: 1, shots: { s01: { zoom: 9 } } });
    expect(await service.apply({ shotId: 's01', next: { dim: 1 }, command: 'x' })).toMatchObject({
      status: 'error',
    });
  });

  it('merges directions into the preview/export manifest (only storyboard shots)', async () => {
    await service.apply({ shotId: 's02', next: { zoom: 1.2 }, command: 'zoom in' });
    await write('directions.json', {
      version: 1,
      shots: { gone: { dim: 1 }, s02: { zoom: 1.2 } },
    });
    const built = await buildProjectManifest(root);
    if (built.status !== 'ready') throw new Error(built.status);
    expect(built.manifest.shots.map((shot) => shot.direction)).toEqual([undefined, { zoom: 1.2 }]);
    expect('direction' in (built.manifest.shots[0] ?? {})).toBe(false);
  });

  it('cuts long commit subjects', () => {
    expect(directionCommitSubject('s01', 'a\n b')).toBe('Direction s01: a b');
    expect(directionCommitSubject('s01', 'x'.repeat(100))).toHaveLength(72);
  });
});
