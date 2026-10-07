/**
 * Text provenance (docs/worlds/QUALITY.md §1.4, §8): every on-screen string of a shot must come from
 * the narration, the research notes, the asset titles or the world's labels. Numbers need a source
 * too: a number is sourced when the vocabulary has it, when it names the decade/century of a
 * sourced number ("1500s"), or when it is the visible result of a calculation with sourced
 * on-screen numbers ("365.2422 − 365 = 0.2422", "0.2422 × 4 = 0.9688"), at the precision shown.
 * 0 and 1 never need one; in a world with `shortYears` (Game B1) "82" is sourced by 1982. A number
 * that counts a thing the sources count with other numbers only is changed ("TWO DEGREES" when the
 * narration says "four degrees"), even when the value is elsewhere in the sources. A timeline that
 * ends in "now" needs the sources to reach the modern era (a "now" at the end of a 1518 strip is
 * invented); a correction word (Game B1 manual `strike`/`write`) is a label like a timeline end.
 * Sound-shaped words ("BRRRING", "ZZZ", "RRIP", sound-words.ts) are never invented; an onomatopoeia
 * (role `sound`) may also use the world's sound words ("CLANG"); any other word still needs a source.
 */
import { inSoundList, isSoundShaped } from './sound-words.js';
import type { OnScreenText } from './source-text.js';
import {
  countedUnit,
  isFunctionWord,
  knownWord,
  numberRuns,
  spelledNumbers,
  tokenize,
  type NumberRun,
  type Token,
  type Vocabulary,
} from './vocabulary.js';
import { GENERAL_LABELS, type WorldSlopSpec } from './world-labels.js';

export interface InventedText {
  readonly text: string;
  readonly line: number;
  /** Unknown words and unsourced numbers of the string. */
  readonly unknown: readonly string[];
}

/** Numbers never judged (a count of one is not a claim). */
const TRIVIAL_NUMBERS = new Set([0, 1]);
/** Words that put the end of a timeline in the present. */
const PRESENT_WORDS = new Set(['now', 'today', 'present', 'nowadays']);
/** Years from which the sources reach the present (a timeline may then end in "now"). */
const MODERN_YEARS = { from: 1900, to: 2100 } as const;
/** Derivation passes over the shot's own numbers (chains like 365.25 − 365.2422 = 0.0078). */
const DERIVATION_PASSES = 3;

function shownAs(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function matches(candidate: number, token: Token): boolean {
  const shown = token.number ?? Number.NaN;
  return Math.abs(shownAs(candidate, token.decimals ?? 0) - shown) < 1e-9;
}

/**
 * A sum or difference of a sourced on-screen number and a known number, or a product or quotient
 * of two sourced on-screen numbers (a visible calculation; products with any known number would
 * source almost anything: 29 × 3 = 87).
 */
function derived(token: Token, onScreen: readonly number[], known: readonly number[]): boolean {
  for (const first of onScreen) {
    for (const second of known) {
      if ([first + second, first - second, second - first].some((sum) => matches(sum, token))) {
        return true;
      }
    }
    for (const second of onScreen) {
      const results = [first * second];
      if (second !== 0) results.push(first / second);
      if (results.some((result) => matches(result, token))) return true;
    }
  }
  return false;
}

/** "82" of a sourced 1982 (a world with `shortYears`: a tag, a level-select label). */
function shortYear(token: Token, vocabulary: Vocabulary): boolean {
  if (!/^\d{2}$/.test(token.text)) return false;
  const value = token.number ?? Number.NaN;
  return vocabulary.numbers.some(
    (known) =>
      Number.isInteger(known) &&
      known >= MODERN_YEARS.from - 100 &&
      known <= MODERN_YEARS.to &&
      known % 100 === value,
  );
}

/** The numeric tokens of every string that the vocabulary or the shot's own numbers source. */
function sourcedNumbers(
  numbers: readonly Token[],
  vocabulary: Vocabulary,
  changed: ReadonlySet<Token>,
  shortYears = false,
): Set<Token> {
  const sourced = new Set<Token>();
  const direct = (token: Token): boolean => {
    const value = token.number ?? Number.NaN;
    if (changed.has(token)) return false;
    if (TRIVIAL_NUMBERS.has(value)) return true;
    if (shortYears && shortYear(token, vocabulary)) return true;
    if (token.range !== undefined) {
      const [start, end] = token.range;
      return vocabulary.numbers.some((known) => known >= start && known < end);
    }
    return vocabulary.numbers.some((known) => matches(known, token));
  };
  for (const token of numbers) if (direct(token)) sourced.add(token);
  for (let pass = 0; pass < DERIVATION_PASSES; pass += 1) {
    const onScreen = [...sourced].map((token) => token.number ?? 0);
    const known = [...vocabulary.numbers, ...onScreen];
    let added = false;
    for (const token of numbers) {
      if (sourced.has(token) || !derived(token, onScreen, known)) continue;
      sourced.add(token);
      added = true;
    }
    if (!added) break;
  }
  return sourced;
}

function withoutLabelPatterns(text: string, spec: WorldSlopSpec | undefined): string {
  return (spec?.labelPatterns ?? []).reduce((rest, pattern) => rest.replace(pattern, ' '), text);
}

function isLabel(word: string, spec: WorldSlopSpec | undefined): boolean {
  return GENERAL_LABELS.has(word) || (spec?.labels.includes(word) ?? false);
}

/** Equal at the precision of the run: a digit token as shown, a number word exactly. */
function sameValue(known: number, run: NumberRun, tokens: readonly Token[]): boolean {
  const token = tokens[run.start];
  if (run.end - run.start === 1 && token?.number !== undefined) return matches(known, token);
  return Math.abs(known - run.value) < 1e-9;
}

/**
 * Tokens of numbers that count a thing the sources count with other numbers only ("TWO DEGREES"
 * when the narration says "four degrees"): a changed number, even when the value itself is
 * somewhere in the sources.
 */
function changedNumbers(tokens: readonly Token[], vocabulary: Vocabulary): Set<Token> {
  const changed = new Set<Token>();
  for (const run of numberRuns(tokens)) {
    const first = tokens[run.start];
    if (TRIVIAL_NUMBERS.has(run.value) || first?.range !== undefined) continue;
    const unit = countedUnit(tokens, run.end);
    const known = unit === undefined ? undefined : vocabulary.quantities.get(unit);
    if (known === undefined || known.some((value) => sameValue(value, run, tokens))) continue;
    for (const token of tokens.slice(run.start, run.end)) changed.add(token);
  }
  return changed;
}

/**
 * Whether a string's unknown words make it invented: a name or label the sources do not have (a
 * capitalised word that does not start the string, any all-caps word of 2+ letters), or mostly
 * unknown words (at least two and half of its content words). A single paraphrased word
 * ("slipped" for "drifted") is not.
 */
function invented(tokens: readonly Token[], words: readonly Token[], unknown: readonly Token[]) {
  const label = unknown.some(
    (token) => token.shape === 'upper' || (token.shape === 'capital' && token !== tokens[0]),
  );
  return label || (unknown.length >= 2 && unknown.length * 2 >= words.length);
}

/** Present-time words of a timeline's end when no source year is modern. */
function staleTimelineEnd(
  entry: OnScreenText,
  tokens: readonly Token[],
  vocabulary: Vocabulary,
): Token[] {
  if (entry.role !== 'timeline-end') return [];
  const modern = vocabulary.numbers.some(
    (known) => known >= MODERN_YEARS.from && known <= MODERN_YEARS.to,
  );
  return modern ? [] : tokens.filter((token) => PRESENT_WORDS.has(token.text));
}

/** On-screen strings with unknown names, mostly unknown words or unsourced numbers. */
export function inventedTexts(
  texts: readonly OnScreenText[],
  vocabulary: Vocabulary,
  spec: WorldSlopSpec | undefined,
): InventedText[] {
  const tokenized = texts.map((entry) => tokenize(withoutLabelPatterns(entry.text, spec)));
  const numbers = tokenized.flatMap((tokens) =>
    tokens.filter((token) => token.number !== undefined),
  );
  const changed = new Set(tokenized.flatMap((tokens) => [...changedNumbers(tokens, vocabulary)]));
  const sourced = sourcedNumbers(numbers, vocabulary, changed, spec?.shortYears === true);
  return texts.flatMap((entry, index) => {
    const tokens = tokenized[index] ?? [];
    const words = tokens.filter(
      (token) =>
        token.number === undefined &&
        token.text.length >= 2 &&
        !isFunctionWord(token.text) &&
        !isLabel(token.text, spec),
    );
    const unknownWords = words.filter((token) => {
      if (knownWord(vocabulary, token.text)) return false;
      if (isSoundShaped(token.text)) return false;
      if (entry.role === 'sound' && inSoundList(token.text, spec?.soundWords)) return false;
      // A number word on screen ("ten") is fine when the sources have its value.
      const [value] = spelledNumbers([token]);
      return value === undefined || !vocabulary.numbers.includes(value);
    });
    const unsourced = tokens.filter(
      (token) =>
        (token.number !== undefined && !sourced.has(token)) ||
        (token.number === undefined && changed.has(token)),
    );
    const stale = staleTimelineEnd(entry, tokens, vocabulary);
    // A timeline's end word and a correction are labels: any unknown word makes them invented.
    const label =
      (entry.role === 'timeline-end' || entry.role === 'correction') && unknownWords.length > 0;
    const clean = unsourced.length === 0 && stale.length === 0 && !label;
    if (clean && !invented(tokens, words, unknownWords)) return [];
    const unknown = [...unknownWords, ...unsourced, ...stale].map((token) =>
      changed.has(token) ? `${token.text} (changed number)` : token.text,
    );
    return [{ text: entry.text, line: entry.line, unknown }];
  });
}
