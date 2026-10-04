/**
 * The beat-sync report (PLAN.md#12.21, pure): the share of cuts within one frame of a beat or an
 * accented word, the whooshes whose peak lands within the cue window of one, and what the last
 * snapping did. `ok` = at least 90 % of the cuts on the grid (and of the whooshes, when any).
 */
import {
  BEAT_SYNC_REPORT_VERSION,
  BEAT_SYNC_TARGET,
  type BeatSyncReport,
  type StoryboardShot,
} from '@reelforge/shared';
import type { GridTimes } from './grid.js';
import { GRID_FRAME_S, MAX_CUE_SNAP_S, type CutSnapResult } from './snap.js';

/** Sounds that sweep into their peak (the whooshes of the report). */
export const WHOOSH_RECIPES: ReadonlySet<string> = new Set([
  'whoosh',
  'swoosh-in',
  'swoosh-out',
  'whoosh-impact',
]);
/** A whoosh whose sweep starts this long before a cut peaks on that cut. */
const WHOOSH_LEAD_MAX_S = 0.35;
/** Peak of a whoosh with no cut ahead (the rule table's lead). */
const DEFAULT_WHOOSH_LEAD_S = 0.25;

const round2 = (value: number): number => Math.round(value * 100) / 100;
const round4 = (value: number): number => Math.round(value * 10_000) / 10_000;
const share = (part: number, total: number): number => (total === 0 ? 1 : round4(part / total));

export interface SfxCueLike {
  readonly t: number;
  /** Absent for a cue that plays a file. */
  readonly name?: string | undefined;
}

export function cutStats(
  shots: readonly Pick<StoryboardShot, 't0'>[],
  grid: GridTimes,
): BeatSyncReport['cuts'] {
  const cuts = shots.slice(1).map((shot) => shot.t0);
  const onGrid = cuts.filter((cut) => grid.nearest(cut, GRID_FRAME_S) !== undefined).length;
  return { total: cuts.length, onGrid, fraction: share(onGrid, cuts.length) };
}

export function whooshStats(
  cues: readonly SfxCueLike[],
  shots: readonly Pick<StoryboardShot, 't0'>[],
  grid: GridTimes,
): NonNullable<BeatSyncReport['whooshes']> {
  const cuts = shots.slice(1).map((shot) => shot.t0);
  const whooshes = cues.filter((cue) => cue.name !== undefined && WHOOSH_RECIPES.has(cue.name));
  const inWindow = whooshes.filter((cue) => {
    const cut = cuts.find((t) => t >= cue.t - 1e-6 && t <= cue.t + WHOOSH_LEAD_MAX_S);
    const peak = cut ?? cue.t + DEFAULT_WHOOSH_LEAD_S;
    return grid.nearest(peak, MAX_CUE_SNAP_S) !== undefined;
  }).length;
  return {
    total: whooshes.length,
    inWindow,
    fraction: share(inWindow, whooshes.length),
    windowS: MAX_CUE_SNAP_S,
  };
}

export function nudgeStats(
  snap: CutSnapResult,
  reverted: boolean,
): NonNullable<BeatSyncReport['nudges']> {
  const distances = snap.nudges.map((nudge) => Math.abs(nudge.to - nudge.from) * 1000);
  const total = distances.reduce((sum, value) => sum + value, 0);
  return {
    moved: reverted ? 0 : snap.nudges.length,
    locked: snap.locked,
    kept: snap.kept,
    meanMs: reverted || distances.length === 0 ? 0 : round2(total / distances.length),
    maxMs: reverted ? 0 : round2(Math.max(0, ...distances)),
    reverted,
  };
}

export interface ReportParts {
  readonly cuts: BeatSyncReport['cuts'];
  readonly nudges?: BeatSyncReport['nudges'] | undefined;
  readonly whooshes?: BeatSyncReport['whooshes'] | undefined;
  readonly cues?: BeatSyncReport['cues'] | undefined;
}

export function beatSyncReport(parts: ReportParts): BeatSyncReport {
  const whooshesOk = parts.whooshes === undefined || parts.whooshes.fraction >= BEAT_SYNC_TARGET;
  return {
    version: BEAT_SYNC_REPORT_VERSION,
    frameS: round4(GRID_FRAME_S),
    cuts: parts.cuts,
    ...(parts.nudges === undefined ? {} : { nudges: parts.nudges }),
    ...(parts.whooshes === undefined ? {} : { whooshes: parts.whooshes }),
    ...(parts.cues === undefined ? {} : { cues: parts.cues }),
    ok: parts.cuts.fraction >= BEAT_SYNC_TARGET && whooshesOk,
  };
}
