/**
 * The beat grid of a film (PLAN.md#12.21, pure and deterministic): per act a tempo within its
 * mood's range and a phase, chosen so the beats fit the speech — as many cut windows (where a
 * shot boundary may move, `cutRegion`) as possible contain a beat and as many accented words as
 * possible start on one — with a mild pull towards the speech pace and the act's tension (faster
 * talk / higher tension = a livelier tempo inside the range). Result: `timing/beats.json`.
 */
import { moodTempoRange, type MusicMood } from '@reelforge/pipeline';
import {
  BEATS_FILE_VERSION,
  meanTension,
  type BeatAccent,
  type BeatAct,
  type BeatsFile,
  type TensionPoint,
} from '@reelforge/shared';
import type { DirectorWord } from '../sound/cue-events.js';
import { findAccents } from './accents.js';

/** A cut moves at most this far to reach a beat or an accent (s). */
export const MAX_CUT_NUDGE_S = 0.1;
/** Tempo search step (bpm). */
const BPM_STEP = 0.25;
/** An accent "on the beat" in the fit: within this of one (s). */
const ACCENT_FIT_S = 0.035;
/** Weight of a reachable beat in a cut window against one accent. */
const CUT_WEIGHT = 3;
const ACCENT_WEIGHT: Readonly<Record<BeatAccent['kind'], number>> = {
  phrase: 1,
  emphasis: 1,
  number: 0.75,
  final: 0.5,
};
/** Score cost of the tempo being a whole range away from the preferred one. */
const PACE_PULL = 0.75;
const EDGE = 0.001;
const EPSILON = 1e-9;

const round3 = (value: number): number => Math.round(value * 1000) / 1000;
const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const mod = (value: number, period: number): number => ((value % period) + period) % period;

export interface GridAct {
  readonly from: number;
  readonly to: number;
  readonly mood: MusicMood;
}

export interface BeatGridInput {
  readonly words: readonly DirectorWord[];
  readonly durationS: number;
  /** Acts of the film with their moods (`sound/acts.ts`); none = one calm act over the film. */
  readonly acts: readonly GridAct[];
  /** Shot boundaries (global s) the grid should reach. */
  readonly cuts?: readonly number[] | undefined;
  readonly tension?: readonly TensionPoint[] | undefined;
}

export interface CutRegion {
  readonly lo: number;
  readonly hi: number;
}

/**
 * Where a cut at `c` may move: within `maxNudgeS`, never across or into a word — inside the pause
 * it sits in (a cut a little inside a word belongs to the pause before that word).
 */
export function cutRegion(
  c: number,
  words: readonly DirectorWord[],
  maxNudgeS = MAX_CUT_NUDGE_S,
): CutRegion | undefined {
  const inside = words.find((word) => word.t < c - EPSILON && c < word.tEnd - EPSILON);
  const edge = inside === undefined ? c : inside.t;
  let prevEnd = Number.NEGATIVE_INFINITY;
  let nextStart = Number.POSITIVE_INFINITY;
  for (const word of words) {
    if (word.t >= edge - EPSILON) nextStart = Math.min(nextStart, word.t);
    else prevEnd = Math.max(prevEnd, word.tEnd);
  }
  const lo = Math.max(prevEnd, c - maxNudgeS, 0);
  const hi = Math.min(nextStart, c + maxNudgeS);
  return lo <= hi + EPSILON ? { lo, hi } : undefined;
}

/** True when `t` is strictly inside a spoken word. */
export function insideWord(words: readonly DirectorWord[], t: number): boolean {
  return words.some((word) => word.t < t - EPSILON && t < word.tEnd - EPSILON);
}

/** Sorted, unique grid times (beats and accented word starts) with a nearest-time lookup. */
export class GridTimes {
  readonly times: readonly number[];

  constructor(file: Pick<BeatsFile, 'beats' | 'accents'>) {
    const all = [...file.beats, ...file.accents.map((accent) => accent.t)].sort((a, b) => a - b);
    this.times = all.filter((t, index) => index === 0 || t - (all[index - 1] ?? 0) > EPSILON);
  }

  /** The grid time nearest to `t` within `within` (earlier wins a tie), else undefined. */
  nearest(t: number, within: number): number | undefined {
    let low = 0;
    let high = this.times.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if ((this.times[middle] ?? 0) < t) low = middle + 1;
      else high = middle;
    }
    const before = this.times[low - 1];
    const after = this.times[low];
    const dBefore = before === undefined ? Number.POSITIVE_INFINITY : t - before;
    const dAfter = after === undefined ? Number.POSITIVE_INFINITY : after - t;
    const best = dBefore <= dAfter ? before : after;
    return best !== undefined && Math.min(dBefore, dAfter) <= within + EPSILON ? best : undefined;
  }

  /** Grid times inside [lo, hi]. */
  within(lo: number, hi: number): number[] {
    return this.times.filter((t) => t >= lo - EPSILON && t <= hi + EPSILON);
  }
}

interface FitTargets {
  readonly regions: readonly CutRegion[];
  readonly accents: readonly { readonly t: number; readonly weight: number }[];
}

interface Fit {
  readonly bpm: number;
  readonly phase: number;
  readonly score: number;
  readonly pull: number;
}

function score(targets: FitTargets, period: number, phase: number): number {
  let total = 0;
  for (const region of targets.regions) {
    const beat = phase + Math.ceil((region.lo - phase) / period - EPSILON) * period;
    if (beat <= region.hi + EPSILON) total += CUT_WEIGHT;
  }
  for (const accent of targets.accents) {
    const offset = mod(accent.t - phase, period);
    if (Math.min(offset, period - offset) <= ACCENT_FIT_S) total += accent.weight;
  }
  return total;
}

function phaseCandidates(targets: FitTargets, period: number): number[] {
  const phases = new Set<number>([0]);
  for (const region of targets.regions) {
    phases.add(mod(Math.min(region.lo + EDGE, region.hi), period));
    phases.add(mod(Math.max(region.hi - EDGE, region.lo), period));
  }
  for (const accent of targets.accents) {
    phases.add(mod(accent.t, period));
    phases.add(mod(accent.t - ACCENT_FIT_S + EDGE, period));
    phases.add(mod(accent.t + ACCENT_FIT_S - EDGE, period));
  }
  return [...phases].sort((a, b) => a - b);
}

function better(candidate: Fit, best: Fit | undefined): boolean {
  if (best === undefined) return true;
  const a = candidate.score - candidate.pull;
  const b = best.score - best.pull;
  if (a > b + EPSILON) return true;
  if (a < b - EPSILON) return false;
  if (candidate.pull !== best.pull) return candidate.pull < best.pull;
  return candidate.bpm === best.bpm ? candidate.phase < best.phase : candidate.bpm < best.bpm;
}

/** Preferred tempo in the range: faster talk and higher tension pull it up. */
function preferredBpm(
  range: readonly [number, number],
  wordsPerSecond: number,
  tension: number,
): number {
  const pace = clamp01((wordsPerSecond - 1.8) / 1.4);
  return range[0] + (range[1] - range[0]) * (0.6 * pace + 0.4 * tension);
}

function fitAct(act: GridAct, targets: FitTargets, preferred: number): Fit {
  const [low, high] = moodTempoRange(act.mood);
  const span = Math.max(1, high - low);
  let best: Fit | undefined;
  for (let step = 0; low + step * BPM_STEP <= high + EPSILON; step++) {
    const bpm = low + step * BPM_STEP;
    const period = 60 / bpm;
    const pull = (PACE_PULL * Math.abs(bpm - preferred)) / span;
    for (const phase of phaseCandidates(targets, period)) {
      const candidate: Fit = { bpm, phase, score: score(targets, period, phase), pull };
      if (better(candidate, best)) best = candidate;
    }
  }
  return best ?? { bpm: low, phase: 0, score: 0, pull: 0 };
}

function actTargets(
  act: GridAct,
  input: BeatGridInput,
  accents: readonly BeatAccent[],
  accentTimes: GridTimes,
): FitTargets {
  const inAct = (t: number): boolean => t >= act.from && t < act.to;
  const regions = (input.cuts ?? [])
    .filter(inAct)
    // A cut already on an accent is on the grid whatever the beats do.
    .filter((cut) => accentTimes.nearest(cut, 1 / 30) === undefined)
    .map((cut) => cutRegion(cut, input.words))
    .filter((region): region is CutRegion => region !== undefined);
  return {
    regions,
    accents: accents
      .filter((accent) => inAct(accent.t))
      .map((accent) => ({ t: accent.t, weight: ACCENT_WEIGHT[accent.kind] })),
  };
}

function wordsPerSecond(words: readonly DirectorWord[], act: GridAct): number {
  const count = words.filter((word) => word.t >= act.from && word.t < act.to).length;
  return count / Math.max(1, act.to - act.from);
}

/** The film's beat grid (see the module comment). Same input -> same file. */
export function deriveBeatGrid(input: BeatGridInput): BeatsFile {
  const accents = findAccents(input.words);
  const accentTimes = new GridTimes({ beats: [], accents });
  const acts: readonly GridAct[] =
    input.acts.length > 0
      ? input.acts
      : [{ from: 0, to: Math.max(input.durationS, 1), mood: 'calm-tech' }];
  const beats: number[] = [];
  const beatActs = acts.map((act): BeatAct => {
    const tension =
      input.tension === undefined ? 0.5 : meanTension(input.tension, act.from, act.to);
    const preferred = preferredBpm(
      moodTempoRange(act.mood),
      wordsPerSecond(input.words, act),
      tension,
    );
    const fit = fitAct(act, actTargets(act, input, accents, accentTimes), preferred);
    const period = 60 / fit.bpm;
    const first = fit.phase + Math.ceil((act.from - fit.phase) / period - EPSILON) * period;
    for (let index = 0; first + index * period < act.to - EPSILON; index++) {
      beats.push(round3(first + index * period));
    }
    return {
      from: round3(act.from),
      to: round3(act.to),
      bpm: fit.bpm,
      phaseS: round3(first),
      mood: act.mood,
    };
  });
  return {
    version: BEATS_FILE_VERSION,
    durationS: round3(input.durationS),
    acts: beatActs,
    beats,
    accents: accents.map((accent) => ({ ...accent, t: round3(accent.t) })),
  };
}
