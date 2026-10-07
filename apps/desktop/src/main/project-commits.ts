/**
 * Autocommits of the app's own edits (CLAUDE.md §3.4: a commit per change). Each one is limited to
 * the files the action wrote: a scene build, a chat turn or another writer may have unfinished
 * files in the project at the same moment, and they must not land in this commit.
 */
import { autocommit, type CommitResult, type Result } from '@reelforge/project';
import type { Logger } from './logger.js';

/** A `manual` autocommit of `paths` (project-relative) with a `ReelForge-Step`; logs failures. */
export type ManualCommit = (
  dir: string,
  message: string,
  step: string,
  paths: readonly string[],
) => Promise<Result<CommitResult>>;

/**
 * What an IPC module gets from main: commit `paths` with `step`. The flag is the module's own
 * contract (a commit was made, or: the commit did not fail).
 */
export type StepCommit = (
  dir: string,
  message: string,
  step: string,
  paths: readonly string[],
) => Promise<boolean>;

export function manualCommitter(log: Logger): ManualCommit {
  return async (dir, message, step, paths) => {
    const committed = await autocommit(dir, message, { kind: 'manual', step, paths });
    if (!committed.ok) log.warn(`autocommit "${message}" failed: ${committed.error.message}`);
    return committed;
  };
}

/** A commit was made (not failed, not `nothing-to-commit`). */
export function madeCommit(result: Result<CommitResult>): boolean {
  return result.ok && result.value.status === 'committed';
}
