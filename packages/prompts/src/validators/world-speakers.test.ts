/**
 * A moment with a speaker (Game B2 `dialogue`) only where the narration lets someone speak (real
 * run Game B2 2: an invented "keeper" said a line nobody in the narration says).
 */
import type { StoryboardShot, WordsFile } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { GAME_B2_MOMENTS } from '../worlds/game-b2-moments.js';
import { checkStoryboard } from './storyboard.js';
import { checkWorldSpeakers, narrationHasSpeaker } from './world-speakers.js';

function words(text: string, from = 0): WordsFile {
  return {
    version: 1,
    language: 'en',
    words: text.split(' ').map((word, i) => ({
      text: word,
      t: from + i * 0.4,
      tEnd: from + i * 0.4 + 0.3,
    })),
  } as WordsFile;
}

const shot = (id: string, t0: number, t1: number, worldMoment?: string): StoryboardShot => ({
  id,
  t0,
  t1,
  intent: 'a walk',
  scene: `scenes/${id}.js`,
  treatment: 'character-scene',
  roll: 'A',
  look: 'rpg-explore',
  ...(worldMoment === undefined ? {} : { worldMoment }),
});

describe('world speakers', () => {
  it('finds a speech verb or a quote, case and punctuation aside', () => {
    expect(narrationHasSpeaker(words('The ranger Says, the oak is old.'), 0, 5)).toBe(true);
    expect(narrationHasSpeaker(words('“Never again” was the answer'), 0, 5)).toBe(true);
    expect(narrationHasSpeaker(words('Whether oaks share sugar is debated.'), 0, 5)).toBe(false);
  });

  it('flags a dialogue shot nobody speaks in, with the fix', () => {
    const narration = words('Whether oaks share sugar is debated. Scientists say they might.');
    const issues = checkWorldSpeakers(
      [shot('s05', 0, 2.5, 'dialogue')],
      narration,
      GAME_B2_MOMENTS,
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: 'error', code: 'moment-speaker' });
    expect(issues[0]?.message).toMatch(/s05: dialogue needs someone the narration lets speak/);
    expect(issues[0]?.message).toMatch(/narration box/);
  });

  it('accepts an attribution just before the shot, other moments and missing words', () => {
    const narration = words('Scientists say oaks share sugar with their neighbours.');
    expect(
      checkWorldSpeakers([shot('s05', 1.2, 3.5, 'dialogue')], narration, GAME_B2_MOMENTS),
    ).toEqual([]);
    const quiet = words('Whether oaks share sugar is debated.');
    expect(checkWorldSpeakers([shot('s05', 0, 3, 'quest-log')], quiet, GAME_B2_MOMENTS)).toEqual(
      [],
    );
    expect(checkWorldSpeakers([shot('s05', 0, 3, 'dialogue')], undefined, GAME_B2_MOMENTS)).toEqual(
      [],
    );
  });

  it('runs in the storyboard check of a world film only', () => {
    const narration = words('Whether oaks share sugar is debated. They might.');
    const storyboard = { version: 1 as const, shots: [shot('s01', 0, 3, 'dialogue')] };
    const codes = (options: Parameters<typeof checkStoryboard>[1]): string[] =>
      checkStoryboard(storyboard, options).map((entry) => entry.code);
    expect(codes({ words: narration, worldVariety: { moments: GAME_B2_MOMENTS } })).toContain(
      'moment-speaker',
    );
    expect(codes({ words: narration })).not.toContain('moment-speaker');
  });
});
