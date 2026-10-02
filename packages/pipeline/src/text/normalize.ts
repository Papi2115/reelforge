/**
 * Word normalisation shared by alignment (PLAN 4.4) and anchor resolution (4.5): punctuation and
 * case stripping, Polish diacritic folding, numbers spelled out (EN/PL cardinals, EN ordinals,
 * decimals), unit abbreviations unified ("61KB" ~ "61 kilobytes" ~ "61 kilobajtów").
 */
import { numberToWords, ordinalToWords, plNumeralLemma, type SpelledLanguage } from './numbers.js';

const PL_FOLD: Readonly<Record<string, string>> = {
  ą: 'a',
  ć: 'c',
  ę: 'e',
  ł: 'l',
  ń: 'n',
  ó: 'o',
  ś: 's',
  ź: 'z',
  ż: 'z',
};

/** Lowercase, unify apostrophes, strip punctuation; keeps letters (incl. diacritics) and digits. */
export function cleanWord(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^\p{L}\p{N}'.,-]/gu, '')
    .replace(/'/g, '')
    .replace(/[.,](?!\d)|(?<!\d)[.,]/g, '')
    .replace(/(?<=\d)[,.](?=\d{3}(?!\d))/g, '')
    .replace(/^-+|-+$/g, '');
}

/** Diacritics-insensitive form (Polish ł is not decomposed by NFD, so it is folded explicitly). */
export function foldDiacritics(word: string): string {
  return word
    .replace(/[ąćęłńóśźż]/g, (ch) => PL_FOLD[ch] ?? ch)
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/** Tokens used for WER: cleaned words, hyphenated compounds split, digits kept as-is. */
export function werTokens(text: string): string[] {
  return text
    .split(/\s+/)
    .flatMap((raw) => cleanWord(raw).split('-'))
    .filter((token) => token.length > 0);
}

/** Unit spellings (matched on the folded form) -> one canonical token. */
const UNITS: readonly { readonly canonical: string; readonly forms: RegExp }[] = [
  { canonical: 'kb', forms: /^(kb|kib|kilobytes?|kilobajt(y|ow|a|ach|ami|em)?)$/ },
  { canonical: 'mb', forms: /^(mb|mib|megabytes?|megabajt(y|ow|a|ach|ami|em)?)$/ },
  { canonical: 'gb', forms: /^(gb|gib|gigabytes?|gigabajt(y|ow|a|ach|ami|em)?)$/ },
  { canonical: 'tb', forms: /^(tb|tib|terabytes?|terabajt(y|ow|a|ach|ami|em)?)$/ },
  { canonical: 'hz', forms: /^(hz|hertz|herc(a|e|ow|ach|ami|em)?)$/ },
  { canonical: 'khz', forms: /^(khz|kilohertz|kiloherc(a|e|ow|ach|ami|em)?)$/ },
  { canonical: 'mhz', forms: /^(mhz|megahertz|megaherc(a|e|ow|ach|ami|em)?)$/ },
  { canonical: 'ghz', forms: /^(ghz|gigahertz|gigaherc(a|e|ow|ach|ami|em)?)$/ },
  { canonical: 'km', forms: /^(km|kilomet(er|re)s?|kilometr(y|ow|a|ach|ami|em|ze)?)$/ },
  { canonical: 'kg', forms: /^(kg|kilograms?|kilogram(y|ow|a|ach|ami|em|ie)?)$/ },
  { canonical: 'cm', forms: /^(cm|centimet(er|re)s?|centymetr(y|ow|a|ach|ami|em|ze)?)$/ },
  { canonical: 'mm', forms: /^(mm|millimet(er|re)s?|milimetr(y|ow|a|ach|ami|em|ze)?)$/ },
  { canonical: 'percent', forms: /^(percent|procent(y|ow|a|ach|ami|em|u)?)$/ },
];

function canonicalUnit(token: string): string | null {
  const folded = foldDiacritics(token);
  return UNITS.find((unit) => unit.forms.test(folded))?.canonical ?? null;
}

function spellLanguage(lang: string): SpelledLanguage | null {
  return lang === 'en' || lang === 'pl' ? lang : null;
}

function spellInteger(digits: string, lang: string): string[] {
  const spelledLang = spellLanguage(lang);
  const spelled = spelledLang === null ? null : numberToWords(Number(digits), spelledLang);
  return spelled === null ? [digits] : spelled.split(' ');
}

/** "3.5" -> EN "three point five" (digit by digit), PL "trzy przecinek pięć" (as a number). */
function spellDecimal(whole: string, fraction: string, lang: string): string[] {
  const head = spellInteger(whole, lang);
  if (lang === 'pl') return [...head, 'przecinek', ...spellInteger(fraction, lang)];
  if (lang === 'en')
    return [
      ...head,
      'point',
      ...Array.from(fraction.matchAll(/\d/g), (digit) => spellInteger(digit[0], lang)).flat(),
    ];
  return [`${whole}.${fraction}`];
}

function spellNumber(value: string, lang: string): string[] {
  const decimal = /^(\d+)[.,](\d+)$/.exec(value);
  if (decimal?.[1] !== undefined && decimal[2] !== undefined) {
    return spellDecimal(decimal[1], decimal[2], lang);
  }
  return spellInteger(value, lang);
}

/** One hyphen-free, cleaned part -> normalised tokens. */
function expandPart(part: string, lang: string): string[] {
  if (/^\d+(?:[.,]\d+)?$/.test(part)) return spellNumber(part, lang);
  const ordinal = /^(\d+)(st|nd|rd|th)$/.exec(part);
  if (ordinal?.[1] !== undefined && lang === 'en') {
    const words = ordinalToWords(Number(ordinal[1]));
    if (words !== null) return words.split(' ');
  }
  const glued = /^(\d+(?:[.,]\d+)?)(\p{L}+)$/u.exec(part);
  if (glued?.[1] !== undefined && glued[2] !== undefined) {
    const unit = canonicalUnit(glued[2]);
    if (unit !== null) return [...spellNumber(glued[1], lang), unit];
  }
  const unit = canonicalUnit(part);
  if (unit !== null) return [unit];
  return [lang === 'pl' ? plNumeralLemma(part) : part];
}

/**
 * Normalised sub-tokens of one surface word: punctuation stripped, hyphens split, numbers spelled
 * out in `lang` (en/pl; other languages keep digits), units canonical, PL numerals lemmatised.
 */
export function subTokens(raw: string, lang: string): string[] {
  return raw
    .replace(/%/g, ' percent ')
    .split(/\s+/)
    .flatMap((word) => cleanWord(word).split('-'))
    .filter((part) => part.length > 0)
    .flatMap((part) => expandPart(part, lang));
}

/** Normalised tokens of a phrase or text (all words concatenated). */
export function normalizeText(text: string, lang: string): string[] {
  return text.split(/\s+/).flatMap((word) => subTokens(word, lang));
}

export interface ScriptWord {
  readonly text: string;
  readonly paragraph: number;
}

/** Script text -> surface words with their paragraph index (paragraphs = blank-line separated). */
export function tokenizeScript(text: string): ScriptWord[] {
  const words: ScriptWord[] = [];
  text
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .forEach((paragraph, paragraphIndex) => {
      for (const raw of paragraph.split(/\s+/)) {
        if (subTokens(raw, 'en').length > 0) words.push({ text: raw, paragraph: paragraphIndex });
      }
    });
  return words;
}
