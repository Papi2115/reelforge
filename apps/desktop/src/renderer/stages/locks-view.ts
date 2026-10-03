/**
 * View model of shot locks (PLAN.md#11.4): the locked set from `locks.json`, which ✓ shots
 * "Lock all ✓ shots" would lock, locked shots that may be out of sync (their words moved: sync
 * report or final review), the Shift+L shortcut and the timeline edits that would change a
 * locked shot's length (they need a confirmation). Pure.
 */
import type { FinalReview, ShotLocksFile, StoryboardShot, SyncReport } from '@reelforge/shared';
import type { FileState } from '../../shared/snapshot-contract.js';
import type { FileEdits } from '../../shared/timeline-contract.js';
import { isTextEntry, type TransportKey } from '../preview/transport-keys.js';
import type { ShotBadge } from './scenes-view.js';

const NONE: ReadonlySet<string> = new Set();

export function lockedShotSet(locks: FileState<ShotLocksFile> | undefined): ReadonlySet<string> {
  if (locks?.status !== 'ok') return NONE;
  return new Set(locks.data.shots.map((entry) => entry.shotId));
}

/** ✓ shots that are not locked yet, in storyboard order. */
export function lockableOkShots(
  shots: readonly StoryboardShot[],
  badges: ReadonlyMap<string, ShotBadge>,
  locked: ReadonlySet<string>,
): string[] {
  return shots
    .filter((shot) => badges.get(shot.id)?.tone === 'ok' && !locked.has(shot.id))
    .map((shot) => shot.id);
}

/** Locked shots whose events are off their words (> ±150 ms), from either report. */
export function outOfSyncLocked(
  locked: ReadonlySet<string>,
  sync: SyncReport | null,
  review: FinalReview | null,
): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const shot of sync?.shots ?? []) {
    if (locked.has(shot.shotId) && shot.problems > 0) ids.add(shot.shotId);
  }
  for (const entry of review?.shots ?? []) {
    if (locked.has(entry.shotId) && entry.outOfSync) ids.add(entry.shotId);
  }
  return ids;
}

/** Shift+L outside text fields (plain L is the player's "faster"). */
export function isLockShortcut(event: TransportKey): boolean {
  if (event.ctrlKey || event.altKey || event.metaKey || event.repeat || !event.shiftKey) {
    return false;
  }
  if (event.target !== undefined && isTextEntry(event.target)) return false;
  return event.key.toLowerCase() === 'l';
}

/** Locked shots whose length a timeline change would alter (both sides of a moved boundary). */
export function lockedLengthChanges(change: FileEdits, locked: ReadonlySet<string>): string[] {
  if (change.file !== 'storyboard' || locked.size === 0) return [];
  const ids = change.edits.flatMap((edit) =>
    edit.from === edit.to ? [] : [edit.left, edit.right].filter((id) => locked.has(id)),
  );
  return [...new Set(ids)];
}

/** "This shot is locked: change its length anyway?" (s03) / plural. */
export function lockedLengthQuestion(ids: readonly string[]): string {
  return ids.length === 1
    ? `Shot ${ids.join('')} is locked: change its length anyway? Its scene stays as it is.`
    : `Shots ${ids.join(', ')} are locked: change their length anyway? Their scenes stay as they are.`;
}
