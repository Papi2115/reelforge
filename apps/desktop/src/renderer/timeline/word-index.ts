/**
 * Word-derived lookups of the timeline (PLAN.md#6.5): snapping to word boundaries, sentences for
 * the zoomed-out Narration track and the visible slice of a time-sorted list (binary search, so a
 * 10-minute narration never iterates all its words per frame).
 */
import type { TimedWord } from '@reelforge/shared';

/** Narration shows single words from this zoom on (px per second), sentences below it. */
export const WORD_DETAIL_PX_PER_SECOND = 70;
/** A pause this long also ends a sentence. */
const SENTENCE_PAUSE_SECONDS = 0.6;
const SENTENCE_END = /[.!?…]["')\]]*$/;

export interface TimeSpan {
  readonly t: number;
  readonly tEnd: number;
}

export interface Sentence extends TimeSpan {
  readonly text: string;
  /** Index of the first and last word (inclusive). */
  readonly first: number;
  readonly last: number;
}

/** Sorted, de-duplicated word starts and ends. */
export function wordBoundaries(words: readonly TimeSpan[]): Float64Array {
  const times = new Float64Array(words.length * 2);
  words.forEach((word, index) => {
    times[index * 2] = word.t;
    times[index * 2 + 1] = word.tEnd;
  });
  times.sort();
  let size = 0;
  for (const time of times) {
    if (size === 0 || time - (times[size - 1] ?? 0) > 1e-9) times[size++] = time;
  }
  return times.slice(0, size);
}

/** Index of the first element >= t (sorted ascending), or the length. */
function lowerBound(sorted: Float64Array, t: number): number {
  let low = 0;
  let high = sorted.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if ((sorted[middle] ?? 0) < t) low = middle + 1;
    else high = middle;
  }
  return low;
}

/** Nearest boundary within `tolerance` of `t`, else `t` itself. */
export function snapTime(
  t: number,
  boundaries: Float64Array,
  tolerance: number,
): { readonly t: number; readonly snapped: boolean } {
  const index = lowerBound(boundaries, t);
  let best: number | undefined;
  for (const candidate of [boundaries[index - 1], boundaries[index]]) {
    if (candidate === undefined || Math.abs(candidate - t) > tolerance) continue;
    if (best === undefined || Math.abs(candidate - t) < Math.abs(best - t)) best = candidate;
  }
  return best === undefined ? { t, snapped: false } : { t: best, snapped: true };
}

/** Groups words into sentences (ending punctuation or a long pause). */
export function sentencesOf(words: readonly TimedWord[]): Sentence[] {
  const sentences: Sentence[] = [];
  let first = 0;
  words.forEach((word, index) => {
    const next = words[index + 1];
    const ends =
      next === undefined ||
      SENTENCE_END.test(word.text) ||
      next.t - word.tEnd >= SENTENCE_PAUSE_SECONDS;
    if (!ends) return;
    const span = words.slice(first, index + 1);
    sentences.push({
      t: span[0]?.t ?? word.t,
      tEnd: word.tEnd,
      text: span.map((item) => item.text).join(' '),
      first,
      last: index,
    });
    first = index + 1;
  });
  return sentences;
}

/**
 * Index range [start, end) of the spans that overlap [from, to]. Spans must be sorted by `t`
 * with non-decreasing `tEnd` (true for words and sentences).
 */
export function visibleSpans(
  spans: readonly TimeSpan[],
  from: number,
  to: number,
): { readonly start: number; readonly end: number } {
  let low = 0;
  let high = spans.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if ((spans[middle]?.tEnd ?? 0) < from) low = middle + 1;
    else high = middle;
  }
  const start = low;
  high = spans.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if ((spans[middle]?.t ?? 0) <= to) low = middle + 1;
    else high = middle;
  }
  return { start, end: low };
}
