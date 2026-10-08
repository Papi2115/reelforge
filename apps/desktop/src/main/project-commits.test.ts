import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { autocommit, initRepository, runGit } from '@reelforge/project';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLogger } from './logger.js';
import { madeCommit, manualCommitter } from './project-commits.js';

// Each case spawns git several times; Windows is slow at process creation.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

let root: string;
let dir: string;
let previousEnv: NodeJS.ProcessEnv;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'reelforge commits ż-'));
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
  await writeFile(path.join(dir, 'tension.json'), '{}');
  const first = await autocommit(dir, 'Start', { kind: 'manual' });
  if (!first.ok) throw new Error(first.error.message);
});

afterEach(async () => {
  process.env = previousEnv;
  await rm(root, { recursive: true, force: true, maxRetries: 5 });
});

describe('manualCommitter', () => {
  it('commits only the given paths; another writer keeps its unfinished file', async () => {
    const lines: string[] = [];
    const commit = manualCommitter(createLogger((line) => lines.push(line)));
    await writeFile(path.join(dir, 'tension.json'), '{"version":1}');
    await writeFile(path.join(dir, 'scenes', 's04.js'), 'export default (t'); // a scene build
    const committed = await commit(dir, 'Tension: edited', 'tension', ['tension.json']);
    expect(madeCommit(committed)).toBe(true);
    const shown = await runGit(dir, ['show', '--name-only', '--format=%B', 'HEAD']);
    expect(shown.ok && shown.value.stdout).toContain('ReelForge-Step: tension');
    expect(shown.ok && shown.value.stdout.trim().split('\n').at(-1)).toBe('tension.json');
    const status = await runGit(dir, ['status', '--porcelain', '--untracked-files=all']);
    expect(status.ok && status.value.stdout.trim()).toBe('?? scenes/s04.js');
    expect(madeCommit(await commit(dir, 'Tension: same', 'tension', ['tension.json']))).toBe(false);
    expect(lines).toEqual([]);
  });

  it('logs a failed commit and reports it as not made', async () => {
    const lines: string[] = [];
    const commit = manualCommitter(createLogger((line) => lines.push(line)));
    const failed = await commit(path.join(root, 'missing'), 'Edit', 'script', ['script.txt']);
    expect(failed.ok).toBe(false);
    expect(madeCommit(failed)).toBe(false);
    expect(lines.some((line) => line.includes('autocommit "Edit" failed'))).toBe(true);
  });
});
