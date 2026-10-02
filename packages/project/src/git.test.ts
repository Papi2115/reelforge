import { existsSync } from 'node:fs';
import { mkdir, readFile, utimes, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatCommitMessage } from './commit-message.js';
import { createProject } from './create.js';
import { diffSummary, history, type HistoryEntry } from './git-history.js';
import { autocommit, revertFile, revertTo } from './git-repo.js';
import { runGit } from './git-runner.js';
import { indexLockPath } from './index-lock.js';
import { createGitSandbox, type GitSandbox } from './testing/git-sandbox.js';

// Every case spawns git a dozen times; Windows CI runners are slow at process creation.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

let sandbox: GitSandbox;
let dir: string;

beforeEach(async () => {
  sandbox = await createGitSandbox();
  dir = path.join(sandbox.root, 'Film ąę test');
  const created = await createProject({ dir, title: 'Film', git: sandbox.git });
  if (!created.ok) throw new Error(created.error.message);
});

afterEach(async () => {
  await sandbox.dispose();
});

const SCENE = 'scenes/s01_intro.js';
const sceneFile = (): string => path.join(dir, 'scenes', 's01_intro.js');

async function write(relative: string, content: string): Promise<void> {
  const file = path.join(dir, ...relative.split('/'));
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content);
}

async function commit(message: string, step = 'scenes-built'): Promise<string> {
  const result = await autocommit(dir, message, { kind: 'pipeline-step', step, git: sandbox.git });
  if (!result.ok) throw new Error(result.error.message);
  if (result.value.status !== 'committed') throw new Error('nothing was committed');
  return result.value.hash;
}

async function entries(): Promise<HistoryEntry[]> {
  const result = await history(dir, { git: sandbox.git });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

describe('autocommit + history + revert', () => {
  it('revert restores the scene file content as a new commit', async () => {
    // LF and CRLF must both survive byte for byte (no autocrlf conversion).
    const v1 = 'export const meta = { id: "s01" };\r\n// v1 ż\n';
    await write(SCENE, v1);
    const first = await commit('Scenes built: s01');
    await write(SCENE, '// v2 broken by a Claude turn\n');
    const turn = await autocommit(dir, 'Claude: make the logo bigger', {
      kind: 'claude-turn',
      step: 'scene-fix',
      git: sandbox.git,
    });
    expect(turn.ok && turn.value.status).toBe('committed');

    const reverted = await revertTo(dir, first.slice(0, 7), sandbox.git);
    if (!reverted.ok) throw new Error(reverted.error.message);
    expect(reverted.value).toMatchObject({ status: 'reverted', target: first });
    expect(reverted.value).not.toHaveProperty('autoSaved');
    expect(await readFile(sceneFile(), 'utf8')).toBe(v1);

    const list = await entries();
    expect(list.map((entry) => [entry.kind, entry.step])).toEqual([
      ['revert', 'revert'],
      ['claude-turn', 'scene-fix'],
      ['pipeline-step', 'scenes-built'],
      ['create', 'create'],
    ]);
    expect(list[0]).toMatchObject({
      subject: `Revert to ${first.slice(0, 7)}: Scenes built: s01`,
      revertOf: first,
      files: [{ status: 'modified', path: SCENE }],
      counts: { added: 0, modified: 1, deleted: 0 },
    });
    expect(list[0]?.time).toMatch(/^\d{4}-\d\d-\d\dT/);
  });

  it('auto-saves uncommitted changes before reverting, so nothing is lost', async () => {
    const created = (await entries())[0]?.hash ?? '';
    await write(SCENE, '// unsaved work\n');
    const reverted = await revertTo(dir, created, sandbox.git);
    if (!reverted.ok) throw new Error(reverted.error.message);
    expect(reverted.value.status).toBe('reverted');
    expect(reverted.value.autoSaved).toMatch(/^[0-9a-f]{40}$/);
    // The scene did not exist at the target: it is removed (and still in the auto-save commit).
    expect(existsSync(sceneFile())).toBe(false);
    const list = await entries();
    expect(list.map((entry) => entry.step)).toEqual(['revert', 'auto-save', 'create']);
    const show = await runGit(
      dir,
      ['show', `${reverted.value.autoSaved ?? ''}:${SCENE}`],
      sandbox.git,
    );
    expect(show.ok && show.value.stdout).toBe('// unsaved work\n');
  });

  it('reports unchanged for a revert to the current content and unknown commits', async () => {
    const head = (await entries())[0]?.hash ?? '';
    const same = await revertTo(dir, head, sandbox.git);
    expect(same.ok && same.value.status).toBe('unchanged');
    for (const hash of ['deadbeef', 'zz--x', '--output=x']) {
      const unknown = await revertTo(dir, hash, sandbox.git);
      expect(!unknown.ok && unknown.error.kind).toBe('unknown-commit');
    }
    expect(await entries()).toHaveLength(1);
  });

  it('reverts a single file and leaves the others alone', async () => {
    await write(SCENE, 'one-v1\n');
    await write('scenes/s02.js', 'two-v1\n');
    const first = await commit('v1');
    await write(SCENE, 'one-v2\n');
    await write('scenes/s02.js', 'two-v2\n');
    await write('scenes/s03.js', 'three\n');
    await commit('v2');
    const one = await revertFile(dir, first, SCENE, sandbox.git);
    expect(one.ok && one.value.status).toBe('reverted');
    expect(await readFile(sceneFile(), 'utf8')).toBe('one-v1\n');
    expect(await readFile(path.join(dir, 'scenes', 's02.js'), 'utf8')).toBe('two-v2\n');
    // A file that did not exist at the target is removed.
    const three = await revertFile(dir, first, path.join(dir, 'scenes', 's03.js'), sandbox.git);
    expect(three.ok && three.value.status).toBe('reverted');
    expect(existsSync(path.join(dir, 'scenes', 's03.js'))).toBe(false);
    const outside = await revertFile(dir, first, '../escape.js', sandbox.git);
    expect(!outside.ok && outside.error.kind).toBe('invalid-argument');
    const missing = await revertFile(dir, first, 'scenes/none.js', sandbox.git);
    expect(!missing.ok && missing.error.kind).toBe('not-found');
  });

  it('skips commits when nothing tracked changed (ignored: audio, out, .reelforge)', async () => {
    const nothing = await autocommit(dir, 'Claude turn', { kind: 'claude-turn', git: sandbox.git });
    expect(nothing).toEqual({ ok: true, value: { status: 'nothing-to-commit' } });
    await write('audio/vo.original.wav', 'RIFF....');
    await write('out/Film.mp4', 'mp4');
    await write('.reelforge/usage.json', '{}');
    await write('timing/words.json.123.tmp', '{');
    const ignored = await autocommit(dir, 'Voiceover', {
      kind: 'pipeline-step',
      step: 'voiceover',
      git: sandbox.git,
    });
    expect(ignored.ok && ignored.value.status).toBe('nothing-to-commit');
    expect(await entries()).toHaveLength(1);
  });

  it('rejects empty messages and invalid step ids', async () => {
    await write(SCENE, 'x');
    const empty = await autocommit(dir, '  \n ', { kind: 'manual', git: sandbox.git });
    expect(!empty.ok && empty.error.kind).toBe('invalid-argument');
    const badStep = await autocommit(dir, 'x', {
      kind: 'manual',
      step: 'Bad Step',
      git: sandbox.git,
    });
    expect(!badStep.ok && badStep.error.kind).toBe('invalid-argument');
  });

  it('serializes concurrent autocommits on one project', async () => {
    const results = await Promise.all(
      [1, 2, 3, 4, 5].map(async (index) => {
        await write(`scenes/s0${String(index)}.js`, `// ${String(index)}\n`);
        return autocommit(dir, `Shot ${String(index)}`, { kind: 'claude-turn', git: sandbox.git });
      }),
    );
    expect(results.every((result) => result.ok)).toBe(true);
    const committed = results.filter((result) => result.ok && result.value.status === 'committed');
    expect(committed.length).toBeGreaterThanOrEqual(1);
    expect(await entries()).toHaveLength(1 + committed.length);
    const status = await runGit(dir, ['status', '--porcelain'], sandbox.git);
    expect(status.ok && status.value.stdout).toBe('');
  });

  it('reads commits made outside ReelForge as external', async () => {
    await write('notes.md', 'by hand\n');
    await runGit(dir, ['add', 'notes.md'], sandbox.git);
    await runGit(dir, ['commit', '-q', '-m', 'Manual git commit'], sandbox.git);
    expect((await entries())[0]).toMatchObject({
      kind: 'external',
      step: null,
      subject: 'Manual git commit',
    });
  });
});

describe('index.lock', () => {
  it('removes a stale lock left by a crashed git', async () => {
    const lock = indexLockPath(dir);
    await writeFile(lock, '');
    const anHourAgo = new Date(Date.now() - 3_600_000);
    await utimes(lock, anHourAgo, anHourAgo);
    await write(SCENE, 'x\n');
    const result = await autocommit(dir, 'After crash', { kind: 'manual', git: sandbox.git });
    expect(result.ok && result.value.status).toBe('committed');
    expect(existsSync(lock)).toBe(false);
  });

  it('waits for a fresh lock and fails with `locked` without touching it', async () => {
    const lock = indexLockPath(dir);
    await writeFile(lock, '');
    await write(SCENE, 'x\n');
    const result = await autocommit(dir, 'Busy', {
      kind: 'manual',
      git: { ...sandbox.git, lockWaitMs: 200 },
    });
    expect(!result.ok && result.error.kind).toBe('locked');
    expect(existsSync(lock)).toBe(true);
  });
});

describe('diffSummary', () => {
  it('lists files with line counts (first commit included)', async () => {
    await write(SCENE, 'a\nb\nc\n');
    const hash = await commit('scene');
    const summary = await diffSummary(dir, hash.slice(0, 8), sandbox.git);
    expect(summary).toEqual({
      ok: true,
      value: {
        hash,
        files: [{ status: 'added', path: SCENE, additions: 3, deletions: 0 }],
        additions: 3,
        deletions: 0,
      },
    });
    const first = (await entries()).at(-1)?.hash ?? '';
    const root = await diffSummary(dir, first, sandbox.git);
    // .gitignore, CLAUDE.md, project.json, 3 .keep files, 3 style bibles
    expect(root.ok && root.value.files.length).toBe(9);
    const unknown = await diffSummary(dir, 'abcdef12', sandbox.git);
    expect(!unknown.ok && unknown.error.kind).toBe('unknown-commit');
  });
});

describe('formatCommitMessage', () => {
  it('writes subject, body and trailers', () => {
    expect(
      formatCommitMessage({
        message: '\n Scenes   built\nbody line\n',
        kind: 'pipeline-step',
        step: 'scenes-built',
      }),
    ).toEqual({
      ok: true,
      value:
        'Scenes built\n\nbody line\n\nReelForge-Step: scenes-built\nReelForge-Kind: pipeline-step\n',
    });
    const long = formatCommitMessage({ message: 'x'.repeat(300), kind: 'manual', step: 'manual' });
    expect(long.ok && long.value.split('\n')[0]?.length).toBe(120);
  });
});
