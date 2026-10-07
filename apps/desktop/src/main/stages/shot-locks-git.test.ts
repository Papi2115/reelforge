/**
 * Shot locks against a real git repo: each lock / unlock is its own commit holding locks.json as
 * it was written by that change, also when the user toggles again before the previous commit is
 * done (Shift+L twice), and a revert to a lock commit restores the lock.
 */
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { autocommit, initRepository, revertTo, runGit } from '@reelforge/project';
import { shotLocksFileSchema } from '@reelforge/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLogger } from '../logger.js';
import { manualCommitter } from '../project-commits.js';
import { lockShots } from './shot-locks.js';

// Each case spawns git many times; Windows is slow at process creation.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 30_000 });

const NOW = new Date('2026-10-03T10:00:00.000Z');
const STORYBOARD = {
  version: 1,
  shots: [
    { id: 's01', scene: 'scenes/s01_title.js' },
    { id: 's02', scene: 'scenes/s02_calc.js' },
  ],
};

let root: string;
let dir: string;
let previousEnv: NodeJS.ProcessEnv;
const logLines: string[] = [];
const committer = manualCommitter(createLogger((line) => logLines.push(line)));
const commit = async (target: string, message: string, paths: readonly string[]): Promise<void> => {
  await committer(target, message, 'locks', paths);
};

async function git(args: readonly string[]): Promise<string> {
  const run = await runGit(dir, args, {});
  if (!run.ok) throw new Error(run.error.message);
  return run.value.stdout.trim();
}

/** Locked shot ids in locks.json as committed by `revision`. */
async function lockedAt(revision: string): Promise<string[]> {
  const text = await git(['show', `${revision}:locks.json`]);
  return shotLocksFileSchema.parse(JSON.parse(text)).shots.map((entry) => entry.shotId);
}

async function lockedOnDisk(): Promise<string[]> {
  const text = await readFile(path.join(dir, 'locks.json'), 'utf8');
  return shotLocksFileSchema.parse(JSON.parse(text)).shots.map((entry) => entry.shotId);
}

function toggle(shotId: string, locked: boolean): ReturnType<typeof lockShots> {
  return lockShots({ dir, shotIds: [shotId], locked, now: NOW, commit });
}

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'reelforge locks git ż-'));
  const globalConfig = path.join(root, 'global.gitconfig');
  await writeFile(globalConfig, '');
  // manualCommitter uses the process env (as in the app): isolate git from the user's config.
  previousEnv = { ...process.env };
  process.env['GIT_CONFIG_GLOBAL'] = globalConfig;
  process.env['GIT_CONFIG_NOSYSTEM'] = '1';
  dir = path.join(root, 'My film');
  await mkdir(path.join(dir, 'scenes'), { recursive: true });
  const init = await initRepository(dir);
  if (!init.ok) throw new Error(init.error.message);
  await writeFile(path.join(dir, 'storyboard.json'), JSON.stringify(STORYBOARD));
  await writeFile(path.join(dir, 'scenes', 's01_title.js'), '// s01\n');
  await writeFile(path.join(dir, 'scenes', 's02_calc.js'), '// s02\n');
  const first = await autocommit(dir, 'Fixture', { kind: 'manual' });
  if (!first.ok) throw new Error(first.error.message);
  logLines.length = 0;
});

afterEach(async () => {
  process.env = previousEnv;
  await rm(root, { recursive: true, force: true, maxRetries: 5 });
});

describe('lockShots with git', () => {
  it('commits lock and unlock with locks.json, also when toggled before the commit is done', async () => {
    // Shift+L twice in quick succession: the unlock starts while the lock is still committing.
    const lock = toggle('s01', true);
    const unlock = toggle('s01', false);
    expect(await lock).toEqual({ status: 'ok', message: null });
    expect(await unlock).toEqual({ status: 'ok', message: null });
    expect(await toggle('s02', true)).toEqual({ status: 'ok', message: null });
    expect((await git(['log', '--format=%s'])).split('\n')).toEqual([
      'Lock shot s02',
      'Unlock shot s01',
      'Lock shot s01',
      'Fixture',
    ]);
    expect(await lockedAt('HEAD~2')).toEqual(['s01']);
    expect(await lockedAt('HEAD~1')).toEqual([]);
    expect(await lockedAt('HEAD')).toEqual(['s02']);
    expect(await git(['show', '--format=', '--name-only', 'HEAD~1'])).toBe('locks.json');
    expect(await git(['status', '--porcelain'])).toBe('');
    expect(logLines).toEqual([]);
  });

  it('a revert to the lock commit brings the lock back', async () => {
    await toggle('s01', true);
    const lockCommit = await git(['rev-parse', 'HEAD']);
    await toggle('s01', false);
    expect(await lockedOnDisk()).toEqual([]);
    const reverted = await revertTo(dir, lockCommit);
    expect(reverted.ok && reverted.value.status).toBe('reverted');
    expect(await lockedOnDisk()).toEqual(['s01']);
    expect(await lockedAt('HEAD')).toEqual(['s01']);
  });
});
