/**
 * Lock / unlock shots from the UI (PLAN.md#11.4): `locks.json` is written atomically by the stages
 * package and the change is committed at once ("Lock shot s03"). A lock commits the locked shots'
 * scene files (and the project props they call) with it, so the locked scene's current state is
 * what HEAD holds and what the lock guard keeps; nothing else is committed (another shot may be
 * half-built right now).
 */
import { SHOT_LOCKS_FILE } from '@reelforge/shared';
import { lockedFiles, setShotsLocked } from '@reelforge/stages';
import type { StageCommandResult } from '../../shared/stages-contract.js';

export interface LockShotsRequest {
  readonly dir: string | undefined;
  readonly shotIds: readonly string[];
  readonly locked: boolean;
  readonly now: Date;
  /** Autocommit of `paths` (failures are logged by the caller, never fatal). */
  readonly commit: (dir: string, message: string, paths: readonly string[]) => Promise<void>;
}

/** "Lock shot s03" / "Unlock shots s01, s02". */
export function lockCommitSubject(shotIds: readonly string[], locked: boolean): string {
  const noun = shotIds.length === 1 ? 'shot' : 'shots';
  return `${locked ? 'Lock' : 'Unlock'} ${noun} ${shotIds.join(', ')}`;
}

/** locks.json, plus on a lock the files the newly locked shots protect. */
async function lockCommitPaths(
  dir: string,
  ids: readonly string[],
  locked: boolean,
): Promise<string[]> {
  if (!locked) return [SHOT_LOCKS_FILE];
  const protectedFiles = await lockedFiles(dir, new Set(ids));
  // Unreadable scene: commit locks.json alone (the lock guard reports the scene itself).
  return [SHOT_LOCKS_FILE, ...(protectedFiles.ok ? protectedFiles.value.map((f) => f.file) : [])];
}

export async function lockShots(request: LockShotsRequest): Promise<StageCommandResult> {
  const { dir } = request;
  if (dir === undefined) return { status: 'error', message: 'No project is open.' };
  const ids = [...new Set(request.shotIds)];
  const written = await setShotsLocked(dir, ids, request.locked, request.now);
  if (!written.ok) return { status: 'error', message: written.error.message };
  const paths = await lockCommitPaths(dir, ids, request.locked);
  await request.commit(dir, lockCommitSubject(ids, request.locked), paths);
  return { status: 'ok', message: null };
}
