/**
 * Snapping to the beat grid (PLAN.md#12.21, pure):
 * - `snapCutsToBeats` nudges the boundary between two unlocked shots to the nearest beat or
 *   accented word start within ±100 ms, only inside the pause the cut sits in (never into a
 *   word), keeping every shot at least 1 s long and longer than its transition. A cut already on
 *   the grid (±1 frame) or next to a locked shot never moves.
 * - `snapGestures` moves the sound director's hits / risers / emphasis (whole gestures, so a riser
 *   still ends on its hit) so their peak — the event time the cue's lead is measured from — lands
 *   on the nearest beat or accent within ±120 ms. Transition sounds follow the cuts instead.
 */
import type { StoryboardShot } from '@reelforge/shared';
import type { CueEventKind } from '../sound/cue-rules.js';
import type { DirectorWord, Gesture } from '../sound/cue-events.js';
import { cutRegion, GridTimes, insideWord, MAX_CUT_NUDGE_S } from './grid.js';

/** One video frame at 30 fps: "on the grid" for a cut. */
export const GRID_FRAME_S = 1 / 30;
/** Hits and risers move at most this far (s). */
export const MAX_CUE_SNAP_S = 0.12;
/** A shot never gets shorter than this by snapping (the storyboard's hard minimum). */
const MIN_SHOT_S = 1;
const EPSILON = 1e-6;

const round3 = (value: number): number => Math.round(value * 1000) / 1000;

export interface CutNudge {
  /** The shot that starts at the cut. */
  readonly shotId: string;
  readonly from: number;
  readonly to: number;
}

export interface CutSnapResult {
  readonly shots: StoryboardShot[];
  readonly nudges: readonly CutNudge[];
  /** Cuts next to a locked shot (left alone). */
  readonly locked: number;
  /** Cuts off the grid with no reachable beat or accent (left alone). */
  readonly kept: number;
}

export interface CutSnapOptions {
  readonly maxNudgeS?: number;
  readonly frameS?: number;
}

function transitionS(shot: StoryboardShot): number {
  const transition = shot.transitionIn;
  return transition === undefined || transition.type === 'cut' ? 0 : transition.duration;
}

/** The shortest a shot may become: 1 s, and longer than its own transition. */
function minLength(shot: StoryboardShot): number {
  return Math.max(MIN_SHOT_S, transitionS(shot) + 0.1);
}

export function snapCutsToBeats(
  shots: readonly StoryboardShot[],
  grid: GridTimes,
  words: readonly DirectorWord[],
  locked: ReadonlySet<string>,
  options: CutSnapOptions = {},
): CutSnapResult {
  const maxNudge = options.maxNudgeS ?? MAX_CUT_NUDGE_S;
  const frame = options.frameS ?? GRID_FRAME_S;
  const out = shots.map((shot) => ({ ...shot }));
  const nudges: CutNudge[] = [];
  let lockedCount = 0;
  let kept = 0;
  for (let index = 1; index < out.length; index++) {
    const previous = out[index - 1];
    const shot = out[index];
    if (previous === undefined || shot === undefined) continue;
    const cut = shot.t0;
    if (locked.has(previous.id) || locked.has(shot.id)) {
      lockedCount += 1;
      continue;
    }
    if (grid.nearest(cut, frame) !== undefined) continue;
    const region = cutRegion(cut, words, maxNudge);
    const lo = Math.max(region?.lo ?? cut, previous.t0 + minLength(previous));
    const hi = Math.min(region?.hi ?? cut, shot.t1 - minLength(shot));
    const target =
      region === undefined
        ? undefined
        : grid
            .within(lo, hi)
            .filter((t) => !insideWord(words, t))
            .sort((a, b) => Math.abs(a - cut) - Math.abs(b - cut) || a - b)[0];
    if (target === undefined || Math.abs(target - cut) < EPSILON) {
      kept += 1;
      continue;
    }
    const to = round3(target);
    out[index - 1] = { ...previous, t1: to };
    out[index] = { ...shot, t0: to };
    nudges.push({ shotId: shot.id, from: cut, to });
  }
  return { shots: out, nudges, locked: lockedCount, kept };
}

/** Gesture kinds whose peak snaps: spoken numbers, big numbers (whoosh-impact), emphasis. */
export const SNAP_GESTURE_KINDS: ReadonlySet<CueEventKind> = new Set<CueEventKind>([
  'number',
  'number-big',
  'emphasis-hit',
  'emphasis-riser',
]);

export interface GestureSnapResult {
  readonly gestures: Gesture[];
  /** Gestures moved onto the grid. */
  readonly snapped: number;
}

export function snapGestures(
  gestures: readonly Gesture[],
  grid: GridTimes,
  maxS = MAX_CUE_SNAP_S,
): GestureSnapResult {
  let snapped = 0;
  const out = gestures.map((gesture): Gesture => {
    if (!SNAP_GESTURE_KINDS.has(gesture.kind)) return gesture;
    // The peak is the last cue's event time (a riser + hit gesture peaks on the hit).
    const peak = gesture.cues.at(-1)?.t;
    if (peak === undefined) return gesture;
    const target = grid.nearest(peak, maxS);
    if (target === undefined || Math.abs(target - peak) < EPSILON) return gesture;
    const delta = target - peak;
    if (gesture.cues.some((cue) => cue.t + delta < 0)) return gesture;
    snapped += 1;
    return { ...gesture, cues: gesture.cues.map((cue) => ({ ...cue, t: round3(cue.t + delta) })) };
  });
  return { gestures: out, snapped };
}
