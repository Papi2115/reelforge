import { describe, expect, it } from 'vitest';
import {
  isGenericChapterTitle,
  publishSeoFileSchema,
  publishSeoIssues,
  publishSeoSchema,
  seoChapterBounds,
  seoTagList,
  type PublishSeo,
} from './publish-seo.js';

const SEO: PublishSeo = {
  title: 'How Rome Debased Its Coins',
  tags: {
    oneWord: ['rome', 'inflation', 'denarius', 'history', 'economics'],
    twoWord: [
      'roman empire',
      'history explained',
      'coin debasement',
      'ancient money',
      'roman coins',
    ],
    threeWord: [
      'fall of rome',
      'history of money',
      'why rome fell',
      'roman silver coins',
      'ancient inflation explained',
    ],
  },
  chapters: [
    { t: 0, title: 'A Coin That Lost Its Silver' },
    { t: 41.2, title: 'How Nero Cut the Denarius' },
    { t: 95, title: 'Soldiers Paid in Bronze' },
    { t: 160.4, title: 'Prices Run Away' },
    { t: 230, title: 'Why Debasement Felt Free' },
    { t: 300, title: 'What Rome Teaches About Money' },
  ],
};

const codes = (seo: PublishSeo, durationS = 360, candidates?: number[]): string[] =>
  publishSeoIssues(seo, candidates === undefined ? { durationS } : { durationS, candidates }).map(
    (entry) => entry.code,
  );

describe('publish/seo.json', () => {
  it('accepts a valid file and orders tags by rank across the groups', () => {
    const file = publishSeoFileSchema.parse({
      version: 1,
      source: 'claude',
      generatedAt: '2026-10-09T10:00:00.000Z',
      model: 'sonnet',
      ...SEO,
    });
    expect(codes(file)).toEqual([]);
    expect(seoTagList(file.tags).slice(0, 4)).toEqual([
      'rome',
      'roman empire',
      'fall of rome',
      'inflation',
    ]);
    expect(seoTagList(file.tags)).toHaveLength(15);
  });

  it('needs exactly five tags per group and at most eight chapters', () => {
    const fewer = { ...SEO, tags: { ...SEO.tags, oneWord: SEO.tags.oneWord.slice(0, 4) } };
    expect(publishSeoSchema.safeParse(fewer).success).toBe(false);
    const many = {
      ...SEO,
      chapters: Array.from({ length: 9 }, (_, i) => ({ t: i * 20, title: `T${String(i)}` })),
    };
    expect(publishSeoSchema.safeParse(many).success).toBe(false);
  });

  it('checks word counts, duplicates, characters and offensive words of tags', () => {
    const bad: PublishSeo = {
      ...SEO,
      tags: {
        oneWord: ['roman empire', 'Rome', 'rome', '#history', 'economics'],
        twoWord: SEO.tags.twoWord,
        threeWord: [...SEO.tags.threeWord.slice(0, 4), 'shit coin history'],
      },
    };
    expect(codes(bad)).toEqual(
      expect.arrayContaining(['tag-words', 'tag-duplicate', 'tag-chars', 'offensive-word']),
    );
  });

  it('checks chapter count, start, gaps, end, candidates and generic titles', () => {
    expect(codes({ ...SEO, chapters: SEO.chapters.slice(0, 4) })).toContain('chapter-count');
    const late = SEO.chapters.map((c, i) => (i === 0 ? { ...c, t: 2 } : c));
    expect(codes({ ...SEO, chapters: late })).toContain('chapter-first');
    const close = SEO.chapters.map((c, i) => (i === 2 ? { ...c, t: 50.9 } : c));
    expect(codes({ ...SEO, chapters: close })).toContain('chapter-gap');
    expect(codes(SEO, 309)).toContain('chapter-end');
    const generic = SEO.chapters.map((c, i) => (i === 0 ? { ...c, title: 'Intro' } : c));
    expect(codes({ ...SEO, chapters: generic })).toContain('chapter-generic');
    expect(codes(SEO, 360, [41.2, 95, 160.4, 230, 300])).toEqual([]);
    expect(codes(SEO, 360, [41.2, 95, 160.4, 230])).toContain('chapter-candidate');
  });

  it('allows fewer chapters only when the video is too short', () => {
    expect(seoChapterBounds(600)).toEqual({ min: 5, max: 8 });
    expect(seoChapterBounds(55)).toEqual({ min: 5, max: 5 });
    expect(seoChapterBounds(41.4)).toEqual({ min: 3, max: 4 });
    // The cuts of a 41 s video allow only 3 chapters of 10 s (0, 12, 24; 31 is too close).
    expect(seoChapterBounds(41.45, [4.28, 12.305, 16.915, 24.05, 31.345, 38.27])).toEqual({
      min: 3,
      max: 3,
    });
    expect(seoChapterBounds(600, [100, 200])).toEqual({ min: 3, max: 3 });
    expect(seoChapterBounds(600, [300])).toEqual({ min: 0, max: 0 });
    expect(seoChapterBounds(36)).toEqual({ min: 3, max: 3 });
    expect(seoChapterBounds(29)).toEqual({ min: 0, max: 0 });
  });

  it('treats only bare generic words as generic titles', () => {
    expect(isGenericChapterTitle('Intro')).toBe(true);
    expect(isGenericChapterTitle('Part 3')).toBe(true);
    expect(isGenericChapterTitle('Conclusion.')).toBe(true);
    expect(isGenericChapterTitle('Intro to the Denarius')).toBe(false);
  });
});
