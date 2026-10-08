import type { VoiceCharAlignment } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { tokenizeScript } from '../text/normalize.js';
import { WordsFileSchema, type WordsFile } from '../schemas/words.js';
import { alignmentToWords, buildApiWordsFile, compareWithWhisper } from './alignment.js';
import { planVoiceChunks } from './script-chunks.js';

/** 0.1 s per character, as the vendor would return for `text`. */
function uniform(text: string, step = 0.1): VoiceCharAlignment {
  const characters = Array.from(text);
  return {
    characters,
    starts: characters.map((_, k) => k * step),
    ends: characters.map((_, k) => (k + 1) * step),
  };
}

describe('alignmentToWords', () => {
  it('times script tokens by their first and last letter or digit', () => {
    const words = alignmentToWords('"Hi," she said — 61 KB.', uniform('"Hi," she said — 61 KB.'));
    if (!words.ok) throw new Error(words.error.message);
    expect(words.value.map((word) => word.text)).toEqual(['"Hi,"', 'she', 'said', '61', 'KB.']);
    const [hi] = words.value;
    expect(hi?.t).toBeCloseTo(0.1);
    expect(hi?.tEnd).toBeCloseTo(0.3);
  });

  it('tolerates whitespace differences but not other characters', () => {
    const text = 'One  two';
    const spaced = alignmentToWords(text, uniform('One two'));
    expect(spaced.ok && spaced.value.map((word) => word.text)).toEqual(['One', 'two']);
    const wrong = alignmentToWords('One two', uniform('One tw0'));
    expect(!wrong.ok && wrong.error.kind).toBe('alignment');
    const extra = alignmentToWords('One', uniform('One!'));
    expect(!extra.ok && extra.error.message).toContain('extra');
  });
});

describe('buildApiWordsFile', () => {
  const script = 'Doom runs anywhere.\n\nEven on a calculator!';
  const plan = planVoiceChunks(script, 1_000);
  if (!plan.ok) throw new Error(plan.error.message);

  it('offsets chunk words into a valid words.json with script indices', () => {
    const placed = plan.value.map((chunk, index) => {
      const words = alignmentToWords(chunk.text, uniform(chunk.text));
      if (!words.ok) throw new Error(words.error.message);
      return { chunk, offsetS: index * 10, words: words.value };
    });
    const file = buildApiWordsFile(placed, 'eleven_multilingual_v2');
    if (!file.ok) throw new Error(file.error.message);
    expect(WordsFileSchema.parse(file.value)).toEqual(file.value);
    const expected = tokenizeScript(script);
    expect(file.value.words.map((word) => [word.i, word.text, word.paragraph])).toEqual(
      expected.map((word, i) => [i, word.text, word.paragraph]),
    );
    expect(file.value.words[3]?.t).toBe(10);
    expect(file.value.asrModel).toBe('elevenlabs/eleven_multilingual_v2');
    expect(file.value.stats).toMatchObject({
      scriptWords: 7,
      exact: 7,
      monotonic: true,
      clamped: 0,
    });
  });

  it('clamps non-monotonic starts and rejects missing words', () => {
    const [first, second] = plan.value;
    if (first === undefined || second === undefined) throw new Error('plan');
    const late = alignmentToWords(first.text, uniform(first.text, 1));
    const early = alignmentToWords(second.text, uniform(second.text));
    if (!late.ok || !early.ok) throw new Error('align');
    const file = buildApiWordsFile(
      [
        { chunk: first, offsetS: 0, words: late.value },
        { chunk: second, offsetS: 1, words: early.value },
      ],
      'm',
    );
    expect(file.ok && file.value.stats.clamped).toBeGreaterThan(0);
    expect(file.ok && WordsFileSchema.safeParse(file.value).success).toBe(true);
    const short = buildApiWordsFile(
      [{ chunk: first, offsetS: 0, words: late.value.slice(1) }],
      'm',
    );
    expect(!short.ok && short.error.kind).toBe('alignment');
  });
});

describe('compareWithWhisper', () => {
  const word = (i: number, t: number, status: WordsFile['words'][number]['status'] = 'exact') => ({
    i,
    text: `w${String(i)}`,
    t,
    status,
  });

  it('reports median and 95th percentile start offsets of matching words', () => {
    const api = [word(0, 0), word(1, 1.1), word(2, 2), word(3, 3.3), word(4, 9)];
    const whisper = [word(0, 0.05), word(1, 1), word(2, 2), word(3, 3), word(4, 4, 'missing')];
    const comparison = compareWithWhisper(api, whisper);
    expect(comparison.pairs).toBe(4);
    expect(comparison.medianAbsS).toBeCloseTo(0.05);
    expect(comparison.p95AbsS).toBeCloseTo(0.3);
    expect(comparison.maxAbsS).toBeCloseTo(0.3);
    expect(comparison.medianSignedS).toBeCloseTo(0);
    expect(compareWithWhisper([], whisper)).toEqual({
      pairs: 0,
      medianAbsS: null,
      p95AbsS: null,
      maxAbsS: null,
      medianSignedS: null,
    });
  });
});
