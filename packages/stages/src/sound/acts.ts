/**
 * Acts of a film for the music (pure): short films are one act; longer ones are cut into ~60 s
 * chunks (45-90 s) at shot boundaries, preferring non-cut transitions (the storyboard's own act
 * breaks), with an intro, body acts and an outro. Each act gets an energy from its shot density
 * and a mood from the project style (overridable per act by Claude's `moods` hint). With a
 * tension curve (PLAN.md#12.22) the energy blends the shot density with the act's mean tension
 * and the mood follows the tension (calm or tense, never the bright/cheerful one).
 */
import type { MusicMood } from '@reelforge/pipeline';
import { meanTension, type StoryboardShot, type TensionPoint } from '@reelforge/shared';

export type ActRole = 'full' | 'intro' | 'body' | 'outro';

export interface FilmAct {
  readonly from: number;
  readonly to: number;
  readonly role: ActRole;
  readonly shotIds: readonly string[];
  /**
   * 0..1 from the shot density (shots per minute), blended with the tension when there is a
   * curve; intro and outro a little calmer.
   */
  readonly energy: number;
  /** Mean tension of the act (only with a tension curve). */
  readonly tension?: number;
}

/** Films shorter than this are one act. */
export const SINGLE_ACT_MAX_S = 75;
export const TARGET_ACT_S = 60;
/** No act shorter than this (s), so a bed always has room to breathe. */
export const MIN_ACT_S = 30;
/** A non-cut transition is worth this many seconds of distance from the ideal boundary. */
const NON_CUT_BONUS_S = 10;
/** Highest energy a generated bed gets: the music stays light under the voice. */
export const MAX_BED_ENERGY = 0.7;

/**
 * Mood candidates per style: [calm default, livelier, liveliest]. Unknown styles use
 * `DEFAULT_STYLE_MOODS`.
 */
export const STYLE_MOODS: Readonly<Record<string, readonly MusicMood[]>> = {
  'voxel-pixel-crisp640': ['calm-tech', 'bright-explainer', 'retro-wave'],
  'noir-voxel': ['tense-investigation', 'lofi-chill'],
  'soft-480': ['lofi-chill', 'calm-tech'],
};
export const DEFAULT_STYLE_MOODS: readonly MusicMood[] = ['calm-tech', 'bright-explainer'];

/**
 * Moods per style when a tension curve drives them: [calm, tense]. Both stay pleasant under the
 * voice (the user: never heavy, never too cheerful), so `bright-explainer` is not among them.
 */
export const TENSION_STYLE_MOODS: Readonly<Record<string, readonly [MusicMood, MusicMood]>> = {
  'voxel-pixel-crisp640': ['calm-tech', 'retro-wave'],
  'noir-voxel': ['lofi-chill', 'tense-investigation'],
  'soft-480': ['lofi-chill', 'calm-tech'],
};
export const DEFAULT_TENSION_MOODS: readonly [MusicMood, MusicMood] = ['calm-tech', 'retro-wave'];
/** A body act this tense (mean) gets the tense mood; intro and outro need TENSE_EDGE_ACT. */
export const TENSE_ACT = 0.6;
export const TENSE_EDGE_ACT = 0.75;
/** Share of the tension in a tension-driven act energy (the rest is the shot density). */
const TENSION_ENERGY_SHARE = 0.5;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));
const round2 = (value: number): number => Math.round(value * 100) / 100;

interface Boundary {
  readonly t: number;
  readonly nonCut: boolean;
}

function boundaries(shots: readonly StoryboardShot[], durationS: number): number[] {
  const count = Math.max(2, Math.round(durationS / TARGET_ACT_S));
  const candidates: Boundary[] = shots.slice(1).map((shot) => ({
    t: shot.t0,
    nonCut: shot.transitionIn !== undefined && shot.transitionIn.type !== 'cut',
  }));
  const picked: number[] = [];
  for (let index = 1; index < count; index++) {
    const ideal = (index * durationS) / count;
    const previous = picked.at(-1) ?? 0;
    let best: Boundary | undefined;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const candidate of candidates) {
      if (candidate.t < previous + MIN_ACT_S || candidate.t > durationS - MIN_ACT_S) continue;
      const score = Math.abs(candidate.t - ideal) - (candidate.nonCut ? NON_CUT_BONUS_S : 0);
      if (score < bestScore) {
        best = candidate;
        bestScore = score;
      }
    }
    if (best !== undefined) picked.push(best.t);
  }
  return picked;
}

function roleOf(index: number, count: number): ActRole {
  if (count === 1) return 'full';
  if (index === 0) return 'intro';
  return index === count - 1 ? 'outro' : 'body';
}

/** Energy from shots per minute: 4/min -> 0.3, 8 -> 0.5, 12 -> 0.7, 16+ -> 0.9. */
export function densityEnergy(shotCount: number, lengthS: number): number {
  const perMinute = lengthS > 0 ? (shotCount * 60) / lengthS : 0;
  return clamp(0.1 + 0.05 * perMinute, 0.2, 0.9);
}

/** Energy of a tension: 0.2 (calm) .. 0.9 (peak), the range of the density energy. */
export function tensionEnergy(tension: number): number {
  return clamp(0.2 + 0.7 * tension, 0.2, 0.9);
}

/**
 * The acts of a film. `tension` (the curve's points, PLAN.md#12.22): each act also gets its mean
 * tension and an energy blended from density and tension; absent = exactly the 1.x acts.
 */
export function detectActs(
  shots: readonly StoryboardShot[],
  durationS: number,
  tension?: readonly TensionPoint[],
): FilmAct[] {
  if (shots.length === 0 || durationS <= 0) return [];
  const cuts = durationS < SINGLE_ACT_MAX_S ? [] : boundaries(shots, durationS);
  const edges = [0, ...cuts, durationS];
  const count = edges.length - 1;
  return edges.slice(0, -1).map((from, index) => {
    const to = edges[index + 1] ?? durationS;
    const inAct = shots.filter((shot) => shot.t0 >= from && shot.t0 < to);
    const role = roleOf(index, count);
    const density = densityEnergy(inAct.length, to - from);
    const mean = tension === undefined ? undefined : round2(meanTension(tension, from, to));
    const energy =
      mean === undefined
        ? density
        : (1 - TENSION_ENERGY_SHARE) * density + TENSION_ENERGY_SHARE * tensionEnergy(mean);
    return {
      from,
      to,
      role,
      shotIds: inAct.map((shot) => shot.id),
      energy: round2(role === 'intro' || role === 'outro' ? energy * 0.85 : energy),
      ...(mean === undefined ? {} : { tension: mean }),
    };
  });
}

/** The tension-driven mood of an act: the style's tense mood for tense acts, else its calm one. */
export function tensionMood(act: FilmAct, styleId: string, tension: number): MusicMood {
  const [calm, tense] = TENSION_STYLE_MOODS[styleId] ?? DEFAULT_TENSION_MOODS;
  const edge = act.role === 'intro' || act.role === 'outro';
  return tension >= (edge ? TENSE_EDGE_ACT : TENSE_ACT) ? tense : calm;
}

/**
 * The style's mood for an act: intro/outro calm, livelier moods for energetic acts; with a
 * tension curve the act's tension decides (`tensionMood`).
 */
export function defaultMood(act: FilmAct, styleId: string): MusicMood {
  if (act.tension !== undefined) return tensionMood(act, styleId, act.tension);
  const moods = STYLE_MOODS[styleId] ?? DEFAULT_STYLE_MOODS;
  const [calm = 'calm-tech', lively = calm, liveliest = lively] = moods;
  if (act.role === 'intro' || act.role === 'outro') return calm;
  // Calm is the default (the user finds livelier beds too cheerful): lively only for clearly energetic acts.
  if (act.energy < 0.75) return calm;
  return act.energy < 0.92 ? lively : liveliest;
}

/** Mood per act: Claude's hint where given (same length as the acts), else the style default. */
export function actMoods(
  acts: readonly FilmAct[],
  styleId: string,
  hint?: readonly MusicMood[],
): MusicMood[] {
  const usable = hint !== undefined && hint.length === acts.length ? hint : undefined;
  return acts.map((act, index) => usable?.[index] ?? defaultMood(act, styleId));
}

/** Energy a generated bed gets (capped: light music). */
export function bedEnergy(act: FilmAct): number {
  return round2(Math.min(MAX_BED_ENERGY, act.energy));
}
