import { describe, expect, it } from 'vitest';
import { tokenizeScript } from '../text/normalize.js';
import {
  contextAfter,
  contextBefore,
  isSpokenWord,
  planVoiceChunks,
  splitScriptParagraphs,
  splitSentences,
} from './script-chunks.js';

const SCRIPT = [
  'Doom runs on almost anything. Fridges, watches, even a printer.',
  '',
  'But this one is special: a school calculator with only 61 KB of memory!',
  '',
  '',
  'Dr. Smith said it best. "Will it run?" Yes. J. R. R. Tolkien never asked, e.g. about Doom.',
  '',
  '— —',
  '',
  'If it has a screen, it runs Doom.',
].join('\r\n');

describe('splitSentences', () => {
  it('splits on end punctuation and keeps abbreviations, initials and quotes', () => {
    expect(
      splitSentences(
        'Dr. Smith said it best. "Will it run?" Yes. J. R. R. Tolkien never asked, e.g. about Doom.',
      ),
    ).toEqual([
      'Dr. Smith said it best.',
      '"Will it run?"',
      'Yes.',
      'J. R. R. Tolkien never asked, e.g. about Doom.',
    ]);
  });

  it('does not split before a lower-case word', () => {
    expect(splitSentences('It costs 3.5 dollars. and more. Then 1990 came.')).toEqual([
      'It costs 3.5 dollars. and more.',
      'Then 1990 came.',
    ]);
  });
});

describe('splitScriptParagraphs', () => {
  it('counts words exactly like tokenizeScript (words.json indices)', () => {
    const paragraphs = splitScriptParagraphs(SCRIPT);
    const expected = tokenizeScript(SCRIPT);
    const words = paragraphs.flatMap((paragraph) =>
      paragraph.sentences.flatMap((sentence) =>
        sentence.text
          .split(' ')
          .filter(isSpokenWord)
          .map((text) => ({ text, paragraph: paragraph.index })),
      ),
    );
    expect(words).toEqual(expected);
    expect(words.map((word) => word.text)).not.toContain('—');
    const last = paragraphs.flatMap((paragraph) => paragraph.sentences).at(-1);
    expect(last?.firstWord).toBe(expected.findIndex((word) => word.text === 'If'));
    expect((last?.firstWord ?? 0) + (last?.wordCount ?? 0)).toBe(expected.length);
  });
});

describe('planVoiceChunks', () => {
  it('makes one chunk per spoken paragraph with stable ids and joins', () => {
    const plan = planVoiceChunks(SCRIPT, 8_000);
    if (!plan.ok) throw new Error(plan.error.message);
    expect(plan.value.map((chunk) => [chunk.id, chunk.join])).toEqual([
      ['p00a', 'start'],
      ['p01a', 'paragraph'],
      ['p02a', 'paragraph'],
      ['p04a', 'paragraph'],
    ]);
    expect(plan.value[2]?.sentences.map((sentence) => sentence.id)).toEqual([
      'p02-s00',
      'p02-s01',
      'p02-s02',
      'p02-s03',
    ]);
    expect(plan.value[0]?.text).toBe(
      'Doom runs on almost anything. Fridges, watches, even a printer.',
    );
    expect(planVoiceChunks(SCRIPT, 8_000)).toEqual(plan);
  });

  it('splits a long paragraph between sentences only', () => {
    const paragraph = 'One two three. Four five six. Seven eight nine. Ten eleven twelve.';
    const plan = planVoiceChunks(paragraph, 32);
    if (!plan.ok) throw new Error(plan.error.message);
    expect(plan.value.map((chunk) => [chunk.id, chunk.text, chunk.join])).toEqual([
      ['p00a', 'One two three. Four five six.', 'start'],
      ['p00b', 'Seven eight nine.', 'sentence'],
      ['p00c', 'Ten eleven twelve.', 'sentence'],
    ]);
    expect(plan.value.map((chunk) => chunk.firstWord)).toEqual([0, 6, 9]);
    expect(plan.value.every((chunk) => chunk.characters <= 32)).toBe(true);
  });

  it('refuses a sentence longer than one request', () => {
    const plan = planVoiceChunks('Short. This sentence is far too long for the budget.', 20);
    expect(!plan.ok && plan.error).toMatchObject({ kind: 'invalid-input' });
    expect(!plan.ok && plan.error.message).toContain('p00-s01');
  });

  it('refuses an empty script', () => {
    expect(planVoiceChunks(' \n\n — ', 100).ok).toBe(false);
  });
});

describe('context text', () => {
  it('takes whole words from the neighbours', () => {
    const plan = planVoiceChunks('Alpha beta gamma.\n\nDelta epsilon.\n\nZeta eta theta.', 100);
    if (!plan.ok) throw new Error(plan.error.message);
    expect(contextBefore(plan.value, 1)).toBe('Alpha beta gamma.');
    expect(contextAfter(plan.value, 1)).toBe('Zeta eta theta.');
    expect(contextBefore(plan.value, 2, 12)).toBe('epsilon.');
    expect(contextAfter(plan.value, 0, 12)).toBe('Delta');
    expect(contextBefore(plan.value, 0)).toBe('');
  });
});
