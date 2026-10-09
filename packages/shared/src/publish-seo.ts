/**
 * `publish/seo.json` (PLAN.md#13.17): the film's YouTube SEO metadata, written by the
 * `publish-seo` Claude turn or, when Claude is unavailable, by the deterministic fallback. Tags are
 * exactly 5 one-word, 5 two-word and 5 three-word search phrases (film-specific and channel-wide);
 * chapters are 5–8 timestamps (fewer only when the video is too short for 5 chapters of 10 s).
 * `publishSeoIssues` holds every rule both the prompt validator and the publish kit apply.
 */
import { z } from 'zod';
import { findOffensiveWords, offensiveWordMessage } from './offensive-words.js';
import { tagsLength, YOUTUBE_TAGS_TOTAL_MAX, YOUTUBE_TITLE_MAX } from './youtube-meta.js';

export const PUBLISH_SEO_VERSION = 1;
/** Project-relative, tracked (the publish kit's folder). */
export const PUBLISH_SEO_FILE = 'publish/seo.json';
export const SEO_TAGS_PER_GROUP = 5;
export const SEO_MIN_CHAPTERS = 5;
export const SEO_MAX_CHAPTERS = 8;
/** YouTube: each chapter lasts at least 10 s (compared in whole seconds, as the description shows). */
export const SEO_MIN_CHAPTER_SECONDS = 10;
/** YouTube shows no chapters below this many. */
export const SEO_YOUTUBE_MIN_CHAPTERS = 3;
export const SEO_CHAPTER_TITLE_MAX = 60;
export const SEO_TAG_MAX = 100;

/** Tag groups in file order, with the exact word count of their tags. */
export const SEO_TAG_GROUPS = [
  { key: 'oneWord', words: 1 },
  { key: 'twoWord', words: 2 },
  { key: 'threeWord', words: 3 },
] as const;
export type SeoTagGroup = (typeof SEO_TAG_GROUPS)[number]['key'];

const tagGroupSchema = z
  .array(z.string().trim().min(1).max(SEO_TAG_MAX))
  .length(SEO_TAGS_PER_GROUP);

export const publishSeoTagsSchema = z.strictObject({
  oneWord: tagGroupSchema,
  twoWord: tagGroupSchema,
  threeWord: tagGroupSchema,
});
export type PublishSeoTags = z.infer<typeof publishSeoTagsSchema>;

export const publishSeoChapterSchema = z.strictObject({
  /** Start in seconds. */
  t: z.number().min(0),
  title: z.string().trim().min(1).max(SEO_CHAPTER_TITLE_MAX),
});
export type PublishSeoChapter = z.infer<typeof publishSeoChapterSchema>;

/** The metadata itself (also the shape of Claude's JSON reply). */
export const publishSeoSchema = z.strictObject({
  /** A search-friendly title suggestion. */
  title: z.string().trim().min(1).max(YOUTUBE_TITLE_MAX).optional(),
  tags: publishSeoTagsSchema,
  chapters: z.array(publishSeoChapterSchema).max(SEO_MAX_CHAPTERS),
});
export type PublishSeo = z.infer<typeof publishSeoSchema>;

export const publishSeoFileSchema = z.strictObject({
  version: z.literal(PUBLISH_SEO_VERSION),
  /** Claude's turn, or the deterministic fallback (script keywords + planned chapters). */
  source: z.enum(['claude', 'fallback']),
  generatedAt: z.iso.datetime(),
  /** Model alias of Claude's turn (absent for the fallback). */
  model: z.string().trim().min(1).max(64).optional(),
  ...publishSeoSchema.shape,
});
export type PublishSeoFile = z.infer<typeof publishSeoFileSchema>;

export interface PublishSeoIssue {
  readonly code: string;
  readonly message: string;
  readonly path: string;
}

export interface SeoChapterBounds {
  readonly min: number;
  readonly max: number;
}

/**
 * Most chapters of 10 s that fit: by length alone, or (with `candidates`, the allowed starts
 * besides 0) by taking the earliest start that keeps 10 s to the previous one and to the end.
 */
function chaptersThatFit(durationS: number, candidates?: readonly number[]): number {
  const end = Math.floor(Math.max(0, durationS));
  if (candidates === undefined) return Math.floor(end / SEO_MIN_CHAPTER_SECONDS);
  if (end < SEO_MIN_CHAPTER_SECONDS) return 0;
  let count = 1;
  let previous = 0;
  for (const second of candidates.map((t) => Math.floor(t)).sort((a, b) => a - b)) {
    if (second - previous >= SEO_MIN_CHAPTER_SECONDS && end - second >= SEO_MIN_CHAPTER_SECONDS) {
      count += 1;
      previous = second;
    }
  }
  return count;
}

/**
 * How many chapters a video gets: 5–8; when 5 do not fit (a short video, or too few cuts with
 * `candidates`), 3 up to what fits; none when not even YouTube's minimum of 3 fits.
 */
export function seoChapterBounds(
  durationS: number,
  candidates?: readonly number[],
): SeoChapterBounds {
  const max = Math.min(SEO_MAX_CHAPTERS, chaptersThatFit(durationS, candidates));
  if (max < SEO_YOUTUBE_MIN_CHAPTERS) return { min: 0, max: 0 };
  return { min: max >= SEO_MIN_CHAPTERS ? SEO_MIN_CHAPTERS : SEO_YOUTUBE_MIN_CHAPTERS, max };
}

/** Whitespace collapsed, lower case: how duplicates are compared. */
export function seoTagKey(tag: string): string {
  return tag.replace(/\s+/g, ' ').trim().toLowerCase();
}

export function seoWordCount(text: string): number {
  return text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
}

/** The 15 tags in a paste order: the groups interleaved, most important (first) of each first. */
export function seoTagList(tags: PublishSeoTags): string[] {
  const list: string[] = [];
  for (let rank = 0; rank < SEO_TAGS_PER_GROUP; rank += 1) {
    for (const group of SEO_TAG_GROUPS) {
      const tag = tags[group.key][rank];
      if (tag !== undefined) list.push(tag);
    }
  }
  return list;
}

/** Chapter titles that say nothing a viewer would search for. */
const GENERIC_TITLE =
  /^(?:intro|introduction|outro|conclusion|ending|end|the end|summary|recap|start|beginning|overview|final thoughts|wrap[- ]?up|(?:part|chapter|section) \d+)$/i;

export function isGenericChapterTitle(title: string): boolean {
  return GENERIC_TITLE.test(title.replace(/[^\p{L}\p{N}\s-]/gu, '').trim());
}

function offensiveIssues(text: string, path: string): PublishSeoIssue[] {
  return [...new Set(findOffensiveWords(text).map((hit) => hit.word))].map((word) => ({
    code: 'offensive-word',
    message: offensiveWordMessage(word),
    path,
  }));
}

function tagIssues(tags: PublishSeoTags): PublishSeoIssue[] {
  const issues: PublishSeoIssue[] = [];
  const seen = new Set<string>();
  for (const group of SEO_TAG_GROUPS) {
    tags[group.key].forEach((tag, index) => {
      const path = `tags.${group.key}[${String(index)}]`;
      const words = seoWordCount(tag);
      if (words !== group.words) {
        const want = `${String(group.words)} word${group.words === 1 ? '' : 's'}`;
        issues.push({
          code: 'tag-words',
          message: `"${tag}" has ${String(words)} word(s); ${group.key} tags have exactly ${want}`,
          path,
        });
      }
      if (/[#,<>]/.test(tag)) {
        issues.push({ code: 'tag-chars', message: `"${tag}" contains #, a comma, < or >`, path });
      }
      const key = seoTagKey(tag);
      if (seen.has(key)) {
        issues.push({ code: 'tag-duplicate', message: `"${tag}" appears twice`, path });
      }
      seen.add(key);
      issues.push(...offensiveIssues(tag, path));
    });
  }
  const all = seoTagList(tags);
  if (tagsLength(all) > YOUTUBE_TAGS_TOTAL_MAX) {
    issues.push({
      code: 'tags-too-long',
      message: `the tags have ${String(tagsLength(all))} characters together (YouTube allows ${String(YOUTUBE_TAGS_TOTAL_MAX)})`,
      path: 'tags',
    });
  }
  return issues;
}

export interface PublishSeoCheckOptions {
  /** Length of the video in seconds. */
  readonly durationS: number;
  /** Allowed chapter starts (shot cuts); absent = any time. */
  readonly candidates?: readonly number[];
}

/** Candidate starts are matched within this many seconds. */
const CANDIDATE_TOLERANCE_S = 0.05;

function chapterIssues(
  chapters: readonly PublishSeoChapter[],
  options: PublishSeoCheckOptions,
): PublishSeoIssue[] {
  const issues: PublishSeoIssue[] = [];
  const bounds = seoChapterBounds(options.durationS, options.candidates);
  // A video under 50 s may go without chapters (its cuts rarely allow 3 of 10 s).
  const noneAllowed = chapters.length === 0 && bounds.max < SEO_MIN_CHAPTERS;
  if (!noneAllowed && (chapters.length < bounds.min || chapters.length > bounds.max)) {
    const range =
      bounds.max === 0
        ? 'none (the video is too short)'
        : `${String(bounds.min)}–${String(bounds.max)}`;
    issues.push({
      code: 'chapter-count',
      message: `${String(chapters.length)} chapters; a ${String(Math.floor(options.durationS))} s video needs ${range}`,
      path: 'chapters',
    });
  }
  const end = Math.floor(options.durationS);
  const titles = new Set<string>();
  chapters.forEach((chapter, index) => {
    const path = `chapters[${String(index)}]`;
    const second = Math.floor(chapter.t);
    const previous = chapters[index - 1];
    if (index === 0 && second !== 0) {
      issues.push({ code: 'chapter-first', message: 'the first chapter must start at 0:00', path });
    }
    if (previous !== undefined && second - Math.floor(previous.t) < SEO_MIN_CHAPTER_SECONDS) {
      issues.push({
        code: 'chapter-gap',
        message: `"${chapter.title}" starts less than ${String(SEO_MIN_CHAPTER_SECONDS)} s after the previous chapter (or before it)`,
        path,
      });
    }
    if (index === chapters.length - 1 && end - second < SEO_MIN_CHAPTER_SECONDS) {
      issues.push({
        code: 'chapter-end',
        message: `the last chapter must start at least ${String(SEO_MIN_CHAPTER_SECONDS)} s before the end (${String(end)} s)`,
        path,
      });
    }
    const candidates = options.candidates;
    if (
      index > 0 &&
      candidates !== undefined &&
      !candidates.some((t) => Math.abs(t - chapter.t) <= CANDIDATE_TOLERANCE_S)
    ) {
      issues.push({
        code: 'chapter-candidate',
        message: `${String(chapter.t)} s is not one of the candidate cut points`,
        path,
      });
    }
    if (isGenericChapterTitle(chapter.title)) {
      issues.push({
        code: 'chapter-generic',
        message: `"${chapter.title}" says nothing searchable: name what happens in it`,
        path,
      });
    }
    const key = seoTagKey(chapter.title);
    if (titles.has(key)) {
      issues.push({ code: 'chapter-duplicate', message: `"${chapter.title}" appears twice`, path });
    }
    titles.add(key);
    issues.push(...offensiveIssues(chapter.title, `${path}.title`));
  });
  return issues;
}

/** Every rule of `publish/seo.json` beyond its schema (empty: valid for this video). */
export function publishSeoIssues(
  seo: PublishSeo,
  options: PublishSeoCheckOptions,
): PublishSeoIssue[] {
  return [
    ...tagIssues(seo.tags),
    ...chapterIssues(seo.chapters, options),
    ...(seo.title === undefined ? [] : offensiveIssues(seo.title, 'title')),
  ];
}
