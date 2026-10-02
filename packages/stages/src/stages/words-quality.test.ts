import { describe, expect, it } from 'vitest';
import { RETRY_DECODING, attemptPlan, findRepetitionLoop, isBetter } from './words-quality.js';

const words = (text: string): { text: string }[] => text.split(' ').map((word) => ({ text: word }));

describe('findRepetitionLoop', () => {
  it('finds a repeated phrase (whisper decoder loop)', () => {
    const looped = words(
      'it ran on a calculator and on a fridge and on a fridge and on a fridge and on a fridge',
    );
    expect(findRepetitionLoop(looped)).toMatchObject({ n: 4, repeats: 4 });
  });

  it('ignores normal speech, punctuation and short repetitions', () => {
    expect(
      findRepetitionLoop(words('no, no, no. It was called Doom, and it changed everything.')),
    ).toBeUndefined();
    expect(findRepetitionLoop(words('the the the the the the'))).toMatchObject({
      n: 1,
      repeats: 6,
    });
  });
});

describe('attemptPlan', () => {
  it('retries with -bs 5 -tp 0.2, then an installed fallback model', () => {
    expect(attemptPlan('large-v3-turbo-q5_0', 'small', () => true)).toEqual([
      { model: 'large-v3-turbo-q5_0', decoding: undefined },
      { model: 'large-v3-turbo-q5_0', decoding: RETRY_DECODING },
      { model: 'small', decoding: undefined },
    ]);
    expect(attemptPlan('large-v3-turbo-q5_0', 'small', () => false)).toHaveLength(2);
    expect(attemptPlan('small', null, () => true)).toHaveLength(2);
  });

  it('prefers loop-free results, then coverage', () => {
    expect(isBetter({ coverage: 0.7, loop: false }, { coverage: 0.95, loop: true })).toBe(true);
    expect(isBetter({ coverage: 0.9, loop: false }, { coverage: 0.95, loop: false })).toBe(false);
    expect(isBetter({ coverage: 0.5, loop: true }, undefined)).toBe(true);
  });
});
