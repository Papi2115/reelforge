import type { TimedWord } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { sentencesOf, snapTime, visibleSpans, wordBoundaries } from './word-index.js';

const words: TimedWord[] = [
  { text: 'Doom', t: 0.3, tEnd: 0.6 },
  { text: 'runs.', t: 0.6, tEnd: 0.85 },
  { text: 'This', t: 2.3, tEnd: 2.5 },
  { text: 'calculator', t: 2.5, tEnd: 3.1 },
  { text: 'has', t: 4.0, tEnd: 4.2 },
];

describe('word boundaries and snapping', () => {
  it('lists starts and ends once, sorted', () => {
    expect([...wordBoundaries(words)]).toEqual([0.3, 0.6, 0.85, 2.3, 2.5, 3.1, 4.0, 4.2]);
  });

  it('snaps to the nearest boundary within the tolerance only', () => {
    const boundaries = wordBoundaries(words);
    expect(snapTime(2.44, boundaries, 0.15)).toEqual({ t: 2.5, snapped: true });
    expect(snapTime(2.36, boundaries, 0.15)).toEqual({ t: 2.3, snapped: true });
    expect(snapTime(3.5, boundaries, 0.15)).toEqual({ t: 3.5, snapped: false });
    expect(snapTime(3.24, boundaries, 0.15)).toEqual({ t: 3.1, snapped: true });
    expect(snapTime(5, new Float64Array(), 0.15)).toEqual({ t: 5, snapped: false });
  });
});

describe('sentencesOf', () => {
  it('splits on ending punctuation and long pauses', () => {
    expect(sentencesOf(words)).toEqual([
      { t: 0.3, tEnd: 0.85, text: 'Doom runs.', first: 0, last: 1 },
      { t: 2.3, tEnd: 3.1, text: 'This calculator', first: 2, last: 3 },
      { t: 4.0, tEnd: 4.2, text: 'has', first: 4, last: 4 },
    ]);
    expect(sentencesOf([])).toEqual([]);
  });
});

describe('visibleSpans', () => {
  it('finds the spans overlapping a window by binary search', () => {
    expect(visibleSpans(words, 0.7, 2.4)).toEqual({ start: 1, end: 3 });
    expect(visibleSpans(words, 5, 6)).toEqual({ start: 5, end: 5 });
    expect(visibleSpans(words, 0, 0.1)).toEqual({ start: 0, end: 0 });
    expect(visibleSpans(words, 2.5, 2.5)).toEqual({ start: 2, end: 4 });
  });
});
