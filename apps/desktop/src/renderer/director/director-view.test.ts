/** View model of the Director tab (docs/ux/redesign-2.4.md §2.4, U9). */
import type { TensionFile } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { EMPTY_SESSION, markUndone, pushEntry } from '../direction/direction-view.js';
import {
  canRedoDirection,
  canUndoDirection,
  DEFAULT_SIDE_TAB,
  DIRECTOR_SECTIONS,
  DIRECTOR_SECTION_TITLES,
  directionRows,
  directionsSummary,
  directorEmptyLine,
  directorRefreshKey,
  directorSectionId,
  miniCurvePath,
  openingLine,
  SIDE_TAB_LABELS,
  SIDE_TABS,
  sideTabSchema,
  tensionSummary,
} from './director-view.js';

const CURVE: TensionFile = {
  version: 1,
  source: 'user',
  points: [
    { t: 0, v: 0.2 },
    { t: 3.7, v: 0.95 },
    { t: 7.5, v: 0.3 },
  ],
};

const entry = (command: string, shotId: string) => ({
  command,
  shotId,
  confirmation: `${command} done`,
  before: undefined,
  after: { dim: -0.25 },
});

describe('side tabs', () => {
  it('lists Chat, History and Director, Chat first and by default', () => {
    expect(SIDE_TABS).toEqual(['chat', 'history', 'director']);
    expect(DEFAULT_SIDE_TAB).toBe('chat');
    expect(SIDE_TAB_LABELS.director).toBe('Director');
  });

  it('accepts only known tabs from storage', () => {
    expect(sideTabSchema.safeParse('director').success).toBe(true);
    expect(sideTabSchema.safeParse('drawer').success).toBe(false);
  });
});

describe('sections', () => {
  it('has the five sections in order with plain names and stable ids', () => {
    expect(DIRECTOR_SECTIONS.map((section) => DIRECTOR_SECTION_TITLES[section])).toEqual([
      'Tension curve',
      'Story beats',
      'Editing',
      'Opening',
      'Directions',
    ]);
    expect(directorSectionId('directions')).toBe('director-directions');
  });

  it('says what comes next while there is no shot plan', () => {
    expect(directorEmptyLine('Record your voiceover.')).toBe(
      'The Director opens once the shots are planned. Next: Record your voiceover.',
    );
    expect(directorEmptyLine(undefined)).toContain('Next: Plan the shots');
  });

  it('refreshes on a new revision, review or sync check', () => {
    const before = directorRefreshKey(1, undefined);
    expect(directorRefreshKey(2, undefined)).not.toBe(before);
    expect(directorRefreshKey(1, { finalReview: null, sync: null })).toBe(before);
  });
});

describe('tension curve', () => {
  it('summarises the source, points and peak', () => {
    expect(tensionSummary(CURVE, undefined)).toBe('Drawn by you · 3 points · peak 95 % at 0:04');
    expect(tensionSummary({ ...CURVE, source: 'claude', locked: true }, undefined)).toMatch(
      /^Proposed by Claude · locked · 3 points/,
    );
  });

  it('says when there is no curve or it cannot be read', () => {
    expect(tensionSummary(undefined, undefined)).toMatch(/^No curve yet/);
    expect(tensionSummary(undefined, 'bad JSON')).toBe('The curve cannot be read: bad JSON');
  });

  it('draws the mini curve across the film, nothing without a length', () => {
    const path = miniCurvePath(CURVE.points, 7.5);
    expect(path.startsWith('M4.0 ')).toBe(true);
    expect(path.split(' L')).toHaveLength(CURVE.points.length + 2);
    expect(miniCurvePath(CURVE.points, 0)).toBe('');
  });
});

describe('opening', () => {
  it('shows the first sentence, shortened when long', () => {
    expect(openingLine('Doom runs on a calculator.  Again! And again.')).toBe(
      '“Doom runs on a calculator.”',
    );
    const long = `${'word '.repeat(60)}end.`;
    const line = openingLine(long);
    expect(line.length).toBeLessThanOrEqual(142);
    expect(line.endsWith('…”')).toBe(true);
  });

  it('says when it is loading or there is no script', () => {
    expect(openingLine(undefined)).toBe('Reading the script…');
    expect(openingLine(null)).toMatch(/^No script yet/);
    expect(openingLine('   ')).toMatch(/^No script yet/);
  });
});

describe('directions', () => {
  it('lists the session newest first with undone ones marked', () => {
    let session = pushEntry(
      pushEntry(EMPTY_SESSION, entry('darker', 's01')),
      entry('slower', 's02'),
    );
    session = markUndone(session, 2, true);
    expect(directionRows(session)).toEqual([
      { id: 2, shotId: 's02', command: 'slower', confirmation: 'slower done', undone: true },
      { id: 1, shotId: 's01', command: 'darker', confirmation: 'darker done', undone: false },
    ]);
    expect(canUndoDirection(session)).toBe(true);
    expect(canRedoDirection(session)).toBe(true);
  });

  it('summarises the session and the directed shots', () => {
    expect(directionsSummary(EMPTY_SESSION, 0)).toBe(
      'No directions this session · no shot has directions',
    );
    const session = pushEntry(EMPTY_SESSION, entry('darker', 's01'));
    expect(directionsSummary(session, 1)).toBe('1 direction this session · 1 shot has directions');
    expect(directionsSummary(session, 3)).toBe(
      '1 direction this session · 3 shots have directions',
    );
    expect(canUndoDirection(EMPTY_SESSION)).toBe(false);
    expect(canRedoDirection(session)).toBe(false);
  });
});
