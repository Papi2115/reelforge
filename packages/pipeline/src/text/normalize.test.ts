import { describe, expect, it } from 'vitest';
import {
  cleanWord,
  foldDiacritics,
  normalizeText,
  subTokens,
  tokenizeScript,
} from './normalize.js';
import { numberToWords, ordinalToWords, plNumeralLemma } from './numbers.js';

describe('cleanWord', () => {
  it('strips punctuation but keeps decimals and diacritics', () => {
    expect(cleanWord('Doom,')).toBe('doom');
    expect(cleanWord('"Księżyc."')).toBe('księżyc');
    expect(cleanWord('3.5')).toBe('3.5');
    expect(cleanWord('4,000')).toBe('4000');
    expect(cleanWord("It's")).toBe('its');
    expect(cleanWord('It’s')).toBe('its');
    expect(cleanWord('—')).toBe('');
  });
});

describe('foldDiacritics', () => {
  it('handles Polish ł explicitly', () => {
    expect(foldDiacritics('źdźbło łąki')).toBe('zdzblo laki');
    expect(foldDiacritics('café')).toBe('cafe');
  });
});

describe('numbers', () => {
  it('spells cardinals in EN and PL', () => {
    expect(numberToWords(1993, 'en')).toBe('one thousand nine hundred ninety three');
    expect(numberToWords(1969, 'pl')).toBe('tysiąc dziewięćset sześćdziesiąt dziewięć');
    expect(numberToWords(4, 'pl')).toBe('cztery');
    expect(numberToWords(25000, 'pl')).toBe('dwadzieścia pięć tysięcy');
    expect(numberToWords(3000, 'pl')).toBe('trzy tysiące');
    expect(numberToWords(0, 'en')).toBe('zero');
    expect(numberToWords(1_000_000, 'en')).toBeNull();
    expect(numberToWords(1.5, 'en')).toBeNull();
  });

  it('spells EN ordinals', () => {
    expect(ordinalToWords(1)).toBe('first');
    expect(ordinalToWords(21)).toBe('twenty first');
    expect(ordinalToWords(40)).toBe('fortieth');
    expect(ordinalToWords(12)).toBe('twelfth');
    expect(ordinalToWords(100)).toBe('one hundredth');
  });

  it('lemmatises inflected PL numerals', () => {
    expect(plNumeralLemma('jednego')).toBe('jeden');
    expect(plNumeralLemma('piętnastu')).toBe('piętnaście');
    expect(plNumeralLemma('dwunastu')).toBe('dwanaście');
    expect(plNumeralLemma('kot')).toBe('kot');
  });
});

describe('subTokens', () => {
  it('splits hyphens and spells integers', () => {
    expect(subTokens('twenty-six', 'en')).toEqual(['twenty', 'six']);
    expect(subTokens('26', 'en')).toEqual(['twenty', 'six']);
    expect(subTokens('4,000', 'en')).toEqual(['four', 'thousand']);
  });

  it('keeps digits for languages without a speller', () => {
    expect(subTokens('26', 'de')).toEqual(['26']);
  });

  it('unifies units, glued or spelled out', () => {
    expect(subTokens('61KB', 'en')).toEqual(['sixty', 'one', 'kb']);
    expect(normalizeText('61 KB', 'en')).toEqual(['sixty', 'one', 'kb']);
    expect(normalizeText('sixty-one kilobytes', 'en')).toEqual(['sixty', 'one', 'kb']);
    expect(normalizeText('4 kilobajty', 'pl')).toEqual(['cztery', 'kb']);
    expect(normalizeText('jednego megaherca', 'pl')).toEqual(['jeden', 'mhz']);
    expect(normalizeText('50%', 'en')).toEqual(['fifty', 'percent']);
    expect(normalizeText('50 procent', 'pl')).toEqual(['pięćdziesiąt', 'percent']);
  });

  it('spells decimals and EN ordinals', () => {
    expect(subTokens('3.5', 'en')).toEqual(['three', 'point', 'five']);
    expect(subTokens('3,5', 'pl')).toEqual(['trzy', 'przecinek', 'pięć']);
    expect(subTokens('21st', 'en')).toEqual(['twenty', 'first']);
  });
});

describe('tokenizeScript', () => {
  it('drops punctuation-only words and numbers paragraphs', () => {
    expect(tokenizeScript('Hello — world.\r\n\r\nNext 50 %')).toEqual([
      { text: 'Hello', paragraph: 0 },
      { text: 'world.', paragraph: 0 },
      { text: 'Next', paragraph: 1 },
      { text: '50', paragraph: 1 },
      { text: '%', paragraph: 1 },
    ]);
  });
});
