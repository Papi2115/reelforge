/**
 * A Grim Ink storyboard against its direction plan (PLAN.md#14.16): a storyboard that executes the
 * plan passes; the title frame, the framings, the climax ECU and the gags are enforced; the check
 * runs inside `validateStoryboard` only when the plan is passed.
 */
import type { StoryboardShot } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { checkDirectedStoryboard } from './direction-storyboard.js';
import { goodPlan, goodShots } from './direction-fixture.js';
import { validateStoryboard } from './storyboard.js';

/** The shot without its direction refs. */
function undirected(shot: StoryboardShot): StoryboardShot {
  const copy = { ...shot };
  delete copy.direction;
  return copy;
}

function errors(shots: readonly StoryboardShot[]): string[] {
  return checkDirectedStoryboard(shots, goodPlan())
    .filter((entry) => entry.severity === 'error')
    .map((entry) => entry.code);
}

function edited(index: number, edit: (shot: StoryboardShot) => StoryboardShot): StoryboardShot[] {
  return goodShots().map((shot, at) => (at === index ? edit(shot) : shot));
}

const framings = (shot: StoryboardShot): NonNullable<StoryboardShot['direction']>['framings'] =>
  shot.direction?.framings ?? [];

describe('a storyboard against its direction plan', () => {
  it('passes when it executes the plan', () => {
    expect(checkDirectedStoryboard(goodShots(), goodPlan())).toEqual([]);
  });

  it('wants the title frame first: ink-poster, 1.5-3 s, marked', () => {
    expect(errors(edited(0, undirected))).toEqual(['direction-title-frame']);
    expect(errors(edited(0, (shot) => ({ ...shot, look: 'ink-scene' })))).toEqual([
      'direction-title-frame',
    ]);
    const long = goodShots().map((shot, index) =>
      index === 0 ? { ...shot, t1: 4 } : index === 1 ? { ...shot, t0: 4 } : shot,
    );
    expect(errors(long)).toEqual(['direction-title-frame']);
    const twice = edited(3, (shot) => ({
      ...shot,
      direction: { ...shot.direction, framings: framings(shot), titleFrame: true },
    }));
    expect(errors(twice)).toEqual(['direction-title-frame']);
  });

  it('wants direction refs with 2-5 framings, reasons and no repeated sequence', () => {
    expect(errors(edited(2, undirected))).toEqual(['direction-shot', 'direction-gag-shots']);
    const single = edited(2, (shot) => ({
      ...shot,
      direction: { ...shot.direction, framings: framings(shot).slice(0, 1) },
    }));
    expect(errors(single)).toEqual(['direction-framings']);
    const noWhy = edited(2, (shot) => ({
      ...shot,
      direction: {
        ...shot.direction,
        framings: framings(shot).map((step) => ({ framing: step.framing, subject: step.subject })),
      },
    }));
    expect(errors(noWhy)).toEqual(['direction-why']);
    const repeat = edited(2, (shot) => ({
      ...shot,
      direction: { ...shot.direction, framings: framings(goodShots()[1] ?? shot) },
    }));
    expect(errors(repeat)).toEqual(['direction-repeat']);
    const unknown = edited(2, (shot) => ({
      ...shot,
      direction: { ...shot.direction, framings: framings(shot), beats: ['b99'], gags: ['ghost'] },
    }));
    expect(errors(unknown)).toEqual(expect.arrayContaining(['direction-unknown-ref']));
  });

  it('wants close-ups, the climax ECU and the gags with their payoffs', () => {
    const wideOnly = goodShots().map((shot, index) =>
      index === 0
        ? shot
        : {
            ...shot,
            direction: {
              ...shot.direction,
              framings:
                index % 2 === 0
                  ? [
                      { framing: 'wide' as const, subject: 'a' },
                      { framing: 'medium' as const, subject: 'b' },
                    ]
                  : [
                      { framing: 'medium' as const, subject: 'a' },
                      { framing: 'wide' as const, subject: 'b' },
                    ],
            },
          },
    );
    expect(errors(wideOnly)).toEqual(['direction-all-wide', 'direction-climax']);
    const noPayoff = edited(5, (shot) => ({
      ...shot,
      direction: { ...shot.direction, framings: framings(shot), gags: [] },
    }));
    expect(errors(noPayoff)).toEqual(['direction-payoff', 'direction-gag-shots']);
    const uncovered = edited(4, (shot) => ({
      ...shot,
      direction: { ...shot.direction, framings: framings(shot), beats: [] },
    }));
    expect(errors(uncovered)).toEqual(['direction-climax', 'direction-payoff']);
    const warnings = checkDirectedStoryboard(uncovered, goodPlan()).filter(
      (entry) => entry.severity === 'warning',
    );
    expect(warnings.map((entry) => entry.code)).toEqual(['direction-uncovered']);
  });

  it('runs inside validateStoryboard only with a plan', () => {
    const text = JSON.stringify({
      version: 1,
      shots: edited(0, undirected),
    });
    const codes = (plan?: ReturnType<typeof goodPlan>): string[] =>
      validateStoryboard(text, plan === undefined ? {} : { direction: plan }).issues.map(
        (entry) => entry.code,
      );
    expect(codes()).not.toContain('direction-title-frame');
    expect(codes(goodPlan())).toContain('direction-title-frame');
    const parsed = validateStoryboard(JSON.stringify({ version: 1, shots: goodShots() }));
    expect(parsed.value?.shots[1]?.direction?.beats).toEqual(['b01', 'b02']);
  });
});
