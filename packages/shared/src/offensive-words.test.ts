import { describe, expect, it } from 'vitest';
import { PROFANITY_TERMS, SLUR_TERMS } from './offensive-terms.js';
import { findOffensiveWords, offensiveTerm, offensiveWordMessage } from './offensive-words.js';

const terms = (text: string): string[] => findOffensiveWords(text).map((entry) => entry.term);

describe('offensive terms list', () => {
  it('is lower case, unique and has no blanks', () => {
    const all = [...SLUR_TERMS, ...PROFANITY_TERMS];
    expect(new Set(all).size).toBe(all.length);
    for (const term of all) expect(term).toMatch(/^[a-z]{3,}$/);
  });
});

describe('findOffensiveWords', () => {
  it('finds the real-run slur as a sound word, in any case', () => {
    expect(findOffensiveWords("page.sfx('CHINK')")).toEqual([
      { word: 'CHINK', term: 'chink', index: 10 },
    ]);
    expect(terms('Chink. chink! CHINKS')).toEqual(['chink', 'chink', 'chinks']);
  });

  it('matches whole words only', () => {
    expect(terms('glasses chinking, a Chinkapin oak, Scunthorpe, ink, think, clink')).toEqual([]);
    expect(terms('cocktail, Dickens, assessment, shitake? no: shiitake, therapist')).toEqual([]);
    expect(terms('Penistone, grape, Sussex, Essex, analysis, classic')).toEqual([]);
  });

  it('sees through held letters, leetspeak, masks and spacing', () => {
    expect(terms('CHIIIINK')).toEqual(['chink']);
    expect(terms('sh1t and $hit and 5h!t')).toEqual(['shit', 'shit']);
    expect(terms('n1gg3r')).toEqual(['nigger']);
    expect(terms('s1ut')).toEqual(['slut']);
    expect(terms('f*ck and f**k')).toEqual(['fuck', 'fuck']);
    expect(terms('a C H I N K here, c.h.i.n.k there, c-h-i-n-k')).toEqual([
      'chink',
      'chink',
      'chink',
    ]);
  });

  it('never flags numbers, masks alone or ordinary spaced letters', () => {
    expect(terms('1912 1953 $5 *** ** 0.61')).toEqual([]);
    expect(terms('A B C, U S A, I am a cat')).toEqual([]);
    expect(terms('con, cons, ragtime, wopping? no: whopping, spice, spicy')).toEqual([]);
  });

  it('flags listed homographs (never allowed silently)', () => {
    expect(terms('a coon in the yard')).toEqual(['coon']);
    expect(offensiveTerm('Retarded')).toBe('retarded');
  });

  it('words its message with replacements', () => {
    expect(offensiveWordMessage('CHINK')).toBe(
      'offensive or slur-like word "CHINK" — use another word (e.g. CLINK, CLANG, TINK)',
    );
  });
});
