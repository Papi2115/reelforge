/**
 * View model of the Shots panel's list (PLAN.md#11.2): the filter (id / intent / treatment / scene
 * text, "only ⚠/✗"), the counts in the heading, and whether rows are compact (one line) or
 * detailed. Pure.
 */
import type { StoryboardShot } from '@reelforge/shared';
import { z } from 'zod';
import type { ShotBadge } from '../stages/scenes-view.js';

export type ShotListMode = 'auto' | 'compact' | 'detailed';

export const SHOTS_PREFS_KEY = 'reelforge.layout.shots.v1';
export const shotsPrefsSchema = z.object({ mode: z.enum(['auto', 'compact', 'detailed']) });
export const DEFAULT_SHOTS_PREFS: { mode: ShotListMode } = { mode: 'auto' };

/** Windows shorter than this (CSS px) start with compact rows. */
export const COMPACT_BELOW_HEIGHT = 900;

/** The filter row shows from this many shots on. */
export const FILTER_MIN_SHOTS = 5;

export function isCompact(mode: ShotListMode, windowHeight: number): boolean {
  if (mode === 'auto') return windowHeight < COMPACT_BELOW_HEIGHT;
  return mode === 'compact';
}

export interface ShotFilter {
  readonly query: string;
  /** Only shots whose QA is ⚠ or ✗. */
  readonly problemsOnly: boolean;
}

export const NO_FILTER: ShotFilter = { query: '', problemsOnly: false };

export function hasProblem(badge: ShotBadge | undefined): boolean {
  return badge?.tone === 'warning' || badge?.tone === 'failed';
}

export function filterShots(
  shots: readonly StoryboardShot[],
  badges: ReadonlyMap<string, ShotBadge>,
  filter: ShotFilter,
): readonly StoryboardShot[] {
  const words = filter.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return shots.filter((shot) => {
    if (filter.problemsOnly && !hasProblem(badges.get(shot.id))) return false;
    const text = `${shot.id} ${shot.treatment} ${shot.intent} ${shot.scene}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}

export interface ShotCounts {
  readonly ok: number;
  readonly warning: number;
  readonly failed: number;
  readonly locked: number;
}

export function shotCounts(
  shots: readonly StoryboardShot[],
  badges: ReadonlyMap<string, ShotBadge>,
  locked: ReadonlySet<string>,
): ShotCounts {
  const tone = (wanted: string): number =>
    shots.filter((shot) => badges.get(shot.id)?.tone === wanted).length;
  return {
    ok: tone('ok'),
    warning: tone('warning'),
    failed: tone('failed'),
    locked: shots.filter((shot) => locked.has(shot.id)).length,
  };
}

/** "Showing 3 of 16" while a filter hides shots, else null. */
export function filterSummary(shown: number, total: number): string | null {
  return shown === total ? null : `Showing ${String(shown)} of ${String(total)}`;
}
