/**
 * `publish/seo.json` without Claude (PLAN.md#13.17): exactly 5 one-word, 5 two-word and 5
 * three-word tags from the film's keywords (title words weigh more) and the channel's niche
 * (its genre's umbrella phrases, its default tags, its name), plus the planned SEO chapters.
 * Deterministic, so an export never waits for Claude.
 */
import {
  findOffensiveWords,
  SEO_TAG_GROUPS,
  SEO_TAG_MAX,
  SEO_TAGS_PER_GROUP,
  seoTagKey,
  seoWordCount,
  YOUTUBE_TITLE_MAX,
  type PublishSeo,
  type PublishSeoTags,
  type SeoTagGroup,
  type TimedWord,
} from '@reelforge/shared';
import type { PlanShot } from './chapter-plan.js';
import { isFunctionWord } from './chapter-titles.js';
import { fallbackSeoChapters } from './seo-chapters.js';

/** What the publish kit knows about the project's channel (all optional). */
export interface SeoChannelInfo {
  readonly name?: string | undefined;
  /** Genre preset id of the project or channel (e.g. `history`). */
  readonly genre?: string | undefined;
  /** Its display name (e.g. "History"). */
  readonly genreName?: string | undefined;
  /** Style / world id (e.g. `voxel-pixel-crisp640`). */
  readonly style?: string | undefined;
  /** The channel's default tags (publish defaults). */
  readonly tags?: readonly string[] | undefined;
  /** The channel's notes (what it is about). */
  readonly notes?: string | undefined;
}

/** Umbrella phrases of the built-in genre presets (any word count; sorted into the groups). */
const GENRE_UMBRELLAS: Readonly<Record<string, readonly string[]>> = {
  'true-crime': [
    'crime',
    'mystery',
    'true crime',
    'crime stories',
    'true crime documentary',
    'true crime explained',
  ],
  'tech-explainer': [
    'technology',
    'tech',
    'tech explained',
    'computer science',
    'how technology works',
    'technology explained simply',
  ],
  history: [
    'history',
    'documentary',
    'history explained',
    'world history',
    'history documentary explained',
    'history explained simply',
  ],
  finance: [
    'finance',
    'money',
    'money explained',
    'finance explained',
    'personal finance explained',
    'how money works',
  ],
  science: [
    'science',
    'physics',
    'science explained',
    'science facts',
    'how science works',
    'science explained simply',
  ],
  'pop-culture': [
    'gaming',
    'games',
    'gaming history',
    'pop culture',
    'video game history',
    'pop culture explained',
  ],
  'explained-as-a-game': [
    'explained',
    'gaming',
    'explained simply',
    'game explained',
    'explained like a game',
    'explained in minutes',
  ],
};
const DEFAULT_UMBRELLAS = [
  'explained',
  'education',
  'explained simply',
  'educational video',
  'explained in minutes',
  'learn something new',
];
/** Last resort per group (never all used up: 5 per group are always available). */
const GENERIC_POOL: Readonly<Record<SeoTagGroup, readonly string[]>> = {
  oneWord: [
    'explained',
    'education',
    'documentary',
    'facts',
    'learning',
    'explainer',
    'story',
    'knowledge',
  ],
  twoWord: [
    'explained simply',
    'fun facts',
    'educational video',
    'short documentary',
    'quick explainer',
    'learn fast',
    'true story',
    'deep dive',
  ],
  threeWord: [
    'explained in minutes',
    'how it works',
    'the full story',
    'learn something new',
    'facts you missed',
    'explained for beginners',
    'a short documentary',
    'the real story',
  ],
};
/** Content words too vague to be a tag (and common verbs, which make no search phrase). */
const VAGUE = new Set(
  [
    'thing things people way ways lot lots make makes made get gets got went said says year years',
    'time times day days kind sort bit part parts point world new old big small good bad',
    'run runs running need needs needed work works worked use uses used go goes going come comes',
    'came take takes took give gives gave find finds found become becomes became start starts',
    'started begin begins began call calls called show shows showed look looks looked keep keeps',
    'kept turn turns turned put puts tell tells told know knows knew think thinks thought',
  ]
    .join(' ')
    .split(' '),
);

function cleanTag(text: string): string {
  return text
    .toLowerCase()
    .replace(/[#,<>"“”]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, SEO_TAG_MAX);
}

/** Sentences as lists of lower-case words (possessives dropped). */
function sentenceWords(text: string): string[][] {
  return text
    .split(/[.!?…;:,()\n]+/)
    .map((sentence) =>
      (sentence.toLowerCase().match(/\p{L}[\p{L}\p{N}'’-]*/gu) ?? []).map((word) =>
        word.replace(/['’]s$/u, '').replace(/['’-]+$/u, ''),
      ),
    )
    .filter((words) => words.length > 0);
}

function isKeyword(word: string): boolean {
  return word.length >= 3 && !isFunctionWord(word) && !VAGUE.has(word);
}

interface RankedPhrases {
  /** Said twice or more, or in the title: best first (count + a title bonus, then first use). */
  readonly strong: string[];
  /** Said once, in first-use order. */
  readonly weak: string[];
}

/** Phrases of `size` keywords in a row. */
function rankedPhrases(title: string, script: string, size: number): RankedPhrases {
  const scores = new Map<string, { score: number; first: number }>();
  let order = 0;
  const add = (text: string, weight: number): void => {
    for (const words of sentenceWords(text)) {
      for (let start = 0; start + size <= words.length; start += 1) {
        const run = words.slice(start, start + size);
        if (!run.every(isKeyword)) continue;
        const phrase = run.join(' ');
        const entry = scores.get(phrase) ?? { score: 0, first: (order += 1) };
        scores.set(phrase, { score: entry.score + weight, first: entry.first });
      }
    }
  };
  add(title, 3);
  add(script, 1);
  const ranked = [...scores.entries()].sort(
    (a, b) => b[1].score - a[1].score || a[1].first - b[1].first,
  );
  return {
    strong: ranked.filter(([, entry]) => entry.score >= 2).map(([phrase]) => phrase),
    weak: ranked.filter(([, entry]) => entry.score < 2).map(([phrase]) => phrase),
  };
}

function channelPhrases(channel: SeoChannelInfo | null): string[] {
  if (channel === null) return DEFAULT_UMBRELLAS;
  const genre = channel.genre === undefined ? undefined : GENRE_UMBRELLAS[channel.genre];
  const genreName = cleanTag(channel.genreName ?? '');
  const named = genre ?? (genreName === '' ? [] : [genreName, `${genreName} explained`]);
  const name = cleanTag(channel.name ?? '');
  return [
    ...(channel.tags ?? []),
    ...named,
    ...(name === '' || name === 'default' ? [] : [name]),
    ...DEFAULT_UMBRELLAS,
  ];
}

/**
 * Film phrases per group: keywords, then repeated (or title) keyword pairs and triples, then
 * "… explained" forms of the top keywords, then pairs and triples said once.
 */
function filmPhrases(title: string, script: string): Record<SeoTagGroup, string[]> {
  const one = rankedPhrases(title, script, 1);
  const two = rankedPhrases(title, script, 2);
  const three = rankedPhrases(title, script, 3);
  const topWords = [...one.strong, ...one.weak];
  const topPairs = [...two.strong, ...two.weak];
  return {
    oneWord: topWords,
    twoWord: [
      ...two.strong,
      ...topWords.slice(0, 3).map((word) => `${word} explained`),
      ...two.weak,
    ],
    threeWord: [
      ...three.strong,
      ...topPairs.slice(0, 3).map((pair) => `${pair} explained`),
      ...topWords.slice(0, 2).map((word) => `${word} explained simply`),
      ...three.weak,
    ],
  };
}

/** Five tags of a group: film first, then the channel, alternating; the generic pool last. */
function pickGroup(
  group: (typeof SEO_TAG_GROUPS)[number],
  film: readonly string[],
  channel: readonly string[],
  taken: Set<string>,
): string[] {
  const fits = (tag: string): boolean =>
    tag !== '' &&
    seoWordCount(tag) === group.words &&
    !taken.has(seoTagKey(tag)) &&
    findOffensiveWords(tag).length === 0;
  const picked: string[] = [];
  const take = (source: readonly string[], count: number): void => {
    for (const raw of source) {
      if (picked.length >= SEO_TAGS_PER_GROUP || count <= 0) return;
      const tag = cleanTag(raw);
      if (!fits(tag)) continue;
      picked.push(tag);
      taken.add(seoTagKey(tag));
      count -= 1;
    }
  };
  take(film, 1);
  take(channel, 1);
  take(film, 2);
  take(channel, 1);
  take(film, SEO_TAGS_PER_GROUP);
  take(channel, SEO_TAGS_PER_GROUP);
  take(GENERIC_POOL[group.key], SEO_TAGS_PER_GROUP);
  return picked;
}

export interface FallbackSeoTagsInput {
  readonly title: string;
  readonly script: string;
  readonly channel: SeoChannelInfo | null;
}

export function fallbackSeoTags(input: FallbackSeoTagsInput): PublishSeoTags {
  const film = filmPhrases(input.title, input.script);
  const channel = channelPhrases(input.channel);
  const taken = new Set<string>();
  const tags: Record<SeoTagGroup, string[]> = { oneWord: [], twoWord: [], threeWord: [] };
  for (const group of SEO_TAG_GROUPS) {
    tags[group.key] = pickGroup(group, film[group.key], channel, taken);
  }
  return tags;
}

export interface FallbackSeoInput extends FallbackSeoTagsInput {
  readonly shots: readonly PlanShot[];
  readonly durationS: number;
  readonly words: readonly TimedWord[];
}

/** The whole fallback: the film title, 15 tags and the planned chapters. */
export function fallbackPublishSeo(input: FallbackSeoInput): PublishSeo {
  const title = input.title.replace(/\s+/g, ' ').trim().slice(0, YOUTUBE_TITLE_MAX);
  return {
    ...(title === '' ? {} : { title }),
    tags: fallbackSeoTags(input),
    chapters: fallbackSeoChapters(input.shots, input.durationS, input.words, input.title),
  };
}
