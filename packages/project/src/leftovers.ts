/**
 * Leftovers of interrupted atomic writes (power loss, a killed app): `<file>.<token>.tmp` files
 * whose rename never happened. The real file still holds its last complete version, so the
 * leftovers are only noise; old ones are removed when a project is opened (young ones may belong
 * to a write in flight).
 */
import { readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { PROJECT_FOLDERS } from './paths.js';
import { errorCode } from './result.js';

/** `.tmp` files younger than this may still be renamed by a running write. */
export const DEFAULT_LEFTOVER_AGE_MS = 60_000;

/** Folders searched (not recursive): root, the pipeline folders and the app state folder. */
export const LEFTOVER_FOLDERS: readonly string[] = ['', ...PROJECT_FOLDERS, '.reelforge'];

/** `<name>.<uuid | hex | pid>.tmp`, the names the app's atomic writers use. */
const LEFTOVER_PATTERN =
  /^.+\.(?:[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}|[0-9a-f]{8}|\d+)\.tmp$/i;

export function isAtomicLeftover(name: string): boolean {
  return LEFTOVER_PATTERN.test(name);
}

async function entriesOf(folder: string): Promise<string[]> {
  try {
    const entries = await readdir(folder, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  } catch (error) {
    const code = errorCode(error);
    if (code === 'ENOENT' || code === 'ENOTDIR') return [];
    throw error;
  }
}

export interface LeftoverCleanup {
  /** Project-relative paths (forward slashes) that were removed. */
  readonly removed: string[];
  /** Leftovers that could not be removed (locked by a scanner, …): retried on the next open. */
  readonly skipped: string[];
}

/**
 * Removes leftovers older than `olderThanMs`. Best effort: a file that cannot be inspected or
 * removed is reported in `skipped` (it is git-ignored and harmless). Throws only when a folder
 * exists but cannot be listed.
 */
export async function removeAtomicLeftovers(
  dir: string,
  options: { readonly olderThanMs?: number; readonly now?: number } = {},
): Promise<LeftoverCleanup> {
  const minAge = options.olderThanMs ?? DEFAULT_LEFTOVER_AGE_MS;
  const now = options.now ?? Date.now();
  const removed: string[] = [];
  const skipped: string[] = [];
  for (const folder of LEFTOVER_FOLDERS) {
    const names = (await entriesOf(path.join(dir, folder))).filter(isAtomicLeftover);
    for (const name of names) {
      const relative = folder === '' ? name : `${folder}/${name}`;
      try {
        const info = await stat(path.join(dir, folder, name));
        if (now - info.mtimeMs < minAge) continue;
        await rm(path.join(dir, folder, name), { force: true });
        removed.push(relative);
      } catch (error) {
        if (errorCode(error) !== 'ENOENT') skipped.push(relative);
      }
    }
  }
  return { removed, skipped };
}
