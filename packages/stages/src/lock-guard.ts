/**
 * Lock enforcement in code, not only in the prompt (PLAN.md#11.4): the bytes of every locked file
 * are taken before a Claude turn; after the turn a changed (or deleted, or created) locked file is
 * put back exactly as it was and the change is reported ("Claude tried to change locked shot s03;
 * change discarded"). A lock is committed when it is set, so "as it was" is the file in HEAD.
 * Shots unlocked while the turn ran keep the turn's change.
 */
import { readFile, rm } from 'node:fs/promises';
import { err, ok, type Result } from '@reelforge/claude-bridge';
import { writeAtomic } from '@reelforge/project';
import { lockedFiles, readLockedShots, type LockedFile } from './locks.js';
import { inProject } from './paths.js';
import { stageError, type StageError } from './types.js';

interface GuardedFile extends LockedFile {
  /** Content before the turn; undefined = the file did not exist. */
  readonly content: Buffer | undefined;
}

export interface LockSnapshot {
  readonly projectDir: string;
  readonly files: readonly GuardedFile[];
}

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

async function readBytes(file: string): Promise<Buffer | undefined> {
  try {
    return await readFile(file);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
    throw error;
  }
}

/** Takes the locked files of the project as they are now (before a turn). */
export async function snapshotLockedFiles(
  projectDir: string,
): Promise<Result<LockSnapshot, StageError>> {
  const locked = await readLockedShots(projectDir);
  if (!locked.ok) return locked;
  const files = await lockedFiles(projectDir, locked.value);
  if (!files.ok) return files;
  try {
    const guarded = await Promise.all(
      files.value.map(async (entry) => ({
        ...entry,
        content: await readBytes(inProject(projectDir, entry.file)),
      })),
    );
    return ok({ projectDir, files: guarded });
  } catch (error) {
    return err(stageError('io', `cannot read a locked file: ${describe(error)}`));
  }
}

function same(first: Buffer | undefined, second: Buffer | undefined): boolean {
  if (first === undefined || second === undefined) return first === second;
  return first.equals(second);
}

/** Puts back every locked file a turn changed; returns what was discarded. */
export async function discardLockedChanges(
  snapshot: LockSnapshot,
): Promise<Result<LockedFile[], StageError>> {
  if (snapshot.files.length === 0) return ok([]);
  const { projectDir } = snapshot;
  const locked = await readLockedShots(projectDir);
  if (!locked.ok) return locked;
  const discarded: LockedFile[] = [];
  try {
    for (const entry of snapshot.files) {
      const shotIds = entry.shotIds.filter((id) => locked.value.has(id));
      if (shotIds.length === 0) continue;
      const absolute = inProject(projectDir, entry.file);
      if (same(entry.content, await readBytes(absolute))) continue;
      if (entry.content === undefined) await rm(absolute, { force: true });
      else await writeAtomic(absolute, entry.content);
      discarded.push({ file: entry.file, kind: entry.kind, shotIds });
    }
  } catch (error) {
    return err(stageError('io', `cannot restore a locked file: ${describe(error)}`));
  }
  return ok(discarded);
}

/** "Claude tried to change locked shot s03; change discarded". */
export function lockViolationMessage(entry: LockedFile): string {
  const shots = entry.shotIds.join(', ');
  const plural = entry.shotIds.length === 1 ? 'shot' : 'shots';
  return entry.kind === 'scene'
    ? `Claude tried to change locked ${plural} ${shots}; change discarded`
    : `Claude tried to change ${entry.file}, used by locked ${plural} ${shots}; change discarded`;
}

/**
 * Runs `turn` between a snapshot and the discard; `report` gets one line per discarded change and
 * per guard failure (a broken locks.json never stops the turn itself).
 */
export async function guardLockedFiles<T>(
  projectDir: string,
  turn: () => Promise<T>,
  report: (message: string) => void,
): Promise<T> {
  const snapshot = await snapshotLockedFiles(projectDir);
  if (!snapshot.ok) report(`shot locks not enforced for this turn: ${snapshot.error.message}`);
  const result = await turn();
  if (!snapshot.ok) return result;
  const discarded = await discardLockedChanges(snapshot.value);
  if (!discarded.ok) report(discarded.error.message);
  else for (const entry of discarded.value) report(lockViolationMessage(entry));
  return result;
}
