/**
 * Integer -> cardinal words (EN, PL nominative) and EN ordinals, so "1969" in a script and
 * "tysiąc dziewięćset ..." / "1969" from ASR land on comparable tokens. Range 0..999 999.
 */

export type SpelledLanguage = 'en' | 'pl';

const EN_ONES = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
] as const;
const EN_TENS = [
  '',
  '',
  'twenty',
  'thirty',
  'forty',
  'fifty',
  'sixty',
  'seventy',
  'eighty',
  'ninety',
];

const PL_ONES = [
  'zero',
  'jeden',
  'dwa',
  'trzy',
  'cztery',
  'pięć',
  'sześć',
  'siedem',
  'osiem',
  'dziewięć',
  'dziesięć',
  'jedenaście',
  'dwanaście',
  'trzynaście',
  'czternaście',
  'piętnaście',
  'szesnaście',
  'siedemnaście',
  'osiemnaście',
  'dziewiętnaście',
] as const;
const PL_TENS = [
  '',
  '',
  'dwadzieścia',
  'trzydzieści',
  'czterdzieści',
  'pięćdziesiąt',
  'sześćdziesiąt',
  'siedemdziesiąt',
  'osiemdziesiąt',
  'dziewięćdziesiąt',
];
const PL_HUNDREDS = [
  '',
  'sto',
  'dwieście',
  'trzysta',
  'czterysta',
  'pięćset',
  'sześćset',
  'siedemset',
  'osiemset',
  'dziewięćset',
];

const MAX_SPELLED = 999_999;

function at(list: readonly string[], index: number): string {
  return list[index] ?? '';
}

function belowThousand(
  n: number,
  ones: readonly string[],
  tens: readonly string[],
  hundreds: (h: number) => string[],
): string[] {
  const parts: string[] = n >= 100 ? hundreds(Math.floor(n / 100)) : [];
  const rest = n % 100;
  if (rest >= 20) {
    parts.push(at(tens, Math.floor(rest / 10)));
    if (rest % 10 !== 0) parts.push(at(ones, rest % 10));
  } else if (rest > 0) {
    parts.push(at(ones, rest));
  }
  return parts;
}

const enBelowThousand = (n: number): string[] =>
  belowThousand(n, EN_ONES, EN_TENS, (h) => [at(EN_ONES, h), 'hundred']);
const plBelowThousand = (n: number): string[] =>
  belowThousand(n, PL_ONES, PL_TENS, (h) => [at(PL_HUNDREDS, h)]);

function plThousandWord(count: number): string {
  if (count === 1) return 'tysiąc';
  const lastTwo = count % 100;
  const last = count % 10;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return 'tysiące';
  return 'tysięcy';
}

/** Cardinal words separated by single spaces, or null outside 0..999 999 / non-integers. */
export function numberToWords(n: number, lang: SpelledLanguage): string | null {
  if (!Number.isInteger(n) || n < 0 || n > MAX_SPELLED) return null;
  if (n === 0) return lang === 'pl' ? PL_ONES[0] : EN_ONES[0];
  const thousands = Math.floor(n / 1000);
  const rest = n % 1000;
  if (lang === 'pl') {
    const head =
      thousands === 0
        ? []
        : thousands === 1
          ? ['tysiąc']
          : [...plBelowThousand(thousands), plThousandWord(thousands)];
    return [...head, ...plBelowThousand(rest)].join(' ');
  }
  const head = thousands === 0 ? [] : [...enBelowThousand(thousands), 'thousand'];
  return [...head, ...enBelowThousand(rest)].join(' ');
}

const EN_ORDINAL_IRREGULAR: Readonly<Record<string, string>> = {
  one: 'first',
  two: 'second',
  three: 'third',
  five: 'fifth',
  eight: 'eighth',
  nine: 'ninth',
  twelve: 'twelfth',
};

function enOrdinalWord(cardinal: string): string {
  const irregular = EN_ORDINAL_IRREGULAR[cardinal];
  if (irregular !== undefined) return irregular;
  if (cardinal.endsWith('y')) return `${cardinal.slice(0, -1)}ieth`;
  return `${cardinal}th`;
}

/** EN ordinal words ("21" -> "twenty first"); null when the number cannot be spelled. */
export function ordinalToWords(n: number): string | null {
  const cardinal = numberToWords(n, 'en');
  if (cardinal === null) return null;
  const parts = cardinal.split(' ');
  const last = parts.pop() ?? '';
  return [...parts, enOrdinalWord(last)].join(' ');
}

/**
 * Inflected Polish numerals (genitive/instrumental/feminine...) -> nominative, so "jednego
 * megaherca" matches "1 MHz" spelled as "jeden".
 */
const PL_NUMERAL_LEMMAS: Readonly<Record<string, string>> = {
  jednego: 'jeden',
  jednej: 'jeden',
  jedną: 'jeden',
  jednym: 'jeden',
  jednemu: 'jeden',
  jedna: 'jeden',
  jedno: 'jeden',
  dwóch: 'dwa',
  dwu: 'dwa',
  dwoma: 'dwa',
  dwiema: 'dwa',
  dwie: 'dwa',
  trzech: 'trzy',
  trzema: 'trzy',
  czterech: 'cztery',
  czterema: 'cztery',
  pięciu: 'pięć',
  sześciu: 'sześć',
  siedmiu: 'siedem',
  ośmiu: 'osiem',
  dziewięciu: 'dziewięć',
  dziesięciu: 'dziesięć',
  dwudziestu: 'dwadzieścia',
  trzydziestu: 'trzydzieści',
  czterdziestu: 'czterdzieści',
  pięćdziesięciu: 'pięćdziesiąt',
  sześćdziesięciu: 'sześćdziesiąt',
  siedemdziesięciu: 'siedemdziesiąt',
  osiemdziesięciu: 'osiemdziesiąt',
  dziewięćdziesięciu: 'dziewięćdziesiąt',
  dwunastu: 'dwanaście',
  stu: 'sto',
  dwustu: 'dwieście',
  trzystu: 'trzysta',
  czterystu: 'czterysta',
  pięciuset: 'pięćset',
  tysiąca: 'tysiąc',
  tysiącu: 'tysiąc',
  tysiącem: 'tysiąc',
  tysiącach: 'tysiące',
};

/** "-nastu" forms (jedenastu, piętnastu, ...) -> "-naście". */
export function plNumeralLemma(word: string): string {
  const known = PL_NUMERAL_LEMMAS[word];
  if (known !== undefined) return known;
  if (word.endsWith('nastu') && word.length > 6) return `${word.slice(0, -3)}ście`;
  return word;
}
