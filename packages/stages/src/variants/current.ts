/**
 * The current variant sets of a project (PLAN.md#11.3): a set whose shot left the storyboard, or
 * whose shot entry or scene changed since it was built, is stale and removed on read. After an
 * app restart, variants still marked `building` were interrupted: they are dropped (and a set
 * without any ready variant is removed).
 */
import { err, ok, type Result } from '@reelforge/claude-bridge';
import { storyboardFileSchema, type ShotVariantSet, type StoryboardShot } from '@reelforge/shared';
import { requireProjectJson } from '../files.js';
import { FILES } from '../paths.js';
import type { SceneJob } from '../scenes/job.js';
import { selectShots } from '../scenes/job.js';
import { stageError, type StageError } from '../types.js';
import {
  readVariantSet,
  removeVariantSet,
  sameBase,
  updateVariantSet,
  variantBase,
  variantShotIds,
} from './store.js';

export function lockedShotError(shotId: string): StageError {
  return stageError('invalid-input', `Shot ${shotId} is locked — unlock first`);
}

/** The one storyboard shot a variant action is about. */
export function variantShot(
  job: SceneJob,
  shotId: string | undefined,
): Result<StoryboardShot, StageError> {
  if (shotId === undefined) {
    return err(stageError('invalid-input', 'shot variants need exactly one shot'));
  }
  const selected = selectShots(job, [shotId]);
  if (!selected.ok) return selected;
  const [shot] = selected.value;
  return shot === undefined ? err(stageError('invalid-input', `unknown shot ${shotId}`)) : ok(shot);
}

export interface CurrentSet {
  /** The usable set, if any. */
  readonly set: ShotVariantSet | undefined;
  /** A set existed but was stale and has been removed. */
  readonly stale: boolean;
}

/** The shot's set if it still matches the shot (a stale one is removed). */
export async function currentSetOf(
  projectDir: string,
  shot: StoryboardShot,
): Promise<Result<CurrentSet, StageError>> {
  const read = await readVariantSet(projectDir, shot.id);
  if (!read.ok) return read;
  if (read.value === undefined) return ok({ set: undefined, stale: false });
  const base = await variantBase(projectDir, shot);
  if (!base.ok) return base;
  if (sameBase(read.value.base, base.value)) return ok({ set: read.value, stale: false });
  const removed = await removeVariantSet(projectDir, shot.id);
  return removed.ok ? ok({ set: undefined, stale: true }) : removed;
}

export function currentVariantSet(
  job: SceneJob,
  shot: StoryboardShot,
): Promise<Result<CurrentSet, StageError>> {
  return currentSetOf(job.ctx.projectDir, shot);
}

export interface VariantSets {
  readonly sets: readonly ShotVariantSet[];
  /** Shot ids whose stale or orphaned variants were removed now. */
  readonly removed: readonly string[];
}

/** Every usable set of the project, in storyboard order (stale ones removed). */
export async function readVariantSets(
  projectDir: string,
): Promise<Result<VariantSets, StageError>> {
  const ids = await variantShotIds(projectDir);
  if (!ids.ok || ids.value.length === 0) return ids.ok ? ok({ sets: [], removed: [] }) : ids;
  const storyboard = await requireProjectJson(projectDir, FILES.storyboard, storyboardFileSchema);
  if (!storyboard.ok) return storyboard;
  const sets: ShotVariantSet[] = [];
  const removed: string[] = [];
  const byId = new Map(storyboard.value.shots.map((shot) => [shot.id, shot]));
  for (const id of ids.value) {
    const shot = byId.get(id);
    if (shot === undefined) {
      const dropped = await removeVariantSet(projectDir, id);
      if (!dropped.ok) return dropped;
      removed.push(id);
      continue;
    }
    const current = await currentSetOf(projectDir, shot);
    if (!current.ok) return current;
    if (current.value.stale) removed.push(id);
    if (current.value.set !== undefined) sets.push(current.value.set);
  }
  const order = storyboard.value.shots.map((shot) => shot.id);
  sets.sort((first, second) => order.indexOf(first.shotId) - order.indexOf(second.shotId));
  return ok({ sets, removed });
}

/**
 * After a restart nothing is being built: `building` variants become dropped ("interrupted") and
 * sets left without a ready variant are removed. Call only when no scene run is active.
 */
export async function settleInterruptedVariants(
  projectDir: string,
  now: Date,
): Promise<Result<readonly string[], StageError>> {
  const ids = await variantShotIds(projectDir);
  if (!ids.ok) return ids;
  const settled: string[] = [];
  for (const id of ids.value) {
    const read = await readVariantSet(projectDir, id);
    if (!read.ok) return read;
    const set = read.value;
    if (set === undefined || !set.variants.some((variant) => variant.status === 'building')) {
      continue;
    }
    settled.push(id);
    if (!set.variants.some((variant) => variant.status === 'ready')) {
      const removed = await removeVariantSet(projectDir, id);
      if (!removed.ok) return removed;
      continue;
    }
    const written = await updateVariantSet(projectDir, id, (current) => {
      const base = current ?? set;
      return {
        ...base,
        variants: base.variants.map((variant) =>
          variant.status === 'building'
            ? {
                ...variant,
                status: 'dropped' as const,
                reason: 'interrupted (the app closed while it was building)',
                updatedAt: now.toISOString(),
              }
            : variant,
        ),
      };
    });
    if (!written.ok) return written;
  }
  return ok(settled);
}
