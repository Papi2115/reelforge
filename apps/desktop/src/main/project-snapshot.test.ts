import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { listProjectFiles, MAX_PROJECT_FILE_BYTES, readProjectText } from './project-files.js';
import { buildProjectManifest } from './project-manifest.js';
import { readProjectSnapshot } from './project-snapshot.js';

const FIXTURE = path.resolve(
  import.meta.dirname,
  '..',
  '..',
  '..',
  '..',
  'packages',
  'cli',
  'test',
  'fixtures',
  'project',
);

let root: string;
let dir: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'reelforge snapshot ż-'));
  dir = path.join(root, 'Mój film');
  await cp(FIXTURE, dir, { recursive: true });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true, maxRetries: 5 });
});

describe('readProjectSnapshot', () => {
  it('lists pipeline files and parses storyboard, words and cues', async () => {
    await mkdir(path.join(dir, 'audio'));
    await writeFile(path.join(dir, 'audio', 'vo.original.m4a'), 'x');
    await mkdir(path.join(dir, '.git'));
    await writeFile(path.join(dir, '.git', 'HEAD'), 'ref');
    const snapshot = await readProjectSnapshot(dir);
    expect(snapshot.files).toEqual([
      'audio/vo.original.m4a',
      'brief.json',
      'cues.json',
      'project.json',
      'scenes/s01_title.js',
      'scenes/s02_calc.js',
      'script.txt',
      'storyboard.json',
      'timing/words.json',
    ]);
    expect(snapshot.filesTruncated).toBe(false);
    expect(snapshot.storyboard.status).toBe('ok');
    if (snapshot.storyboard.status === 'ok') {
      expect(snapshot.storyboard.data.shots.map((shot) => [shot.id, shot.t0, shot.t1])).toEqual([
        ['s01', 0, 2.2],
        ['s02', 2.2, 7.5],
      ]);
    }
    expect(snapshot.words.status === 'ok' && snapshot.words.data.words[0]).toEqual({
      text: 'Doom',
      t: 0.3,
      tEnd: 0.6,
      confidence: 0.95,
      status: 'exact',
    });
    expect(snapshot.cues).toEqual({
      status: 'ok',
      data: { sfx: [{ t: 3.7, label: 'hit', gainDb: 0 }], ambience: [], music: [] },
    });
  });

  it('reports each broken or missing file on its own', async () => {
    await writeFile(path.join(dir, 'storyboard.json'), '{ "version": 1, "shots": [ }');
    await writeFile(path.join(dir, 'cues.json'), JSON.stringify({ version: 1, sfx: [{ t: -1 }] }));
    await rm(path.join(dir, 'timing'), { recursive: true });
    const snapshot = await readProjectSnapshot(dir);
    expect(snapshot.storyboard).toMatchObject({
      status: 'error',
      error: { kind: 'invalid-json' },
    });
    expect(snapshot.cues).toMatchObject({ status: 'error', error: { kind: 'invalid' } });
    expect(snapshot.cues.status === 'error' && snapshot.cues.error.message).toMatch(
      /^cues\.json: sfx\.0\.t: /,
    );
    expect(snapshot.words).toEqual({ status: 'missing' });
    expect(snapshot.locks).toEqual({ status: 'missing' });
  });

  it('reads the shot locks (locks.json)', async () => {
    const locks = { version: 1, shots: [{ shotId: 's02', lockedAt: '2026-10-03T10:00:00.000Z' }] };
    await writeFile(path.join(dir, 'locks.json'), JSON.stringify(locks));
    const snapshot = await readProjectSnapshot(dir);
    expect(snapshot.locks).toEqual({ status: 'ok', data: locks });
    expect(snapshot.files).toContain('locks.json');
  });

  it('accepts a UTF-8 BOM', async () => {
    await writeFile(
      path.join(dir, 'cues.json'),
      String.fromCharCode(0xfeff) + JSON.stringify({ version: 1 }),
    );
    expect((await readProjectSnapshot(dir)).cues.status).toBe('ok');
  });

  it('throws when the project folder is gone', async () => {
    await expect(readProjectSnapshot(path.join(root, 'nope'))).rejects.toThrow();
  });
});

describe('project file confinement', () => {
  it('refuses paths outside the project, also through links', async () => {
    await writeFile(path.join(root, 'secret.js'), 'secret');
    expect(await readProjectText(dir, '../secret.js')).toMatchObject({
      status: 'error',
      error: { kind: 'outside-project' },
    });
    expect(await readProjectText(dir, path.join(root, 'secret.js'))).toMatchObject({
      error: { kind: 'outside-project' },
    });
    // A junction needs no privileges on Windows (symlinks do).
    await mkdir(path.join(root, 'outside'));
    await writeFile(path.join(root, 'outside', 'leak.js'), 'leak');
    await symlink(path.join(root, 'outside'), path.join(dir, 'linked'), 'junction');
    expect(await readProjectText(dir, 'linked/leak.js')).toMatchObject({
      error: { kind: 'outside-project' },
    });
    await rm(path.join(dir, 'scenes'), { recursive: true });
    await symlink(path.join(root, 'outside'), path.join(dir, 'scenes'), 'junction');
    expect((await listProjectFiles(dir)).files).not.toContain('scenes/leak.js');
  });

  it('refuses folders and oversized files', async () => {
    expect(await readProjectText(dir, 'scenes')).toMatchObject({
      error: { kind: 'unreadable' },
    });
    await writeFile(path.join(dir, 'big.json'), Buffer.alloc(MAX_PROJECT_FILE_BYTES + 1));
    expect(await readProjectText(dir, 'big.json')).toMatchObject({
      error: { kind: 'too-large' },
    });
  });
});

describe('buildProjectManifest', () => {
  it('inlines every scene with project settings and words', async () => {
    const result = await buildProjectManifest(dir);
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    const { manifest } = result;
    expect([manifest.style, manifest.fps, manifest.seed]).toEqual([
      'voxel-pixel-crisp640',
      30,
      2115,
    ]);
    expect(manifest.words?.words.length).toBeGreaterThan(0);
    expect(manifest.shots.map((shot) => [shot.id, shot.scene.file])).toEqual([
      ['s01', 'scenes/s01_title.js'],
      ['s02', 'scenes/s02_calc.js'],
    ]);
    expect(manifest.shots[1]?.transitionIn).toEqual({ type: 'crossfade', duration: 0.4 });
    expect(manifest.shots[0]?.scene.source).toContain('export function build');
    // No `ambientVariation` in project.json: the manifest is exactly as before 2.0.
    expect(manifest.ambientVariation).toBeUndefined();
    expect(manifest.shots.map((shot) => shot.ambient)).toEqual([undefined, undefined]);
  });

  it('turns ambient variation on from project.json with storyboard positions', async () => {
    const file = path.join(dir, 'project.json');
    const project = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>;
    await writeFile(file, JSON.stringify({ ...project, ambientVariation: true }));
    const result = await buildProjectManifest(dir);
    if (result.status !== 'ready') throw new Error(result.status);
    expect(result.manifest.ambientVariation).toEqual({ enabled: true, seed: 2115 });
    // s02 transitions in with a crossfade: a new act.
    expect(result.manifest.shots.map((shot) => shot.ambient)).toEqual([
      { index: 0, act: 0 },
      { index: 1, act: 1 },
    ]);
  });

  it('says why a project cannot be previewed', async () => {
    await rm(path.join(dir, 'scenes', 's02_calc.js'));
    expect(await buildProjectManifest(dir)).toEqual({
      status: 'unavailable',
      reason: 'shot s02: scenes/s02_calc.js is missing',
    });
    await rm(path.join(dir, 'storyboard.json'));
    expect(await buildProjectManifest(dir)).toEqual({ status: 'no-storyboard' });
  });

  it('rejects storyboards the engine cannot play', async () => {
    await writeFile(
      path.join(dir, 'storyboard.json'),
      JSON.stringify({
        version: 1,
        shots: [
          {
            id: 's01',
            t0: 1,
            t1: 2,
            treatment: 'title-card',
            intent: 'x',
            scene: 'scenes/s01_title.js',
          },
        ],
      }),
    );
    const result = await buildProjectManifest(dir);
    expect(result.status === 'unavailable' && result.reason).toMatch(
      /^storyboard cannot be previewed: shots\.0\.t0: shot "s01" must start at 0/,
    );
  });
});
