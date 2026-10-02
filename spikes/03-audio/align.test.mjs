// node --test spikes/03-audio/   (node:test, no extra dependencies)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  alignScript,
  cleanWord,
  foldDiacritics,
  needlemanWunsch,
  subTokens,
  werTokens,
  wordErrorRate,
} from './align.mjs';
import { numberToWords } from './lib/numbers.mjs';

const asr = (...items) => items.map(([text, t, tEnd, p = 0.9]) => ({ text, t, tEnd, p }));

test('cleanWord strips punctuation but keeps decimals and diacritics', () => {
  assert.equal(cleanWord('Doom,'), 'doom');
  assert.equal(cleanWord('"Księżyc."'), 'księżyc');
  assert.equal(cleanWord('3.5'), '3.5');
  assert.equal(cleanWord('4,000'), '4000');
  assert.equal(cleanWord("It's"), 'its');
  assert.equal(cleanWord('—'), '');
});

test('foldDiacritics handles Polish ł explicitly', () => {
  assert.equal(foldDiacritics('źdźbło łąki'), 'zdzblo laki');
});

test('numbers are spelled out in EN and PL', () => {
  assert.equal(numberToWords(1993, 'en'), 'one thousand nine hundred ninety three');
  assert.equal(numberToWords(1969, 'pl'), 'tysiąc dziewięćset sześćdziesiąt dziewięć');
  assert.equal(numberToWords(4, 'pl'), 'cztery');
  assert.equal(numberToWords(25000, 'pl'), 'dwadzieścia pięć tysięcy');
  assert.equal(numberToWords(3000, 'pl'), 'trzy tysiące');
  assert.equal(numberToWords(1_000_000, 'en'), null);
  assert.deepEqual(subTokens('twenty-six', 'en'), ['twenty', 'six']);
  assert.deepEqual(subTokens('26', 'en'), ['twenty', 'six']);
});

test('WER counts substitutions, deletions and insertions', () => {
  assert.equal(wordErrorRate(werTokens('a b c d'), werTokens('a x c d e')), 0.5);
  assert.equal(wordErrorRate([], []), 0);
});

test('needlemanWunsch aligns with gaps', () => {
  const pairs = needlemanWunsch(['a', 'bb', 'c'], ['a', 'c']).map(([i, j]) => [i, j]);
  assert.deepEqual(pairs, [
    [0, 0],
    [1, null],
    [2, 1],
  ]);
});

test('needlemanWunsch merges several tokens heard as one word and vice versa', () => {
  const merged = needlemanWunsch(['x', 'a', 'small', 'team', 'y'], ['x', 'asmolteam', 'y']);
  assert.deepEqual(
    merged.map(([i, j, cmp]) => [i, j, cmp?.kind ?? null]),
    [
      [0, 0, 'exact'],
      [1, 1, 'fuzzy'],
      [2, 1, 'fuzzy'],
      [3, 1, 'fuzzy'],
      [4, 2, 'exact'],
    ],
  );
  const split = needlemanWunsch(['cannot'], ['can', 'not']);
  assert.deepEqual(
    split.map(([i, j, cmp]) => [i, j, cmp?.kind ?? null]),
    [
      [0, 0, 'exact'],
      [0, 1, 'exact'],
    ],
  );
});

test('alignScript splits one merged ASR word across script words', () => {
  const result = alignScript('a small team', asr([' asmolteam', 1.0, 1.9]), 'en');
  assert.deepEqual(
    result.words.map((w) => [w.status, w.t, w.tEnd]),
    [
      ['fuzzy', 1, 1.09],
      ['fuzzy', 1.09, 1.54],
      ['fuzzy', 1.54, 1.9],
    ],
  );
  const split = alignScript(
    'cannot stop',
    asr([' can', 0, 0.2], [' not', 0.2, 0.5], [' stop', 0.5, 0.9]),
    'en',
  );
  assert.deepEqual(split.words[0], {
    i: 0,
    text: 'cannot',
    t: 0,
    tEnd: 0.5,
    confidence: 0.9,
    status: 'exact',
  });
});

test('alignScript keeps script text, times words and interpolates a missed word', () => {
  const result = alignScript(
    'Hello big world.',
    asr([' Hello', 1.0, 1.4, 0.8], [' world', 2.0, 2.5, 0.9]),
    'en',
  );
  assert.deepEqual(
    result.words.map((w) => [w.text, w.status]),
    [
      ['Hello', 'exact'],
      ['big', 'missing'],
      ['world.', 'exact'],
    ],
  );
  assert.equal(result.words[1].t, 1.4);
  assert.equal(result.words[1].tEnd, 2.0);
  assert.equal(result.words[1].confidence, 0);
  assert.equal(result.stats.coverage, 0.667);
  assert.equal(result.mismatches.length, 1);
  assert.equal(result.stats.monotonic, true);
});

test('alignScript matches numbers, diacritic-less PL and fuzzy spellings', () => {
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
    'pl',
  );
  assert.deepEqual(
    result.words.map((w) => w.status),
    ['exact', 'exact', 'exact', 'folded', 'exact', 'exact', 'folded'],
  );
  assert.equal(result.words[1].t, 0.1);
  assert.equal(result.words[1].tEnd, 1.5);
  assert.ok(result.stats.werFolded < result.stats.wer);
});

test('alignScript reports ASR insertions as mismatches', () => {
  const result = alignScript(
    'one two',
    asr([' one', 0, 0.3], [' uh', 0.3, 0.5], [' two', 0.5, 0.9]),
    'en',
  );
  assert.equal(result.stats.insertions, 1);
  assert.equal(result.mismatches[0].heard, 'uh');
  assert.equal(result.stats.coverage, 1);
});
