/**
 * The Comic pace (worlds/pace.ts; Papi after real run Comic 3: "the transitions feel dry"): a
 * comic film may join its pages with about one non-cut transition per 8 s and a link per ~18 s,
 * still capped, never the same transition twice in a row and never 4 plain cuts in a row with
 * nothing carried across; every other world and project keeps the defaults (20 s, 45 s).
 */
import type { StoryboardShot } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { storyboardWorldVars, worldPromptText, WORLD_PROMPTS } from '../worlds/index.js';
import type { WorldTransitionOption } from '../worlds/types.js';
import { checkContinuity } from './continuity.js';
import { checkStoryboard } from './storyboard.js';
import { checkWorldPace, flowingIntent } from './world-pace.js';

const comic = worldPromptText('comic');
const PACE = comic?.pace;
if (comic === undefined || PACE === undefined) throw new Error('no comic pace');
const LOOKS = ['comic-story', 'comic-info', 'comic-loud'] as const;
const STYLES = ['page-turn', 'page-slide', 'panel-push', 'page-scroll', 'gutter-collapse'];
const TRANSITIONS: WorldTransitionOption[] = STYLES.map((name) => ({
  id: `comic-${name}`,
  type: 'wipe',
  duration: 0.7,
  description: name,
}));

/** 'cut', 'flow' (a cut into a flowing page), 'link' or a transition style. */
type Entry = string;

/** 5 s shots; an entry is a cut, a cut into a flowing page, a link or a transition style. */
function film(entries: readonly Entry[]): StoryboardShot[] {
  return entries.map((entry, index) => {
    const id = `s${String(index + 1).padStart(2, '0')}`;
    const roll = (['A', 'B', 'A', 'C'] as const)[index % 4] ?? 'A';
    const flow = entry === 'flow' ? ' the page flows down the well' : '';
    return {
      id,
      t0: index * 5,
      t1: (index + 1) * 5,
      treatment: index % 2 === 0 ? 'character-scene' : 'kinetic-text',
      intent: `the rope${flow}`,
      scene: `scenes/${id}.js`,
      roll,
      look: LOOKS[index % 3] ?? 'comic-story',
      transitionIn:
        index === 0 || entry === 'cut' || entry === 'flow' || entry === 'link'
          ? { type: 'cut' }
          : { type: 'wipe', duration: 0.7, style: `comic-${entry}` },
      ...(entry === 'link' && index > 0
        ? { continuity: { kind: 'shared-object' as const, object: 'rope' } }
        : {}),
    };
  });
}

const codes = (shots: readonly StoryboardShot[]): string[] =>
  checkWorldPace(shots, PACE).map((entry) => entry.code);

describe('world pace', () => {
  it('belongs to the comic world only', () => {
    expect(PACE).toMatchObject({ transitionEveryS: 8, continuityEveryS: 18, dryCutRun: 4 });
    for (const [id, text] of Object.entries(WORLD_PROMPTS)) {
      if (id !== 'comic') expect(text.pace, id).toBeUndefined();
    }
    const sketchbook = worldPromptText('sketchbook');
    if (sketchbook === undefined) throw new Error('no sketchbook');
    const vars = storyboardWorldVars(
      { label: 'Sketchbook', text: sketchbook },
      'sketch-story',
      [],
      {
        durationS: 155,
      },
    );
    expect(vars).not.toHaveProperty('worldPace');
    expect(vars).not.toHaveProperty('worldContinuityPace');
  });

  it('gives a comic film its budget, links and transition guide', () => {
    const vars = storyboardWorldVars({ label: 'Comic', text: comic }, 'comic-story', TRANSITIONS, {
      durationS: 120,
    });
    expect(vars['maxTransitions']).toBe('15');
    expect(vars['worldPace']).toContain('never 4 plain cuts in a row');
    expect(vars['worldPace']).toContain('`comic-gutter-collapse`');
    expect(vars['worldContinuityPace']).toContain('at most 6 links in this film');
  });

  it('flags 4 plain cuts in a row with nothing carried across, once per run', () => {
    expect(codes(film(['cut', 'cut', 'cut', 'cut']))).toEqual([]);
    expect(codes(film(['cut', 'cut', 'cut', 'cut', 'cut']))).toEqual(['dry-run']);
    expect(codes(film(['cut', 'cut', 'cut', 'cut', 'cut', 'cut', 'cut', 'cut']))).toEqual([
      'dry-run',
    ]);
    for (const carried of ['flow', 'link', 'page-slide']) {
      const shots = film(['cut', 'cut', 'cut', carried, 'cut', 'cut', 'cut']);
      expect(codes(shots), carried).toEqual([]);
    }
  });

  it('reads a flowing page or a thread from the intent', () => {
    expect(flowingIntent('the page flows down the well')).toBe(true);
    expect(flowingIntent('a strip that runs across the valley')).toBe(true);
    expect(flowingIntent('thread: the red rope')).toBe(true);
    expect(flowingIntent('the river floods the town')).toBe(false);
  });

  it('never the same transition twice in a row, cuts between included', () => {
    expect(codes(film(['cut', 'page-slide', 'cut', 'page-slide']))).toEqual(['transition-repeat']);
    expect(codes(film(['cut', 'page-slide', 'panel-push', 'page-slide']))).toEqual([]);
    expect(checkWorldPace(film(['cut', 'page-slide', 'page-slide']), undefined)).toEqual([]);
  });

  it('spaces continuity links by the pace', () => {
    const shots = film(['cut', 'link', 'cut', 'cut', 'cut', 'link', 'cut', 'cut', 'cut', 'link']);
    const spacing = (everyS?: number) =>
      checkContinuity(shots, everyS).filter((entry) => entry.code === 'continuity-spacing');
    expect(spacing()).toHaveLength(2);
    expect(spacing(PACE.continuityEveryS)).toHaveLength(0);
  });
});

describe('storyboard with the comic pace', () => {
  // 12 shots of 5 s, every other one opened by a page-native transition: 6 in 60 s.
  const busy = film(STYLES.flatMap((style) => ['cut', style]).concat(['cut', 'page-turn']));
  const issues = (pace: boolean): string[] =>
    checkStoryboard(
      { version: 1, shots: busy },
      {
        lookMode: 'mixed',
        looks: [...LOOKS],
        worldTransitions: TRANSITIONS,
        worldVariety: { moments: [], transitions: TRANSITIONS, ...(pace ? { pace: PACE } : {}) },
      },
    ).map((entry) => entry.code);

  it('allows a non-cut transition per ~8 s in a comic film, not elsewhere', () => {
    expect(issues(true)).not.toContain('transition-density');
    expect(issues(false)).toContain('transition-density');
  });

  it('still caps a flood of transitions', () => {
    const flood = film(['cut', ...Array.from({ length: 11 }, (_, i) => STYLES[i % 5] ?? 'cut')]);
    const found = checkStoryboard(
      { version: 1, shots: flood },
      {
        lookMode: 'mixed',
        looks: [...LOOKS],
        worldTransitions: TRANSITIONS,
        worldVariety: { moments: [], transitions: TRANSITIONS, pace: PACE },
      },
    ).map((entry) => entry.code);
    expect(found).toContain('transition-density');
  });
});
