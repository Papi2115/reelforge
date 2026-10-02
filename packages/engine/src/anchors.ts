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
