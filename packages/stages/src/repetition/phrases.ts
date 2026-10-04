/**
 * Repeated narration phrases (PLAN.md#12.23, pure): word n-grams (default 3+ words) said again
 * and again in a short stretch ("the old engine" three times in a minute). Quoted passages are
 * deliberate repeats and are skipped, so are n-grams of function words only; a longer repeated
 * phrase is reported once (not as each of its 3-word pieces). Report only: Claude would have to
 * re-record nothing, but the script can be reworded next time.
 */
import type { DirectorWord } from '../sound/cue-events.js';
import { clusters } from './clusters.js';

const STOPWORDS: ReadonlySet<string> = new Set(
  (
    'a an the and or but if so to of in on at by for with from as is are was were be been it its ' +
    'this that these those there here we you they he she i me my our your their not no do does did ' +
    'has have had will would can could just than then into out up about what which who how all ' +
    'i w z na do nie się to że jak co ale a o od po za ze jest był była było są'
  ).split(' '),
);
const QUOTE_OPEN = /^["“„«']/u;
const QUOTE_CLOSE = /["”«»']$/u;

export interface PhraseOccurrence {
  readonly t: number;
  /** Index of the phrase's first word. */
  readonly word: number;
}

export interface RepeatedPhrase {
  readonly phrase: string;
  readonly words: number;
  readonly occurrences: readonly PhraseOccurrence[];
}

export interface PhraseRules {
  readonly phraseWords: number;
  readonly phraseCount: number;
  readonly phraseWindowS: number;
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

/** Words inside a quotation ("…", “…”, „…”) — said on purpose, never a repeat. */
function quotedWords(words: readonly DirectorWord[]): boolean[] {
  let open = false;
  return words.map((word) => {
    const opens = QUOTE_OPEN.test(word.text);
    const closes = QUOTE_CLOSE.test(word.text) && (open || opens);
    const quoted = open || opens;
    open = (open || opens) && !closes;
    return quoted;
  });
}

export function findRepeatedPhrases(
  words: readonly DirectorWord[],
  rules: PhraseRules,
): RepeatedPhrase[] {
  const size = rules.phraseWords;
  const tokens = words.map((word) => normalize(word.text));
  const quoted = quotedWords(words);
  const byPhrase = new Map<string, PhraseOccurrence[]>();
  for (let index = 0; index + size <= tokens.length; index++) {
    const gram = tokens.slice(index, index + size);
    if (gram.some((token) => token === '')) continue;
    if (quoted.slice(index, index + size).some(Boolean)) continue;
    if (gram.every((token) => STOPWORDS.has(token) || token.length < 3)) continue;
    const key = gram.join(' ');
    const list = byPhrase.get(key) ?? [];
    const last = list.at(-1);
    // Overlapping occurrences ("very very very very") count once.
    if (last === undefined || index >= last.word + size) {
      list.push({ t: words[index]?.t ?? 0, word: index });
    }
    byPhrase.set(key, list);
  }
  const found = [...byPhrase.entries()].flatMap(([phrase, occurrences]) =>
    clusters(occurrences, rules.phraseCount, rules.phraseWindowS).map((cluster) => ({
      phrase,
      words: size,
      occurrences: cluster,
    })),
  );
  // A longer repeated phrase shows up as several overlapping n-grams: keep the first of them.
  found.sort((a, b) => (a.occurrences[0]?.word ?? 0) - (b.occurrences[0]?.word ?? 0));
  const kept: RepeatedPhrase[] = [];
  for (const candidate of found) {
    const covered = kept.some(
      (other) =>
        other.occurrences.length === candidate.occurrences.length &&
        candidate.occurrences.every((occurrence, index) => {
          const twin = other.occurrences[index];
          return twin !== undefined && Math.abs(occurrence.word - twin.word) < size;
        }),
    );
    if (!covered) kept.push(candidate);
  }
  return kept;
}
