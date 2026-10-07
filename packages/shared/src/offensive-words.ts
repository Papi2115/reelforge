/**
 * Offensive-word check (real run Comic 1): finds the words of `offensive-terms.ts` in any text that
 * reaches the screen or the narration. Deterministic and whole-word: a listed term matches a whole
 * word (case and diacritics ignored), also with held letters ("CHIIINK"), leetspeak ("sh1t",
 * "n1gg3r", "$hit"), masked letters ("f*ck") and spaced letters ("C H I N K", "c.h.i.n.k"). Words
 * that merely contain a term ("chinking", "Chinkapin", "Scunthorpe") are not offensive.
 */
import { PROFANITY_TERMS, SLUR_TERMS } from './offensive-terms.js';

export interface OffensiveWord {
  /** The word as written in the text. */
  readonly word: string;
  /** The listed term it matched. */
  readonly term: string;
  /** Index of the word in the text. */
  readonly index: number;
}

const TERMS: readonly string[] = [...new Set([...SLUR_TERMS, ...PROFANITY_TERMS])];
/** Each letter of a term may be held ("chiiink"), never dropped. */
const HELD: readonly { term: string; regex: RegExp }[] = TERMS.map((term) => ({
  term,
  regex: new RegExp(
    `^${Array.from(term)
      .map((letter) => `${letter}+`)
      .join('')}$`,
    'u',
  ),
}));
/** Characters that stand in for letters. */
const LEET: Readonly<Record<string, string>> = {
  '0': 'o',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  $: 's',
};
/** `1` reads as `i` or as `l`. */
const ONE_AS = ['i', 'l'] as const;
/** A word: letters, digits and the stand-ins (`*` masks a letter). */
const WORD = /[\p{L}\p{N}@$*]+/gu;
/** Single characters separated by spaces, dots, dashes or underscores: "c h i n k". */
const SPACED =
  /(?<![\p{L}\p{N}@$*])[\p{L}\p{N}@$*](?:[\s._-]+[\p{L}\p{N}@$*](?![\p{L}\p{N}@$*])){2,}/gu;
/** Masked words need this many real letters ("f*ck"; "**" alone is not a word). */
const MIN_MASKED_LETTERS = 2;

function fold(text: string): string {
  return text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
}

/** The readings of a word: leetspeak resolved, `1` as `i` and as `l`. */
function readings(word: string): string[] {
  const forms = ONE_AS.map((one) =>
    Array.from(fold(word))
      .map((char) => (char === '1' ? one : (LEET[char] ?? char)))
      .join(''),
  );
  return [...new Set(forms)];
}

function maskedMatch(form: string): string | undefined {
  const letters = Array.from(form).filter((char) => char !== '*').length;
  if (letters < MIN_MASKED_LETTERS) return undefined;
  return TERMS.find(
    (term) =>
      term.length === form.length &&
      Array.from(form).every((char, index) => char === '*' || char === term[index]),
  );
}

/** The term a whole word reads as; undefined when it is not offensive. */
export function offensiveTerm(word: string): string | undefined {
  if (!/\p{L}/u.test(word)) return undefined;
  for (const form of readings(word.replace(/^\*+|\*+$/g, ''))) {
    if (form.includes('*')) {
      const masked = maskedMatch(form);
      if (masked !== undefined) return masked;
      continue;
    }
    const held = HELD.find((entry) => entry.regex.test(form));
    if (held !== undefined) return held.term;
  }
  return undefined;
}

/** Spaced-out letters ("C H I N K"): every run of three or more that reads as a term. */
function spacedWords(text: string): OffensiveWord[] {
  const found: OffensiveWord[] = [];
  for (const match of text.matchAll(SPACED)) {
    const letters = match[0].replace(/[\s._-]+/g, '');
    for (let start = 0; start < letters.length; start += 1) {
      for (let end = letters.length; end >= start + 3; end -= 1) {
        const term = offensiveTerm(letters.slice(start, end));
        if (term !== undefined) found.push({ word: match[0], term, index: match.index });
      }
    }
  }
  return found;
}

/** Every offensive word of a text, in order (one entry per word). */
export function findOffensiveWords(text: string): OffensiveWord[] {
  const found: OffensiveWord[] = [];
  for (const match of text.matchAll(WORD)) {
    const term = offensiveTerm(match[0]);
    if (term !== undefined) found.push({ word: match[0], term, index: match.index });
  }
  const seen = new Set(found.map((entry) => entry.index));
  for (const entry of spacedWords(text)) {
    if (!seen.has(entry.index)) {
      seen.add(entry.index);
      found.push(entry);
    }
  }
  return found.sort((first, second) => first.index - second.index);
}

/** The fix line every check reports (scenes, script, storyboard). */
export function offensiveWordMessage(word: string): string {
  return `offensive or slur-like word "${word}" — use another word (e.g. CLINK, CLANG, TINK)`;
}
