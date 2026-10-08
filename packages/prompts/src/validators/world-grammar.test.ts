/**
 * The film grammar of a world (Game B1 rework, world-grammar.ts) on whole storyboards: a game film
 * that opens in the room, plays levels and menus and closes in the room passes; the failures of
 * B1 film 2 (no framing, camera trips to the room, TV-only plain shots in a row, plain cuts, no
 * gameplay, the same breakthrough pair) each get an error that says what to change.
 */
import type { StoryboardShot } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { B1_GRAMMAR } from '../worlds/game-b1.js';
import { GAME_B1_MOMENTS } from '../worlds/game-b1-moments.js';
import {
  checkWorldGrammar,
  maxViewSwitches,
  minGameplayShots,
  minNativeTransitions,
} from './world-grammar.js';

const CATALOG = new Map(GAME_B1_MOMENTS.map((option) => [option.id, option]));

/** [view, moment ('-' = plain), transition style ('-' = cut)] per 5 s shot. */
type Plan = readonly [string, string, string];

function film(plans: readonly Plan[]): StoryboardShot[] {
  return plans.map(([view, moment, style], index) => ({
    id: `s${String(index + 1).padStart(2, '0')}`,
    t0: index * 5,
    t1: (index + 1) * 5,
    treatment: 'character-scene',
    intent: 'a shot',
    scene: `scenes/s${String(index + 1)}.js`,
    worldView: view,
    ...(moment === '-' ? {} : { worldMoment: moment }),
    transitionIn:
      style === '-' || index === 0
        ? { type: 'cut' }
        : { type: 'wipe', duration: 0.6, style: `game-b1-${style}` },
  }));
}

/** 10 shots, 50 s: the room opens and closes it, the rest is the game. */
const GOOD: readonly Plan[] = [
  ['push-in', 'level', '-'],
  ['screen', 'level-select', 'scanline-wipe'],
  ['screen', 'level', 'screen-flip'],
  ['screen', 'inventory', '-'],
  ['screen', 'level', 'attract-cycle'],
  ['screen', 'boss-card', '-'],
  ['screen', 'level', 'screen-flip'],
  ['screen', 'splits', '-'],
  ['screen', 'dialogue', 'scanline-wipe'],
  ['pull-out', '-', '-'],
];

const codes = (plans: readonly Plan[]): string[] =>
  checkWorldGrammar(film(plans), B1_GRAMMAR, CATALOG).map((entry) => entry.code);
const swap = (index: number, plan: Plan): Plan[] =>
  GOOD.map((entry, at) => (at === index ? plan : entry));

describe('world grammar (Game B1)', () => {
  it('scales its numbers with the film', () => {
    expect(maxViewSwitches(B1_GRAMMAR, 50)).toBe(2);
    expect(maxViewSwitches(B1_GRAMMAR, 120)).toBe(5);
    expect(minGameplayShots(B1_GRAMMAR, 11)).toBe(3);
    expect(minNativeTransitions(B1_GRAMMAR, 50)).toBe(4);
    expect(minNativeTransitions(B1_GRAMMAR, 120)).toBe(10);
  });

  it('passes a film that is mostly game, framed by the room', () => {
    expect(codes(GOOD)).toEqual([]);
  });

  it.each([
    ['a shot without framing', swap(3, ['', 'inventory', '-']), ['view-missing']],
    [
      'camera trips to the room between game shots',
      swap(4, ['room-visit', 'level', 'attract-cycle']),
      ['view-switches'],
    ],
    ['a cut from the game to a room shot', swap(5, ['room', 'boss-card', '-']), ['view-switches']],
    [
      'three plain shots in a row',
      [...GOOD.slice(0, 6), ['screen', '-', '-'], ['screen', '-', 'screen-flip'], ['screen', '-', '-'], GOOD[9]] as Plan[],
      ['kind-run'],
    ],
    [
      'plain cuts everywhere',
      GOOD.map(([view, moment]): Plan => [view, moment, '-']),
      ['native-transitions'],
    ],
    [
      'the score table and the manual together',
      swap(7, ['screen', 'manual', '-']).map((plan, at): Plan => (at === 3 ? ['screen', 'score-table', '-'] : plan)),
      ['breakthrough-pair'],
    ],
  ])('flags %s', (_, plans, expected) => {
    expect(codes(plans)).toEqual(expect.arrayContaining(expected));
  }); // prettier-ignore

  it('says what to change', () => {
    const [switches] = checkWorldGrammar(
      film(swap(4, ['room-visit', 'level', 'attract-cycle'])),
      B1_GRAMMAR,
      CATALOG,
    );
    expect(switches?.message).toMatch(/^4 room <-> screen switches in 50 s \(at s01, s05, s10\); at most 2: keep the film inside the game/);
  }); // prettier-ignore
});
