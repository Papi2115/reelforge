/**
 * Applies timeline edits (PLAN.md#6.5) to shots and cue lists, returning the edits that undo
 * them. Pure and generic over the item types: main applies them strictly to the raw JSON of
 * `storyboard.json` / `cues.json` (unknown keys survive); the renderer applies them leniently to
 * its view model to show an edit before the rewritten file has been read back.
 * Strict: every edit must match what it expects to replace, or the whole change is rejected.
 * Lenient: edits that do not fit are skipped (the next file read corrects the view).
 */
import {
  MIN_SHOT_SECONDS,
  type CueEdit,
  type CueTrack,
  type MoveBoundaryEdit,
  type RawCue,
} from './timeline-contract.js';

/** Times written by the editor are ms-rounded; anything closer counts as equal. */
const EPSILON = 5e-4;

export type ApplyMode = 'strict' | 'lenient';

export type EditOutcome<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: string };

export interface ShotTimes {
  readonly id: string;
  readonly t0: number;
  readonly t1: number;
}

export interface SfxTimes {
  readonly t: number;
  readonly gainDb?: number | undefined;
}

export interface RangeTimes {
  readonly from: number;
  readonly to: number;
  readonly gainDb?: number | undefined;
}

export interface CueLists<Sfx extends SfxTimes, Range extends RangeTimes> {
  readonly sfx: readonly Sfx[];
  readonly ambience: readonly Range[];
  readonly music: readonly Range[];
}

/** Converts between the caller's cue items and raw cues (inserts, and the undo of deletes). */
export interface CueAdapter<Sfx extends SfxTimes, Range extends RangeTimes> {
  sfxFromRaw(raw: RawCue): Sfx | undefined;
  rangeFromRaw(raw: RawCue): Range | undefined;
  toRaw(item: Sfx | Range): RawCue;
}

function near(a: number, b: number): boolean {
  return Math.abs(a - b) <= EPSILON;
}

/** Rounds to the editor's time resolution (1 ms). */
export function roundTime(t: number): number {
  return Math.round(t * 1000) / 1000;
}

/** Display name of a cue: its id, recipe name or file name. */
export function cueLabel(cue: Readonly<Record<string, unknown>>, fallback: string): string {
  const { id, name, file } = cue;
  if (typeof id === 'string') return id;
  if (typeof name === 'string') return name;
  if (typeof file === 'string') return file.split(/[\\/]/).pop() ?? fallback;
  return fallback;
}

/** Adjacent shot pairs that do not touch (gap or overlap). */
export function contiguityBreaks(shots: readonly ShotTimes[]): number {
  let breaks = 0;
  for (let index = 1; index < shots.length; index += 1) {
    const previous = shots[index - 1];
    const shot = shots[index];
    if (previous && shot && !near(previous.t1, shot.t0)) breaks += 1;
  }
  return breaks;
}

function moveBoundary(shots: ShotTimes[], edit: MoveBoundaryEdit): string | undefined {
  const leftIndex = shots.findIndex((shot) => shot.id === edit.left);
  const left = shots[leftIndex];
  const right = shots[leftIndex + 1];
  if (!left || right?.id !== edit.right) {
    return `shots ${edit.left} and ${edit.right} are not adjacent`;
  }
  if (!near(left.t1, edit.from) || !near(right.t0, edit.from)) {
    return `the boundary ${edit.left}/${edit.right} is no longer at ${String(edit.from)} s`;
  }
  const leftLength = edit.to - left.t0;
  const rightLength = right.t1 - edit.to;
  const minLeft = Math.min(MIN_SHOT_SECONDS, left.t1 - left.t0);
  const minRight = Math.min(MIN_SHOT_SECONDS, right.t1 - right.t0);
  if (leftLength < minLeft - EPSILON || rightLength < minRight - EPSILON) {
    return `shots must stay at least ${String(MIN_SHOT_SECONDS)} s long`;
  }
  shots[leftIndex] = { ...left, t1: edit.to };
  shots[leftIndex + 1] = { ...right, t0: edit.to };
  return undefined;
}

/** Moves shot boundaries; the inverse moves them back (reverse order). */
export function applyBoundaryEdits<Shot extends ShotTimes>(
  shots: readonly Shot[],
  edits: readonly MoveBoundaryEdit[],
  mode: ApplyMode,
): EditOutcome<{ readonly shots: Shot[]; readonly inverse: MoveBoundaryEdit[] }> {
  const next = [...shots];
  const inverse: MoveBoundaryEdit[] = [];
  for (const edit of edits) {
    const error = moveBoundary(next, edit);
    if (error !== undefined) {
      if (mode === 'strict') return { ok: false, error };
      continue;
    }
    inverse.unshift({ ...edit, from: edit.to, to: edit.from });
  }
  return { ok: true, value: { shots: next, inverse } };
}

interface MutableCues<Sfx extends SfxTimes, Range extends RangeTimes> {
  sfx: Sfx[];
  ambience: Range[];
  music: Range[];
}

function cueStart(item: SfxTimes | RangeTimes): number {
  return 't' in item ? item.t : item.from;
}

type CueStep = { readonly error: string } | { readonly inverse: CueEdit };

function applyCueEdit<Sfx extends SfxTimes, Range extends RangeTimes>(
  cues: MutableCues<Sfx, Range>,
  edit: CueEdit,
  adapter: CueAdapter<Sfx, Range>,
): CueStep {
  const track: CueTrack = edit.kind === 'move-sfx' ? 'sfx' : edit.track;
  const list: (Sfx | Range)[] = cues[track];
  const missing = { error: `${track} cue ${String(edit.index + 1)} does not exist` };
  const stale = { error: `${track} cue ${String(edit.index + 1)} changed on disk` };
  switch (edit.kind) {
    case 'move-sfx': {
      const cue = cues.sfx[edit.index];
      if (!cue) return missing;
      if (!near(cue.t, edit.from)) return stale;
      cues.sfx[edit.index] = { ...cue, t: edit.to };
      return { inverse: { ...edit, from: edit.to, to: edit.from } };
    }
    case 'set-range': {
      const range = cues[edit.track][edit.index];
      if (!range) return missing;
      if (!near(range.from, edit.from.from) || !near(range.to, edit.from.to)) return stale;
      cues[edit.track][edit.index] = { ...range, from: edit.to.from, to: edit.to.to };
      return { inverse: { ...edit, from: edit.to, to: edit.from } };
    }
    case 'set-gain': {
      const cue = list[edit.index];
      if (!cue) return missing;
      if (!near(cue.gainDb ?? 0, edit.from)) return stale;
      list[edit.index] = { ...cue, gainDb: edit.to };
      return { inverse: { ...edit, from: edit.to, to: edit.from } };
    }
    case 'insert-cue': {
      if (edit.index > list.length) return missing;
      if (edit.track === 'sfx') {
        const cue = adapter.sfxFromRaw(edit.cue);
        if (!cue) return { error: 'the new sfx cue has no valid time' };
        cues.sfx.splice(edit.index, 0, cue);
        return { inverse: { kind: 'delete-cue', track: 'sfx', index: edit.index, at: cue.t } };
      }
      const range = adapter.rangeFromRaw(edit.cue);
      if (!range) return { error: `the new ${edit.track} cue has no valid range` };
      cues[edit.track].splice(edit.index, 0, range);
      return {
        inverse: { kind: 'delete-cue', track: edit.track, index: edit.index, at: range.from },
      };
    }
    case 'delete-cue': {
      const cue = list[edit.index];
      if (!cue) return missing;
      if (!near(cueStart(cue), edit.at)) return stale;
      list.splice(edit.index, 1);
      return {
        inverse: {
          kind: 'insert-cue',
          track: edit.track,
          index: edit.index,
          cue: adapter.toRaw(cue),
        },
      };
    }
  }
}

/** Applies cue edits in order; the inverse undoes them (reverse order). */
export function applyCueEdits<Sfx extends SfxTimes, Range extends RangeTimes>(
  cues: CueLists<Sfx, Range>,
  edits: readonly CueEdit[],
  adapter: CueAdapter<Sfx, Range>,
  mode: ApplyMode,
): EditOutcome<{ readonly cues: MutableCues<Sfx, Range>; readonly inverse: CueEdit[] }> {
  const next: MutableCues<Sfx, Range> = {
    sfx: [...cues.sfx],
    ambience: [...cues.ambience],
    music: [...cues.music],
  };
  const inverse: CueEdit[] = [];
  for (const edit of edits) {
    const step = applyCueEdit(next, edit, adapter);
    if ('error' in step) {
      if (mode === 'strict') return { ok: false, error: step.error };
      continue;
    }
    inverse.unshift(step.inverse);
  }
  return { ok: true, value: { cues: next, inverse } };
}
