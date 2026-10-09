import { publishSeoFileSchema, type PublishSeoFile } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import {
  seoActionLabel,
  seoChaptersNote,
  seoChaptersText,
  seoGenerateNote,
  seoSourceNote,
  seoStaleNote,
  seoTagRows,
  seoTagsText,
} from './seo-view.js';

const SEO: PublishSeoFile = publishSeoFileSchema.parse({
  version: 1,
  source: 'claude',
  generatedAt: '2026-10-09T12:34:56.000Z',
  model: 'sonnet',
  title: 'Why the Bridge Collapsed',
  tags: {
    oneWord: ['bridge', 'engineering', 'physics', 'flutter', 'science'],
    twoWord: [
      'bridge collapse',
      'science explained',
      'tacoma narrows',
      'wind power',
      'physics facts',
    ],
    threeWord: [
      'tacoma narrows bridge',
      'why bridges fail',
      'how bridges work',
      'flutter explained simply',
      'engineering disasters explained',
    ],
  },
  chapters: [
    { t: 0, title: 'Why Every Bridge Moves' },
    { t: 41.2, title: 'The Bridge That Moved Too Much' },
    { t: 95.5, title: 'What Flutter Does to a Deck' },
    { t: 160, title: 'Wind at the Right Rhythm' },
    { t: 230.75, title: 'How the Deck Twisted Apart' },
  ],
});

describe('tags and timestamps view', () => {
  it('lists the tags by word count and pastes them most important first', () => {
    expect(seoTagRows(SEO).map((row) => `${row.label}: ${String(row.tags.length)}`)).toEqual([
      'One word: 5',
      'Two words: 5',
      'Three words: 5',
    ]);
    expect(
      seoTagsText(SEO).startsWith('bridge, bridge collapse, tacoma narrows bridge, engineering'),
    ).toBe(true);
    expect(seoTagsText(SEO).split(', ')).toHaveLength(15);
  });

  it('writes the chapters as description timestamps', () => {
    expect(seoChaptersText(SEO, 300)).toBe(
      [
        '0:00 Why Every Bridge Moves',
        '0:41 The Bridge That Moved Too Much',
        '1:35 What Flutter Does to a Deck',
        '2:40 Wind at the Right Rhythm',
        '3:50 How the Deck Twisted Apart',
      ].join('\n'),
    );
    expect(seoChaptersText(SEO, 3700).split('\n')[1]).toBe(
      '0:00:41 The Bridge That Moved Too Much',
    );
    expect(seoChaptersNote(SEO)).toBe('5 timestamps · paste them into the description');
    expect(seoChaptersNote({ ...SEO, chapters: [] })).toMatch(/too short/);
  });

  it('names the source and flags a film that changed since', () => {
    expect(seoSourceNote(SEO)).toBe('Written by Claude (sonnet) · 2026-10-09 12:34 UTC');
    expect(seoSourceNote({ ...SEO, source: 'fallback' })).toMatch(/^Made from the script/);
    expect(seoStaleNote(SEO, 300)).toBeNull();
    expect(seoStaleNote(SEO, 235)).toBe(
      'The video changed since: the timestamps no longer fit. Regenerate them.',
    );
    expect(seoStaleNote(SEO, 0)).toBeNull();
  });

  it('reports the outcome of Regenerate and labels the button', () => {
    const state = {
      status: 'ok',
      seo: SEO,
      durationS: 300,
      generating: false,
      problem: null,
    } as const;
    expect(seoGenerateNote({ status: 'ok', state, fallbackReason: null, warnings: [] })).toBe(
      'Tags and timestamps written by Claude.',
    );
    expect(
      seoGenerateNote({
        status: 'ok',
        state,
        fallbackReason: 'Claude: not logged in',
        warnings: [],
      }),
    ).toBe('Made from the script instead (Claude: not logged in).');
    expect(seoGenerateNote({ status: 'error', message: 'No project is open.' })).toBe(
      'Not written: No project is open.',
    );
    expect(seoActionLabel(null, false)).toBe('Write tags and timestamps');
    expect(seoActionLabel(SEO, false)).toBe('Regenerate');
    expect(seoActionLabel(SEO, true)).toBe('Writing…');
  });
});
