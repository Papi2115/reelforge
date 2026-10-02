import { describe, expect, it } from 'vitest';
import { alignScript, type AsrWord } from './align.js';
import { alignTokens } from './anchored.js';
import { wordErrorRate } from './levenshtein.js';
import { needlemanWunsch, type Token } from './needleman-wunsch.js';
import { foldDiacritics, werTokens } from '../text/normalize.js';

const asr = (...items: [string, number, number, number?][]): AsrWord[] =>
  items.map(([text, t, tEnd, p = 0.9]) => ({ text, t, tEnd, p }));
const tokens = (...texts: string[]): Token[] =>
  texts.map((text) => ({ text, folded: foldDiacritics(text) }));
const shape = (
  pairs: ReturnType<typeof needlemanWunsch>,
): [number | null, number | null, string | null][] =>
  pairs.map((pair) => [pair.a, pair.b, pair.cmp?.kind ?? null]);

describe('wordErrorRate', () => {
  it('counts substitutions, deletions and insertions', () => {
    expect(wordErrorRate(werTokens('a b c d'), werTokens('a x c d e'))).toBe(0.5);
    expect(wordErrorRate([], [])).toBe(0);
  });
});

describe('needlemanWunsch', () => {
  it('aligns with gaps', () => {
    expect(shape(needlemanWunsch(tokens('a', 'bb', 'c'), tokens('a', 'c')))).toEqual([
      [0, 0, 'exact'],
      [1, null, null],
      [2, 1, 'exact'],
    ]);
  });

  it('merges several tokens heard as one word and vice versa', () => {
    const merged = needlemanWunsch(
      tokens('x', 'a', 'small', 'team', 'y'),
      tokens('x', 'asmolteam', 'y'),
    );
    expect(shape(merged)).toEqual([
      [0, 0, 'exact'],
      [1, 1, 'fuzzy'],
      [2, 1, 'fuzzy'],
      [3, 1, 'fuzzy'],
      [4, 2, 'exact'],
    ]);
    expect(shape(needlemanWunsch(tokens('cannot'), tokens('can', 'not')))).toEqual([
      [0, 0, 'exact'],
      [0, 1, 'exact'],
    ]);
  });

  it('gives the same result with a band wide enough for the path', () => {
    const a = tokens('one', 'two', 'three', 'four', 'five', 'six', 'seven');
    const b = tokens('one', 'too', 'three', 'five', 'six', 'uh', 'seven');
    expect(needlemanWunsch(a, b, { bandHalfWidth: 2 })).toEqual(needlemanWunsch(a, b));
  });

  it('handles empty sides', () => {
    expect(shape(needlemanWunsch([], tokens('a')))).toEqual([[null, 0, null]]);
    expect(shape(needlemanWunsch(tokens('a'), []))).toEqual([[0, null, null]]);
  });
});

describe('alignTokens', () => {
  it('matches the full matrix on long inputs split at unique anchors', () => {
    const words = Array.from({ length: 400 }, (_, k) => `t${String(k)}`);
    const heard = words.filter((_, k) => k % 50 !== 7).map((w, k) => (k % 61 === 3 ? `${w}z` : w));
    const pairs = alignTokens(tokens(...words), tokens(...heard));
    expect(pairs).toEqual(needlemanWunsch(tokens(...words), tokens(...heard)));
  });
});

describe('alignScript', () => {
  it('splits one merged ASR word across script words', () => {
    const result = alignScript('a small team', asr([' asmolteam', 1.0, 1.9]), { lang: 'en' });
    expect(result.words.map((w) => [w.status, w.t, w.tEnd])).toEqual([
      ['fuzzy', 1, 1.09],
      ['fuzzy', 1.09, 1.54],
      ['fuzzy', 1.54, 1.9],
    ]);
    const split = alignScript(
      'cannot stop',
      asr([' can', 0, 0.2], [' not', 0.2, 0.5], [' stop', 0.5, 0.9]),
      { lang: 'en' },
    );
    expect(split.words[0]).toEqual({
      i: 0,
      text: 'cannot',
      paragraph: 0,
      t: 0,
      tEnd: 0.5,
      confidence: 0.9,
      status: 'exact',
    });
  });

  it('keeps script text, times words and interpolates a missed word', () => {
    const result = alignScript(
      'Hello big world.',
      asr([' Hello', 1.0, 1.4, 0.8], [' world', 2.0, 2.5, 0.9]),
      { lang: 'en' },
    );
    expect(result.words.map((w) => [w.text, w.status])).toEqual([
      ['Hello', 'exact'],
      ['big', 'missing'],
      ['world.', 'exact'],
    ]);
    expect(result.words[1]).toMatchObject({ t: 1.4, tEnd: 2.0, confidence: 0 });
    expect(result.stats.coverage).toBe(0.667);
    expect(result.mismatches).toHaveLength(1);
    expect(result.mismatches[0]).toMatchObject({ kind: 'script', from: 1, to: 1, script: 'big' });
    expect(result.stats.monotonic).toBe(true);
  });

  it('matches numbers, diacritic-less PL and fuzzy spellings', () => {
    const result = alignScript(
      'W 1969 roku wysłały ludzi na Księżyc.',
      asr(
        [' W', 0.0, 0.1],
        [' 1969', 0.1, 1.5],
        [' roku', 1.5, 1.8],
        [' wyslaly', 1.8, 2.3],
        [' ludzi', 2.3, 2.6],
        [' na', 2.6, 2.7],
        [' Ksiezyc.', 2.7, 3.2],
      ),
      { lang: 'pl' },
    );
    expect(result.words.map((w) => w.status)).toEqual([
      'exact',
      'exact',
      'exact',
      'folded',
      'exact',
      'exact',
      'folded',
    ]);
    expect(result.words[1]).toMatchObject({ t: 0.1, tEnd: 1.5 });
    expect(result.stats.werFolded).toBeLessThan(result.stats.wer);
  });

  it('matches spelled-out numbers, units and inflected PL numerals', () => {
    const en = alignScript(
      'It needs 4 megabytes, about 61KB.',
      asr(
        [' It', 0, 0.2],
        [' needs', 0.2, 0.5],
        [' four', 0.5, 0.8],
        [' MB,', 0.8, 1.2],
        [' about', 1.2, 1.5],
        [' sixty-one', 1.5, 2.0],
        [' kilobytes.', 2.0, 2.6],
      ),
      { lang: 'en' },
    );
    expect(en.words.map((w) => w.status)).toEqual([
      'exact',
      'exact',
      'exact',
      'exact',
      'exact',
      'exact',
    ]);
    expect(en.words[5]).toMatchObject({ text: '61KB.', t: 1.5, tEnd: 2.6 });
    const pl = alignScript('jednego megaherca', asr([' 1', 0, 0.4], [' MHz', 0.4, 1.0]), {
      lang: 'pl',
    });
    expect(pl.words.map((w) => w.status)).toEqual(['exact', 'exact']);
  });

  it('reports ASR insertions as mismatches', () => {
    const result = alignScript(
      'one two',
      asr([' one', 0, 0.3], [' uh', 0.3, 0.5], [' two', 0.5, 0.9]),
      {
        lang: 'en',
      },
    );
    expect(result.stats.insertions).toBe(1);
    expect(result.mismatches[0]).toMatchObject({ kind: 'insertion', heard: 'uh' });
    expect(result.stats.coverage).toBe(1);
  });

  it('clamps ASR times that go backwards and flags them', () => {
    const result = alignScript(
      'alpha beta gamma',
      asr([' alpha', 1.0, 1.5], [' beta', 0.8, 1.2], [' gamma', 1.6, 2.0]),
      { lang: 'en' },
    );
    expect(result.stats.monotonic).toBe(false);
    expect(result.stats.clamped).toBe(1);
    expect(result.words[1]).toMatchObject({ t: 1.0, tEnd: 1.2, clamped: true });
    const starts = result.words.map((w) => w.t);
    expect(starts).toEqual([...starts].sort((x, y) => x - y));
  });

  it('interpolates trailing missing words up to the audio end', () => {
    const result = alignScript('one two three', asr([' one', 0, 0.5]), { lang: 'en', audioS: 2.5 });
    expect(result.words.at(-1)).toMatchObject({ status: 'missing', tEnd: 2.5 });
  });

  it('records paragraphs', () => {
    const result = alignScript(
      'one two\n\nthree',
      asr([' one', 0, 0.3], [' two', 0.3, 0.6], [' three', 1, 1.4]),
      {
        lang: 'en',
      },
    );
    expect(result.words.map((w) => w.paragraph)).toEqual([0, 0, 1]);
  });
});
