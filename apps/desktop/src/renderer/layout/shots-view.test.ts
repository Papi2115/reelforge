import type { StoryboardShot } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import type { ShotBadge } from '../stages/scenes-view.js';
import { filterShots, filterSummary, isCompact, NO_FILTER, shotCounts } from './shots-view.js';

function shot(id: string, intent: string, treatment = 'title-card'): StoryboardShot {
  return { id, t0: 0, t1: 1, intent, treatment, scene: `scenes/${id}.js` } as StoryboardShot;
}

function badge(tone: ShotBadge['tone']): ShotBadge {
  return {
    tone,
    symbol: '',
    label: '',
    findings: [],
    critic: [],
    missingProps: [],
    builtProps: [],
    notes: [],
  };
}

const SHOTS = [
  shot('s01_hook', 'A rainbow on the kitchen wall'),
  shot('s02_glass', 'Glass of water on a table', 'metaphor-object'),
  shot('s03_newton', 'Isaac Newton with a prism', 'character'),
];
const BADGES = new Map([
  ['s01_hook', badge('ok')],
  ['s02_glass', badge('warning')],
  ['s03_newton', badge('failed')],
]);

describe('filterShots', () => {
  it('matches every word against id, treatment, intent and scene file', () => {
    expect(filterShots(SHOTS, BADGES, NO_FILTER)).toHaveLength(3);
    expect(filterShots(SHOTS, BADGES, { query: 's02', problemsOnly: false })).toEqual([SHOTS[1]]);
    expect(filterShots(SHOTS, BADGES, { query: 'NEWTON prism', problemsOnly: false })).toEqual([
      SHOTS[2],
    ]);
    expect(filterShots(SHOTS, BADGES, { query: 'metaphor', problemsOnly: false })).toEqual([
      SHOTS[1],
    ]);
    expect(filterShots(SHOTS, BADGES, { query: 'nothing', problemsOnly: false })).toEqual([]);
  });

  it('keeps only ⚠ and ✗ shots on request', () => {
    expect(
      filterShots(SHOTS, BADGES, { query: '', problemsOnly: true }).map((entry) => entry.id),
    ).toEqual(['s02_glass', 's03_newton']);
    expect(filterShots(SHOTS, new Map(), { query: '', problemsOnly: true })).toEqual([]);
  });
});

describe('shot list helpers', () => {
  it('counts badges and locks', () => {
    expect(shotCounts(SHOTS, BADGES, new Set(['s01_hook']))).toEqual({
      ok: 1,
      warning: 1,
      failed: 1,
      locked: 1,
    });
  });

  it('starts compact on short windows unless the user chose', () => {
    expect(isCompact('auto', 720)).toBe(true);
    expect(isCompact('auto', 1080)).toBe(false);
    expect(isCompact('detailed', 720)).toBe(false);
    expect(isCompact('compact', 1080)).toBe(true);
  });

  it('says how many shots a filter shows', () => {
    expect(filterSummary(3, 3)).toBeNull();
    expect(filterSummary(1, 16)).toBe('Showing 1 of 16');
  });
});
