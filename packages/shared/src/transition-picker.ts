/**
 * Picks transition styles per look pair (PLAN.md#12.15, ADR-011), pure and deterministic:
 * `transitionFor` chooses a style that suits the pair (look-change specials only where the look
 * changes, weighted up there), never the one used just before; `assignTransitionStyles` fills the
 * non-cut transitions of a `mixed` storyboard that name no style and aligns `type` with the style.
 * Repetition control beyond "not twice in a row" (PLAN.md#12.23) plugs in through `recent` and
 * `avoidRecent`. Wow transitions (ADR-028) are picked only when the caller allows one and the
 * shot's content names one of their content tags; `assignTransitionStyles` allows one only within
 * the wow budget (`WOW_RULES`).
 */
import { shotLook, type StoryboardShot, type Transition } from './storyboard.js';
import {
  getTransitionStyle,
  TRANSITION_STYLE_LIST,
  transitionSuits,
  type TransitionRolls,
  type TransitionStyle,
  type TransitionStyleId,
} from './transitions.js';
import { WOW_RULES, wowContentMatches, wowStyleOf } from './wow-transitions.js';

/** How many of the most recent styles a pick avoids by default (12.23 may raise it). */
export const RECENT_TRANSITION_STYLES = 1;

/** Weight of a look-change special against a plain style (1) where the look changes. */
const SPECIAL_WEIGHT = 3;
/** Weight of a wow style whose content tags the shot names (only when a wow is allowed). */
const WOW_WEIGHT = 4;
/** The picker spaces automatic wow transitions wider than the validator's warning. */
const AUTO_WOW_SPACING_S = 60;

export interface TransitionPickOptions {
  /** Styles used before this transition, most recent last. */
  readonly recent?: readonly string[];
  /** How many entries of `recent` to avoid. Default `RECENT_TRANSITION_STYLES`. */
  readonly avoidRecent?: number;
  /**
   * A wow transition may be picked here (ADR-028): `content` is what the shot shows (its
   * intent); only wow styles whose content tags it names are candidates. Absent = no wow.
   */
  readonly wow?: {
    readonly content: string;
    /** Wow styles not to pick (used within `WOW_RULES.repeatWindowS`). */
    readonly avoid?: readonly string[];
  };
}

export interface TransitionChoice {
  readonly type: TransitionStyle['type'];
  readonly duration: number;
  readonly style: TransitionStyleId;
}

/** FNV-1a over UTF-16 code units + a final avalanche (uint32). */
export function transitionHash(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d) >>> 0;
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b) >>> 0;
  return (hash ^ (hash >>> 16)) >>> 0;
}

function weightedPick(
  pool: readonly TransitionStyle[],
  weight: (style: TransitionStyle) => number,
  hash: number,
): TransitionStyle | undefined {
  const total = pool.reduce((sum, style) => sum + weight(style), 0);
  let target = (hash / 4_294_967_296) * total;
  for (const style of pool) {
    target -= weight(style);
    if (target < 0) return style;
  }
  return pool.at(-1);
}

/**
 * The style of a transition from a `fromLook` shot into a `toLook` shot. `seed` should already be
 * per transition (e.g. project seed + shot id); the same inputs always give the same choice.
 */
export function transitionFor(
  fromLook: string,
  toLook: string,
  rolls: TransitionRolls,
  seed: number,
  options: TransitionPickOptions = {},
): TransitionChoice {
  const wow = options.wow;
  const suitable = TRANSITION_STYLE_LIST.filter(
    (style) =>
      transitionSuits(style, fromLook, toLook, rolls) &&
      (style.wow === undefined ||
        (wow !== undefined &&
          !(wow.avoid ?? []).includes(style.id) &&
          wowContentMatches(style, wow.content))),
  );
  const avoid = new Set(
    (options.recent ?? []).slice(-(options.avoidRecent ?? RECENT_TRANSITION_STYLES)),
  );
  const fresh = suitable.filter((style) => !avoid.has(style.id));
  const pool = fresh.length > 0 ? fresh : suitable;
  const changes = fromLook !== toLook;
  const weight = (style: TransitionStyle): number =>
    style.wow !== undefined ? WOW_WEIGHT : changes && style.lookChange ? SPECIAL_WEIGHT : 1;
  const salt = `${String(seed >>> 0)}|${fromLook}>${toLook}|${rolls.from ?? '-'}${rolls.to ?? '-'}`;
  // The plain styles suit every pair, so the pool is never empty.
  const picked = weightedPick(pool, weight, transitionHash(salt)) ?? pool[0];
  if (picked === undefined) throw new Error('transition kit has no style for any look pair');
  return { type: picked.type, duration: picked.duration.default, style: picked.id };
}

export interface AssignedTransitions {
  readonly shots: StoryboardShot[];
  /** Shot ids whose `transitionIn` was filled in or aligned. */
  readonly changed: readonly string[];
}

/**
 * Fills `style` into every non-cut transition that has none (picked for its look pair, keeping
 * the storyboard's duration when the style allows it) and aligns `type` with a named style.
 * Cuts, unknown styles (a validator error) and the first shot are left alone.
 */
export function assignTransitionStyles(
  shots: readonly StoryboardShot[],
  projectSeed: number,
): AssignedTransitions {
  const recent: string[] = [];
  const changed: string[] = [];
  const named = shots.flatMap((shot) => {
    const style = wowStyleOf(shot);
    return style === undefined ? [] : [{ t: shot.t0, style: style.id }];
  });
  const wows: { readonly t: number; readonly style: string }[] = [];
  let previousWow = false;
  const result = shots.map((shot, index): StoryboardShot => {
    const near = (entry: { readonly t: number }, window: number): boolean =>
      entry.t !== shot.t0 && Math.abs(entry.t - shot.t0) < window;
    const assigned = assignOne(shots, index, projectSeed, recent, {
      allowed:
        !previousWow &&
        wowStyleOf(shots[index + 1]) === undefined &&
        shot.t0 >= WOW_RULES.hookS &&
        ![...wows, ...named].some((entry) => near(entry, AUTO_WOW_SPACING_S)),
      avoid: [...wows, ...named]
        .filter((entry) => near(entry, WOW_RULES.repeatWindowS))
        .map((entry) => entry.style),
    });
    const style = wowStyleOf(assigned);
    previousWow = style !== undefined;
    if (style !== undefined) wows.push({ t: shot.t0, style: style.id });
    if (assigned !== shot) changed.push(shot.id);
    return assigned;
  });
  return { shots: result, changed };
}

/** The transition into `shots[index]` with a style filled in or aligned (or the shot as is). */
function assignOne(
  shots: readonly StoryboardShot[],
  index: number,
  projectSeed: number,
  recent: string[],
  wow: { readonly allowed: boolean; readonly avoid: readonly string[] },
): StoryboardShot {
  const shot = shots[index];
  if (shot === undefined) throw new RangeError(`no shot at ${String(index)}`);
  const transition = shot.transitionIn;
  const previous = shots[index - 1];
  if (transition === undefined || transition.type === 'cut' || previous === undefined) {
    return shot;
  }
  const named = getTransitionStyle(transition.style);
  if (transition.style !== undefined && named === undefined) return shot;
  let next: Transition;
  if (named !== undefined) {
    next = { ...transition, type: named.type };
  } else {
    // A wow transition needs room: at least twice its default length of shot.
    const roomy = shot.t1 - shot.t0 >= 2.4;
    const choice = transitionFor(
      shotLook(previous),
      shotLook(shot),
      { from: previous.roll, to: shot.roll },
      transitionHash(`${String(projectSeed >>> 0)}|${shot.id}`),
      {
        recent,
        ...(wow.allowed && roomy ? { wow: { content: shot.intent, avoid: wow.avoid } } : {}),
      },
    );
    const style = getTransitionStyle(choice.style);
    const keeps =
      style !== undefined &&
      transition.duration >= style.duration.min &&
      transition.duration <= style.duration.max;
    next = { ...choice, duration: keeps ? transition.duration : choice.duration };
  }
  recent.push(next.style ?? next.type);
  if (next.type === transition.type && next.style === transition.style) return shot;
  return { ...shot, transitionIn: next };
}
