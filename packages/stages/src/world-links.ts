/**
 * Continuity links drawn by a world's own transitions (PLAN.md#13.5 part c): an engine world
 * transition may carry `link` (Game B1: `game-b1-calendar-zoom` = zoom-through, the cartridge in
 * and out = carry-environment). A linked shot of such a world opens with the world's transition of
 * its link's kind (the one the storyboard named, else the world's first of that kind) instead of
 * the generic `continuity-<kind>` style, focused on the link's anchor, at most half of the shot
 * long. Kinds the world has no transition for, and every world without link transitions, get the
 * generic link exactly as before (`applyContinuityTransitions` of @reelforge/shared). Pure.
 */
import { WORLD_TRANSITIONS } from '@reelforge/engine';
import {
  applyContinuityTransitions,
  continuityTransition,
  type ContinuityKind,
  type ContinuityLink,
  type LinkedShots,
  type StoryboardShot,
  type Transition,
} from '@reelforge/shared';
import type { WorldTransitionChoice } from './worlds.js';

type LinkShot = Pick<StoryboardShot, 'id' | 't0' | 't1' | 'transitionIn' | 'continuity'>;

const CENTRE = { x: 0.5, y: 0.5 } as const;

/** The link kind a world transition style renders (undefined: none, or not a world style). */
export function worldLinkKind(transition: Transition | undefined): ContinuityKind | undefined {
  if (transition === undefined || transition.type === 'cut') return undefined;
  const style = transition.style;
  if (style === undefined || !Object.hasOwn(WORLD_TRANSITIONS, style)) return undefined;
  const world = WORLD_TRANSITIONS[style as keyof typeof WORLD_TRANSITIONS];
  return 'link' in world ? world.link : undefined;
}

/** The world transition of a link: its own duration (at most half the shot), on the anchor. */
function worldLinkTransition(
  shot: Pick<StoryboardShot, 't0' | 't1'>,
  link: ContinuityLink,
  option: WorldTransitionChoice,
): Transition {
  const room = (shot.t1 - shot.t0) / 2;
  const duration = Math.max(0.001, Math.round(Math.min(option.duration, room) * 1000) / 1000);
  return { type: option.type, duration, style: option.id, focus: link.anchor ?? CENTRE };
}

/**
 * Writes every linked shot's `transitionIn` from its link: the world's link transition of that
 * kind where the world has one (see the module comment), else the generic continuity style.
 */
export function applyWorldContinuity<Shot extends LinkShot>(
  shots: readonly Shot[],
  options: readonly WorldTransitionChoice[],
): LinkedShots<Shot> {
  const linking = options.filter((option) => option.link !== undefined);
  if (linking.length === 0) return applyContinuityTransitions(shots);
  const changed: string[] = [];
  const result = shots.map((shot, index): Shot => {
    const link = shot.continuity;
    if (link === undefined || index === 0) return shot;
    const named = shot.transitionIn?.type === 'cut' ? undefined : shot.transitionIn?.style;
    const own = linking.filter((option) => option.link === link.kind);
    const picked = own.find((option) => option.id === named) ?? own[0];
    const transition =
      picked === undefined
        ? continuityTransition(shot, link)
        : worldLinkTransition(shot, link, picked);
    if (JSON.stringify(shot.transitionIn) === JSON.stringify(transition)) return shot;
    changed.push(shot.id);
    return { ...shot, transitionIn: transition };
  });
  return { shots: result, changed };
}
