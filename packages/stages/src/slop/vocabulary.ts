/**
 * The words and numbers a film may show (docs/worlds/QUALITY.md §1.4, §8 "text provenance"):
 * everything the narration says, the research notes and the asset titles, as lower-case words with
 * simple stems and as numbers (digits and English number words: "ten" = 10, "fourth" = 4,
 * "365 and a quarter" = 365.25). Polish number words are not parsed (digits are).
 */

/** Words that carry no claim: never "invented" (EN + PL function words, fillers). */
const FUNCTION_WORDS = new Set(
  (
    'a an the and or but nor of to in on at by for with from as is are was were be been being it its ' +
    'this that these those not no so too very just only then than there here what which who whom how ' +
    'why when where all any each every more most less least few many much some other another same ' +
    'such bit lot little yet again still also even about over under up down out into onto off per ' +
    'via i you he she we they me him her us them my your his our their do does did done has have ' +
    'had will would can could may might must shall should if else new old now like get got ' +
    'w z na do od po za o ale nie tak jest są że się co jak czy dla przez przy pod nad ten ta te ' +
    'tym tego już jeszcze tylko bardzo też'
  ).split(' '),
);

const UNITS: Readonly<Record<string, number>> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9,
  tenth: 10, eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15,
  sixteenth: 16, seventeenth: 17, eighteenth: 18, nineteenth: 19, twentieth: 20, thirtieth: 30,
  fortieth: 40, fiftieth: 50, sixtieth: 60, seventieth: 70, eightieth: 80, ninetieth: 90,
}; // prettier-ignore
const SCALES: Readonly<Record<string, number>> = {
  hundred: 100, hundredth: 100, thousand: 1000, thousandth: 1000, million: 1e6, billion: 1e9,
  trillion: 1e12,
}; // prettier-ignore
const FRACTIONS: Readonly<Record<string, number>> = { half: 0.5, quarter: 0.25, third: 1 / 3 };
const FRACTION_GLYPHS: Readonly<Record<string, string>> = {
  '¼': ' quarter ',
  '½': ' half ',
  '¾': ' three quarters ',
  '⅓': ' third ',
};

/** Letters/digits runs: numbers (with separators, decimals, ordinal or plural suffix) and words. */
const TOKEN = /\d[\d,]*(?:\.\d+)?(?:st|nd|rd|th|s)?|\.\d+|\p{L}[\p{L}'’]*/giu;

export interface Token {
  readonly text: string;
  /** The value of a numeric token (absolute: signs are not judged). */
  readonly number?: number | undefined;
  /** Decimal places shown (numbers). */
  readonly decimals?: number | undefined;
  /** "1500s": the decade/century range it names. */
  readonly range?: readonly [number, number] | undefined;
  /** How a word is written: `upper` "CORE", `capital` "Core", `lower` "core". */
  readonly shape?: 'upper' | 'capital' | 'lower' | undefined;
}

function numericToken(text: string): Token {
  const plural = /^(\d+0)s$/.exec(text);
  if (plural?.[1] !== undefined) {
    const start = Number(plural[1]);
    const zeros = /0+$/.exec(plural[1])?.[0].length ?? 1;
    return { text, number: start, decimals: 0, range: [start, start + 10 ** zeros] };
  }
  const digits = text.replace(/(st|nd|rd|th|s)$/, '').replace(/,/g, '');
  const value = Number(digits.startsWith('.') ? `0${digits}` : digits);
  const decimals = digits.includes('.') ? (digits.split('.')[1]?.length ?? 0) : 0;
  return { text, number: value, decimals };
}

export function tokenize(text: string): Token[] {
  let prepared = text;
  for (const [glyph, words] of Object.entries(FRACTION_GLYPHS)) {
    prepared = prepared.split(glyph).join(words);
  }
  return [...prepared.matchAll(TOKEN)].map(([raw]) => {
    const lower = raw.toLowerCase();
    if (/^[\d.]/.test(raw)) return numericToken(lower);
    const shape = raw === lower ? 'lower' : raw === raw.toUpperCase() ? 'upper' : 'capital';
    return { text: lower.replace(/['’]s$/, '').replace(/['’]/g, ''), shape };
  });
}

/** A crude stem: plural/verb endings off, so "years" = "year", "drifted" = "drift". */
export function stem(word: string): string {
  const rules: readonly (readonly [RegExp, string])[] = [
    [/ies$/, 'y'],
    [/(ss|sh|ch|x)es$/, '$1'],
    [/([^s])s$/, '$1'],
    [/ing$/, ''],
    [/ed$/, ''],
    [/ly$/, ''],
  ];
  for (const [pattern, replacement] of rules) {
    const next = word.replace(pattern, replacement);
    if (next !== word && next.length >= 3) return next;
  }
  return word;
}

/** Number words of a token run: "sixteen centuries" -> 16, "365 and a quarter" -> 365.25. */
export function spelledNumbers(tokens: readonly Token[]): number[] {
  const found: number[] = [];
  let [total, current, active] = [0, 0, false];
  const flush = (): void => {
    if (active) found.push(total + current);
    [total, current, active] = [0, 0, false];
  };
  for (let index = 0; index < tokens.length; index += 1) {
    const { text: word, number } = tokens[index] ?? { text: '' };
    const [next, after] = [tokens[index + 1]?.text ?? '', tokens[index + 2]?.text ?? ''];
    const [unit, scale, fraction] = [UNITS[word], SCALES[word], FRACTIONS[word]];
    if (number !== undefined) {
      flush();
      [current, active] = [number, true];
    } else if (unit !== undefined) {
      [current, active] = [current + unit, true];
    } else if (scale !== undefined && active) {
      if (scale === 100) current *= 100;
      else [total, current] = [total + current * scale, 0];
    } else if (active && word === 'and' && UNITS[next] !== undefined) {
      // "three hundred and five": the number goes on.
    } else if (active && word === 'and' && next === 'a' && FRACTIONS[after] !== undefined) {
      current += FRACTIONS[after] ?? 0;
      index += 2;
    } else {
      flush();
      if (fraction !== undefined) found.push(fraction);
    }
  }
  flush();
  return found;
}

export interface Vocabulary {
  readonly words: ReadonlySet<string>;
  readonly stems: ReadonlySet<string>;
  readonly numbers: readonly number[];
}

export function buildVocabulary(texts: readonly string[]): Vocabulary {
  const words = new Set<string>();
  const numbers = new Set<number>();
  for (const text of texts) {
    const tokens = tokenize(text);
    for (const token of tokens) {
      if (token.number === undefined) words.add(token.text);
      else numbers.add(token.number);
    }
    for (const value of spelledNumbers(tokens)) numbers.add(value);
  }
  return { words, stems: new Set([...words].map(stem)), numbers: [...numbers] };
}

export function isFunctionWord(word: string): boolean {
  return FUNCTION_WORDS.has(word);
}

/** A word the vocabulary has: as it is, by stem, or as an abbreviation ("feb" of "february"). */
export function knownWord(vocabulary: Vocabulary, word: string): boolean {
  if (vocabulary.words.has(word) || vocabulary.stems.has(stem(word))) return true;
  if (word.length < 3) return false;
  for (const known of vocabulary.words)
    if (known.length > word.length && known.startsWith(word)) {
      return true;
    }
  return false;
}
