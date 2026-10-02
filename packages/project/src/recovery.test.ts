/**
 * Robustness scenarios (PLAN.md#10.2) at the project level: a damaged tracked file is restored
 * from its last good commit as a new commit, and leftovers of interrupted atomic writes (power
 * loss) are removed on open while the last complete file is kept.
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, utimes, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createProject } from './create.js';
import { history } from './git-history.js';
import { restoreFileFromHistory } from './git-restore.js';
import { autocommit } from './git-repo.js';
import { runGit } from './git-runner.js';
import { isAtomicLeftover, removeAtomicLeftovers } from './leftovers.js';
import { openProject } from './open.js';
import { createGitSandbox, type GitSandbox } from './testing/git-sandbox.js';

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

let sandbox: GitSandbox;
let dir: string;

beforeEach(async () => {
  sandbox = await createGitSandbox();
  dir = path.join(sandbox.root, 'Film ąę recovery');
  const created = await createProject({ dir, title: 'Film', git: sandbox.git });
  if (!created.ok) throw new Error(created.error.message);
});

afterEach(async () => {
  await sandbox.dispose();
});

const file = (relative: string): string => path.join(dir, ...relative.split('/'));

async function write(relative: string, content: string): Promise<void> {
  await mkdir(path.dirname(file(relative)), { recursive: true });
  await writeFile(file(relative), content);
}

async function commit(message: string): Promise<string> {
  const result = await autocommit(dir, message, { kind: 'pipeline-step', git: sandbox.git });
  if (!result.ok) throw new Error(result.error.message);
  if (result.value.status !== 'committed') throw new Error('nothing was committed');
  return result.value.hash;
}

describe('restoreFileFromHistory', () => {
  const GOOD = '{ "version": 1, "shots": [] }\n';

  it('restores a truncated file from the last commit as a new commit, keeping the damage', async () => {
    await write('storyboard.json', GOOD);
    const good = await commit('Storyboard');
    const truncated = '{ "version": 1, "sho';
    await write('storyboard.json', truncated);

    const restored = await restoreFileFromHistory(dir, 'storyboard.json', { git: sandbox.git });
    if (!restored.ok) throw new Error(restored.error.message);
    expect(restored.value).toMatchObject({ status: 'reverted', target: good });
    expect(await readFile(file('storyboard.json'), 'utf8')).toBe(GOOD);

    const list = await history(dir, { git: sandbox.git });
    if (!list.ok) throw new Error(list.error.message);
    expect(list.value[0]?.kind).toBe('revert');
    expect(list.value[0]?.subject).toMatch(
      /^Restore storyboard\.json from [0-9a-f]{7}: Storyboard$/,
    );
    // The damaged content was auto-saved first: nothing is lost.
    expect(list.value[1]?.subject).toBe('Auto-save before revert');
    const status = await runGit(dir, ['status', '--porcelain'], sandbox.git);
    expect(status.ok && status.value.stdout).toBe('');
  });

  it('skips committed versions the validator rejects (a broken file that was committed)', async () => {
    await write('cues.json', GOOD);
    const good = await commit('Cues v1');
    await write('cues.json', '');
    await commit('Cues truncated by a crash');

    const restored = await restoreFileFromHistory(dir, 'cues.json', { git: sandbox.git });
    expect(restored.ok && restored.value).toMatchObject({ status: 'reverted', target: good });
    expect(await readFile(file('cues.json'), 'utf8')).toBe(GOOD);
  });

  it('uses the custom validator (a schema check, not only JSON syntax)', async () => {
    await write('timing/words.json', '{ "version": 1 }\n');
    const good = await commit('Words v1');
    await write('timing/words.json', '{ "version": 99 }\n');
    await commit('Words from the future');

    const restored = await restoreFileFromHistory(dir, 'timing/words.json', {
      git: sandbox.git,
      isValid: (content) => content.includes('"version": 1 '),
    });
    expect(restored.ok && restored.value).toMatchObject({ status: 'reverted', target: good });
  });

  it('fails with not-found when no committed version is valid, and changes nothing', async () => {
    await write('storyboard.json', '{ broken');
    await commit('Broken storyboard');
    const restored = await restoreFileFromHistory(dir, 'storyboard.json', { git: sandbox.git });
    expect(!restored.ok && restored.error.kind).toBe('not-found');
    expect(!restored.ok && restored.error.message).toContain('storyboard.json');
    expect(await readFile(file('storyboard.json'), 'utf8')).toBe('{ broken');
  });

  it('restores project.json so the project opens again', async () => {
    const before = await readFile(file('project.json'), 'utf8');
    await writeFile(file('project.json'), before.slice(0, 20));
    const broken = await openProject(dir, { git: sandbox.git });
    expect(!broken.ok && broken.error).toMatchObject({ kind: 'corrupt' });
    expect(!broken.ok && broken.error.path).toBe(file('project.json'));

    const restored = await restoreFileFromHistory(dir, file('project.json'), { git: sandbox.git });
    expect(restored.ok && restored.value.status).toBe('reverted');
    const opened = await openProject(dir, { git: sandbox.git });
    expect(opened.ok && opened.value.project.title).toBe('Film');
  });

  it('refuses paths outside the project', async () => {
    const restored = await restoreFileFromHistory(dir, '../elsewhere.json', { git: sandbox.git });
    expect(!restored.ok && restored.error.kind).toBe('invalid-argument');
  });
});

describe('interrupted atomic writes (power loss)', () => {
  const OLD = new Date(Date.now() - 10 * 60_000);

  it('recognizes the leftover names of every atomic writer', () => {
    expect(isAtomicLeftover('storyboard.json.0f8fad5b-d9cb-469f-a165-70867728950e.tmp')).toBe(true);
    expect(isAtomicLeftover('cues.json.a1b2c3d4.tmp')).toBe(true);
    expect(isAtomicLeftover('frame.png.12345.tmp')).toBe(true);
    expect(isAtomicLeftover('notes.tmp')).toBe(false);
    expect(isAtomicLeftover('storyboard.json')).toBe(false);
  });

  it('openProject removes old leftovers and keeps the last complete files', async () => {
    const storyboard = '{ "version": 1, "shots": [] }\n';
    await write('storyboard.json', storyboard);
    const leftovers = [
      'storyboard.json.0f8fad5b-d9cb-469f-a165-70867728950e.tmp',
      'timing/words.json.a1b2c3d4.tmp',
      '.reelforge/pipeline.json.1f8fad5b-d9cb-469f-a165-70867728950f.tmp',
    ];
    for (const leftover of leftovers) {
      await write(leftover, '{ "version": 1, "sh');
      await utimes(file(leftover), OLD, OLD);
    }
    const young = 'cues.json.b1b2c3d4.tmp';
    await write(young, '{');

    const opened = await openProject(dir, { git: sandbox.git });
    if (!opened.ok) throw new Error(opened.error.message);
    expect([...opened.value.removedLeftovers].sort()).toEqual([...leftovers].sort());
    for (const leftover of leftovers) expect(existsSync(file(leftover))).toBe(false);
    // A young one may belong to a write in flight.
    expect(existsSync(file(young))).toBe(true);
    expect(await readFile(file('storyboard.json'), 'utf8')).toBe(storyboard);
  });

  it('leaves user files that only look similar alone', async () => {
    await write('notes.tmp', 'mine');
    await utimes(file('notes.tmp'), OLD, OLD);
    const cleanup = await removeAtomicLeftovers(dir);
    expect(cleanup).toEqual({ removed: [], skipped: [] });
    expect(existsSync(file('notes.tmp'))).toBe(true);
  });

  it('a zero-byte project.json (rename done, data lost) is a corrupt error, not a crash', async () => {
    await writeFile(file('project.json'), '');
    const opened = await openProject(dir, { git: sandbox.git });
    expect(!opened.ok && opened.error.kind).toBe('corrupt');
    expect(!opened.ok && opened.error.message).toContain('project.json is not valid JSON');
  });
});
