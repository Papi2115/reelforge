/**
 * The project's git history (CLAUDE.md §3.4: autocommit after every pipeline step and Claude
 * turn). All operations on one project are serialized (`withLock`); history is never rewritten:
 * a revert is a NEW commit whose tree equals the chosen commit's tree.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { formatCommitMessage, type AutocommitKind, type CommitKind } from './commit-message.js';
import { gitChecked, runGit, type GitOptions } from './git-runner.js';
import { clearIndexLock } from './index-lock.js';
import { lockKey, withLock } from './mutex.js';
import { toProjectRelative } from './paths.js';
import { err, ok, projectError, type Result } from './result.js';

/** Used only when git has no identity at all; written to the project repo, never globally. */
export const FALLBACK_IDENTITY = { name: 'ReelForge', email: 'reelforge@local' } as const;

export type CommitResult =
  | { readonly status: 'committed'; readonly hash: string }
  | { readonly status: 'nothing-to-commit' };

export type RevertResult =
  | {
      readonly status: 'reverted';
      /** The new commit. */
      readonly hash: string;
      /** The commit whose content was restored. */
      readonly target: string;
      /** Commit saving uncommitted changes before the revert, if there were any. */
      readonly autoSaved?: string;
    }
  /** The project already has that content. */
  | { readonly status: 'unchanged'; readonly target: string; readonly autoSaved?: string };

export interface AutocommitOptions {
  readonly kind: AutocommitKind;
  /** `ReelForge-Step` trailer; defaults to the kind. */
  readonly step?: string;
  readonly git?: GitOptions;
}

export function hasRepository(dir: string): boolean {
  return existsSync(path.join(dir, '.git'));
}

export async function initRepository(dir: string, options: GitOptions = {}): Promise<Result<void>> {
  const result = await gitChecked(dir, ['init', '--quiet', '--initial-branch=main'], options);
  return result.ok ? ok(undefined) : result;
}

async function configValue(
  dir: string,
  key: string,
  options: GitOptions,
): Promise<Result<string | undefined>> {
  const result = await runGit(dir, ['config', '--get', key], options);
  if (!result.ok) return result;
  // Exit 1: the key is not set anywhere.
  if (result.value.code === 1) return ok(undefined);
  if (result.value.code !== 0) {
    return err(projectError('git-failed', `git config --get ${key} failed`));
  }
  const value = result.value.stdout.trim();
  return ok(value === '' ? undefined : value);
}

/** Projects known to have an identity in this process (saves two git spawns per commit). */
const identityChecked = new Set<string>();

/** Sets the fallback identity in the repo's local config when git has none (CI, fresh installs). */
export async function ensureIdentity(
  dir: string,
  options: GitOptions = {},
): Promise<Result<{ readonly configured: boolean }>> {
  const key = lockKey(dir);
  if (identityChecked.has(key)) return ok({ configured: false });
  const result = await checkIdentity(dir, options);
  if (result.ok) identityChecked.add(key);
  return result;
}

async function checkIdentity(
  dir: string,
  options: GitOptions,
): Promise<Result<{ readonly configured: boolean }>> {
  const name = await configValue(dir, 'user.name', options);
  if (!name.ok) return name;
  const email = await configValue(dir, 'user.email', options);
  if (!email.ok) return email;
  if (name.value !== undefined && email.value !== undefined) return ok({ configured: false });
  const settings: [string, string][] = [];
  if (name.value === undefined) settings.push(['user.name', FALLBACK_IDENTITY.name]);
  if (email.value === undefined) settings.push(['user.email', FALLBACK_IDENTITY.email]);
  for (const [key, value] of settings) {
    const set = await gitChecked(dir, ['config', '--local', key, value], options);
    if (!set.ok) return set;
  }
  return ok({ configured: true });
}

async function headHash(dir: string, options: GitOptions): Promise<Result<string | undefined>> {
  const result = await runGit(dir, ['rev-parse', '--verify', '--quiet', 'HEAD'], options);
  if (!result.ok) return result;
  return ok(result.value.code === 0 ? result.value.stdout.trim() : undefined);
}

/** True when the index differs from HEAD (or HEAD is unborn and the index has files). */
async function hasStagedChanges(dir: string, options: GitOptions): Promise<Result<boolean>> {
  const result = await runGit(dir, ['diff', '--cached', '--quiet', '--no-ext-diff'], options);
  if (!result.ok) return result;
  if (result.value.code === 0) return ok(false);
  if (result.value.code === 1) return ok(true);
  return err(projectError('git-failed', `git diff --cached failed: ${result.value.stderr.trim()}`));
}

/** Commits the index with a structured message (caller holds the project lock). */
async function commitIndex(
  dir: string,
  message: string,
  kind: CommitKind,
  step: string,
  options: GitOptions,
  revertOf?: string,
): Promise<Result<CommitResult>> {
  const text = formatCommitMessage(
    revertOf === undefined ? { message, kind, step } : { message, kind, step, revertOf },
  );
  if (!text.ok) return text;
  const changed = await hasStagedChanges(dir, options);
  if (!changed.ok) return changed;
  if (!changed.value) return ok({ status: 'nothing-to-commit' });
  const identity = await ensureIdentity(dir, options);
  if (!identity.ok) return identity;
  const commit = await gitChecked(
    dir,
    ['commit', '--quiet', '--no-edit', '--cleanup=whitespace', '--file=-'],
    options,
    text.value,
  );
  if (!commit.ok) return commit;
  const head = await headHash(dir, options);
  if (!head.ok) return head;
  if (head.value === undefined) {
    return err(projectError('git-failed', 'git commit succeeded but HEAD is missing'));
  }
  return ok({ status: 'committed', hash: head.value });
}

/** Stages everything git does not ignore and commits it (caller holds the project lock). */
async function commitAll(
  dir: string,
  message: string,
  kind: CommitKind,
  step: string,
  options: GitOptions,
): Promise<Result<CommitResult>> {
  const lock = await clearIndexLock(dir, options);
  if (!lock.ok) return lock;
  const add = await gitChecked(dir, ['add', '--all'], options);
  if (!add.ok) return add;
  return commitIndex(dir, message, kind, step, options);
}

/**
 * Commits every change in the project (respecting its .gitignore). Nothing changed ->
 * `nothing-to-commit`, no empty commits.
 */
export function autocommit(
  dir: string,
  message: string,
  options: AutocommitOptions,
): Promise<Result<CommitResult>> {
  const step = options.step ?? options.kind;
  return withLock(dir, () => commitAll(dir, message, options.kind, step, options.git ?? {}));
}

/** Internal commits of this package (`create`, migrations) with a fixed kind. */
export function commitProjectChanges(
  dir: string,
  message: string,
  kind: CommitKind,
  step: string,
  options: GitOptions = {},
): Promise<Result<CommitResult>> {
  return withLock(dir, () => commitAll(dir, message, kind, step, options));
}

const HASH_PATTERN = /^[0-9a-f]{4,64}$/i;

/** Full hash + subject of a commit given by (abbreviated) hash. */
export async function resolveCommit(
  dir: string,
  hash: string,
  options: GitOptions,
): Promise<Result<{ readonly hash: string; readonly subject: string }>> {
  const unknown = projectError('unknown-commit', `no commit ${hash} in this project's history`);
  if (!HASH_PATTERN.test(hash)) return err(unknown);
  const result = await runGit(dir, ['log', '-1', '--format=%H%x1f%s', `${hash}^{commit}`], options);
  if (!result.ok) return result;
  const [full, subject] = result.value.stdout.trim().split('\x1f');
  if (result.value.code !== 0 || full === undefined || full === '') return err(unknown);
  return ok({ hash: full, subject: subject ?? '' });
}

export async function saveBeforeRevert(
  dir: string,
  options: GitOptions,
): Promise<Result<string | undefined>> {
  const saved = await commitAll(dir, 'Auto-save before revert', 'manual', 'auto-save', options);
  if (!saved.ok) return saved;
  return ok(saved.value.status === 'committed' ? saved.value.hash : undefined);
}

/** Puts index + working tree back to HEAD after a failed restore (nothing uncommitted is lost). */
async function rollbackToHead(dir: string, options: GitOptions): Promise<void> {
  await runGit(dir, ['restore', '--source=HEAD', '--staged', '--worktree', '--', '.'], options);
}

/** Restores `pathspec` from `target` and commits it as a revert (caller holds the lock). */
export async function restoreAndCommit(
  dir: string,
  target: { readonly hash: string; readonly subject: string },
  pathspec: string,
  message: string,
  autoSaved: string | undefined,
  options: GitOptions,
): Promise<Result<RevertResult>> {
  const restore = await gitChecked(
    dir,
    ['restore', `--source=${target.hash}`, '--staged', '--worktree', '--', pathspec],
    options,
  );
  if (!restore.ok) {
    await rollbackToHead(dir, options);
    return restore;
  }
  const commit = await commitIndex(dir, message, 'revert', 'revert', options, target.hash);
  if (!commit.ok) {
    await rollbackToHead(dir, options);
    return commit;
  }
  const saved = autoSaved === undefined ? {} : { autoSaved };
  return ok(
    commit.value.status === 'committed'
      ? { status: 'reverted', hash: commit.value.hash, target: target.hash, ...saved }
      : { status: 'unchanged', target: target.hash, ...saved },
  );
}

/**
 * Restores the whole project (tracked files) to `hash` as a new commit. Uncommitted changes are
 * committed first, so nothing is lost; ignored files (audio, out/, .reelforge/) are untouched.
 */
export function revertTo(
  dir: string,
  hash: string,
  options: GitOptions = {},
): Promise<Result<RevertResult>> {
  return withLock(dir, async () => {
    const target = await resolveCommit(dir, hash, options);
    if (!target.ok) return target;
    const saved = await saveBeforeRevert(dir, options);
    if (!saved.ok) return saved;
    const short = target.value.hash.slice(0, 7);
    const message = `Revert to ${short}: ${target.value.subject}`;
    return restoreAndCommit(dir, target.value, '.', message, saved.value, options);
  });
}

/** Restores one project file (project-relative or absolute inside the project) to `hash`. */
export function revertFile(
  dir: string,
  hash: string,
  file: string,
  options: GitOptions = {},
): Promise<Result<RevertResult>> {
  return withLock(dir, async () => {
    const relative = toProjectRelative(dir, file);
    if (!relative.ok) return relative;
    const target = await resolveCommit(dir, hash, options);
    if (!target.ok) return target;
    const known = await runGit(
      dir,
      ['ls-tree', '--name-only', target.value.hash, '--', relative.value],
      options,
    );
    if (!known.ok) return known;
    const inTarget = known.value.stdout.trim() !== '';
    const inHead = existsSync(path.join(dir, ...relative.value.split('/')));
    if (!inTarget && !inHead) {
      return err(
        projectError('not-found', `${relative.value} exists neither now nor in ${hash}`, {
          path: relative.value,
        }),
      );
    }
    const saved = await saveBeforeRevert(dir, options);
    if (!saved.ok) return saved;
    const short = target.value.hash.slice(0, 7);
    const message = `Revert ${relative.value} to ${short}: ${target.value.subject}`;
    return restoreAndCommit(
      dir,
      target.value,
      `:(literal)${relative.value}`,
      message,
      saved.value,
      options,
    );
  });
}
