/**
 * A world's own captions (PLAN.md#14.18, Grim Ink): longer line groups, drawn by the world over
 * the shot; the engine's pixel captions stay as they were for every other world and step in when
 * the world has nothing to draw on.
 */
import type { TimedWord } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { captionGroups, drawWorldCaptions, type WorldCaptionDrawer } from './captions.js';

const WORDS: TimedWord[] = [
  { text: 'You', t: 0.3, tEnd: 0.6 },
  { text: 'have', t: 0.6, tEnd: 0.9 },
  { text: 'just', t: 0.9, tEnd: 1.2 },
  { text: 'won.', t: 1.2, tEnd: 1.5 },
  { text: 'The', t: 1.9, tEnd: 2.1 },
  { text: 'crowd', t: 2.1, tEnd: 2.4 },
];

const SCENE = { traverse: () => undefined };
const FRAME = { width: 1920, height: 1080 };

function recorder(answer: boolean): WorldCaptionDrawer & { readonly lines: string[] } {
  const lines: string[] = [];
  return {
    lines,
    draw: (_scene, text) => {
      lines.push(text);
      return answer;
    },
  };
}

describe('world captions', () => {
  it('groups up to the world maximum, a sentence end still breaks', () => {
    const window = { t0: 0, t1: 3 };
    expect(captionGroups(WORDS, window).map((group) => group.words.length)).toEqual([3, 1, 2]);
    expect(captionGroups(WORDS, window, 9).map((group) => group.words.length)).toEqual([4, 2]);
  });

  it('hands the line on screen to the world; nothing between lines', () => {
    const groups = captionGroups(WORDS, { t0: 0, t1: 3 }, 9);
    const world = recorder(true);
    expect(drawWorldCaptions(world, SCENE, groups, 1.0, FRAME)).toBe(true);
    expect(world.lines).toEqual(['You have just won.']);
    expect(drawWorldCaptions(world, SCENE, groups, 0.1, FRAME)).toBe(true);
    expect(world.lines).toHaveLength(1);
    const bare = recorder(false);
    expect(drawWorldCaptions(bare, SCENE, groups, 2.2, FRAME)).toBe(false);
    expect(bare.lines).toEqual(['The crowd']);
  });
});
