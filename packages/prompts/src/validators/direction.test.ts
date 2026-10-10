/**
 * The direction plan rules (PLAN.md#14.16): a plan that follows every rule passes; each broken
 * rule gives its error code; the fallback plan is valid for any narration of three or more words.
 */
import type { DirectionFile, WordsFile } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { fallbackDirection, fallbackTitle } from '../worlds/c-cam-direction-fallback.js';
import { checkDirection, DIRECTION_RULES, validateDirection } from './direction.js';
import { goodPlan, PLAN_DURATION_S, PLAN_SCRIPT } from './direction-fixture.js';

const OPTIONS = {
  durationS: PLAN_DURATION_S,
  gagKinds: ['yawn', 'sweat', 'gum'],
  script: PLAN_SCRIPT,
};

function codes(plan: DirectionFile): string[] {
  return checkDirection(plan, OPTIONS)
    .filter((entry) => entry.severity === 'error')
    .map((entry) => entry.code);
}

function broken(edit: (plan: DirectionFile) => DirectionFile): string[] {
  return codes(edit(goodPlan()));
}

const beat = (plan: DirectionFile, index: number): DirectionFile['beats'][number] => {
  const found = plan.beats[index];
  if (found === undefined) throw new Error(`no beat ${String(index)}`);
  return found;
};

describe('direction plan rules', () => {
  it('pass a plan that follows them', () => {
    expect(checkDirection(goodPlan(), OPTIONS)).toEqual([]);
    const report = validateDirection(`Here it is:\n${JSON.stringify(goodPlan())}`, OPTIONS);
    expect(report.valid).toBe(true);
    expect(report.issues.map((entry) => entry.code)).toEqual(['embedded-json']);
  });

  it('refuse a reply that is not a plan', () => {
    expect(validateDirection('no plan today', OPTIONS).valid).toBe(false);
    const missing = validateDirection(
      JSON.stringify({ ...goodPlan(), titleFrame: undefined }),
      OPTIONS,
    );
    expect(missing.issues.map((entry) => entry.code)).toContain('schema');
  });

  it('want the payoff in the last 30 % after a setup and an escalation', () => {
    expect(
      broken((plan) => {
        const [warden, inmate] = plan.cast;
        if (warden === undefined || inmate === undefined) throw new Error('cast');
        const arc = { ...warden.signatureGag.arc, payoff: 'b02', escalations: [] };
        return {
          ...plan,
          cast: [{ ...warden, signatureGag: { ...warden.signatureGag, arc } }, inmate],
        };
      }),
    ).toEqual(expect.arrayContaining(['direction-gag-arc', 'direction-payoff-early']));
    const early = (plan: DirectionFile): DirectionFile => {
      const inmate = plan.cast[1];
      if (inmate === undefined) throw new Error('cast');
      const arc = { ...inmate.signatureGag.arc, escalations: ['b03'], payoff: 'b04' };
      const beats = plan.beats.map((entry) =>
        entry.id === 'b03' ? { ...entry, gagRefs: ['warden', 'inmate'] } : entry,
      );
      return {
        ...plan,
        beats,
        cast: [
          plan.cast[0] ?? inmate,
          { ...inmate, signatureGag: { ...inmate.signatureGag, arc } },
        ],
      };
    };
    expect(broken(early)).toEqual(['direction-payoff-early']);
  });

  it('check gag kinds and that the arc beats play the gag', () => {
    expect(
      broken((plan) => ({
        ...plan,
        cast: plan.cast.map((person) => ({
          ...person,
          signatureGag: { ...person.signatureGag, kind: 'juggle' },
        })),
      })),
    ).toEqual(['direction-gag-kind', 'direction-gag-kind']);
    expect(
      broken((plan) => ({
        ...plan,
        beats: plan.beats.map((entry) => ({ ...entry, gagRefs: [] })),
      })),
    ).toEqual(Array.from({ length: 6 }, () => 'direction-gag-arc'));
  });

  it('want an accident and a climax ECU', () => {
    expect(broken((plan) => ({ ...plan, accidents: [] }))).toEqual(['direction-accident']);
    expect(broken((plan) => ({ ...plan, accidents: ['b02'] }))).toEqual([
      'direction-accident',
      'direction-accident',
    ]);
    expect(broken((plan) => ({ ...plan, climax: { ...plan.climax, beatRef: 'b02' } }))).toEqual([
      'direction-climax',
    ]);
  });

  it('enforce 2-5 framings, a why on every close-up and no repeated sequence', () => {
    const one = (plan: DirectionFile): DirectionFile => ({
      ...plan,
      beats: plan.beats.map((entry, index) =>
        index === 1
          ? {
              ...entry,
              camera: {
                progression: [
                  beat(plan, 1).camera.progression[0] ?? { framing: 'wide', subject: 'x' },
                ],
              },
            }
          : entry,
      ),
    });
    expect(broken(one)).toEqual(['direction-framings']);
    const why = (plan: DirectionFile): DirectionFile => ({
      ...plan,
      beats: plan.beats.map((entry, index) =>
        index === 1
          ? {
              ...entry,
              camera: {
                progression: [
                  { framing: 'wide', subject: 'a' },
                  { framing: 'close', subject: 'b' },
                ],
              },
            }
          : entry,
      ),
    });
    expect(broken(why)).toEqual(['direction-why']);
    const repeat = (plan: DirectionFile): DirectionFile => ({
      ...plan,
      beats: plan.beats.map((entry, index) =>
        index === 1 ? { ...entry, camera: beat(plan, 0).camera } : entry,
      ),
    });
    expect(broken(repeat)).toEqual(['direction-repeat']);
    const allWide = (plan: DirectionFile): DirectionFile => ({
      ...plan,
      beats: plan.beats.map((entry, index) => ({
        ...entry,
        camera: {
          progression:
            index % 2 === 0
              ? [
                  { framing: 'wide', subject: 'a' },
                  { framing: 'medium', subject: 'b' },
                ]
              : [
                  { framing: 'medium', subject: 'a' },
                  { framing: 'wide', subject: 'b' },
                ],
        },
      })),
    });
    expect(broken(allWide)).toEqual(['direction-all-wide', 'direction-climax']);
  });

  it('check spans, ids and the title frame', () => {
    expect(
      broken((plan) => ({
        ...plan,
        beats: plan.beats.map((entry, index) =>
          index === 5 ? { ...entry, span: { ...entry.span, t1: 40 } } : entry,
        ),
      })),
    ).toEqual(['direction-span']);
    expect(broken((plan) => ({ ...plan, motifs: [...plan.motifs, ...plan.motifs] }))).toEqual([
      'direction-duplicate-id',
    ]);
    expect(
      broken((plan) => ({
        ...plan,
        titleFrame: {
          ...plan.titleFrame,
          title: 'Nobody in the whole prison had the key',
          cast: ['warden', 'ghost'],
        },
      })),
    ).toEqual(['direction-title', 'direction-title', 'direction-title']);
  });

  it('warn about quotes that are not in the script', () => {
    const plan = goodPlan();
    const quoted = {
      ...plan,
      beats: plan.beats.map((entry, index) =>
        index === 0
          ? { ...entry, span: { ...entry.span, text: 'Prisons were invented in 1066.' } }
          : entry,
      ),
    };
    const issues = checkDirection(quoted, OPTIONS);
    expect(issues.map((entry) => [entry.severity, entry.code])).toEqual([
      ['warning', 'direction-quote'],
    ]);
  });
});

function narration(sentences: readonly (readonly string[])[], wordS = 0.4): WordsFile {
  let t = 0;
  const words = sentences.flatMap((sentence) =>
    sentence.map((text, index) => {
      const word = {
        text: index === sentence.length - 1 ? `${text}.` : text,
        t,
        tEnd: t + wordS * 0.9,
      };
      t += wordS;
      return word;
    }),
  );
  return { version: 1, words };
}

describe('the fallback plan', () => {
  const kinds = ['gum', 'sweat', 'fidget'];
  const cases: readonly [string, WordsFile][] = [
    [
      'three short sentences',
      narration([
        ['one', 'two'],
        ['three', 'four'],
        ['five', 'six'],
      ]),
    ],
    [
      'one long sentence',
      narration([Array.from({ length: 60 }, (_, index) => `w${String(index)}`)]),
    ],
    [
      'a long last sentence',
      narration([
        ['a', 'b'],
        ['c', 'd'],
        Array.from({ length: 30 }, (_, index) => `x${String(index)}`),
      ]),
    ],
    [
      'many sentences',
      narration(Array.from({ length: 30 }, (_, index) => ['the', 'thing', `n${String(index)}`])),
    ],
  ];

  it.each(cases)('is valid for %s', (_, words) => {
    const plan = fallbackDirection({ words, script: 'One two. Three four.', gagKinds: kinds });
    if (plan === undefined) throw new Error('no plan');
    const durationS = words.words.at(-1)?.tEnd ?? 0;
    const errors = checkDirection(plan, { durationS, gagKinds: kinds }).filter(
      (entry) => entry.severity === 'error',
    );
    expect(errors).toEqual([]);
    expect(plan.source).toBe('fallback');
    expect(plan.cast[0]?.signatureGag.kind).toBe('fidget');
    expect(fallbackDirection({ words, script: 'x', gagKinds: kinds })).toEqual({
      ...plan,
      titleFrame: { ...plan.titleFrame, title: 'x' },
    });
  });

  it('gives up below three words and titles from the first sentence', () => {
    expect(
      fallbackDirection({ words: narration([['hi', 'there']]), script: 'Hi there.', gagKinds: [] }),
    ).toBeUndefined();
    expect(fallbackTitle('Would you survive a night in the old prison? Probably not.')).toBe(
      'Would you survive a night in',
    );
    expect(fallbackTitle('')).toBe('Untitled');
    expect(DIRECTION_RULES.titleMaxWords).toBe(6);
  });
});
