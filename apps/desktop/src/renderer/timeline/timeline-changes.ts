/**
 * Builds the edit requests of timeline gestures (PLAN.md#6.5): a dragged shot boundary (min shot
 * length, snapping to words), moved/nudged/deleted/added cues and resized ranges. Pure; every
 * builder returns undefined when nothing would change.
 */
import type { StoryboardShot } from '@reelforge/shared';
import type { CuesView } from '../../shared/snapshot-contract.js';
import {
  MIN_SHOT_SECONDS,
  SNAP_TOLERANCE_SECONDS,
  type CueEdit,
  type CueTrack,
  type FileEdits,
  type RangeTrack,
} from '../../shared/timeline-contract.js';
import { roundTime } from '../../shared/timeline-edits.js';
import { snapTime } from './word-index.js';

/** Shortest ambience/music range a drag may produce (s). */
export const MIN_RANGE_SECONDS = 0.1;

export interface Snapping {
  readonly boundaries: Float64Array;
  /** False while Alt is held. */
  readonly enabled: boolean;
}

export interface Placed {
  readonly t: number;
  /** True when the time was pulled onto a word boundary. */
  readonly snapped: boolean;
}

/** Snaps `t` (if enabled) and clamps it to [min, max]; a snap outside the bounds is ignored. */
export function placeTime(t: number, snapping: Snapping, min: number, max: number): Placed {
  if (snapping.enabled) {
    const snap = snapTime(t, snapping.boundaries, SNAP_TOLERANCE_SECONDS);
    if (snap.snapped && snap.t >= min && snap.t <= max) return { t: snap.t, snapped: true };
  }
  return { t: roundTime(Math.min(Math.max(t, min), max)), snapped: false };
}

/** Where the boundary after shot `left` lands for pointer time `t`. */
export function placeBoundary(
  shots: readonly StoryboardShot[],
  left: number,
  t: number,
  snapping: Snapping,
): Placed | undefined {
  const before = shots[left];
  const after = shots[left + 1];
  if (!before || !after) return undefined;
  const min = before.t0 + Math.min(MIN_SHOT_SECONDS, before.t1 - before.t0);
  const max = after.t1 - Math.min(MIN_SHOT_SECONDS, after.t1 - after.t0);
  if (min > max) return undefined;
  return placeTime(t, snapping, min, max);
}

export function boundaryChange(
  shots: readonly StoryboardShot[],
  left: number,
  t: number,
): FileEdits | undefined {
  const before = shots[left];
  const after = shots[left + 1];
  if (!before || !after || Math.abs(before.t1 - t) < 1e-6) return undefined;
  return {
    file: 'storyboard',
    edits: [{ kind: 'move-boundary', left: before.id, right: after.id, from: before.t1, to: t }],
  };
}

function cuesChange(edits: CueEdit[]): FileEdits | undefined {
  return edits.length === 0 ? undefined : { file: 'cues', edits };
}

export interface CueRef {
  readonly track: CueTrack;
  readonly index: number;
}

/**
 * Shifts cues by `delta` seconds (sfx times; both range edges). The shift is limited so nothing
 * moves before 0 s, keeping the cues' spacing.
 */
export function shiftCuesChange(
  cues: CuesView,
  refs: readonly CueRef[],
  delta: number,
): FileEdits | undefined {
  let earliest = Number.POSITIVE_INFINITY;
  for (const ref of refs) {
    const cue = cues[ref.track][ref.index];
    if (cue) earliest = Math.min(earliest, 't' in cue ? cue.t : cue.from);
  }
  if (!Number.isFinite(earliest)) return undefined;
  const shift = roundTime(Math.max(delta, -earliest));
  if (Math.abs(shift) < 1e-6) return undefined;
  const edits: CueEdit[] = [];
  for (const ref of refs) {
    if (ref.track === 'sfx') {
      const cue = cues.sfx[ref.index];
      if (cue) {
        edits.push({
          kind: 'move-sfx',
          index: ref.index,
          from: cue.t,
          to: roundTime(cue.t + shift),
        });
      }
      continue;
    }
    const range = cues[ref.track][ref.index];
    if (!range) continue;
    edits.push({
      kind: 'set-range',
      track: ref.track,
      index: ref.index,
      from: { from: range.from, to: range.to },
      to: { from: roundTime(range.from + shift), to: roundTime(range.to + shift) },
    });
  }
  return cuesChange(edits);
}

/** Deletes cues; per track from the highest index down, so earlier indices stay valid. */
export function deleteCuesChange(cues: CuesView, refs: readonly CueRef[]): FileEdits | undefined {
  const sorted = [...refs].sort((a, b) =>
    a.track === b.track ? b.index - a.index : a.track.localeCompare(b.track),
  );
  const edits: CueEdit[] = [];
  for (const ref of sorted) {
    const cue = cues[ref.track][ref.index];
    if (!cue) continue;
    edits.push({
      kind: 'delete-cue',
      track: ref.track,
      index: ref.index,
      at: 't' in cue ? cue.t : cue.from,
    });
  }
  return cuesChange(edits);
}

/** Appends a built-in sfx at `t`. */
export function addSfxChange(cues: CuesView, t: number, name: string): FileEdits {
  return {
    file: 'cues',
    edits: [
      { kind: 'insert-cue', track: 'sfx', index: cues.sfx.length, cue: { t: roundTime(t), name } },
    ],
  };
}

export type RangeGrip = 'from' | 'to' | 'move';

export interface PlacedRange {
  readonly from: number;
  readonly to: number;
  /** The edge time that snapped to a word boundary. */
  readonly snapAt: number | undefined;
}

/** New range for dragging `grip` of a range to pointer time `t` (`grabOffset`: t - from at grab). */
export function placeRange(
  range: { readonly from: number; readonly to: number },
  grip: RangeGrip,
  t: number,
  grabOffset: number,
  snapping: Snapping,
  duration: number,
): PlacedRange {
  if (grip === 'from') {
    const from = placeTime(t, snapping, 0, range.to - MIN_RANGE_SECONDS);
    return { from: from.t, to: range.to, snapAt: from.snapped ? from.t : undefined };
  }
  if (grip === 'to') {
    const max = Math.max(duration, range.to);
    const to = placeTime(t, snapping, range.from + MIN_RANGE_SECONDS, max);
    return { from: range.from, to: to.t, snapAt: to.snapped ? to.t : undefined };
  }
  const length = range.to - range.from;
  const from = placeTime(t - grabOffset, snapping, 0, Number.POSITIVE_INFINITY);
  return {
    from: from.t,
    to: roundTime(from.t + length),
    snapAt: from.snapped ? from.t : undefined,
  };
}

export function rangeChange(
  cues: CuesView,
  track: RangeTrack,
  index: number,
  next: { readonly from: number; readonly to: number },
): FileEdits | undefined {
  const range = cues[track][index];
  if (!range) return undefined;
  if (Math.abs(range.from - next.from) < 1e-6 && Math.abs(range.to - next.to) < 1e-6) {
    return undefined;
  }
  return cuesChange([
    {
      kind: 'set-range',
      track,
      index,
      from: { from: range.from, to: range.to },
      to: { from: next.from, to: next.to },
    },
  ]);
}

export function gainChange(cues: CuesView, ref: CueRef, gainDb: number): FileEdits | undefined {
  const cue = cues[ref.track][ref.index];
  const target = Math.min(Math.max(Math.round(gainDb * 10) / 10, -60), 24);
  if (!cue || !Number.isFinite(gainDb) || Math.abs(cue.gainDb - target) < 1e-6) return undefined;
  return cuesChange([
    { kind: 'set-gain', track: ref.track, index: ref.index, from: cue.gainDb, to: target },
  ]);
}
