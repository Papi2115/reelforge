import { describe, expect, it } from 'vitest';
import type { LibraryEntryView, LibraryState } from '../../shared/library-contract.js';
import {
  EMPTY_LIBRARY_FILTERS,
  libraryBadge,
  libraryMeta,
  libraryQuery,
  librarySummary,
  parseTags,
  libraryUseButton,
} from './library-view.js';

const ENTRY: LibraryEntryView = {
  sha256: 'a'.repeat(64),
  assetId: 'wm-1',
  kind: 'image',
  title: 'Moon',
  description: '',
  author: 'NASA',
  source: 'nasa',
  sourceUrl: null,
  licence: { id: 'unverified', url: null, verified: false },
  group: 'unverified',
  tags: ['space'],
  favorite: false,
  originProject: 'Apollo story',
  addedAt: '2026-10-04T12:00:00.000Z',
  width: 640,
  height: 480,
  image: `${'a'.repeat(64)}.png`,
  inProject: false,
};

function state(entries: readonly LibraryEntryView[], total: number): LibraryState {
  return { status: 'ok', entries: [...entries], total, tags: [], projectOpen: true, problem: null };
}

describe('library view (PLAN.md#12.19)', () => {
  it('builds the query from the filters, leaving empty ones out', () => {
    expect(libraryQuery(EMPTY_LIBRARY_FILTERS)).toEqual({});
    expect(
      libraryQuery({
        text: ' moon ',
        kind: 'image',
        licence: 'own',
        tag: 'space',
        favorites: true,
      }),
    ).toEqual({ text: 'moon', kind: 'image', licence: 'own', tag: 'space', favorites: true });
  });

  it('keeps ⚠ for unverified entries and reads "Your file" for own ones', () => {
    expect(libraryBadge(ENTRY)).toMatchObject({ text: '⚠ unverified', tone: 'warning' });
    expect(libraryBadge({ ...ENTRY, group: 'own', source: 'own' })).toMatchObject({
      text: 'Your file',
      tone: 'ok',
    });
    expect(libraryMeta(ENTRY)).toBe(
      'NASA Image and Video Library · NASA · 640×480 · image · from "Apollo story"',
    );
  });

  it('parses tags, summarises and explains the Use button', () => {
    expect(parseTags('Space, retro ,space,,')).toEqual(['space', 'retro']);
    expect(librarySummary(undefined)).toBe('Loading…');
    expect(librarySummary(state([], 0))).toContain('Empty');
    expect(librarySummary(state([ENTRY], 3))).toBe('1 of 3 assets');
    expect(librarySummary(state([ENTRY], 1))).toBe('1 asset');
    expect(libraryUseButton(ENTRY, true)).toEqual({ label: 'Use in project', disabled: null });
    expect(libraryUseButton({ ...ENTRY, inProject: true }, true).label).toBe('In this project');
    expect(libraryUseButton(ENTRY, false).disabled).toBe('Open a project first.');
  });
});
