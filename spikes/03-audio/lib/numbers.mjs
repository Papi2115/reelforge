// Integer -> cardinal words (EN, PL nominative) so "1969" in a script and "1969"/"tysiąc ..." from
// ASR land on comparable tokens. Range 0..999 999; returns null outside it.

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
];
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
];
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

function enBelowThousand(n) {
  const parts = [];
  if (n >= 100) parts.push(EN_ONES[Math.floor(n / 100)], 'hundred');
  const rest = n % 100;
  if (rest >= 20)
    parts.push(EN_TENS[Math.floor(rest / 10)], ...(rest % 10 ? [EN_ONES[rest % 10]] : []));
  else if (rest > 0) parts.push(EN_ONES[rest]);
  return parts;
}

function plBelowThousand(n) {
  const parts = [];
  if (n >= 100) parts.push(PL_HUNDREDS[Math.floor(n / 100)]);
  const rest = n % 100;
  if (rest >= 20)
    parts.push(PL_TENS[Math.floor(rest / 10)], ...(rest % 10 ? [PL_ONES[rest % 10]] : []));
  else if (rest > 0) parts.push(PL_ONES[rest]);
  return parts;
}

function plThousandWord(count) {
  if (count === 1) return 'tysiąc';
  const lastTwo = count % 100;
  const last = count % 10;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return 'tysiące';
  return 'tysięcy';
}

export function numberToWords(n, lang) {
  if (!Number.isInteger(n) || n < 0 || n > 999_999) return null;
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
