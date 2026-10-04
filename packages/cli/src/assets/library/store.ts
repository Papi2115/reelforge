/**
 * Index file of the global asset library (PLAN.md#12.19, ADR-015): `<library>/library.json`
 * (`assetLibraryFileSchema`, versioned) and the bytes in `<library>/files/<sha256>.<ext>`. Writes
 * are atomic (tmp + rename) and serialised per library folder within a process. A damaged index is
 * moved aside as `library.corrupt-<time>.json` (like the app settings) and the library starts empty;
 * readers that must not change anything (the CLI) just see it empty with a problem.
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename } from 'node:fs/promises';
import path from 'node:path';
import {
  ASSET_LIBRARY_VERSION,
  assetLibraryFileSchema,
  type AssetLibraryFile,
} from '@reelforge/shared';
import { describeUnknown } from '../../errors.js';
import { writeJsonAtomic } from '../store.js';

/** Env var the app sets for Claude's processes: the library folder the CLI may read from. */
export const ASSET_LIBRARY_ENV = 'REELFORGE_ASSET_LIBRARY';

export const LIBRARY_PATHS = { index: 'library.json', files: 'files' } as const;

export function emptyLibrary(): AssetLibraryFile {
  return { version: ASSET_LIBRARY_VERSION, entries: [] };
}

export function libraryIndexFile(dir: string): string {
  return path.join(dir, LIBRARY_PATHS.index);
}

export function libraryFilesDir(dir: string): string {
  return path.join(dir, LIBRARY_PATHS.files);
}

export interface LibraryRead {
  readonly library: AssetLibraryFile;
  /** Why the index could not be used (it was moved aside when `recover` was asked), else null. */
  readonly problem: string | null;
}

function parseIndex(
  text: string,
): { ok: true; value: AssetLibraryFile } | { ok: false; why: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    return { ok: false, why: `not JSON (${describeUnknown(error)})` };
  }
  const parsed = assetLibraryFileSchema.safeParse(raw);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, why: parsed.error.issues[0]?.message ?? 'does not match its schema' };
}

/** `library.corrupt-2026-10-04T12-00-00-000Z.json` next to the index. */
export function corruptBackupName(now: Date): string {
  return `library.corrupt-${now.toISOString().replace(/[:.]/g, '-')}.json`;
}

/**
 * Reads the index. Missing = empty. Damaged = empty with a problem; with `recover` the damaged file
 * is renamed to a `.corrupt-…` backup first so the next write starts clean.
 */
export async function readLibrary(
  dir: string,
  options: { readonly recover: boolean; readonly now?: () => Date } = { recover: false },
): Promise<LibraryRead> {
  const file = libraryIndexFile(dir);
  if (!existsSync(file)) return { library: emptyLibrary(), problem: null };
  const parsed = parseIndex(await readFile(file, 'utf8'));
  if (parsed.ok) return { library: parsed.value, problem: null };
  if (!options.recover) {
    return {
      library: emptyLibrary(),
      problem: `the asset library index is damaged: ${parsed.why}`,
    };
  }
  const backup = corruptBackupName((options.now ?? (() => new Date()))());
  await rename(file, path.join(dir, backup));
  return {
    library: emptyLibrary(),
    problem: `the asset library index was damaged (${parsed.why}); it was moved to ${backup} and the library starts empty`,
  };
}

const queues = new Map<string, Promise<unknown>>();

/**
 * Read-modify-write of the index, one at a time per library folder. `change` returns the new
 * index (validated before writing; undefined = nothing to write) and a result.
 */
export function mutateLibrary<T>(
  dir: string,
  change: (
    library: AssetLibraryFile,
  ) => Promise<{ readonly library?: AssetLibraryFile; readonly result: T }>,
  now?: () => Date,
): Promise<T> {
  const key = path.resolve(dir).toLowerCase();
  const run = (queues.get(key) ?? Promise.resolve()).then(async () => {
    await mkdir(libraryFilesDir(dir), { recursive: true });
    const { library } = await readLibrary(dir, { recover: true, ...(now ? { now } : {}) });
    const outcome = await change(library);
    if (outcome.library !== undefined) {
      await writeJsonAtomic(libraryIndexFile(dir), assetLibraryFileSchema.parse(outcome.library));
    }
    return outcome.result;
  });
  queues.set(
    key,
    run.catch(() => undefined),
  );
  return run;
}
