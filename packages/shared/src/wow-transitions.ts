/**
 * Usage rules of the wow transitions (ADR-028), shared by the storyboard validator, the picker
 * and repetition control: about one per 40–90 s, never in the first 6 s (an `enter-*` may open a
 * shot marked `hook`), never two in a row except a scale sequence (`dive-in` / `dive-out` over
 * shots marked `scaleSequence`, which counts as one moment), the same style not twice within
 * 90 s. Pure. Docs: docs/transitions.md.
 */
import type { StoryboardShot } from './storyboard.js';
import { getTransitionStyle, type TransitionStyle, type WowFamily } from './transitions.js';

export const WOW_RULES = {
  /** Two wow moments closer than this: warning (about one per 40 s at most). */
  warnSpacingS: 40,
  /** Closer than this: error. */
  errorSpacingS: 25,
  /** No wow transition before this (s), except an `enter-*` into a `hook` shot. */
  hookS: 6,
  /** The same wow style twice within this (s) is a repeat (PLAN.md#12.23). */
  repeatWindowS: 90,
  /** Most dives one scale sequence may chain. */
  maxScaleSteps: 4,
} as const;

type WowShot = Pick<StoryboardShot, 'id' | 't0' | 'transitionIn' | 'scaleSequence'>;

/** The wow style of the transition into a shot (undefined: none, a cut or a plain style). */
export function wowStyleOf(
  shot: Pick<StoryboardShot, 'transitionIn'> | undefined,
): TransitionStyle | undefined {
  const transition = shot?.transitionIn;
  if (transition === undefined || transition.type === 'cut') return undefined;
  const style = getTransitionStyle(transition.style);
  return style?.wow === undefined ? undefined : style;
}

function family(shot: WowShot | undefined): WowFamily | undefined {
  return wowStyleOf(shot)?.wow?.family;
}

/**
 * True when the dive into `shots[index]` continues a scale sequence: both it and the shot before
 * are marked `scaleSequence` and the transition into the shot before is a dive too.
 */
export function continuesScaleSequence(shots: readonly WowShot[], index: number): boolean {
  const shot = shots[index];
  const previous = shots[index - 1];
  return (
    family(shot) === 'dive' &&
    family(previous) === 'dive' &&
    shot?.scaleSequence === true &&
    previous?.scaleSequence === true
  );
}

/** A wow transition of the film: one moment unless it continues a scale sequence. */
export interface WowOccurrence {
  readonly index: number;
  readonly shotId: string;
  readonly t: number;
  readonly style: TransitionStyle;
  /** It continues the scale sequence of the previous dive (not a new moment). */
  readonly chained: boolean;
}

export function wowOccurrences(shots: readonly WowShot[]): WowOccurrence[] {
  return shots.flatMap((shot, index): WowOccurrence[] => {
    const style = wowStyleOf(shot);
    if (style === undefined || index === 0) return [];
    return [
      { index, shotId: shot.id, t: shot.t0, style, chained: continuesScaleSequence(shots, index) },
    ];
  });
}

/**
 * Bounds of a genre preset's wow-transition multiplier (`wowTransitionBudget`, ADR-035): below
 * the minimum (including 0) the minimum applies, so a preset never forbids wow moments; above the
 * maximum the maximum, so they stay rare showpieces.
 */
export const WOW_SCALE_BOUNDS = { min: 0.25, max: 2 } as const;

/** The spacing of wow moments under a multiplier (1 = `WOW_RULES` exactly). */
export interface WowPacing {
  /** Closer than this: warning; also one moment per this many seconds is the budget. */
  readonly warnSpacingS: number;
  /** Closer than this: error. */
  readonly errorSpacingS: number;
  /** The upper end of the "about one per …" range the prompt and messages name. */
  readonly maxSpacingS: number;
}

/** The multiplier clamped to `WOW_SCALE_BOUNDS` (a non-finite one counts as 1). */
export function clampWowScale(scale: number): number {
  if (!Number.isFinite(scale)) return 1;
  return Math.min(WOW_SCALE_BOUNDS.max, Math.max(WOW_SCALE_BOUNDS.min, scale));
}

/**
 * Wow spacing under a genre multiplier: ×2 = twice as many moments (warnings at half the gap),
 * ×0.5 = half as many. The error gap only shrinks (a calmer genre gets warnings, never new hard
 * errors). Whole seconds; scale 1 = `WOW_RULES` (40 / 25 / 90 s).
 */
export function wowPacing(scale = 1): WowPacing {
  const factor = clampWowScale(scale);
  return {
    warnSpacingS: Math.round(WOW_RULES.warnSpacingS / factor),
    errorSpacingS: Math.round(WOW_RULES.errorSpacingS / Math.max(1, factor)),
    maxSpacingS: Math.round(WOW_RULES.repeatWindowS / factor),
  };
}

/** How many wow moments a film of this length may have (at least one); `scale`: genre preset. */
export function wowBudget(durationS: number, scale = 1): number {
  return Math.max(1, Math.floor(durationS / wowPacing(scale).warnSpacingS));
}

/** Lower-case word stems of a content tag (`documents` -> `document`), for intent matching. */
function stem(tag: string): string {
  const lower = tag.toLowerCase();
  if (lower.endsWith('ies')) return lower.slice(0, -3);
  return lower.endsWith('s') && lower.length > 4 ? lower.slice(0, -1) : lower;
}

/** True when the text names one of the style's content tags (word start match). */
export function wowContentMatches(style: TransitionStyle, text: string): boolean {
  const words = text.toLowerCase().split(/[^a-z0-9]+/);
  return (style.wow?.content ?? []).some((tag) => {
    const tagStem = stem(tag);
    if (tagStem.includes(' ')) return text.toLowerCase().includes(tagStem);
    return words.some((word) => word.startsWith(tagStem));
  });
}
