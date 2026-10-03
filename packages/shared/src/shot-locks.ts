/**
 * `locks.json` in the project root (PLAN.md#11.4): shots the user approved and locked. A locked
 * shot's scene file (and the project props it uses) is never rebuilt or changed by the scene
 * stage, the reviews or Claude turns until it is unlocked. Tracked by git (unlike `.reelforge/`),
 * so a project revert or the history brings the locks back together with the scenes they protect.
 */
import { z } from 'zod';
import { shotIdSchema } from './storyboard.js';

export const SHOT_LOCKS_VERSION = 1;
/** Project-relative location (tracked). */
export const SHOT_LOCKS_FILE = 'locks.json';

export const shotLockSchema = z.object({
  shotId: shotIdSchema,
  lockedAt: z.iso.datetime(),
});
export type ShotLock = z.infer<typeof shotLockSchema>;

export const shotLocksFileSchema = z.object({
  version: z.literal(SHOT_LOCKS_VERSION),
  /** One entry per locked shot, sorted by shot id (stable diffs). */
  shots: z.array(shotLockSchema),
});
export type ShotLocksFile = z.infer<typeof shotLocksFileSchema>;

export function emptyShotLocks(): ShotLocksFile {
  return { version: SHOT_LOCKS_VERSION, shots: [] };
}

export function lockedShotIds(file: ShotLocksFile | undefined): ReadonlySet<string> {
  return new Set((file?.shots ?? []).map((entry) => entry.shotId));
}

/** Locks (or unlocks) `ids`; already locked shots keep their original `lockedAt`. Pure. */
export function withShotsLocked(
  file: ShotLocksFile,
  ids: readonly string[],
  locked: boolean,
  now: Date,
): ShotLocksFile {
  const entries = new Map(file.shots.map((entry) => [entry.shotId, entry]));
  for (const id of ids) {
    if (!locked) entries.delete(id);
    else if (!entries.has(id)) entries.set(id, { shotId: id, lockedAt: now.toISOString() });
  }
  const shots = [...entries.values()].sort((first, second) =>
    first.shotId < second.shotId ? -1 : first.shotId > second.shotId ? 1 : 0,
  );
  return { version: SHOT_LOCKS_VERSION, shots };
}
