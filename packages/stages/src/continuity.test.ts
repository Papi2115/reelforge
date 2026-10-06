import {
  applyContinuityTransitions,
  storyboardShotSchema,
  type ContinuityLink,
  type FinalReviewShot,
  type StoryboardShot,
} from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import {
  continuityReviewNotes,
  sceneContinuityVars,
  storyboardContinuityVars,
} from './continuity.js';

function shot(id: string, t0: number, continuity?: ContinuityLink): StoryboardShot {
  return storyboardShotSchema.parse({
    id,
    t0,
    t1: t0 + 5,
    treatment: 'map',
    intent: `${id} with the wall calendar`,
    scene: `scenes/${id}.js`,
    ...(continuity === undefined ? {} : { continuity }),
  });
}

const LINK: ContinuityLink = {
  kind: 'zoom-through',
  object: 'wall calendar',
  anchor: { x: 0.72, y: 0.34 },
};

function entry(shotId: string, status: FinalReviewShot['status']): FinalReviewShot {
  return { shotId, status, findings: [], autoFixed: false, locked: false, outOfSync: false };
}

describe('continuity links in the stages', () => {
  it('adds the storyboard section only with the project switch on', () => {
    expect(storyboardContinuityVars({}, 120)).toEqual({});
    expect(storyboardContinuityVars({ continuityLinks: false }, 120)).toEqual({});
    expect(storyboardContinuityVars({ continuityLinks: true }, 120)).toEqual({
      continuityLinks: true,
      continuityBudget: 2,
    });
  });

  it('gives both shots of a link their scene-build directive, others none', () => {
    const shots = [shot('s01', 0), shot('s02', 5, LINK), shot('s03', 10)];
    const [first, second, third] = shots;
    if (first === undefined || second === undefined || third === undefined) throw new Error();
    const outgoing = sceneContinuityVars(shots, first)['continuityDirective'] ?? '';
    expect(outgoing).toContain('hands over to s02 through a zoom-through link');
    expect(outgoing).toContain('"wall calendar" whole and unobstructed at x 0.72, y 0.34');
    expect(outgoing).toContain('up to 1.00 s past its end');
    const incoming = sceneContinuityVars(shots, second)['continuityDirective'] ?? '';
    expect(incoming).toContain('continues s01 through a zoom-through link: open framed on');
    expect(incoming).not.toContain('hands over');
    expect(sceneContinuityVars(shots, third)).toEqual({});
    expect(sceneContinuityVars([shot('a', 0), shot('b', 5)], first)).toEqual({});
  });

  it('reports planned vs rendered links in the final review', () => {
    const planned = [shot('s01', 0), shot('s02', 5, LINK), shot('s03', 10)];
    expect(continuityReviewNotes([shot('s01', 0), shot('s02', 5)], [])).toEqual([]);
    expect(continuityReviewNotes(planned, [])).toEqual([
      'continuity: 1 link planned, 0 rendered (not rendered: s01 -> s02)',
    ]);
    const wired = applyContinuityTransitions(planned).shots;
    expect(continuityReviewNotes(wired, [entry('s01', 'ok'), entry('s02', 'warning')])).toEqual([
      'continuity: 1 link planned, 1 rendered',
    ]);
    expect(continuityReviewNotes(wired, [entry('s01', 'failed')])).toEqual([
      'continuity: 1 link planned, 0 rendered (not rendered: s01 -> s02)',
    ]);
  });
});
