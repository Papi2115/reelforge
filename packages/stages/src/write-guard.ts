/**
 * A Claude turn that may write only some project files (the world-assets turn, a c-cam-build
 * turn) runs with the scene builder's permissions (project edits), so the rule is enforced in
 * code like the shot locks: the bytes of every other project file are taken before the turn, and
 * afterwards a changed or deleted one is put back and a new one is removed. App state, media and
 * git are not watched.
 */
import { readdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { err, ok, type Result } from '@reelforge/claude-bridge';
import { writeAtomic } from '@reelforge/project';
import { inProject } from './paths.js';
import { stageError, type StageError } from './types.js';

/** Top-level folders never watched (git, app state, heavy media, exports, dependencies). */
const SKIPPED = new Set(['.git', '.reelforge', 'audio', 'out', 'node_modules']);

/** True for the project-relative (forward-slash) files the turn may write. */
export type WritableFile = (file: string) => boolean;

export interface TurnWriteSnapshot {
  readonly projectDir: string;
  /** The turn in messages ("the world-assets turn"). */
  readonly turn: string;
  readonly writable: WritableFile;
  readonly files: ReadonlyMap<string, Buffer>;
}

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

async function listFiles(projectDir: string, relative = ''): Promise<string[]> {
  const entries = await readdir(path.join(projectDir, ...relative.split('/').filter(Boolean)), {
    withFileTypes: true,
  });
  const files: string[] = [];
  for (const entry of entries) {
    const child = relative === '' ? entry.name : `${relative}/${entry.name}`;
    if (entry.isDirectory()) {
      if (relative === '' && SKIPPED.has(entry.name)) continue;
      files.push(...(await listFiles(projectDir, child)));
    } else if (entry.isFile()) files.push(child);
  }
  return files;
}

/** The bytes of every watched file the turn must not write. */
export async function snapshotTurnWrites(
  projectDir: string,
  turn: string,
  writable: WritableFile,
): Promise<Result<TurnWriteSnapshot, StageError>> {
  try {
    const files = new Map<string, Buffer>();
    for (const file of await listFiles(projectDir)) {
      if (writable(file)) continue;
      files.set(file, await readFile(inProject(projectDir, file)));
    }
    return ok({ projectDir, turn, writable, files });
  } catch (error) {
    return err(stageError('io', `cannot read the project before ${turn}: ${describe(error)}`));
  }
}

/** Puts back what the turn changed outside its files; returns the discarded paths, sorted. */
export async function restoreTurnWrites(
  snapshot: TurnWriteSnapshot,
): Promise<Result<string[], StageError>> {
  const { projectDir, writable } = snapshot;
  const discarded: string[] = [];
  try {
    const now = await listFiles(projectDir);
    for (const file of now) {
      if (writable(file)) continue;
      const before = snapshot.files.get(file);
      if (before === undefined) {
        await rm(inProject(projectDir, file), { force: true });
        discarded.push(file);
      } else if (!before.equals(await readFile(inProject(projectDir, file)))) {
        await writeAtomic(inProject(projectDir, file), before);
        discarded.push(file);
      }
    }
    const present = new Set(now);
    for (const [file, content] of snapshot.files) {
      if (present.has(file)) continue;
      await writeAtomic(inProject(projectDir, file), content);
      discarded.push(file);
    }
    return ok(discarded.sort());
  } catch (error) {
    return err(
      stageError('io', `cannot restore the project after ${snapshot.turn}: ${describe(error)}`),
    );
  }
}
