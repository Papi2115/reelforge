/**
 * Anchor resolution (PLAN 3.3 / 4.5): phrase -> spoken time range over words.json. Matching is
 * case-, punctuation- and diacritics-insensitive and normalises numbers/units ("61 KB" ~ "61KB" ~
 * "sixty-one kilobytes"). Exact matches win; when there are none, near matches (typos, plurals)
 * count. Failures carry the closest candidates so an LLM can fix its anchor.
 */
import { stringSimilarity } from '../align/levenshtein.js';
import { err, ok, type Result } from '../result.js';
import { foldDiacritics, normalizeText, subTokens } from '../text/normalize.js';

export interface AnchorWord {
  readonly text: string;
  readonly t: number;
  readonly tEnd: number;
  readonly confidence?: number | undefined;
}

export interface AnchorMatch {
  readonly t: number;
  readonly tEnd: number;
  /** Mean word confidence x match similarity, 0..1. */
  readonly confidence: number;
  /** 1 for exact (normalised) matches. */
  readonly similarity: number;
  /** Word index range (inclusive) in words.json. */
  readonly from: number;
  readonly to: number;
  /** The matched words as written in words.json. */
  readonly text: string;
}

export type AnchorCandidate = Pick<
  AnchorMatch,
  'text' | 't' | 'tEnd' | 'similarity' | 'from' | 'to'
>;

export type AnchorError =
  | { readonly kind: 'invalid-phrase'; readonly message: string; readonly phrase: string }
  | {
      readonly kind: 'invalid-nth';
      readonly message: string;
      readonly phrase: string;
      readonly nth: number;
    }
  | {
      readonly kind: 'not-found';
      readonly message: string;
      readonly phrase: string;
      readonly nth: number;
      /** How many times the phrase does occur (exactly, or fuzzily when never exactly). */
      readonly occurrences: number;
      readonly candidates: readonly AnchorCandidate[];
    };

export interface AnchorIndexOptions {
  /** Language used to spell numbers (default en). */
  readonly lang?: string;
  /** Minimum similarity for a fuzzy match (default 0.8). */
  readonly fuzzyThreshold?: number;
}

const DEFAULT_FUZZY_THRESHOLD = 0.8;
const MAX_CANDIDATES = 3;

interface IndexedToken {
  readonly folded: string;
  readonly word: number;
}

interface Span {
  readonly start: number;
  /** Exclusive token end. */
  readonly end: number;
  readonly similarity: number;
}

const round3 = (value: number): number => Math.round(value * 1000) / 1000;

export class AnchorIndex {
  private readonly tokens: IndexedToken[];
  private readonly lang: string;
  private readonly fuzzyThreshold: number;

  constructor(
    private readonly words: readonly AnchorWord[],
    options: AnchorIndexOptions = {},
  ) {
    this.lang = options.lang ?? 'en';
    this.fuzzyThreshold = options.fuzzyThreshold ?? DEFAULT_FUZZY_THRESHOLD;
    this.tokens = words.flatMap((word, index) =>
      subTokens(word.text, this.lang).map((token) => ({
        folded: foldDiacritics(token),
        word: index,
      })),
    );
  }

  /** All occurrences in time order: exact ones, or fuzzy ones when there is no exact match. */
  occurrences(phrase: string): AnchorMatch[] {
    const needle = this.needle(phrase);
    if (needle.length === 0) return [];
    const exact = this.exactSpans(needle);
    const spans =
      exact.length > 0
        ? exact
        : this.fuzzySpans(needle).filter((s) => s.similarity >= this.fuzzyThreshold);
    return spans.map((span) => this.toMatch(span));
  }

  /** The `nth` (1-based) occurrence of `phrase`. */
  resolve(phrase: string, nth = 1): Result<AnchorMatch, AnchorError> {
    if (!Number.isInteger(nth) || nth < 1) {
      return err({
        kind: 'invalid-nth',
        message: `Anchor "${phrase}": nth must be an integer >= 1 (got ${String(nth)}).`,
        phrase,
        nth,
      });
    }
    if (this.needle(phrase).length === 0) {
      return err({
        kind: 'invalid-phrase',
        message: `Anchor "${phrase}" has no words to match; quote a spoken phrase from the script.`,
        phrase,
      });
    }
    const found = this.occurrences(phrase);
    const match = found[nth - 1];
    if (match !== undefined) return ok(match);
    const candidates = this.closest(phrase, found);
    return err({
      kind: 'not-found',
      message: notFoundMessage(phrase, nth, found.length, candidates),
      phrase,
      nth,
      occurrences: found.length,
      candidates,
    });
  }

  private needle(phrase: string): string[] {
    return normalizeText(phrase, this.lang).map(foldDiacritics);
  }

  private exactSpans(needle: readonly string[]): Span[] {
    const spans: Span[] = [];
    let start = 0;
    while (start + needle.length <= this.tokens.length) {
      const hit = needle.every((token, offset) => this.tokens[start + offset]?.folded === token);
      if (hit) {
        spans.push({ start, end: start + needle.length, similarity: 1 });
        start += needle.length;
      } else {
        start++;
      }
    }
    return spans;
  }

  /** Best window per start (length = needle length ± 1), then non-overlapping by score. */
  private fuzzySpans(needle: readonly string[]): Span[] {
    const target = needle.join(' ');
    const lengths = [...new Set([needle.length, needle.length - 1, needle.length + 1])].filter(
      (n) => n > 0,
    );
    const scored: Span[] = [];
    for (let start = 0; start < this.tokens.length; start++) {
      let best: Span | null = null;
      for (const length of lengths) {
        if (start + length > this.tokens.length) continue;
        const text = this.tokens
          .slice(start, start + length)
          .map((token) => token.folded)
          .join(' ');
        const similarity = stringSimilarity(target, text);
        if (best === null || similarity > best.similarity)
          best = { start, end: start + length, similarity };
      }
      if (best !== null) scored.push(best);
    }
    const chosen: Span[] = [];
    for (const span of [...scored].sort(
      (x, y) => y.similarity - x.similarity || x.start - y.start,
    )) {
      if (chosen.every((other) => span.end <= other.start || span.start >= other.end))
        chosen.push(span);
    }
    return chosen.sort((x, y) => x.start - y.start);
  }

  private closest(phrase: string, found: readonly AnchorMatch[]): AnchorCandidate[] {
    const pool =
      found.length > 0
        ? found
        : this.fuzzySpans(this.needle(phrase)).map((span) => this.toMatch(span));
    return [...pool]
      .sort((x, y) => y.similarity - x.similarity || x.t - y.t)
      .slice(0, MAX_CANDIDATES)
      .map(({ text, t, tEnd, similarity, from, to }) => ({ text, t, tEnd, similarity, from, to }));
  }

  private toMatch(span: Span): AnchorMatch {
    const from = this.tokens[span.start]?.word ?? 0;
    const to = this.tokens[span.end - 1]?.word ?? from;
    const words = this.words.slice(from, to + 1);
    const meanConfidence =
      words.reduce((sum, word) => sum + (word.confidence ?? 1), 0) / Math.max(1, words.length);
    return {
      t: words[0]?.t ?? 0,
      tEnd: words.at(-1)?.tEnd ?? 0,
      confidence: round3(meanConfidence * span.similarity),
      similarity: round3(span.similarity),
      from,
      to,
      text: words.map((word) => word.text).join(' '),
    };
  }
}

function describeCandidate(candidate: AnchorCandidate): string {
  return `"${candidate.text}" at ${candidate.t.toFixed(2)}s (${String(Math.round(candidate.similarity * 100))}% similar)`;
}

function notFoundMessage(
  phrase: string,
  nth: number,
  occurrences: number,
  candidates: readonly AnchorCandidate[],
): string {
  const where =
    occurrences === 0
      ? `Anchor "${phrase}" was not found in words.json.`
      : `Anchor "${phrase}" (nth=${String(nth)}) was not found: the phrase occurs only ${String(occurrences)} time${occurrences === 1 ? '' : 's'}.`;
  const closest =
    candidates.length === 0
      ? ' words.json has no words.'
      : ` Closest matches: ${candidates.map(describeCandidate).join(', ')}.`;
  const hint =
    occurrences === 0
      ? ' Use a phrase that is spoken in the script (copy it from words.json).'
      : ` Use nth between 1 and ${String(occurrences)}, or a different phrase.`;
  return `${where}${closest}${hint}`;
}

/** One-off resolution; build an `AnchorIndex` once when resolving many anchors. */
export function resolveAnchor(
  words: readonly AnchorWord[],
  phrase: string,
  nth = 1,
  options: AnchorIndexOptions = {},
): Result<AnchorMatch, AnchorError> {
  return new AnchorIndex(words, options).resolve(phrase, nth);
}
