/**
 * Publish kit (PLAN.md#12.17, ADR-016): the paste-ready texts of a finished film, built from the
 * final storyboard, the script, the YouTube suggestions (`out/metadata.json`, Claude's when
 * present) and the asset credits. Pure: the app reads the inputs, shows the texts and saves them
 * under `publish/` on demand. Nothing is uploaded anywhere.
 */
import {
  scriptSentences,
  tagsLength,
  YOUTUBE_DESCRIPTION_MAX,
  YOUTUBE_TAGS_TOTAL_MAX,
  type StoryboardShot,
  type TimedWord,
  type YoutubeMetaFile,
} from '@reelforge/shared';
import { buildChaptersTxt, type Chapter } from '../export/chapters.js';
import { chapterLinesOf, planChapterStarts, titleChapters } from './chapter-plan.js';

export const PUBLISH_DIR = 'publish';
export const PUBLISH_FILES = [
  'description.txt',
  'chapters.txt',
  'tags.txt',
  'credits.txt',
] as const;
export type PublishFileName = (typeof PUBLISH_FILES)[number];

/** Hashtags YouTube shows above the title (it shows the first three). */
const HASHTAGS = 3;
const HOOK_SENTENCES = 2;
export const LINKS_PLACEHOLDER = 'Links\n- (add your links here)';

export interface PublishCredits {
  /** `reelforge assets credits` text of the assets the scenes use (`creditsMarkdown`). */
  readonly markdown: string;
  /** Assets listed. */
  readonly count: number;
  /** Titles of listed assets whose licence is not verified. */
  readonly unverified: readonly string[];
}

export interface PublishKitInput {
  readonly title: string;
  readonly script: string;
  /** The final storyboard (after locks and timeline trims). */
  readonly shots: readonly StoryboardShot[];
  readonly durationS: number;
  /** `out/metadata.json` (Claude's description/tags win over the template). */
  readonly meta: YoutubeMetaFile | null;
  /** Tags when there is no metadata (script keywords). */
  readonly fallbackTags: readonly string[];
  readonly credits: PublishCredits;
  /** `timing/words.json` words: chapter titles from the narration (absent: from shot intents). */
  readonly words?: readonly TimedWord[];
}

export interface PublishKit {
  readonly files: Readonly<Record<PublishFileName, string>>;
  readonly chapters: readonly Chapter[];
  /** Why YouTube would show no chapters (null: chapters.txt is valid). */
  readonly chapterProblem: string | null;
  readonly unverified: readonly string[];
  /** Things to fix before publishing (unverified licences, a too long description). */
  readonly warnings: readonly string[];
}

/** The block that heads description.txt and credits.txt while a licence is unverified. */
export function unverifiedWarning(titles: readonly string[]): string | null {
  if (titles.length === 0) return null;
  const list = titles.map((title) => `"${title}"`).join(', ');
  const one = titles.length === 1;
  return [
    `!!! WARNING: ${String(titles.length)} asset${one ? ' has' : 's have'} an UNVERIFIED licence: ${list}.`,
    `!!! Confirm ${one ? 'its' : 'each'} licence or replace ${one ? 'it' : 'them'} before publishing, then delete this block.`,
  ].join('\n');
}

/**
 * The opening paragraph: Claude's description without its chapter and hashtag lines (the kit adds
 * its own), else the script's start.
 */
export function hookParagraph(input: Pick<PublishKitInput, 'meta' | 'script' | 'title'>): string {
  if (input.meta?.source === 'claude') {
    const text = input.meta.description
      .split(/\r?\n/)
      .filter((line) => chapterLinesOf(line).size === 0 && !/^\s*(?:#\S+\s*)+$/.test(line))
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    if (text !== '') return text;
  }
  const opening = scriptSentences(input.script)
    .slice(0, HOOK_SENTENCES)
    .map((sentence) => sentence.text)
    .join(' ');
  return opening === '' ? input.title.trim() || 'Untitled video' : opening;
}

/** Tags within YouTube's 500 characters: Claude's/the template's, else the fallback. */
export function publishTags(input: Pick<PublishKitInput, 'meta' | 'fallbackTags'>): string[] {
  const tags = [...(input.meta?.tags ?? input.fallbackTags)]
    .map((tag) => tag.replace(/\s+/g, ' ').trim())
    .filter((tag, index, all) => tag !== '' && all.indexOf(tag) === index);
  while (tags.length > 0 && tagsLength(tags) > YOUTUBE_TAGS_TOTAL_MAX) tags.pop();
  return tags;
}

function hashtag(tag: string): string {
  return `#${tag.replace(/[^\p{L}\p{N}]+/gu, '')}`;
}

/** Chapters of the storyboard (and their chapters.txt), or why there are none. */
export function publishChapters(
  input: Pick<PublishKitInput, 'shots' | 'durationS' | 'meta' | 'words'>,
): {
  chapters: Chapter[];
  text: string | null;
  problem: string | null;
} {
  const starts = planChapterStarts(input.shots, input.durationS);
  if (!starts.ok) return { chapters: [], text: null, problem: starts.problem };
  const suggested =
    input.meta?.source === 'claude'
      ? chapterLinesOf(input.meta.description)
      : new Map<number, string>();
  const chapters = titleChapters(input.shots, starts.starts, suggested, input.words ?? []);
  const built = buildChaptersTxt(chapters, input.durationS);
  return built.ok
    ? { chapters, text: built.value, problem: null }
    : { chapters: [], text: null, problem: built.error.message.replace(/^chapters: /, '') };
}

export function buildPublishKit(input: PublishKitInput): PublishKit {
  const warning = unverifiedWarning(input.credits.unverified);
  const chapters = publishChapters(input);
  const tags = publishTags(input);
  const credits = input.credits.markdown.trim();
  const description = [
    warning,
    hookParagraph(input),
    chapters.text === null ? null : `Chapters\n${chapters.text.trim()}`,
    LINKS_PLACEHOLDER,
    input.credits.count > 0 ? credits : null,
    tags.length === 0 ? null : tags.slice(0, HASHTAGS).map(hashtag).join(' '),
  ]
    .filter((part): part is string => part !== null && part !== '')
    .join('\n\n');
  const warnings: string[] = [];
  if (warning !== null) {
    warnings.push(
      `${String(input.credits.unverified.length)} asset licence(s) unverified: confirm or replace before publishing.`,
    );
  }
  if (description.length > YOUTUBE_DESCRIPTION_MAX) {
    warnings.push(
      `The description has ${String(description.length)} characters (YouTube allows ${String(YOUTUBE_DESCRIPTION_MAX)}): shorten the opening paragraph.`,
    );
  }
  return {
    files: {
      'description.txt': `${description}\n`,
      'chapters.txt': chapters.text ?? `(no chapters: ${chapters.problem ?? 'none'})\n`,
      'tags.txt': `${tags.join(', ')}\n`,
      'credits.txt': `${[warning, credits].filter((part) => part !== null).join('\n\n')}\n`,
    },
    chapters: chapters.chapters,
    chapterProblem: chapters.problem,
    unverified: input.credits.unverified,
    warnings,
  };
}
