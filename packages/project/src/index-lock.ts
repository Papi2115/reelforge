/**
 * `.git/index.lock` handling before a mutating git command. A lock older than `staleLockMs` was
 * left behind by a git that crashed or was killed: it is removed. A fresh one belongs to a running
 * git (an IDE, a terminal): we wait up to `lockWaitMs` and then fail with `locked`.
 */
import { rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import type { GitOptions } from './git-runner.js';
import { describeUnknown, err, errorCode, ok, projectError, type Result } from './result.js';

export const DEFAULT_STALE_LOCK_MS = 30_000;
export const DEFAULT_LOCK_WAIT_MS = 3_000;
const POLL_MS = 100;

export function indexLockPath(dir: string): string {
  return path.join(dir, '.git', 'index.lock');
}

async function lockAgeMs(lock: string): Promise<Result<number | undefined>> {
  try {
    const info = await stat(lock);
    return ok(Date.now() - info.mtimeMs);
  } catch (error) {
    if (errorCode(error) === 'ENOENT') return ok(undefined);
    return err(projectError('io', `${lock}: ${describeUnknown(error)}`, { path: lock }));
  }
}

export interface IndexLockState {
  /** True when a stale lock was found and removed. */
  readonly removedStale: boolean;
}

export async function clearIndexLock(
  dir: string,
  options: GitOptions = {},
): Promise<Result<IndexLockState>> {
  const lock = indexLockPath(dir);
  const staleMs = options.staleLockMs ?? DEFAULT_STALE_LOCK_MS;
  const waitMs = options.lockWaitMs ?? DEFAULT_LOCK_WAIT_MS;
  for (let waited = 0; ; waited += POLL_MS) {
    const age = await lockAgeMs(lock);
    if (!age.ok) return age;
    if (age.value === undefined) return ok({ removedStale: false });
    if (age.value >= staleMs) {
      try {
        await rm(lock, { force: true });
      } catch (error) {
        return err(
          projectError('locked', `could not remove a stale ${lock}: ${describeUnknown(error)}`, {
            path: lock,
          }),
        );
      }
      return ok({ removedStale: true });
    }
    if (waited >= waitMs) {
      return err(
        projectError(
          'locked',
          'another git process is using this project (.git/index.lock); close other git tools or try again in a moment',
          { path: lock },
        ),
      );
    }
    await sleep(POLL_MS);
  }
}
