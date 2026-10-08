/**
 * Anchor resolution: phrase -> spoken time range from words.json (PLAN.md §3.3).
 * The engine depends only on the `AnchorResolver` interface; this module ships a stub that
 * matches normalized words exactly. The real fuzzy resolver is PLAN.md#4.5.
 */
import type { TimedWord } from '@reelforge/shared';

/** Global spoken time range (seconds) of a phrase. */
export interface AnchorSpan {
  readonly t: number;
  readonly tEnd: number;
}

/** Returns the `nth` (1-based) occurrence of `phrase`, or undefined when it is not spoken. */
export type AnchorResolver = (phrase: string, nth: number) => AnchorSpan | undefined;

/** Lower-case, strip punctuation (keeps letters/digits of any script), split on whitespace. */
export function normalizeTokens(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

/** Stub resolver: exact match of the normalized token sequence. */
export function createExactAnchorResolver(words: readonly TimedWord[]): AnchorResolver {
  const tokens: { token: string; word: TimedWord }[] = words.flatMap((word) =>
    normalizeTokens(word.text).map((token) => ({ token, word })),
  );
  return (phrase, nth) => {
    const needle = normalizeTokens(phrase);
    if (needle.length === 0 || !Number.isInteger(nth) || nth < 1) return undefined;
    let found = 0;
    for (let start = 0; start + needle.length <= tokens.length; start += 1) {
      const matches = needle.every((token, offset) => tokens[start + offset]?.token === token);
      if (!matches) continue;
      found += 1;
      if (found < nth) continue;
      const first = tokens[start]?.word;
      const last = tokens[start + needle.length - 1]?.word;
      if (first && last) return { t: first.t, tEnd: last.tEnd };
    }
    return undefined;
  };
}

/** Resolver used when the manifest carries no words: every anchor is unresolved. */
export const NO_ANCHORS: AnchorResolver = () => undefined;

/** A shot's spoken range (global seconds) an anchor should land in. */
export interface AnchorWindow {
  readonly t0: number;
  /** Exclusive end. */
  readonly t1: number;
}

/** A word that starts this much before the shot still counts as spoken in it. */
export const ANCHOR_WINDOW_LEAD_S = 0.15;
/** Occurrences enumerated per phrase at most (a phrase is a few words of one script). */
const MAX_OCCURRENCES = 10_000;

const inWindow = (t: number, window: AnchorWindow): boolean =>
  t >= window.t0 - ANCHOR_WINDOW_LEAD_S && t < window.t1;

/**
 * The occurrence a shot means by `nth` (real run Comic 1: "in" resolved to the film's first word,
 * 31.86 s before the shot). The film-wide `nth` occurrence when it lies inside the shot (so a
 * correct scene resolves exactly as before), else the `nth` occurrence counted from the shot's
 * start: inside the shot, or the nearest following one (outside the shot: the sync checks report
 * it). Nothing from the shot on: the film-wide one (also outside, also reported).
 */
export function pickShotOccurrence<T extends { readonly t: number }>(
  occurrences: readonly T[],
  nth: number,
  window: AnchorWindow,
): T | undefined {
  const filmWide = occurrences[nth - 1];
  if (filmWide === undefined || inWindow(filmWide.t, window)) return filmWide;
  const fromShot = occurrences.filter(
    (occurrence) => occurrence.t >= window.t0 - ANCHOR_WINDOW_LEAD_S,
  );
  return fromShot[nth - 1] ?? filmWide;
}

/** Every occurrence of a phrase through a resolver, in time order. */
function allOccurrences(resolve: AnchorResolver, phrase: string): AnchorSpan[] {
  const found: AnchorSpan[] = [];
  for (let nth = 1; nth <= MAX_OCCURRENCES; nth += 1) {
    const span = resolve(phrase, nth);
    if (span === undefined) break;
    found.push(span);
  }
  return found;
}

/**
 * `resolve` restricted to a shot (`pickShotOccurrence`), memoised per phrase and nth: the
 * film-wide lookup first, the full list only when that one lies outside the shot.
 */
export function shotAnchorResolver(resolve: AnchorResolver, window: AnchorWindow): AnchorResolver {
  const cache = new Map<string, AnchorSpan | undefined>();
  return (phrase, nth) => {
    const key = `${phrase}\u0000${String(nth)}`;
    if (cache.has(key)) return cache.get(key);
    const filmWide = resolve(phrase, nth);
    const span =
      filmWide === undefined || inWindow(filmWide.t, window)
        ? filmWide
        : pickShotOccurrence(allOccurrences(resolve, phrase), nth, window);
    cache.set(key, span);
    return span;
  };
}
