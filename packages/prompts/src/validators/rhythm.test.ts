import type { Roll, StoryboardShot, Transition, Treatment } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { DEFAULT_LOOK_RHYTHM_RULES } from './rhythm.js';
import {
  checkStoryboard,
  DEFAULT_STORYBOARD_RULES,
  type StoryboardCheckOptions,
} from './storyboard.js';

interface Spec {
  readonly roll?: Roll;
  readonly look?: string;
  readonly treatment?: Treatment;
  /** Seconds (default 4). */
  readonly length?: number;
  readonly transitionIn?: Transition;
}

const TREATMENTS: readonly Treatment[] = ['title-card', 'metaphor-object', 'map'];

function shots(specs: readonly Spec[]): StoryboardShot[] {
  let t = 0;
  return specs.map((spec, index) => {
    const id = `s${String(index + 1).padStart(2, '0')}`;
    const t0 = t;
    t += spec.length ?? 4;
    return {
      id,
      t0,
      t1: t,
      treatment: spec.treatment ?? TREATMENTS[index % TREATMENTS.length] ?? 'map',
      intent: `Shot ${id}`,
      scene: `scenes/${id}.js`,
      ...(spec.roll === undefined ? {} : { roll: spec.roll }),
      ...(spec.look === undefined ? {} : { look: spec.look }),
      ...(spec.transitionIn === undefined ? {} : { transitionIn: spec.transitionIn }),
    };
  });
}

const RHYTHM_CODES = new Set([
  'unknown-look',
  'missing-roll',
  'roll-a-gap',
  'look-run',
  'pattern-run',
  'act-change-roll',
]);

const MIXED: StoryboardCheckOptions = { lookMode: 'mixed' };
/** `test-look` exists only in tests: it stands for the 2.0 looks to exercise multi-look rules. */
const TWO_LOOKS: StoryboardCheckOptions = { lookMode: 'mixed', looks: ['voxel', 'test-look'] };

function rhythm(specs: readonly Spec[], options: StoryboardCheckOptions): string[] {
  return checkStoryboard({ version: 1, shots: shots(specs) }, options)
    .filter((entry) => RHYTHM_CODES.has(entry.code))
    .map((entry) => `${entry.severity}:${entry.code}@${entry.path ?? ''}`);
}

const B = { roll: 'B', look: 'test-look' } as const;
const A = { roll: 'A' } as const;

describe('look rhythm rules', () => {
  it('are on only in mixed mode (voxel-only and absent behave as before 2.0)', () => {
    const wild: Spec[] = Array.from({ length: 8 }, () => ({ roll: 'C', look: 'nowhere' }));
    expect(rhythm(wild, {})).toEqual([]);
    expect(rhythm(wild, { lookMode: 'voxel-only', looks: ['voxel', 'test-look'] })).toEqual([]);
    expect(rhythm(wild, MIXED)).toContain('error:unknown-look@shots[0].look');
    expect(DEFAULT_STORYBOARD_RULES).toMatchObject(DEFAULT_LOOK_RHYTHM_RULES);
  });

  it('with voxel as the only look: rolls are optional, an untagged voxel shot is an A-roll', () => {
    expect(
      rhythm(
        Array.from({ length: 12 }, () => ({})),
        MIXED,
      ),
    ).toEqual([]);
    const sixC: Spec[] = [A, ...Array.from({ length: 6 }, () => ({ roll: 'C' as const })), {}];
    expect(rhythm(sixC, MIXED)).toEqual(['error:roll-a-gap@shots[6].roll']);
    const fiveC: Spec[] = [...Array.from({ length: 5 }, () => ({ roll: 'C' as const })), {}];
    expect(rhythm(fiveC, MIXED)).toEqual([]);
    expect(rhythm([A, { roll: 'B', look: 'retro-ui' }], MIXED)).toEqual([
      'error:unknown-look@shots[1].look',
    ]);
  });

  it('with two looks: every shot needs a roll', () => {
    expect(rhythm([A, { look: 'test-look' }, { roll: 'C' }], TWO_LOOKS)).toEqual([
      'error:missing-roll@shots[1].roll',
    ]);
  });

  it('limits one look to 3 shots in a row, A-roll voxel to 4', () => {
    expect(rhythm([A, B, B, B, A], TWO_LOOKS)).toEqual([]);
    expect(rhythm([A, B, B, B, B, A], TWO_LOOKS)).toEqual(['error:look-run@shots[4].look']);
    expect(rhythm([A, A, A, A, B], TWO_LOOKS)).toEqual([]);
    expect(rhythm([A, A, A, A, A, B], TWO_LOOKS)).toEqual(['error:look-run@shots[4].look']);
    expect(rhythm([A, A, { roll: 'C' }, A, B], TWO_LOOKS)).toEqual([
      'error:look-run@shots[3].look',
    ]);
    expect(rhythm([A, B, B, B, B], { ...TWO_LOOKS, rules: { maxLookRun: 4 } })).toEqual([]);
  });

  it('wants an A-roll at least every 6 shots', () => {
    const away: Spec[] = [A, B, B, { roll: 'C' }, B, B, { roll: 'C' }, A];
    expect(rhythm(away, TWO_LOOKS)).toContain('error:roll-a-gap@shots[6].roll');
  });

  it('changes the pattern (roll + look + treatment) at least every 8 s', () => {
    const same = { ...A, treatment: 'map' } as const;
    expect(rhythm([{ ...same, length: 4 }, { ...same, length: 4 }, B], TWO_LOOKS)).toEqual([]);
    expect(rhythm([{ ...same, length: 5 }, { ...same, length: 4 }, B], TWO_LOOKS)).toEqual([
      'error:pattern-run@shots[1].treatment',
    ]);
    // One long shot is the shot-length rules' business, not a pattern run.
    expect(rhythm([{ ...same, length: 9 }, B], TWO_LOOKS)).toEqual([]);
  });

  it('warns when an act change (non-cut transition) is not a C-roll', () => {
    const wipe: Transition = { type: 'wipe', duration: 0.3 };
    expect(rhythm([A, { ...A, transitionIn: wipe }, B], TWO_LOOKS)).toEqual([
      'warning:act-change-roll@shots[1].roll',
    ]);
    expect(rhythm([A, { roll: 'C', transitionIn: wipe }, B], TWO_LOOKS)).toEqual([]);
  });
});
