import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  publishSeoIssues,
  seoTagList,
  seoWordCount,
  storyboardFileSchema,
  wordsFileSchema,
  type PublishSeoFile,
  type StoryboardShot,
} from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { planChapterStarts } from './chapter-plan.js';
import { buildPublishKit, type PublishKitInput } from './publish-kit.js';
import { fallbackSeoChapters, MAX_SEO_CANDIDATES, seoChapterCandidates } from './seo-chapters.js';
import { fallbackPublishSeo, fallbackSeoTags } from './seo-fallback.js';

const EXAMPLE_DIR = path.join(
  import.meta.dirname,
  '..',
  '..',
  '..',
  '..',
  'templates',
  'examples',
  'doom-on-a-calculator',
);
const SHOTS = storyboardFileSchema.parse(
  JSON.parse(readFileSync(path.join(EXAMPLE_DIR, 'storyboard.json'), 'utf8')),
).shots;
const SCRIPT = readFileSync(path.join(EXAMPLE_DIR, 'script.txt'), 'utf8');
const WORDS = wordsFileSchema.parse(
  JSON.parse(readFileSync(path.join(EXAMPLE_DIR, 'timing', 'words.json'), 'utf8')),
).words;
/** The example stretched 10x: a 5-minute film. */
const LONG = SHOTS.map((shot) => ({ ...shot, t0: shot.t0 * 10, t1: shot.t1 * 10 }));
const LONG_WORDS = WORDS.map((word) => ({ ...word, t: word.t * 10, tEnd: word.tEnd * 10 }));
const TITLE = 'Doom on a calculator';

function evenShots(count: number, length: number): StoryboardShot[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `s${String(index)}`,
    t0: index * length,
    t1: (index + 1) * length,
    treatment: 'kinetic-text',
    intent: `Shot ${String(index)}`,
    scene: `scenes/s${String(index)}.js`,
  }));
}

describe('fallback SEO tags', () => {
  it('gives exactly 5 one-, two- and three-word tags from the film and the channel niche', () => {
    const tags = fallbackSeoTags({
      title: TITLE,
      script: SCRIPT,
      channel: { name: 'Voxplain', genre: 'pop-culture', tags: ['retro games'] },
    });
    expect(tags.oneWord.every((tag) => seoWordCount(tag) === 1)).toBe(true);
    expect(tags.twoWord.every((tag) => seoWordCount(tag) === 2)).toBe(true);
    expect(tags.threeWord.every((tag) => seoWordCount(tag) === 3)).toBe(true);
    const all = seoTagList(tags);
    expect(new Set(all).size).toBe(15);
    expect(all).toEqual(expect.arrayContaining(['doom', 'calculator', 'retro games', 'gaming']));
    expect(all).toContain('video game history');
  });

  it('still fills every group without a script or a channel', () => {
    const tags = fallbackSeoTags({ title: '', script: '', channel: null });
    expect([tags.oneWord.length, tags.twoWord.length, tags.threeWord.length]).toEqual([5, 5, 5]);
    expect(new Set(seoTagList(tags)).size).toBe(15);
  });
});

describe('SEO chapters', () => {
  it('lists candidate cuts with the narration, 10 s clear of both ends', () => {
    const candidates = seoChapterCandidates(LONG, LONG_WORDS, 305);
    expect(candidates[0]).toMatchObject({ t: 0, shotId: LONG[0]?.id });
    expect(candidates[0]?.narration).toMatch(/^Doom runs on almost anything\./);
    for (const candidate of candidates.slice(1)) {
      expect(candidate.t).toBeGreaterThanOrEqual(10);
      expect(305 - candidate.t).toBeGreaterThanOrEqual(10);
    }
    const many = seoChapterCandidates(evenShots(200, 3), [], 600);
    expect(many).toHaveLength(MAX_SEO_CANDIDATES);
    expect(many[0]?.t).toBe(0);
  });

  it('narrows the storyboard plan to 5–8 chapters', () => {
    const starts = planChapterStarts(evenShots(60, 10), 600, { min: 5, max: 8 });
    expect(starts.ok && starts.starts.length).toBeGreaterThanOrEqual(5);
    expect(starts.ok && starts.starts.length).toBeLessThanOrEqual(8);
    const chapters = fallbackSeoChapters(LONG, 305, LONG_WORDS, TITLE);
    expect(chapters.length).toBeGreaterThanOrEqual(5);
    expect(chapters.length).toBeLessThanOrEqual(8);
  });

  it('builds a fallback seo.json that passes every rule', () => {
    const seo = fallbackPublishSeo({
      title: TITLE,
      script: SCRIPT,
      channel: { genre: 'history' },
      shots: LONG,
      durationS: 305,
      words: LONG_WORDS,
    });
    expect(publishSeoIssues(seo, { durationS: 305 })).toEqual([]);
    const short = fallbackPublishSeo({
      title: TITLE,
      script: SCRIPT,
      channel: null,
      shots: SHOTS,
      durationS: 30.5,
      words: WORDS,
    });
    expect(publishSeoIssues(short, { durationS: 30.5 })).toEqual([]);
  });
});

describe('publish kit with seo.json', () => {
  const seo: PublishSeoFile = {
    version: 1,
    source: 'claude',
    generatedAt: '2026-10-09T10:00:00.000Z',
    model: 'sonnet',
    ...fallbackPublishSeo({
      title: TITLE,
      script: SCRIPT,
      channel: { genre: 'tech-explainer' },
      shots: LONG,
      durationS: 305,
      words: LONG_WORDS,
    }),
  };
  const input = (durationS: number): PublishKitInput => ({
    title: TITLE,
    script: SCRIPT,
    shots: LONG,
    durationS,
    meta: null,
    fallbackTags: ['fallback'],
    credits: { markdown: '', count: 0, unverified: [] },
    words: LONG_WORDS,
    seo,
  });

  it('uses its 15 tags and its chapters', () => {
    const kit = buildPublishKit(input(305));
    expect(kit.files['tags.txt']).toBe(`${seoTagList(seo.tags).join(', ')}\n`);
    expect(kit.chapters).toEqual(seo.chapters.map(({ t, title }) => ({ t, title })));
    expect(kit.files['description.txt']).toContain(
      `Chapters\n0:00 ${seo.chapters[0]?.title ?? ''}`,
    );
    expect(kit.warnings).toEqual([]);
  });

  it('falls back to its own chapters when seo.json no longer fits the video', () => {
    const kit = buildPublishKit(input(200));
    expect(kit.files['tags.txt']).toBe(`${seoTagList(seo.tags).join(', ')}\n`);
    expect(kit.chapters.every((chapter) => chapter.t < 190)).toBe(true);
    expect(kit.warnings).toEqual([
      'publish/seo.json chapters no longer fit this video: the kit uses its own; regenerate the tags and timestamps.',
    ]);
  });
});
