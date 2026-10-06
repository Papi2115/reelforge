/**
 * World variety checks (real run Sketchbook 1): failing films for every rule (no moments, two
 * pop-ups side by side, one kind twice within 90 s, five shots in one look, …), a varied film that
 * passes, the test-only quota override, and no change for projects outside a world.
 */
import type { StoryboardShot, Treatment } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { worldPromptText } from '../worlds/index.js';
import type { WorldTransitionOption } from '../worlds/types.js';
import { checkStoryboard } from './storyboard.js';
import { checkWorldVariety, type WorldVarietyOptions } from './world-variety.js';

const text = worldPromptText('sketchbook');
if (text === undefined) throw new Error('no sketchbook prompt text');
const TRANSITIONS: readonly WorldTransitionOption[] = [
  'page-flip',
  'riffle',
  'crumple-toss',
  'tape-peel',
  'torn-strip',
].map((name) => ({ id: `sketchbook-${name}`, type: 'wipe', duration: 0.8, description: name }));
const OPTIONS: WorldVarietyOptions = { moments: text.moments, transitions: TRANSITIONS };
const LOOK = { A: 'sketch-story', B: 'sketch-graph', C: 'sketch-loud' } as const;
const TREATMENT: Record<'A' | 'B' | 'C', readonly Treatment[]> = {
  A: ['character-scene', 'metaphor-object'],
  B: ['data-chart-3d', 'node-graph/timeline'],
  C: ['kinetic-text', 'title-card'],
};

/** A shot plan: roll, then optional moment and transition style (`-` = none). */
type Plan = readonly ['A' | 'B' | 'C', (string | undefined)?, (string | undefined)?];

/** A film of `plans`, each shot `lengthS` long, rolls in their looks. */
function film(plans: readonly Plan[], lengthS = 6): StoryboardShot[] {
  return plans.map(([roll, moment, style], index) => {
    const id = `s${String(index + 1).padStart(2, '0')}`;
    return {
      id,
      t0: index * lengthS,
      t1: (index + 1) * lengthS,
      treatment: TREATMENT[roll][index % 2] ?? 'title-card',
      intent: `shot ${id}`,
      scene: `scenes/${id}.js`,
      roll,
      look: LOOK[roll],
      transitionIn:
        style === undefined || index === 0
          ? { type: 'cut' }
          : { type: 'wipe', duration: 0.8, style: `sketchbook-${style}` },
      ...(moment === undefined || moment === '-' ? {} : { worldMoment: moment }),
    };
  });
}

/** 26 shots (156 s) with a pop-up, a strip and three page transitions: passes every rule. */
const VARIED: readonly Plan[] = [
  ['A'],
  ['B'],
  ['A'],
  ['C', 'popup', 'page-flip'],
  ['A'],
  ['B', 'envelope'],
  ['A'],
  ['C', 'sticky-slap'],
  ['A', '-', 'torn-strip'],
  ['B'],
  ['A'],
  ['B'],
  ['C', 'flipbook', 'riffle'],
  ['B', 'strip'],
  ['A'],
  ['B', 'ruler-graph'],
  ['A'],
  ['C'],
  ['A'],
  ['B'],
  ['A'],
  ['C'],
  ['A'],
  ['B'],
  ['A'],
  ['C'],
];

const codes = (shots: readonly StoryboardShot[], options = OPTIONS): string[] =>
  checkWorldVariety(shots, options).map((entry) => entry.code);

function replaced(index: number, plan: Plan, plans: readonly Plan[] = VARIED): Plan[] {
  return plans.map((entry, at) => (at === index ? plan : entry));
}

describe('checkWorldVariety', () => {
  it('passes a varied film', () => {
    expect(checkWorldVariety(film(VARIED), OPTIONS)).toEqual([]);
  });

  it.each([
    [
      'a film without moments',
      VARIED.map(([roll, , style]): Plan => [roll, '-', style]),
      ['moment-quota'],
    ],
    [
      'two pop-ups side by side',
      replaced(4, ['C', 'popup'], replaced(14, ['A'])),
      ['moment-spacing', 'moment-repeat'],
    ],
    [
      'a pop-up next to the strip',
      replaced(12, ['C', 'popup', 'riffle'], replaced(3, ['C', '-', 'page-flip'])),
      ['moment-spacing'],
    ],
    [
      'one breakthrough kind only',
      replaced(13, ['B'], replaced(20, ['C', 'popup'])),
      ['moment-variety'],
    ],
    ['the same moment within 90 s', replaced(9, ['B', 'envelope']), ['moment-repeat']],
    ['a pop-up on a story page', replaced(3, ['A', 'popup', 'page-flip']), ['moment-look']],
    ['an unknown moment', replaced(10, ['A', 'balloon']), ['moment-unknown']],
    ['a torn page without its transition', replaced(10, ['A', 'torn-page']), ['moment-transition']],
    ['three plain A pages in a row', replaced(1, ['A']), ['moment-run']],
    ['two page transitions only', replaced(12, ['C', 'flipbook']), ['transition-variety']],
  ])('flags %s', (_, plans, expected) => {
    expect(codes(film(plans))).toEqual(expected);
  });

  it('never asks a short film for breakthroughs or transitions', () => {
    expect(codes(film([['A'], ['B'], ['C'], ['A']]))).toEqual([]);
  });

  it('caps the breakthroughs (never a gimmick)', () => {
    const busy = film([['C', 'popup'], ['A'], ['B', 'strip'], ['A'], ['C', 'popup'], ['A']], 5);
    expect(codes(busy)).toEqual(expect.arrayContaining(['moment-quota']));
    expect(checkWorldVariety(busy, OPTIONS)[0]?.message).toContain('at most 1');
  });

  it('raises the floor with the test-only override (both kinds in a 50 s film)', () => {
    const plans: Plan[] = [
      ['A'],
      ['C', 'popup', 'page-flip'],
      ['A'],
      ['B', '-', 'riffle'],
      ['A'],
      ['C', '-', 'tape-peel'],
      ['A'],
      ['B'],
      ['A'],
      ['C'],
    ];
    const override = { ...OPTIONS, override: { minBreakthroughs: 2 } };
    expect(codes(film(plans, 5))).toEqual([]);
    expect(codes(film(plans, 5), override)).toEqual(['moment-quota']);
    expect(codes(film(replaced(7, ['B', 'strip'], plans), 5), override)).toEqual([]);
    expect(codes(film(replaced(7, ['C', 'popup'], plans), 5), override)).toEqual(
      expect.arrayContaining(['moment-variety']),
    );
  });
});

describe('checkStoryboard with world variety', () => {
  const storyboard = (shots: StoryboardShot[]) => ({ version: 1 as const, shots });
  const lookRun = (shots: StoryboardShot[], world: boolean): boolean =>
    checkStoryboard(storyboard(shots), {
      lookMode: 'mixed',
      looks: Object.values(LOOK),
      worldTransitions: TRANSITIONS,
      ...(world ? { worldVariety: OPTIONS } : {}),
    }).some((entry) => entry.code === 'look-run');

  it('allows at most two shots in a row in one look in a world (three elsewhere)', () => {
    const three = film([['A'], ['B'], ['B'], ['B'], ['A']]);
    expect(lookRun(three, true)).toBe(true);
    expect(lookRun(three, false)).toBe(false);
    const five = film([['A'], ['B'], ['B'], ['B'], ['B'], ['B'], ['A']]);
    expect(lookRun(five, false)).toBe(true);
  });

  it('reports the variety errors through the storyboard validator only in a world', () => {
    const plain = storyboard(film(VARIED.map(([roll]): Plan => [roll])));
    const inWorld = checkStoryboard(plain, { worldVariety: OPTIONS }).map((entry) => entry.code);
    expect(inWorld).toEqual(expect.arrayContaining(['moment-quota', 'transition-variety']));
    const outside = checkStoryboard(plain).map((entry) => entry.code);
    expect(outside.filter((code) => code.startsWith('moment-'))).toEqual([]);
  });
});
