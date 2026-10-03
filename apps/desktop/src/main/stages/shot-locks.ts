/**
 * Lock / unlock shots from the UI (PLAN.md#11.4): `locks.json` is written atomically by the stages
 * package and the change is committed at once ("Lock shot s03"), so the locked scene's current
 * state is what HEAD holds and what the lock guard keeps.
 */
import { setShotsLocked } from '@reelforge/stages';
import type { StageCommandResult } from '../../shared/stages-contract.js';

export interface LockShotsRequest {
  readonly dir: string | undefined;
  readonly shotIds: readonly string[];
  readonly locked: boolean;
  readonly now: Date;
  /** Autocommit of the project (failures are logged by the caller, never fatal). */
  readonly commit: (dir: string, message: string) => Promise<void>;
}

/** "Lock shot s03" / "Unlock shots s01, s02". */
export function lockCommitSubject(shotIds: readonly string[], locked: boolean): string {
  const noun = shotIds.length === 1 ? 'shot' : 'shots';
  return `${locked ? 'Lock' : 'Unlock'} ${noun} ${shotIds.join(', ')}`;
}

export async function lockShots(request: LockShotsRequest): Promise<StageCommandResult> {
  const { dir } = request;
  if (dir === undefined) return { status: 'error', message: 'No project is open.' };
  const ids = [...new Set(request.shotIds)];
  const written = await setShotsLocked(dir, ids, request.locked, request.now);
  if (!written.ok) return { status: 'error', message: written.error.message };
  await request.commit(dir, lockCommitSubject(ids, request.locked));
  return { status: 'ok', message: null };
}
