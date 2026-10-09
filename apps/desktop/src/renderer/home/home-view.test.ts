import { describe, expect, it } from 'vitest';
import {
  attachShorts,
  channelSections,
  continueRow,
  dirKey,
  filtersActive,
  lastChannelId,
  matchesFilters,
  needsYouCount,
  NO_FILTERS,
  sortProjects,
  usedStyles,
  type HomeFilters,
} from './home-view.js';
import { homeKeyAction } from './home-keys.js';
import { parseHomePrefs, DEFAULT_HOME_PREFS } from './home-prefs.js';
import { card, CHANNELS, steps } from './home-test-cards.js';

const heist = card('Heist night', {
  channelId: 'crime',
  updatedAt: '2026-10-08T10:00:00.000Z',
  openedAt: '2026-10-09T09:00:00.000Z',
});
const magnets = card('How magnets work', {
  channelId: 'voxplain',
  style: 'sketchbook',
  updatedAt: '2026-10-09T11:00:00.000Z',
  steps: steps({ script: 'needs-you' }),
});
const legacy = card('Old film', {
  updatedAt: '2026-10-01T08:00:00.000Z',
  openedAt: '2026-10-01T09:00:00.000Z',
});
const short = card('Heist short', {
  kind: 'short',
  channelId: 'crime',
  parentDir: 'c:/films/heist night/',
});
const orphan = card('Lost short', { kind: 'short', parentDir: 'C:\\Elsewhere\\Film' });
const ALL = [heist, magnets, legacy, short, orphan];

const filters = (patch: Partial<HomeFilters>): HomeFilters => ({ ...NO_FILTERS, ...patch });

describe('filters', () => {
  it('match title words, channels, style and state', () => {
    expect(matchesFilters(heist, filters({ search: 'NIGHT heist' }), CHANNELS)).toBe(true);
    expect(matchesFilters(heist, filters({ search: 'magnet' }), CHANNELS)).toBe(false);
    expect(matchesFilters(heist, filters({ channels: new Set(['crime']) }), CHANNELS)).toBe(true);
    // No channel id = the default channel.
    expect(matchesFilters(legacy, filters({ channels: new Set(['default']) }), CHANNELS)).toBe(
      true,
    );
    expect(matchesFilters(magnets, filters({ style: 'sketchbook' }), CHANNELS)).toBe(true);
    expect(matchesFilters(heist, filters({ style: 'sketchbook' }), CHANNELS)).toBe(false);
    expect(matchesFilters(magnets, filters({ state: 'needs-you' }), CHANNELS)).toBe(true);
    expect(matchesFilters(heist, filters({ state: 'needs-you' }), CHANNELS)).toBe(false);
    expect(filtersActive(NO_FILTERS)).toBe(false);
    expect(filtersActive(filters({ search: ' x ' }))).toBe(true);
  });
});

describe('order', () => {
  it('sorts by the last change or opening, or by title', () => {
    expect(sortProjects([heist, magnets, legacy], 'edited').map((p) => p.title)).toEqual([
      'How magnets work',
      'Heist night',
      'Old film',
    ]);
    expect(sortProjects([magnets, legacy, heist], 'opened').map((p) => p.title)).toEqual([
      'Heist night',
      'Old film',
      'How magnets work',
    ]);
    expect(sortProjects([magnets, legacy, heist], 'title').map((p) => p.title)).toEqual([
      'Heist night',
      'How magnets work',
      'Old film',
    ]);
  });

  it('continues with the projects opened last', () => {
    expect(continueRow(ALL).map((p) => p.title)).toEqual(['Heist night', 'Old film']);
    expect(continueRow([card('Gone', { exists: false, openedAt: heist.openedAt })])).toEqual([]);
    expect(lastChannelId(ALL, CHANNELS)).toBe('crime');
    expect(lastChannelId([], CHANNELS)).toBe('default');
    expect(lastChannelId(ALL, undefined)).toBeUndefined();
  });
});

describe('Shorts and channel sections', () => {
  it('puts a Short under its film, or alone when its film is not listed', () => {
    expect(dirKey('C:\\Films\\Heist night')).toBe(dirKey('c:/films/heist night/'));
    const cards = attachShorts(ALL);
    expect(cards.find((entry) => entry.project === heist)?.shorts).toEqual([short]);
    expect(cards.some((entry) => entry.project === short)).toBe(false);
    expect(cards.some((entry) => entry.project === orphan)).toBe(true);
  });

  it('gives every channel a section in the user order, with counts', () => {
    const sections = channelSections(ALL, NO_FILTERS, 'edited', CHANNELS);
    expect(sections.map((section) => section.channel?.name)).toEqual([
      'Default',
      'Voxplain',
      'Crime',
    ]);
    expect(sections.map((section) => section.total)).toEqual([2, 1, 1]);
    const crime = channelSections(ALL, filters({ search: 'short' }), 'edited', CHANNELS)[2];
    // The film stays (its Short matches) and the total counts the unfiltered cards.
    expect(crime?.cards.map((entry) => entry.project.title)).toEqual(['Heist night']);
    const onlyCrime = channelSections(
      ALL,
      filters({ channels: new Set(['crime']) }),
      'edited',
      CHANNELS,
    );
    expect(onlyCrime.map((section) => section.channel?.id)).toEqual(['crime']);
  });

  it('lists every project under "No channel" when the channels cannot be read', () => {
    const sections = channelSections(ALL, NO_FILTERS, 'title', undefined);
    expect(sections).toHaveLength(1);
    expect(sections[0]?.channel).toBeNull();
    expect(sections[0]?.total).toBe(4);
  });

  it('counts what needs the user and the styles in use', () => {
    expect(needsYouCount(ALL)).toBe(1);
    expect(usedStyles(ALL)).toEqual(['voxel-pixel-crisp640', 'sketchbook']);
  });
});

describe('keys and preferences', () => {
  const press = (key: string, ctrl = false, tagName = 'BODY') => ({
    key,
    ctrlKey: ctrl,
    shiftKey: false,
    altKey: false,
    metaKey: false,
    repeat: false,
    target: { tagName, contentEditable: false },
  });

  it('starts a new project with Ctrl+N and searches with / outside text fields', () => {
    expect(homeKeyAction(press('n', true))).toBe('new-project');
    expect(homeKeyAction(press('N', true, 'INPUT'))).toBe('new-project');
    expect(homeKeyAction(press('/'))).toBe('search');
    expect(homeKeyAction(press('/', false, 'INPUT'))).toBeUndefined();
    expect(homeKeyAction(press('n'))).toBeUndefined();
  });

  it('reads the remembered view, falling back field by field', () => {
    expect(parseHomePrefs(null)).toEqual(DEFAULT_HOME_PREFS);
    expect(parseHomePrefs('{oops')).toEqual(DEFAULT_HOME_PREFS);
    expect(parseHomePrefs('{"layout":"list","order":"weird","collapsed":["crime"]}')).toEqual({
      layout: 'list',
      order: 'edited',
      collapsed: ['crime'],
    });
  });
});
