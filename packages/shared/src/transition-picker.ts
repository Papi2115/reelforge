/**
 * Picks transition styles per look pair (PLAN.md#12.15, ADR-011), pure and deterministic:
 * `transitionFor` chooses a style that suits the pair (look-change specials only where the look
 * changes, weighted up there), never the one used just before; `assignTransitionStyles` fills the
 * non-cut transitions of a `mixed` storyboard that name no style and aligns `type` with the style.
 * Repetition control beyond "not twice in a row" (PLAN.md#12.23) plugs in through `recent` and
 * `avoidRecent`.
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

/** How many of the most recent styles a pick avoids by default (12.23 may raise it). */
export const RECENT_TRANSITION_STYLES = 1;

/** Weight of a look-change special against a plain style (1) where the look changes. */
const SPECIAL_WEIGHT = 3;

export interface TransitionPickOptions {
  /** Styles used before this transition, most recent last. */
  readonly recent?: readonly string[];
  /** How many entries of `recent` to avoid. Default `RECENT_TRANSITION_STYLES`. */
  readonly avoidRecent?: number;
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
  const suitable = TRANSITION_STYLE_LIST.filter((style) =>
    transitionSuits(style, fromLook, toLook, rolls),
  );
  const avoid = new Set(
    (options.recent ?? []).slice(-(options.avoidRecent ?? RECENT_TRANSITION_STYLES)),
  );
  const fresh = suitable.filter((style) => !avoid.has(style.id));
  const pool = fresh.length > 0 ? fresh : suitable;
  const changes = fromLook !== toLook;
  const weight = (style: TransitionStyle): number =>
    changes && style.lookChange ? SPECIAL_WEIGHT : 1;
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
  const result = shots.map((shot, index): StoryboardShot => {
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
      const choice = transitionFor(
        shotLook(previous),
        shotLook(shot),
        { from: previous.roll, to: shot.roll },
        transitionHash(`${String(projectSeed >>> 0)}|${shot.id}`),
        { recent },
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
    changed.push(shot.id);
    return { ...shot, transitionIn: next };
  });
  return { shots: result, changed };
}
