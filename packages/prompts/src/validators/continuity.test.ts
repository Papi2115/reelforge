import {
  applyContinuityTransitions,
  storyboardShotSchema,
  type ContinuityLink,
  type StoryboardShot,
} from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { checkContinuity } from './continuity.js';
import { checkStoryboard, validateStoryboard } from './storyboard.js';

interface Spec {
  readonly intent?: string;
  readonly continuity?: ContinuityLink;
  readonly style?: string;
}

/** Contiguous 5-s shots from 0 with the given links / transitions. */
function film(specs: readonly Spec[]): StoryboardShot[] {
  return specs.map((spec, index) => {
    const id = `s${String(index).padStart(2, '0')}`;
    return storyboardShotSchema.parse({
      id,
      t0: index * 5,
      t1: index * 5 + 5,
      treatment: index % 2 === 0 ? 'map' : 'metaphor-object',
      intent: spec.intent ?? 'the wall calendar of the office',
      scene: `scenes/${id}.js`,
      ...(spec.continuity === undefined ? {} : { continuity: spec.continuity }),
      ...(spec.style === undefined
        ? {}
        : { transitionIn: { type: 'crossfade', duration: 0.6, style: spec.style } }),
    });
  });
}

const LINK: ContinuityLink = { kind: 'zoom-through', object: 'wall calendar' };
const codes = (shots: readonly StoryboardShot[]): string[] =>
  checkContinuity(applyContinuityTransitions(shots).shots).map(
    (entry) => `${entry.severity}:${entry.code}`,
  );

/** `count` shots, links into the given indexes. */
function linkedAt(count: number, indexes: readonly number[]): StoryboardShot[] {
  return film(
    Array.from({ length: count }, (_, index) =>
      indexes.includes(index) ? { continuity: LINK } : {},
    ),
  );
}

describe('continuity link checks', () => {
  it('passes a storyboard without links and one well-placed link', () => {
    expect(codes(film([{}, {}, {}]))).toEqual([]);
    expect(codes(film([{}, { continuity: LINK }]))).toEqual([]);
  });

  it('rejects a link on the first shot', () => {
    expect(codes(film([{ continuity: LINK }, {}]))).toEqual(['error:continuity-first']);
  });

  it('rejects a continuity style without a link', () => {
    expect(codes(film([{}, { style: 'continuity-shared-object' }]))).toEqual([
      'error:continuity-style',
    ]);
  });

  it('warns when the object is not named in both intents', () => {
    const shots = film([{ intent: 'a desk' }, { continuity: LINK, intent: 'calendars of 1999' }]);
    expect(codes(shots)).toEqual(['warning:continuity-object']);
    expect(
      codes(
        film([
          { intent: 'ends on the wall calendar' },
          { continuity: LINK, intent: 'the calendars page' },
        ]),
      ),
    ).toEqual([]);
  });

  it('keeps links rare: spacing and budget', () => {
    // 20 shots = 100 s: budget 2; links at 10 s and 30 s are 20 s apart.
    expect(codes(linkedAt(20, [2, 6]))).toEqual(['warning:continuity-spacing']);
    expect(codes(linkedAt(20, [1, 10, 19]))).toEqual(['warning:continuity-budget']);
    expect(codes(linkedAt(20, [2, 12]))).toEqual([]);
  });
});

describe('continuity links in the storyboard validator', () => {
  it('checks linked shots with their continuity transition, not as unknown styles', () => {
    const shots = film([{}, { continuity: LINK, style: 'iris' }]);
    const issues = checkStoryboard({ version: 1, shots }).map((entry) => entry.code);
    expect(issues).not.toContain('transition-style');
    expect(issues).not.toContain('continuity-style');
  });

  it('reports a continuity style without its link and a link on the first shot', () => {
    const styled = checkStoryboard({
      version: 1,
      shots: film([{}, { style: 'continuity-zoom-through' }]),
    }).map((entry) => entry.code);
    expect(styled).toContain('continuity-style');
    expect(styled).not.toContain('transition-style');
    const text = JSON.stringify({ version: 1, shots: film([{ continuity: LINK }, {}]) });
    expect(validateStoryboard(text).issues.map((entry) => entry.code)).toContain(
      'continuity-first',
    );
  });

  it('does not count a link as an act change or in the transition density', () => {
    const shots = film([{}, { continuity: LINK }, {}]);
    const issues = checkStoryboard(
      { version: 1, shots },
      { lookMode: 'mixed', rules: { transitionEveryS: 1000 } },
    ).map((entry) => entry.code);
    expect(issues).not.toContain('act-change-roll');
    expect(issues).not.toContain('transition-density');
  });
});
