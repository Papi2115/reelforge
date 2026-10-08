import type { TimedWord } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { spokenChapterTitle } from './chapter-titles.js';

/** Words of `text`, one every 0.3 s from `t0`. */
function spoken(text: string, t0: number): TimedWord[] {
  return text.split(' ').map((word, index) => ({
    text: word,
    t: t0 + index * 0.3,
    tEnd: t0 + index * 0.3 + 0.25,
  }));
}

describe('spokenChapterTitle', () => {
  it('takes the longest content-word run of the sentence at the chapter start, title-cased', () => {
    const words = [
      ...spoken('So that was the plan.', 0),
      ...spoken('But the computer had only four kilobytes of erasable memory.', 10),
    ];
    expect(spokenChapterTitle(words, 10, 40, 5)).toBe('Four Kilobytes of Erasable Memory');
    expect(
      spokenChapterTitle(
        spoken('Neil Armstrong took manual control as alarms flashed.', 0),
        0,
        9,
        5,
      ),
    ).toBe('Neil Armstrong Took Manual Control');
    expect(
      spokenChapterTitle(spoken('The AGC had 72 KB of rope memory, woven by hand.', 0), 0, 9, 5),
    ).toBe('72 KB of Rope Memory');
  });

  it('keeps joiners between content words and caps the words', () => {
    expect(spokenChapterTitle(spoken('And there it is: demons and shotguns!', 0), 0, 9, 5)).toBe(
      'Demons and Shotguns',
    );
    expect(
      spokenChapterTitle(
        spoken('weaving copper wire through tiny magnetic cores forever', 0),
        0,
        9,
        3,
      ),
    ).toBe('Weaving Copper Wire');
  });

  it('reads on past a sentence without a key phrase; hedges break runs (real run Comic 2)', () => {
    expect(spokenChapterTitle(spoken('Why? Anglerfish dangle a lure.', 0), 0, 9, 5)).toBe(
      'Anglerfish Dangle',
    );
    expect(
      spokenChapterTitle(
        spoken('Below roughly one thousand meters, the sun gives up.', 0),
        0,
        9,
        5,
      ),
    ).toBe('One Thousand Meters');
    expect(spokenChapterTitle(spoken('Why? Hold on. So what? Anglerfish.', 0), 0, 9, 5)).toBe(
      'Hold',
    );
    expect(spokenChapterTitle(spoken('Why? So? Now? Anglerfish.', 0), 0, 9, 5)).toBeUndefined();
  });

  it('reads Polish narration and ignores words of the next chapter', () => {
    expect(
      spokenChapterTitle(
        spoken('A więc komputer pokładowy miał tylko cztery kilobajty.', 5),
        5,
        20,
        5,
      ),
    ).toBe('Komputer Pokładowy Miał');
    expect(spokenChapterTitle(spoken('Later words.', 30), 5, 20, 5)).toBeUndefined();
    expect(spokenChapterTitle(spoken('And so it is.', 0), 0, 9, 5)).toBeUndefined();
    expect(spokenChapterTitle([], 0, 9, 5)).toBeUndefined();
  });
});
