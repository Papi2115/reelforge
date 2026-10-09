/**
 * SEO chapters (PLAN.md#13.17): the cut points Claude may start a chapter at (every shot start that
 * leaves 10 s on both sides, with the narration spoken there), and the deterministic chapters when
 * Claude is unavailable: the storyboard plan narrowed to 5–8 chapters, titled from the narration.
 */
import {
  findOffensiveWords,
  isGenericChapterTitle,
  SEO_CHAPTER_TITLE_MAX,
  seoChapterBounds,
  type PublishSeoChapter,
  type TimedWord,
} from '@reelforge/shared';
import { MIN_CHAPTER_SECONDS, MIN_CHAPTERS } from '../export/chapters.js';
import {
  boundaryStrength,
  planChapterStarts,
  titleChapters,
  type PlanShot,
} from './chapter-plan.js';

/** Most candidates given to Claude (a long film keeps the strongest act changes). */
export const MAX_SEO_CANDIDATES = 60;
/** Words of narration shown per candidate. */
const NARRATION_WORDS = 30;
/** Words spoken this long before a cut still belong to the shot after it. */
const LEAD_S = 0.3;

export interface SeoChapterCandidate {
  /** Start in seconds (the shot's start; 0 for the first). */
  readonly t: number;
  readonly shotId: string;
  /** What the narrator says from there until the next cut (may be empty). */
  readonly narration: string;
}

function narrationAt(words: readonly TimedWord[], from: number, until: number): string {
  const spoken = words.filter((word) => word.t >= from - LEAD_S && word.t < until - LEAD_S);
  const text = spoken
    .slice(0, NARRATION_WORDS)
    .map((word) => word.text)
    .join(' ');
  return spoken.length > NARRATION_WORDS ? `${text} …` : text;
}

/** Shot starts a chapter may begin at, in time order (the first is always 0). */
export function seoChapterCandidates(
  shots: readonly PlanShot[],
  words: readonly TimedWord[],
  durationS: number,
): SeoChapterCandidate[] {
  const end = Math.floor(durationS);
  const fits = shots
    .map((shot, index) => ({ shot, index, t: index === 0 ? 0 : shot.t0 }))
    .filter(
      ({ index, t }) =>
        index === 0 ||
        (Math.floor(t) >= MIN_CHAPTER_SECONDS && end - Math.floor(t) >= MIN_CHAPTER_SECONDS),
    );
  const kept =
    fits.length <= MAX_SEO_CANDIDATES
      ? fits
      : [
          ...fits.slice(0, 1),
          ...fits
            .slice(1)
            .map((entry) => ({ entry, strength: boundaryStrength(shots, entry.index) }))
            .sort((a, b) => b.strength - a.strength || a.entry.index - b.entry.index)
            .slice(0, MAX_SEO_CANDIDATES - 1)
            .map(({ entry }) => entry)
            .sort((a, b) => a.index - b.index),
        ];
  return kept.map(({ shot, index, t }) => ({
    t,
    shotId: shot.id,
    narration: narrationAt(words, t, shots[index + 1]?.t0 ?? Infinity),
  }));
}

/** At most SEO_CHAPTER_TITLE_MAX characters, cut at a word. */
function clipTitle(title: string): string {
  const clean = title.replace(/\s+/g, ' ').trim();
  if (clean.length <= SEO_CHAPTER_TITLE_MAX) return clean;
  const cut = clean.slice(0, SEO_CHAPTER_TITLE_MAX + 1);
  const space = cut.lastIndexOf(' ');
  return (space > 0 ? cut.slice(0, space) : clean.slice(0, SEO_CHAPTER_TITLE_MAX)).trim();
}

/** A title that is generic ("Intro") or offensive is replaced by the film's own words. */
function seoTitle(title: string, filmTitle: string, index: number): string {
  const film = clipTitle(filmTitle.trim() || 'The Story');
  const bad = isGenericChapterTitle(title) || findOffensiveWords(title).length > 0;
  if (!bad) return clipTitle(title);
  return index === 0 ? film : clipTitle(`${film}, Part ${String(index + 1)}`);
}

/**
 * Chapters without Claude: the storyboard plan with the SEO count (5–8, fewer only for a short
 * video; when the cuts allow no such split, YouTube's minimum of 3), titled from the narration.
 * Empty when the video is too short for chapters.
 */
export function fallbackSeoChapters(
  shots: readonly PlanShot[],
  durationS: number,
  words: readonly TimedWord[],
  filmTitle: string,
): PublishSeoChapter[] {
  const bounds = seoChapterBounds(
    durationS,
    shots.slice(1).map((shot) => shot.t0),
  );
  if (bounds.max === 0) return [];
  let starts = planChapterStarts(shots, durationS, bounds);
  if (!starts.ok)
    starts = planChapterStarts(shots, durationS, { min: MIN_CHAPTERS, max: bounds.max });
  if (!starts.ok) return [];
  const used = new Set<string>();
  return titleChapters(shots, starts.starts, new Map(), words).map((chapter, index) => {
    let title = seoTitle(chapter.title, filmTitle, index);
    if (used.has(title.toLowerCase())) title = clipTitle(`${title} ${String(index + 1)}`);
    used.add(title.toLowerCase());
    return { t: chapter.t, title };
  });
}
