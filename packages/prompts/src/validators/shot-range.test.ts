import type { ShotsPerMinute, WordsFile } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { endsSentence, sentencesOf } from './shot-range.js';
import { validateStoryboard, type StoryboardCheckOptions } from './storyboard.js';

/**
 * 120 s of narration, a word every 0.5 s: seven 8 s sentences (0–56 s), one 16 s sentence with a
 * comma after its 16th word (56–72 s, "w128," ends at 63.9 s), six 8 s sentences (72–120 s).
 */
function narration(punctuated = true): WordsFile {
  const ends = new Set<number>();
  for (let index = 15; index < 112; index += 16) ends.add(index);
  ends.add(143);
  for (let index = 159; index < 240; index += 16) ends.add(index);
  return {
    version: 1,
    words: Array.from({ length: 240 }, (_, index) => {
      const mark = !punctuated ? '' : ends.has(index) ? '.' : index === 127 ? ',' : '';
      return { text: `w${String(index + 1)}${mark}`, t: index * 0.5, tEnd: index * 0.5 + 0.4 };
    }),
  };
}
const WORDS = narration();
const END = 120.2;
/** Sentence starts: every 8 s, except inside the long sentence (56–72 s). */
const SENTENCE_CUTS = [0, 8, 16, 24, 32, 40, 48, 56, 72, 80, 88, 96, 104, 112, END];
const BALANCED: ShotsPerMinute = { min: 5, max: 8 };

interface ShotSpec {
  readonly t0: number;
  readonly t1: number;
  readonly extra?: Record<string, unknown>;
}

function cutsToSpecs(cuts: readonly number[]): ShotSpec[] {
  return cuts.slice(0, -1).map((t0, index) => ({ t0, t1: cuts[index + 1] ?? END }));
}

function storyboard(specs: readonly ShotSpec[]): string {
  const treatments = ['title-card', 'metaphor-object', 'map'] as const;
  const shots = specs.map((spec, index) => {
    const id = `s${String(index + 1).padStart(2, '0')}`;
    return {
      id,
      t0: spec.t0,
      t1: spec.t1,
      treatment: treatments[index % 3],
      intent: `Shot ${id}`,
      scene: `scenes/${id}.js`,
      ...spec.extra,
    };
  });
  return JSON.stringify({ version: 1, shots });
}

function check(specs: readonly ShotSpec[], options: StoryboardCheckOptions = {}, withWords = true) {
  return validateStoryboard(storyboard(specs), {
    ...(withWords ? { words: WORDS } : {}),
    shotsPerMinute: BALANCED,
    ...options,
  }).issues;
}

const errorCodes = (issues: ReturnType<typeof check>): string[] =>
  issues.filter((entry) => entry.severity === 'error').map((entry) => entry.code);

/** The good storyboard with the shot at `index` split at `t` (extra fields on the second half). */
function splitAt(index: number, t: number, extra: Record<string, unknown> = {}): ShotSpec[] {
  const specs = cutsToSpecs(SENTENCE_CUTS);
  const shot = specs[index];
  if (shot === undefined) throw new Error('no shot');
  return [
    ...specs.slice(0, index),
    { t0: shot.t0, t1: t },
    { t0: t, t1: shot.t1, extra },
    ...specs.slice(index + 1),
  ];
}

describe('sentences', () => {
  it('end on . ! ? … (also before a closing quote) and on the last word', () => {
    expect(endsSentence({ text: 'Moon.' })).toBe(true);
    expect(endsSentence({ text: 'why?”' })).toBe(true);
    expect(endsSentence({ text: 'wait…' })).toBe(true);
    expect(endsSentence({ text: '3.5' })).toBe(false);
    expect(endsSentence({ text: 'first,' })).toBe(false);
    const sentences = sentencesOf(WORDS.words);
    expect(sentences).toHaveLength(14);
    expect(sentences[7]).toEqual({ first: 112, last: 143, t0: 56, t1: 71.9 });
  });
});

describe('storyboard with a shots-per-minute range (ADR-027)', () => {
  it('accepts one shot per sentence inside the range', () => {
    const issues = check(cutsToSpecs(SENTENCE_CUTS));
    expect(errorCodes(issues)).toEqual([]);
  });

  it('flags a cut inside a short sentence and hints the merge', () => {
    const issues = check(splitAt(0, 4));
    expect(errorCodes(issues)).toEqual(['cut-mid-sentence']);
    const message = issues.find((entry) => entry.code === 'cut-mid-sentence')?.message ?? '';
    expect(message).toContain('s01 → s02 cuts at 4.00 s inside the sentence "w1 w2 w3 w4 w5');
    expect(message).toContain('merge them into one shot with progressive reveals');
    expect(message).toContain('move the cut to a sentence start (8.00 s)');
    expect(issues.find((entry) => entry.code === 'cut-mid-sentence')?.path).toBe('shots[0].t1');
  });

  it('allows a long sentence to be cut on a clause boundary or as a continued shot', () => {
    // The long sentence is shot 7 (56–72 s); "w128," ends the clause, w129 starts at 64 s.
    expect(errorCodes(check(splitAt(7, 64)))).toEqual([]);
    const notClause = check(splitAt(7, 60));
    expect(errorCodes(notClause)).toEqual(['cut-mid-sentence']);
    const notClauseError = notClause.find((entry) => entry.code === 'cut-mid-sentence');
    expect(notClauseError?.message).toContain('"continues": true');
    expect(errorCodes(check(splitAt(7, 60, { continues: true })))).toEqual([]);
    const otherLook = check(splitAt(7, 60, { continues: true, look: 'retro-ui' }));
    expect(errorCodes(otherLook)).toEqual(['cut-mid-sentence']);
  });

  it('does not check cuts in narration without sentence punctuation', () => {
    const issues = check(splitAt(0, 4), { words: narration(false) });
    expect(errorCodes(issues)).toEqual([]);
  });

  it('errors when the film average is outside the range ±10 %', () => {
    const many = Array.from({ length: 30 }, (_, index) => index * 4);
    const fast = check(cutsToSpecs([...many, END]), {}, false);
    expect(errorCodes(fast)).toContain('shots-per-minute');
    expect(fast.find((entry) => entry.code === 'shots-per-minute')?.message).toContain(
      '30 shots for 2:00 = 15.0 per minute; this project wants 5–8 per minute (10–16 shots): merge neighbouring shots',
    );
    const few = check(cutsToSpecs([0, 16, 32, 48, 72, 96, END]), {}, false);
    expect(few.find((entry) => entry.code === 'shots-per-minute')?.message).toContain(
      '6 shots for 2:00 = 3.0 per minute',
    );
    // 17 shots = 8.5/min: above 8 but inside max x 1.1.
    const seventeen = Array.from({ length: 17 }, (_, index) => index * 7);
    const edge = check(cutsToSpecs([...seventeen, END]), {}, false);
    expect(errorCodes(edge)).not.toContain('shots-per-minute');
  });

  it('warns about a minute far outside the range', () => {
    const fastStart = Array.from({ length: 12 }, (_, index) => index * 5);
    const issues = check(cutsToSpecs([...fastStart, 78, 96, END]), {}, false);
    expect(errorCodes(issues)).not.toContain('shots-per-minute');
    const warnings = issues.filter(
      (entry) => entry.code === 'shots-per-minute' && entry.severity === 'warning',
    );
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]?.message).toContain('0:00–1:00 cuts much faster than the range');
  });

  it('derives the shot length limits from the range', () => {
    // 16 s is fine for 5–8 per minute (max 18 s), an error without a range (max 10 s).
    const specs = cutsToSpecs(SENTENCE_CUTS);
    expect(errorCodes(check(specs))).not.toContain('shot-length');
    const standard = validateStoryboard(storyboard(specs), { words: WORDS }).issues;
    expect(errorCodes(standard)).toContain('shot-length');
    expect(errorCodes(standard)).not.toContain('cut-mid-sentence');
  });

  it('runs none of the range checks without a range', () => {
    const issues = validateStoryboard(storyboard(splitAt(0, 4)), { words: WORDS }).issues;
    expect(issues.map((entry) => entry.code)).not.toContain('cut-mid-sentence');
    expect(issues.map((entry) => entry.code)).not.toContain('shots-per-minute');
  });

  it('lets a continued shot keep the pattern past the window in mixed looks', () => {
    const mixed = { lookMode: 'mixed', looks: ['voxel', 'retro-ui'] } as const;
    const same = { roll: 'A', look: 'voxel', treatment: 'map' };
    const specs = splitAt(7, 60).map((spec, index) =>
      index === 7 || index === 8 ? { ...spec, extra: { ...spec.extra, ...same } } : spec,
    );
    const codes = (list: ShotSpec[]): string[] => check(list, mixed).map((entry) => entry.code);
    expect(codes(specs)).toContain('pattern-run');
    const continued = specs.map((spec, index) =>
      index === 8 ? { ...spec, extra: { ...spec.extra, continues: true } } : spec,
    );
    expect(codes(continued)).not.toContain('pattern-run');
  });
});
