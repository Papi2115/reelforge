/**
 * Snapping to the beat grid (PLAN.md#12.21, pure):
 * - `snapCutsToBeats` nudges the boundary between two unlocked shots to the nearest beat or
 *   accented word start within ±100 ms, only inside the pause the cut sits in (never into a
 *   word), keeping every shot at least 1 s long and longer than its transition. A cut already on
 *   the grid (±1 frame) or next to a locked shot never moves.
 * - `snapGestures` moves the sound director's hits / risers / emphasis (whole gestures, so a riser
 *   still ends on its hit) so their peak — the event time the cue's lead is measured from — lands
 *   on the nearest beat or accent within ±120 ms. Transition sounds follow the cuts instead.
 * - `snapWhooshCues` does the same for the whooshes of the final cue list (scene accents, Claude).
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

/** Sounds that sweep into their peak (the whooshes of the report and of `snapWhooshCues`). */
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
/** Anchor sync tolerance of the scene QA / sync report (scenes/sync.ts SYNC_TOLERANCE_S). */
const ANCHOR_TOLERANCE_S = 0.15;
/** A cue this close to an anchor is matched to it by the sync report (scenes/sync.ts). */
const ANCHOR_NEAR_S = 0.5;

export interface CueLike {
  readonly t: number;
  /** Absent for a cue that plays a file. */
  readonly name?: string | undefined;
}

export function isWhoosh(cue: CueLike): boolean {
  return cue.name !== undefined && WHOOSH_RECIPES.has(cue.name);
}

/** Where a whoosh starting at `start` peaks: on the cut its sweep runs into, else after its lead. */
export function whooshPeak(
  start: number,
  cuts: readonly number[],
): { readonly peak: number; readonly atCut: boolean } {
  const cut = cuts.find((t) => t >= start - EPSILON && t <= start + WHOOSH_LEAD_MAX_S);
  return cut === undefined
    ? { peak: start + DEFAULT_WHOOSH_LEAD_S, atCut: false }
    : { peak: cut, atCut: true };
}

/** False when a cue moved to `to` would sit off the anchor it is matched to (> ±150 ms). */
function keepsAnchorSync(to: number, anchors: readonly number[]): boolean {
  let nearest: number | undefined;
  for (const anchor of anchors) {
    if (nearest === undefined || Math.abs(to - anchor) < Math.abs(to - nearest)) nearest = anchor;
  }
  if (nearest === undefined || Math.abs(to - nearest) > ANCHOR_NEAR_S) return true;
  return Math.abs(to - nearest) <= ANCHOR_TOLERANCE_S + EPSILON;
}

export interface WhooshSnapResult<C extends CueLike> {
  readonly cues: C[];
  /** Whooshes moved so their peak lands on the grid. */
  readonly snapped: number;
}

/**
 * The whooshes of a cue list that the director's gesture snapping never sees (scene `sfx.at`
 * accents, Claude's cues): each moves so its peak lands on the nearest beat or accent within
 * ±120 ms. A whoosh peaking on a cut follows the cut (the cuts are snapped), and a cue matched to
 * a scene anchor never ends up more than ±150 ms from it. Order and every other cue unchanged.
 */
export function snapWhooshCues<C extends CueLike>(
  cues: readonly C[],
  grid: GridTimes,
  cuts: readonly number[],
  anchors: readonly number[],
  maxS = MAX_CUE_SNAP_S,
): WhooshSnapResult<C> {
  let snapped = 0;
  const out = cues.map((cue): C => {
    if (!isWhoosh(cue)) return cue;
    const { peak, atCut } = whooshPeak(cue.t, cuts);
    if (atCut) return cue;
    const target = grid.nearest(peak, maxS);
    if (target === undefined || Math.abs(target - peak) < EPSILON) return cue;
    const to = round3(cue.t + target - peak);
    if (to < 0 || !keepsAnchorSync(to, anchors)) return cue;
    // The move must not run the sweep into a cut (it would then peak there instead).
    if (whooshPeak(to, cuts).atCut) return cue;
    snapped += 1;
    return { ...cue, t: to };
  });
  return { cues: out, snapped };
}
