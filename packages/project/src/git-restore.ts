/**
 * "Restore from history" for a damaged tracked file (PLAN.md#10.2): the newest committed version
 * of the file that passes `isValid` (by default: parses as JSON) is restored as a NEW commit. The
 * damaged working-tree content is auto-saved first, so nothing is lost and history is never
 * rewritten.
 */
import { gitChecked, runGit, type GitOptions } from './git-runner.js';
import {
  resolveCommit,
  restoreAndCommit,
  saveBeforeRevert,
  type RevertResult,
} from './git-repo.js';
import { withLock } from './mutex.js';
import { toProjectRelative } from './paths.js';
import { err, ok, projectError, type Result } from './result.js';

/** Commits that touched the file, newest first, searched for a valid version. */
export const MAX_RESTORE_CANDIDATES = 200;

const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);

/** Default validity check: the content is JSON (a UTF-8 BOM is tolerated). */
export function isParsableJson(content: string): boolean {
  try {
    JSON.parse(content.startsWith(BYTE_ORDER_MARK) ? content.slice(1) : content);
    return true;
  } catch {
    return false; // not JSON: this version is not a restore candidate
  }
}

export interface RestoreFileOptions {
  /** True when a committed version is good enough to restore. */
  readonly isValid?: (content: string) => boolean;
  readonly git?: GitOptions;
}

/** Newest commit (of those that touched `relative`) whose version of it passes `isValid`. */
async function lastGoodCommit(
  dir: string,
  relative: string,
  isValid: (content: string) => boolean,
  git: GitOptions,
): Promise<Result<string | undefined>> {
  const head = await runGit(dir, ['rev-parse', '--verify', '--quiet', 'HEAD'], git);
  if (!head.ok) return head;
  if (head.value.code !== 0) return ok(undefined);
  const log = await gitChecked(
    dir,
    [
      'log',
      `--max-count=${String(MAX_RESTORE_CANDIDATES)}`,
      '--format=%H',
      'HEAD',
      '--',
      `:(literal)${relative}`,
    ],
    git,
  );
  if (!log.ok) return log;
  for (const hash of log.value.split('\n').map((line) => line.trim())) {
    if (hash === '') continue;
    // Fails for the commit that deleted the file: not a candidate.
    const shown = await runGit(dir, ['show', `${hash}:${relative}`], git);
    if (!shown.ok) return shown;
    if (shown.value.code === 0 && isValid(shown.value.stdout)) return ok(hash);
  }
  return ok(undefined);
}

/**
 * Restores `file` (project-relative or absolute inside the project) to its newest valid committed
 * version, as a new `revert` commit. `not-found` when history has no valid version of it.
 */
export function restoreFileFromHistory(
  dir: string,
  file: string,
  options: RestoreFileOptions = {},
): Promise<Result<RevertResult>> {
  const git = options.git ?? {};
  return withLock(dir, async () => {
    const relative = toProjectRelative(dir, file);
    if (!relative.ok) return relative;
    const good = await lastGoodCommit(dir, relative.value, options.isValid ?? isParsableJson, git);
    if (!good.ok) return good;
    if (good.value === undefined) {
      return err(
        projectError(
          'not-found',
          `the project history has no valid version of ${relative.value} to restore`,
          { path: relative.value },
        ),
      );
    }
    const target = await resolveCommit(dir, good.value, git);
    if (!target.ok) return target;
    const saved = await saveBeforeRevert(dir, git);
    if (!saved.ok) return saved;
    const short = target.value.hash.slice(0, 7);
    const message = `Restore ${relative.value} from ${short}: ${target.value.subject}`;
    return restoreAndCommit(
      dir,
      target.value,
      `:(literal)${relative.value}`,
      message,
      saved.value,
      git,
    );
  });
}
