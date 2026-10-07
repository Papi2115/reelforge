import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { autocommit, initRepository, runGit, type GitOptions } from '@reelforge/project';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { changedFiles, commitChatTurn, sceneFilesOf } from './turn-commit.js';

// Each case spawns git several times; Windows is slow at process creation.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

let root: string;
let dir: string;
let git: GitOptions;

async function put(relative: string, text: string): Promise<void> {
  const file = path.join(dir, ...relative.split('/'));
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, text);
}

async function gitLines(args: readonly string[]): Promise<string[]> {
  const result = await runGit(dir, args, git);
  if (!result.ok) throw new Error(result.error.message);
  return result.value.stdout.split('\n').filter((line) => line !== '');
}

const shot = (id: string, scene: string) => ({
  id,
  t0: 0,
  t1: 5,
  treatment: 'metaphor-object',
  intent: 'x',
  scene,
});

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'reelforge turn ż-'));
  const globalConfig = path.join(root, 'global.gitconfig');
  await writeFile(globalConfig, '');
  git = { env: { ...process.env, GIT_CONFIG_GLOBAL: globalConfig, GIT_CONFIG_NOSYSTEM: '1' } };
  dir = path.join(root, 'My film');
  await mkdir(dir);
  const init = await initRepository(dir, git);
  if (!init.ok) throw new Error(init.error.message);
  await put('.gitignore', '.reelforge/\n');
  await put(
    'storyboard.json',
    JSON.stringify({
      version: 1,
      shots: [shot('s01', 'scenes/s01.js'), shot('s02', 'scenes/Shot Two.js')],
    }),
  );
  await put('scenes/s01.js', 'export default 1;\n');
  const first = await autocommit(dir, 'Start', { kind: 'manual', git });
  if (!first.ok) throw new Error(first.error.message);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true, maxRetries: 5 });
});

describe('commitChatTurn', () => {
  it('commits every change of the turn but leaves a scene still being built uncommitted', async () => {
    await put('scenes/s01.js', 'export default 2;\n'); // Claude's edit in the turn
    await put('notes.md', 'chat\n'); // a new file of the turn
    await put('scenes/Shot Two.js', 'export default (t) => '); // half-written by the scene build
    await put('.reelforge/cache.json', '{}'); // ignored app state
    const committed = await commitChatTurn(dir, 'Chat: tweak s01', {
      shotsInProgress: ['s02'],
      git,
    });
    expect(committed.ok && committed.value.status).toBe('committed');
    expect((await gitLines(['show', '--name-only', '--format=', 'HEAD'])).sort()).toEqual([
      'notes.md',
      'scenes/s01.js',
    ]);
    expect(await gitLines(['status', '--porcelain', '--untracked-files=all'])).toEqual([
      '?? "scenes/Shot Two.js"',
    ]);
  });

  it('commits everything when no scene is being built', async () => {
    await put('scenes/s01.js', 'export default 3;\n');
    await put('scenes/Shot Two.js', 'export default 1;\n');
    const committed = await commitChatTurn(dir, 'Chat: both', { shotsInProgress: [], git });
    expect(committed.ok && committed.value.status).toBe('committed');
    expect((await gitLines(['show', '--name-only', '--format=', 'HEAD'])).sort()).toEqual([
      'scenes/Shot Two.js',
      'scenes/s01.js',
    ]);
  });

  it('makes no commit when only the scene being built changed', async () => {
    await put('scenes/Shot Two.js', 'export default (t) => ');
    const committed = await commitChatTurn(dir, 'Chat: nothing', {
      shotsInProgress: ['s02'],
      git,
    });
    expect(committed).toEqual({ ok: true, value: { status: 'nothing-to-commit' } });
  });

  it('commits a deletion made by the turn', async () => {
    await rm(path.join(dir, 'scenes', 's01.js'));
    await put('scenes/Shot Two.js', 'export default (t) => ');
    const committed = await commitChatTurn(dir, 'Chat: drop s01', {
      shotsInProgress: ['s02'],
      git,
    });
    expect(committed.ok && committed.value.status).toBe('committed');
    expect(await gitLines(['show', '--name-status', '--format=', 'HEAD'])).toEqual([
      'D\tscenes/s01.js',
    ]);
  });
});

describe('changedFiles / sceneFilesOf', () => {
  it('lists changed and untracked files (not ignored ones), names with spaces intact', async () => {
    await put('scenes/Shot Two.js', 'x');
    await put('scenes/s01.js', 'y');
    await put('.reelforge/x.json', '{}');
    const changed = await changedFiles(dir, git);
    expect(changed.ok && [...changed.value].sort()).toEqual([
      'scenes/Shot Two.js',
      'scenes/s01.js',
    ]);
  });

  it('maps shots to their scene files, with the conventional path as fallback', async () => {
    expect(await sceneFilesOf(dir, ['s02', 's09'])).toEqual([
      'scenes/Shot Two.js',
      'scenes/s09.js',
    ]);
    expect(await sceneFilesOf(path.join(root, 'nowhere'), ['s01'])).toEqual(['scenes/s01.js']);
    expect(await sceneFilesOf(dir, [])).toEqual([]);
  });
});
