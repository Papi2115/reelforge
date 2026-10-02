import type { Treatment, WordsFile } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { validateStoryboard, type StoryboardCheckOptions } from './storyboard.js';

/** Words every 0.5 s from 0.5 s: "w1"@0.5–0.9, "w2"@1.0–1.4, … up to 20 s. */
const WORDS: WordsFile = {
  version: 1,
  words: Array.from({ length: 40 }, (_, index) => ({
    text: `w${String(index + 1)}`,
    t: 0.5 + index * 0.5,
    tEnd: 0.9 + index * 0.5,
  })),
};
const LAST_END = 0.9 + 39 * 0.5; // 20.4

interface ShotSpec {
  readonly t0: number;
  readonly t1: number;
  readonly treatment?: Treatment;
  readonly extra?: Record<string, unknown>;
}

function storyboard(specs: readonly ShotSpec[], top: Record<string, unknown> = {}): string {
  const shots = specs.map((spec, index) => {
    const id = `s${String(index + 1).padStart(2, '0')}`;
    return {
      id,
      t0: spec.t0,
      t1: spec.t1,
      treatment: spec.treatment ?? (index % 2 === 0 ? 'title-card' : 'metaphor-object'),
      intent: `Shot ${id}`,
      scene: `scenes/${id}.js`,
      ...spec.extra,
    };
  });
  return JSON.stringify({ version: 1, shots, ...top });
}

const GOOD: ShotSpec[] = [
  { t0: 0, t1: 4.5 },
  { t0: 4.5, t1: 10 },
  { t0: 10, t1: 15.5 },
  { t0: 15.5, t1: LAST_END + 0.5 },
];

const codes = (text: string, options: StoryboardCheckOptions = { words: WORDS }): string[] =>
  validateStoryboard(text, options).issues.map((entry) => entry.code);

describe('validateStoryboard', () => {
  it('accepts a contiguous storyboard on word starts (with missingProps)', () => {
    const result = validateStoryboard(storyboard(GOOD, { missingProps: ['calculator'] }), {
      words: WORDS,
    });
    expect(result.issues).toEqual([]);
    expect(result.valid).toBe(true);
    expect(result.value?.missingProps).toEqual(['calculator']);
  });

  it('rejects the same treatment three times in a row, allows two', () => {
    const three = GOOD.map(
      (spec, index) => ({ ...spec, treatment: index < 3 ? 'map' : 'ui-mockup' }) as const,
    );
    const result = validateStoryboard(storyboard(three), { words: WORDS });
    expect(result.valid).toBe(false);
    expect(result.issues).toEqual([
      expect.objectContaining({ code: 'treatment-run', path: 'shots[2].treatment' }),
    ]);
    const two = GOOD.map(
      (spec, index) => ({ ...spec, treatment: index < 2 ? 'map' : 'ui-mockup' }) as const,
    );
    expect(codes(storyboard(two))).toEqual([]);
  });

  it('rejects non-contiguous shots (gap or overlap) and a late start', () => {
    const gap = [GOOD[0], { t0: 5, t1: 10 }, ...GOOD.slice(2)] as ShotSpec[];
    expect(codes(storyboard(gap))).toContain('not-contiguous');
    const overlap = [GOOD[0], { t0: 4, t1: 10 }, ...GOOD.slice(2)] as ShotSpec[];
    expect(codes(storyboard(overlap))).toContain('not-contiguous');
    const late = [{ t0: 0.5, t1: 4.5 }, ...GOOD.slice(1)];
    expect(codes(storyboard(late))).toContain('not-from-zero');
  });

  it('rejects boundaries mid-word or off any word start', () => {
    const midWord = [{ t0: 0, t1: 4.7 }, { t0: 4.7, t1: 10 }, ...GOOD.slice(2)];
    const result = validateStoryboard(storyboard(midWord), { words: WORDS });
    expect(result.issues[0]).toMatchObject({ code: 'boundary-not-on-word', path: 'shots[0].t1' });
    expect(result.issues[0]?.message).toContain('mid-word ("w9")');
    const inGap = [{ t0: 0, t1: 4.93 }, { t0: 4.93, t1: 10 }, ...GOOD.slice(2)];
    expect(codes(storyboard(inGap))).toEqual(['boundary-not-on-word']);
    expect(codes(storyboard(midWord), {})).toEqual([]);
  });

  it('checks the end against the last word', () => {
    const short = [...GOOD.slice(0, 3), { t0: 15.5, t1: 19.5 }];
    expect(codes(storyboard(short))).toContain('end-mismatch');
    const long = [...GOOD.slice(0, 3), { t0: 15.5, t1: LAST_END + 2 }];
    expect(codes(storyboard(long))).toContain('end-mismatch');
  });

  it('enforces shot lengths: hard limits error, typical range warns', () => {
    const tooShort = [{ t0: 0, t1: 0.5 }, { t0: 0.5, t1: 4.5 }, ...GOOD.slice(1)];
    expect(validateStoryboard(storyboard(tooShort)).issues).toContainEqual(
      expect.objectContaining({ code: 'shot-length', severity: 'error' }),
    );
    const tooLong = [{ t0: 0, t1: 10.5 }, { t0: 10.5, t1: 15.5 }, GOOD[3]] as ShotSpec[];
    expect(validateStoryboard(storyboard(tooLong)).valid).toBe(false);
    const short = [{ t0: 0, t1: 2 }, { t0: 2, t1: 4.5 }, ...GOOD.slice(1)];
    const result = validateStoryboard(storyboard(short), { words: WORDS });
    expect(result.valid).toBe(true);
    expect(result.issues.map((entry) => entry.severity)).toEqual(['warning', 'warning']);
  });

  it('checks ids, scene paths and transitions', () => {
    const text = JSON.stringify({
      version: 1,
      shots: [
        {
          id: 's01',
          t0: 0,
          t1: 5,
          treatment: 'map',
          intent: 'a',
          scene: 'scenes/s01.js',
          transitionIn: { type: 'wipe', duration: 0.3 },
        },
        {
          id: 's01',
          t0: 5,
          t1: 10,
          treatment: 'map',
          intent: 'b',
          scene: 'scenes/other.js',
          transitionIn: { type: 'crossfade', duration: 1.5 },
        },
        { id: 's03', t0: 10, t1: 15, treatment: 'ui-mockup', intent: 'c', scene: 'src/s03.ts' },
      ],
    });
    const issues = validateStoryboard(text).issues.map(
      (entry) => `${entry.severity}:${entry.code}`,
    );
    expect(issues).toEqual(
      expect.arrayContaining([
        'error:duplicate-id',
        'warning:scene-path',
        'error:scene-path',
        'error:first-transition',
        'warning:transition-duration',
      ]),
    );
  });

  it('reports schema errors and invalid JSON without a value', () => {
    const bad = validateStoryboard(
      JSON.stringify({ version: 1, shots: [{ id: 'S 1', t0: 0, t1: 1 }] }),
    );
    expect(bad.valid).toBe(false);
    expect(bad.value).toBeUndefined();
    expect(bad.issues.every((entry) => entry.code === 'schema')).toBe(true);
    expect(bad.issues.map((entry) => entry.path)).toContain('shots[0].id');
    expect(validateStoryboard('{ nope').issues[0]?.code).toBe('invalid-json');
  });
});
