/**
 * The casting rules of a Grim Ink direction plan (PLAN.md#14.16 casting): the target ensemble by
 * film length, every person in 2+ beats, 3 people early, nobody over 60 % of the beats, at least
 * one gag, a crowd beat when the script names a group; the build order; the fallback ensemble.
 */
import { directionFileSchema, type DirectionFile, type WordsFile } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { fallbackDirection } from '../worlds/c-cam-direction-fallback.js';
import { castAppearances, castByImportance, groupWordOf } from './direction-cast.js';
import { castTarget, maxPersonBeats } from './direction-rules.js';
import { checkDirection } from './direction.js';
import { goodPlan, PLAN_DURATION_S, PLAN_SCRIPT } from './direction-fixture.js';

const OPTIONS = { durationS: PLAN_DURATION_S, gagKinds: ['yawn', 'sweat'], script: PLAN_SCRIPT };

function errors(plan: DirectionFile, options = OPTIONS): string[] {
  return checkDirection(plan, options)
    .filter((entry) => entry.severity === 'error')
    .map((entry) => entry.code);
}

/** The plan with beat `id`'s `people` replaced. */
function withPeople(
  plan: DirectionFile,
  people: Readonly<Record<string, string[]>>,
): DirectionFile {
  return {
    ...plan,
    beats: plan.beats.map((beat) => {
      const list = people[beat.id];
      if (list === undefined) return beat;
      const copy: DirectionFile['beats'][number] = { ...beat, people: list };
      if (list.length === 0) delete copy.people;
      return copy;
    }),
  };
}

describe('the cast target', () => {
  it('grows with the film: 3 to 45 s, 4 to 90 s, then +1 per 90 s, at most 8', () => {
    const table = [30, 45, 46, 90, 91, 180, 181, 270, 360, 361, 900].map((s) => castTarget(s));
    expect(table).toEqual([3, 3, 4, 4, 5, 5, 6, 6, 7, 8, 8]);
    expect([3, 6, 10, 20].map(maxPersonBeats)).toEqual([3, 3, 6, 12]);
  });
});

describe('the casting rules', () => {
  it('pass the ensemble of the fixture', () => {
    expect(errors(goodPlan())).toEqual([]);
    expect(Object.fromEntries(castAppearances(goodPlan()))).toEqual({
      warden: 3,
      inmate: 3,
      guard: 2,
    });
  });

  it('want the target number of people', () => {
    const plan = withPeople(goodPlan(), { b01: [], b05: [] });
    const small = { ...plan, cast: plan.cast.filter((person) => person.id !== 'guard') };
    expect(errors(small)).toEqual(['direction-cast-size']);
    const message = checkDirection(small, OPTIONS)[0]?.message ?? '';
    expect(message).toContain('casts at least 3');
    expect(message).toContain('protagonist');
  });

  it('want every person in 2+ beats and nobody in more than 60 %', () => {
    expect(errors(withPeople(goodPlan(), { b05: [] }))).toEqual(['direction-cast-presence']);
    expect(errors(withPeople(goodPlan(), { b02: ['warden'], b04: ['warden'] }))).toEqual([
      'direction-cast-overexposed',
    ]);
    expect(errors(withPeople(goodPlan(), { b01: [], b06: ['guard'] }))).toEqual([
      'direction-cast-early',
    ]);
    expect(errors(withPeople(goodPlan(), { b02: ['ghost'] }))).toEqual(['direction-unknown-ref']);
  });

  it('want at least one gag, and gags only of people who have one', () => {
    const plan = goodPlan();
    const gagged = {
      ...plan,
      beats: plan.beats.map((beat) =>
        beat.id === 'b02' ? { ...beat, gagRefs: [...beat.gagRefs, 'guard'] } : beat,
      ),
    };
    expect(errors(gagged)).toEqual(['direction-unknown-ref']);
    const none: DirectionFile = {
      ...plan,
      cast: plan.cast.map(({ id, role }) => (role === undefined ? { id } : { id, role })),
      beats: plan.beats.map((beat) => ({
        ...beat,
        gagRefs: [],
        people: [...beat.gagRefs, ...(beat.people ?? [])],
      })),
    };
    expect(errors(none)).toEqual(['direction-cast-gags']);
  });

  it('want a crowd beat when the script names a group', () => {
    const script = `${PLAN_SCRIPT} The other prisoners cheered.`;
    expect(errors(goodPlan(), { ...OPTIONS, script })).toEqual(['direction-crowd']);
    const crowd = {
      ...goodPlan(),
      beats: goodPlan().beats.map((beat) =>
        beat.id === 'b05' ? { ...beat, crowd: 'the prisoners rattle their cups as one' } : beat,
      ),
    };
    expect(errors(crowd, { ...OPTIONS, script })).toEqual([]);
    expect(groupWordOf('Then the Senate voted.')).toBe('senate');
    expect(groupWordOf('The fan spun and the soldier slept.')).toBeUndefined();
  });

  it('orders the build by importance and caps the cast at 8', () => {
    const plan = goodPlan();
    const reordered = { ...plan, cast: [...plan.cast].reverse() };
    expect(castByImportance(reordered)).toEqual(['warden', 'inmate', 'guard']);
    const nine = Array.from({ length: 9 }, (_, index) => ({ id: `p${String(index)}` }));
    expect(directionFileSchema.safeParse({ ...plan, cast: nine }).success).toBe(false);
  });
});

function narration(count: number, wordS = 0.5): WordsFile {
  const words = Array.from({ length: count }, (_, index) => ({
    text: index % 8 === 7 ? `w${String(index)}.` : `w${String(index)}`,
    t: index * wordS,
    tEnd: index * wordS + wordS * 0.9,
  }));
  return { version: 1, words };
}

describe('the fallback ensemble', () => {
  it.each([
    [20, 3],
    [140, 4],
    [400, 6],
    [1000, 8],
  ])('casts the target for %i words', (count, people) => {
    const words = narration(count);
    const durationS = words.words.at(-1)?.tEnd ?? 0;
    const script = 'The villagers waited. Nobody came.';
    const plan = fallbackDirection({ words, script, gagKinds: ['fidget'] });
    if (plan === undefined) throw new Error('no plan');
    expect(plan.cast).toHaveLength(people);
    expect(plan.cast.map((person) => person.id).slice(0, 3)).toEqual(['lead', 'foil', 'bystander']);
    expect(plan.beats.filter((beat) => beat.crowd !== undefined)).toHaveLength(1);
    const found = checkDirection(plan, { durationS, gagKinds: ['fidget'], script }).filter(
      (entry) => entry.severity === 'error',
    );
    expect(found).toEqual([]);
  });
});
