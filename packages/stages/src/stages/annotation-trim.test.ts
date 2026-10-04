/** Annotation trim (density / run rules): weakest unlocked marks go, deterministically. */
import {
  checkAnnotationPlans,
  type StoryboardOutput,
  type ValidationIssue,
} from '@reelforge/prompts';
import type { AnnotationPlan } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import {
  onlyAnnotationCountErrors,
  softenAnnotationCounts,
  trimAnnotations,
  trimWarning,
} from './annotation-trim.js';

/** One 5 s shot per plan list; without words a mark sits at its shot's start. */
function storyboardOf(plans: readonly (readonly AnnotationPlan[])[]): StoryboardOutput {
  return {
    version: 1,
    shots: plans.map((annotations, index) => {
      const id = `s${String(index + 1).padStart(2, '0')}`;
      return {
        id,
        t0: index * 5,
        t1: index * 5 + 5,
        treatment: index % 2 === 0 ? 'title-card' : 'kinetic-text',
        intent: 'test',
        scene: `scenes/${id}.js`,
        annotations: [...annotations],
      };
    }),
  };
}

const mark = (kind: AnnotationPlan['kind'], reason: AnnotationPlan['reason']): AnnotationPlan => ({
  kind,
  phrase: 'phrase',
  reason,
});

/** Ten marks in 50 s (max 8 per minute), no form three times in a row. */
const BUSY: readonly (readonly AnnotationPlan[])[] = [
  [mark('counter', 'number')],
  [mark('ring', 'emphasis')],
  [mark('pin', 'name')],
  [mark('callout', 'definition')],
  [mark('highlight', 'emphasis')],
  [mark('bracket', 'comparison')],
  [mark('arrow', 'place')],
  [mark('callout', 'claim')],
  [mark('big-text', 'emphasis')],
  [mark('counter', 'number')],
];

const errors = (storyboard: StoryboardOutput): ValidationIssue[] =>
  checkAnnotationPlans(storyboard.shots, undefined).filter((entry) => entry.severity === 'error');

describe('trimAnnotations', () => {
  it('drops the weakest marks until a minute holds at most 8, decorative emphasis first', () => {
    const input = storyboardOf(BUSY);
    expect(errors(input).map((entry) => entry.code)).toEqual(['annotation-density']);
    const trimmed = trimAnnotations(input, undefined, new Set());
    expect(trimmed.removed).toEqual(['s02', 's05']);
    expect(errors(trimmed.storyboard)).toEqual([]);
    expect(trimmed.storyboard.shots.map((shot) => shot.annotations?.length)).toEqual([
      1, 0, 1, 1, 0, 1, 1, 1, 1, 1,
    ]);
    // Nothing else of the storyboard changes.
    const withoutPlans = (storyboard: StoryboardOutput): StoryboardOutput => ({
      ...storyboard,
      shots: storyboard.shots.map((shot) => ({ ...shot, annotations: [] })),
    });
    expect(withoutPlans(trimmed.storyboard)).toEqual(withoutPlans(input));
  });

  it('is deterministic: the same input gives the same output', () => {
    const first = trimAnnotations(storyboardOf(BUSY), undefined, new Set());
    const second = trimAnnotations(storyboardOf(BUSY), undefined, new Set());
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it('never touches a locked shot', () => {
    const trimmed = trimAnnotations(storyboardOf(BUSY), undefined, new Set(['s02', 's05']));
    expect(trimmed.removed).toEqual(['s07', 's09']);
    expect(trimmed.storyboard.shots[1]?.annotations).toHaveLength(1);
    expect(trimmed.storyboard.shots[4]?.annotations).toHaveLength(1);
    expect(errors(trimmed.storyboard)).toEqual([]);
  });

  it('leaves the violation when only locked shots or lone claims could give a mark', () => {
    const claims = storyboardOf(
      BUSY.map(() => [mark('callout', 'claim')]).map((plans, index) =>
        index % 2 === 0 ? plans : [mark('pin', 'claim')],
      ),
    );
    const trimmed = trimAnnotations(claims, undefined, new Set());
    expect(trimmed.removed).toEqual([]);
    expect(trimmed.storyboard).toBe(claims);
    const locked = new Set(BUSY.map((_plans, index) => `s${String(index + 1).padStart(2, '0')}`));
    expect(trimAnnotations(storyboardOf(BUSY), undefined, locked).removed).toEqual([]);
  });

  it('breaks a run of one form by dropping its weakest mark', () => {
    const run = storyboardOf([
      [mark('pin', 'name')],
      [mark('pin', 'place')],
      [mark('pin', 'name')],
    ]);
    expect(errors(run).map((entry) => entry.code)).toEqual(['annotation-run']);
    const trimmed = trimAnnotations(run, undefined, new Set());
    expect(trimmed.removed).toEqual(['s02']);
    expect(errors(trimmed.storyboard)).toEqual([]);
  });
});

describe('annotation count errors', () => {
  const density: ValidationIssue = {
    severity: 'error',
    code: 'annotation-density',
    message: 'too many',
  };
  const other: ValidationIssue = { severity: 'error', code: 'treatment-run', message: 'run' };

  it('are recognised only when no other error is left', () => {
    expect(onlyAnnotationCountErrors([density])).toBe(true);
    expect(onlyAnnotationCountErrors([density, other])).toBe(false);
    expect(onlyAnnotationCountErrors([])).toBe(false);
  });

  it('soften to warnings, other errors stay', () => {
    expect(softenAnnotationCounts([density, other]).map((entry) => entry.severity)).toEqual([
      'warning',
      'error',
    ]);
  });

  it('are reported as one trim warning', () => {
    expect(trimWarning(['s02', 's05'])).toBe(
      'Trimmed 2 annotations to fit the density rules (s02, s05)',
    );
    expect(trimWarning(['s02'])).toBe('Trimmed 1 annotation to fit the density rules (s02)');
  });
});
