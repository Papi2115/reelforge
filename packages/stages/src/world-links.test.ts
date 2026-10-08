/**
 * Continuity links drawn by a world's own transitions (PLAN.md#13.5 part c): a Game B1 linked shot
 * opens with the world's link transition of its kind (named or the world's first), a kind the
 * world has no transition for and every other world keep the generic link; the scene directive
 * and the final review read the world transition as the link.
 */
import { WORLDS } from '@reelforge/kit';
import {
  applyContinuityTransitions,
  type FinalReviewShot,
  type StoryboardShot,
} from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { continuityReviewNotes, sceneContinuityVars } from './continuity.js';
import { applyWorldContinuity, worldLinkKind } from './world-links.js';
import { worldTransitionOptions } from './worlds.js';

const B1 = worldTransitionOptions(WORLDS.find((world) => world.id === 'game-b1'));
const B2 = worldTransitionOptions(WORLDS.find((world) => world.id === 'game-b2'));

function shot(id: string, index: number, extra: Partial<StoryboardShot> = {}): StoryboardShot {
  return {
    id,
    t0: index * 4,
    t1: (index + 1) * 4,
    treatment: 'character-scene',
    intent: `${id}: the wall calendar and the cartridge`,
    scene: `scenes/${id}.js`,
    ...extra,
  };
}

const FILM: readonly StoryboardShot[] = [
  shot('s01', 0),
  shot('s02', 1, {
    transitionIn: { type: 'cut' },
    continuity: { kind: 'zoom-through', object: 'wall calendar', anchor: { x: 0.3, y: 0.2 } },
  }),
  shot('s03', 2, {
    transitionIn: { type: 'wipe', duration: 0.9, style: 'game-b1-cartridge-out' },
    continuity: { kind: 'carry-environment', object: 'cartridge' },
  }),
  shot('s04', 3, {
    transitionIn: { type: 'wipe', duration: 0.5, style: 'game-b1-page-turn' },
    continuity: { kind: 'carry-environment', object: 'cartridge' },
  }),
  shot('s05', 4, { continuity: { kind: 'shared-object', object: 'cartridge' } }),
  shot('s06', 5, { transitionIn: { type: 'wipe', duration: 0.5, style: 'game-b1-room-shake' } }),
];

describe('world link transitions', () => {
  it('draws Game B1 links with its own transitions, the rest with the generic links', () => {
    const linked = applyWorldContinuity(FILM, B1);
    expect(linked.changed).toEqual(['s02', 's03', 's04', 's05']);
    expect(linked.shots.map((entry) => entry.transitionIn)).toEqual([
      undefined,
      { type: 'wipe', duration: 1.2, style: 'game-b1-calendar-zoom', focus: { x: 0.3, y: 0.2 } },
      { type: 'wipe', duration: 0.9, style: 'game-b1-cartridge-out', focus: { x: 0.5, y: 0.5 } },
      { type: 'wipe', duration: 0.8, style: 'game-b1-cartridge-in', focus: { x: 0.5, y: 0.5 } },
      {
        type: 'crossfade',
        duration: 0.6,
        style: 'continuity-shared-object',
        focus: { x: 0.5, y: 0.5 },
      },
      FILM[5]?.transitionIn,
    ]);
    expect(applyWorldContinuity(linked.shots, B1).changed).toEqual([]);
    expect(worldLinkKind(linked.shots[1]?.transitionIn)).toBe('zoom-through');
    expect(worldLinkKind(FILM[5]?.transitionIn)).toBeUndefined();
  });

  it('caps a link at half of a short shot', () => {
    const short = [shot('s01', 0), { ...shot('s02', 1), t1: 5, continuity: FILM[1]?.continuity }];
    expect(applyWorldContinuity(short, B1).shots[1]?.transitionIn).toMatchObject({
      style: 'game-b1-calendar-zoom',
      duration: 0.5,
    });
  });

  it('changes nothing for a world without link transitions or no world', () => {
    expect(applyWorldContinuity(FILM, B2)).toEqual(applyContinuityTransitions(FILM));
    expect(applyWorldContinuity(FILM, [])).toEqual(applyContinuityTransitions(FILM));
  });

  it('tells the scenes and the final review about the world link', () => {
    const { shots } = applyWorldContinuity(FILM, B1);
    expect(sceneContinuityVars(shots, shots[0] as StoryboardShot)['continuityDirective']).toContain(
      'The scene keeps rendering up to 1.20 s past its end',
    );
    const entries = shots.map((entry): FinalReviewShot => ({
      shotId: entry.id,
      status: 'ok',
      findings: [],
      autoFixed: false,
      locked: false,
      outOfSync: false,
    }));
    expect(continuityReviewNotes(shots, entries)).toEqual([
      'continuity: 4 links planned, 4 rendered',
    ]);
    const generic = applyContinuityTransitions(FILM).shots;
    expect(continuityReviewNotes(generic, entries)).toEqual([
      'continuity: 4 links planned, 4 rendered',
    ]);
    expect(continuityReviewNotes(FILM, entries)).toEqual([
      'continuity: 4 links planned, 1 rendered (not rendered: s01 -> s02, s03 -> s04, s04 -> s05)',
    ]);
  });
});
