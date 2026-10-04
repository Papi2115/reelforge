import { storyboardFileSchema, type AnnotationPlan, type WordsFile } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { checkAnnotationPlans, phraseTimes } from './annotations.js';
import { validateStoryboard } from './storyboard.js';

/** "word1" … "word300", one every second from t = 0.5 (a 5-minute film). */
const WORDS: WordsFile = {
  version: 1,
  words: Array.from({ length: 300 }, (_, index) => ({
    text: `word${String(index + 1)}`,
    t: 0.5 + index,
    tEnd: 1.2 + index,
  })),
};

/** 6 s shots covering the words; plans are added per shot index. */
function shots(plans: Readonly<Record<number, readonly AnnotationPlan[]>>, count = 50) {
  return Array.from({ length: count }, (_, index) => ({
    id: `s${String(index + 1).padStart(2, '0')}`,
    t0: index * 6,
    t1: (index + 1) * 6,
    treatment: index % 2 === 0 ? ('title-card' as const) : ('metaphor-object' as const),
    intent: 'x',
    scene: `scenes/s${String(index + 1).padStart(2, '0')}.js`,
    ...(plans[index] === undefined ? {} : { annotations: [...(plans[index] ?? [])] }),
  }));
}

/** A plan on the word spoken at second `at` (word N is spoken at N - 0.5). */
function on(kind: AnnotationPlan['kind'], at: number, reason: AnnotationPlan['reason'] = 'place') {
  return { kind, phrase: `word${String(at + 1)}`, reason };
}

const codes = (planned: Readonly<Record<number, readonly AnnotationPlan[]>>): string[] =>
  checkAnnotationPlans(shots(planned), WORDS).map((entry) => `${entry.severity}:${entry.code}`);

describe('annotation plans', () => {
  it('keeps old storyboards valid and parses plans with every field', () => {
    const old = { version: 1, shots: shots({}, 1) };
    expect(storyboardFileSchema.safeParse(old).success).toBe(true);
    const plan = {
      kind: 'pin',
      phrase: 'word2',
      target: 'calculator',
      text: 'LCD',
      reason: 'name',
    };
    const planned = { version: 1, shots: [{ ...old.shots[0], annotations: [plan] }] };
    expect(storyboardFileSchema.parse(planned).shots[0]?.annotations).toEqual([plan]);
    const bad = { version: 1, shots: [{ ...old.shots[0], annotations: [{ ...plan, kind: 'x' }] }] };
    expect(storyboardFileSchema.safeParse(bad).success).toBe(false);
  });

  it('finds phrases by their normalized words', () => {
    const spoken = [
      { token: 'it', t: 1 },
      { token: 'has', t: 1.2 },
      { token: '61', t: 1.5 },
      { token: 'kb', t: 1.8 },
    ];
    expect(phraseTimes('61 KB!', spoken)).toEqual([1.5]);
    expect(phraseTimes('64 KB', spoken)).toEqual([]);
  });

  it('accepts a varied plan and requires phrases spoken inside the shot', () => {
    expect(
      codes({ 0: [on('pin', 1, 'name'), on('arrow', 4)], 1: [on('counter', 7, 'number')] }),
    ).toEqual([]);
    expect(codes({ 0: [{ kind: 'ring', phrase: 'never said', reason: 'emphasis' }] })).toEqual([
      'error:annotation-phrase-missing',
    ]);
    expect(codes({ 0: [on('ring', 10)] })).toEqual(['error:annotation-phrase-outside-shot']);
  });

  it('rejects the same form three times in a row within 20 s, not further apart', () => {
    const runs = (planned: Readonly<Record<number, readonly AnnotationPlan[]>>): string[] =>
      codes(planned).filter((code) => code.endsWith('annotation-run'));
    expect(runs({ 0: [on('arrow', 1), on('arrow', 4)], 1: [on('arrow', 8)] })).toEqual([
      'error:annotation-run',
    ]);
    expect(runs({ 0: [on('arrow', 1), on('arrow', 4)], 4: [on('arrow', 25)] })).toEqual([]);
    expect(runs({ 0: [on('arrow', 1), on('ring', 4)], 1: [on('arrow', 8)] })).toEqual([]);
  });

  it('does not count source chips as marks (PLAN.md#12.18), but checks their phrase', () => {
    const chips = Object.fromEntries(
      Array.from({ length: 9 }, (_, index) => [index, [on('source-chip', index * 6 + 1, 'claim')]]),
    );
    expect(codes(chips)).toEqual([]);
    expect(codes({ 0: [on('source-chip', 10, 'claim')] })).toEqual([
      'error:annotation-phrase-outside-shot',
    ]);
  });

  it('caps the marks per minute and asks for 3+ forms per busy minute of a long film', () => {
    const kinds = ['pin', 'arrow', 'ring'] as const;
    const busy = Object.fromEntries(
      Array.from({ length: 9 }, (_, index) => [
        index,
        [on(kinds[index % 3] ?? 'pin', index * 6 + 1)],
      ]),
    );
    expect(codes(busy)).toEqual(['error:annotation-density']);
    const monotone = {
      0: [on('pin', 1), on('arrow', 3)],
      2: [on('pin', 13)],
      4: [on('arrow', 25)],
    };
    expect(codes(monotone)).toEqual(['warning:annotation-variety']);
    const short = checkAnnotationPlans(shots(monotone, 15), WORDS);
    expect(short).toEqual([]);
  });

  it('runs inside validateStoryboard with the words', () => {
    const text = JSON.stringify({ version: 1, shots: shots({ 0: [on('ring', 8)] }, 2) });
    const report = validateStoryboard(text, {
      words: { version: 1, words: WORDS.words.slice(0, 12) },
    });
    expect(report.issues.map((entry) => entry.code)).toContain('annotation-phrase-outside-shot');
  });
});
