/** World checks (PLAN.md#13.6): page-native transition styles and the critic's craft notes. */
import { describe, expect, it } from 'vitest';
import type { WorldTransitionOption } from '../worlds/types.js';
import { isCraftNote, parseCraftNote, validateCriticReply } from './critic.js';
import { checkStoryboard } from './storyboard.js';

const FLIP: WorldTransitionOption = {
  id: 'sketchbook-page-flip',
  type: 'wipe',
  duration: 0.62,
  description: 'the page turns',
};

function storyboardWith(style: string | undefined, duration = 0.62) {
  return {
    version: 1 as const,
    shots: [
      {
        id: 's01',
        t0: 0,
        t1: 4,
        treatment: 'title-card' as const,
        intent: 'a',
        scene: 'scenes/s01.js',
      },
      {
        id: 's02',
        t0: 4,
        t1: 8,
        treatment: 'metaphor-object' as const,
        intent: 'b',
        scene: 'scenes/s02.js',
        transitionIn: {
          type: 'wipe' as const,
          duration,
          ...(style === undefined ? {} : { style }),
        },
      },
    ],
  };
}

const codes = (issues: readonly { code: string }[]): string[] => issues.map((entry) => entry.code);

describe('world transition styles', () => {
  it('accept the world style in a world and warn about its duration', () => {
    expect(codes(checkStoryboard(storyboardWith(FLIP.id), { worldTransitions: [FLIP] }))).toEqual(
      [],
    );
    expect(
      codes(checkStoryboard(storyboardWith(FLIP.id, 2), { worldTransitions: [FLIP] })),
    ).toContain('transition-duration');
  });

  it('reject a built-in style in a world and a world style elsewhere', () => {
    const inWorld = checkStoryboard(storyboardWith('iris'), { worldTransitions: [FLIP] });
    expect(inWorld.find((entry) => entry.code === 'transition-style')?.message).toContain(
      'sketchbook-page-flip',
    );
    expect(codes(checkStoryboard(storyboardWith(FLIP.id)))).toContain('transition-style');
    expect(codes(checkStoryboard(storyboardWith('iris', 0.5)))).not.toContain('transition-style');
  });
});

describe('craft notes', () => {
  it('parse the focal point and the traces', () => {
    expect(
      parseCraftNote('focal: red +1 DAY; traces: crossed-out 365, tape, pencil doubt'),
    ).toEqual({ focal: 'red +1 DAY', traces: ['crossed-out 365', 'tape', 'pencil doubt'] });
    expect(isCraftNote('Focal: the sun | traces: smudge, arrow and coffee ring.')).toBe(true);
    expect(isCraftNote('focal: the sun; traces: smudge')).toBe(false);
    expect(parseCraftNote('looks fine')).toBeUndefined();
  });

  it('warn about an ok frame without a craft note only in craft mode', () => {
    const reply = JSON.stringify({ frames: [{ path: 'a.png', verdict: 'ok', note: 'fine' }] });
    expect(codes(validateCriticReply(reply, { craft: true }).issues)).toEqual(['craft-note']);
    expect(codes(validateCriticReply(reply).issues)).toEqual([]);
    const long = Array.from({ length: 15 }, () => 'word').join(' ');
    const craft = JSON.stringify({
      frames: [{ path: 'a.png', verdict: 'ok', note: `focal: a; traces: b, c, d ${long}` }],
    });
    expect(codes(validateCriticReply(craft, { craft: true }).issues)).toEqual([]);
    expect(codes(validateCriticReply(craft).issues)).toEqual(['long-note']);
  });
});
