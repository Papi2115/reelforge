import {
  SFX_RECIPES,
  SFX_VARIANTS,
  mixToMono,
  powerSpectrum,
  sfxVariantIndex,
  spectralCentroid,
  synthesizeSfx,
} from '@reelforge/pipeline';
import type { StoryboardShot } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { directCues, variantSeed, type DirectedCue } from './cue-director.js';
import { findGestures, isNumberWord, listStep, type DirectorInput } from './cue-events.js';
import { CUE_EVENT_KINDS, CUE_RULES, DENSITY, HEAVY_VARIANTS, ruleGainDb } from './cue-rules.js';

function shot(
  id: string,
  t0: number,
  t1: number,
  treatment: StoryboardShot['treatment'],
  transitionIn?: StoryboardShot['transitionIn'],
): StoryboardShot {
  return {
    id,
    t0,
    t1,
    treatment,
    intent: id,
    scene: `scenes/${id}.js`,
    ...(transitionIn === undefined ? {} : { transitionIn }),
  };
}

const word = (text: string, t: number) => ({ text, t, tEnd: t + 0.3 });

function direct(input: Partial<DirectorInput> & Pick<DirectorInput, 'shots'>): DirectedCue[] {
  const full: DirectorInput = { words: [], sceneSfx: [], anchors: [], ...input };
  const duration = full.shots.at(-1)?.t1 ?? 0;
  return directCues(findGestures(full), full.shots, duration);
}

describe('rule table', () => {
  it('has a valid rule for every event kind (recipes and variant names exist)', () => {
    for (const kind of CUE_EVENT_KINDS) {
      const rule = CUE_RULES[kind];
      if (rule.choices === 'event') continue;
      expect(rule.choices.length, kind).toBeGreaterThan(0);
      for (const choice of rule.choices) {
        expect(SFX_RECIPES, kind).toContain(choice.recipe);
        for (const variant of choice.variants) {
          expect(SFX_VARIANTS[choice.recipe], `${kind} ${choice.recipe}`).toContain(variant);
        }
      }
    }
  });

  it('keeps every sound well under the voice (category level + trim)', () => {
    for (const kind of CUE_EVENT_KINDS) {
      const rule = CUE_RULES[kind];
      const recipes = rule.choices === 'event' ? SFX_RECIPES : rule.choices.map((c) => c.recipe);
      for (const recipe of recipes) {
        const gain = ruleGainDb(rule, recipe);
        expect(gain, `${kind} ${recipe}`).toBeLessThanOrEqual(-6);
        expect(gain, `${kind} ${recipe}`).toBeGreaterThanOrEqual(-24);
      }
    }
  });

  it('orders the list-pop variants from low to high pitch', () => {
    const choice = CUE_RULES['list-item'].choices;
    if (choice === 'event') throw new Error('list-item must name its recipe');
    const [pop] = choice;
    if (pop === undefined) throw new Error('no list recipe');
    const centroids = pop.variants.map((variant) => {
      const index = SFX_VARIANTS[pop.recipe].indexOf(variant);
      // Average over a few seeds: the seed also nudges the pitch.
      const seeds = [0, 1, 2, 3].map((n) => n * SFX_VARIANTS[pop.recipe].length + index);
      const values = seeds.map((seed) =>
        spectralCentroid(powerSpectrum(mixToMono(synthesizeSfx(pop.recipe, { seed })), 2048)),
      );
      return values.reduce((sum, value) => sum + value, 0) / values.length;
    });
    const sorted = [...centroids].sort((a, b) => a - b);
    expect(centroids).toEqual(sorted);
    expect([0, 1, 2, 3].map((index) => listStep(index, 4))).toEqual([0, 1, 2, 3]);
    expect([0, 1, 2].map((index) => listStep(index, 3))).toEqual([0, 2, 3]);
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((index) => listStep(index, 8))).toEqual([
      0, 0, 1, 1, 2, 2, 3, 3,
    ]);
  });

  it('derives seeds that select the wanted variant', () => {
    for (const recipe of SFX_RECIPES) {
      SFX_VARIANTS[recipe].forEach((_, variant) => {
        const seed = variantSeed(recipe, variant, `s01|0|0|${recipe}`);
        expect(sfxVariantIndex(recipe, seed)).toBe(variant);
        expect(seed).toBeLessThanOrEqual(0xffff_ffff);
      });
    }
  });
});

describe('events', () => {
  it('recognises spoken numbers (digits and number words, not "one")', () => {
    expect(['61', '4KB', 'four', 'Thousand,', 'pięć'].every(isNumberWord)).toBe(true);
    expect(['one', 'calculator', 'KB'].some(isNumberWord)).toBe(false);
  });

  it('sounds every transition type with its own recipe', () => {
    const cues = direct({
      shots: [
        shot('a', 0, 6, 'map'),
        shot('b', 6, 12, 'title-card'),
        shot('c', 12, 18, '3d-reconstruction'),
        shot('d', 18, 24, 'map', { type: 'crossfade', duration: 0.5 }),
        shot('e', 24, 30, 'map', { type: 'glitch', duration: 0.3 }),
        shot('f', 30, 36, 'map', { type: 'wipe', duration: 0.4 }),
      ],
    });
    const byShot = new Map(cues.map((cue) => [cue.shotId, cue]));
    expect(byShot.get('b')).toMatchObject({ name: 'swoosh-in', variant: 'soft', t: 5.75 });
    expect(byShot.get('c')).toMatchObject({ name: 'whoosh', t: 11.75 });
    expect(['fast', 'up', 'down']).toContain(byShot.get('c')?.variant);
    expect(byShot.get('d')).toMatchObject({ name: 'whoosh', t: 17.7, durationS: 1.1 });
    expect(['air', 'slow']).toContain(byShot.get('d')?.variant);
    expect(byShot.get('e')).toMatchObject({ name: 'glitch', t: 24, durationS: 0.35 });
    expect(byShot.get('f')).toMatchObject({ name: 'swoosh-in', t: 29.95 });
    // Cuts alternate a subtle pan.
    expect(Math.sign(byShot.get('b')?.pan ?? 0)).toBe(-Math.sign(byShot.get('c')?.pan ?? 0));
  });

  it('turns a counter into ticks and tocks scaled to its speed, landing on the final hit', () => {
    const cues = direct({
      shots: [shot('n', 0, 6, 'counter/odometer')],
      words: [word('4', 1), word('61', 4)],
      sceneSfx: [
        { t: 1, name: 'tick', shotId: 'n' },
        { t: 4, name: 'hit', shotId: 'n' },
      ],
    });
    const steps = cues.filter((cue) => cue.kind === 'counter-step');
    expect(steps.length).toBeGreaterThanOrEqual(8);
    expect(steps.map((cue) => cue.name).slice(0, 4)).toEqual(['tick', 'tock', 'tick', 'tock']);
    const gaps = steps.slice(1).map((cue, index) => cue.t - (steps[index]?.t ?? 0));
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThan(0.002);
    // Louder towards the landing.
    expect(steps.at(-1)?.gainDb ?? 0).toBeGreaterThan(steps[0]?.gainDb ?? 0);
    expect(cues.at(-1)).toMatchObject({ kind: 'counter-final', name: 'hit', t: 4 });
    // A faster counter ticks faster.
    const fast = direct({
      shots: [shot('n', 0, 6, 'counter/odometer')],
      sceneSfx: [
        { t: 1, name: 'tick', shotId: 'n' },
        { t: 2.2, name: 'ding', shotId: 'n' },
      ],
    }).filter((cue) => cue.kind === 'counter-step');
    expect((fast[1]?.t ?? 0) - (fast[0]?.t ?? 0)).toBeLessThan(
      (steps[1]?.t ?? 0) - (steps[0]?.t ?? 0),
    );
  });

  it('makes a list reveal a rising pop series spread across the stereo field', () => {
    const cues = direct({
      shots: [shot('l', 0, 8, 'kinetic-text')],
      sceneSfx: [1.5, 2.2, 2.9].map((t) => ({ t, name: 'pop', shotId: 'l' })),
    });
    const items = cues.filter((cue) => cue.kind === 'list-item');
    expect(items.map((cue) => cue.variant)).toEqual(['low', 'pluck', 'mouth']);
    expect(items.map((cue) => cue.pan)).toEqual([-0.2, 0, 0.2]);
  });

  it('hits numbers, cards in, emphasis (riser into hit) and the end card', () => {
    const cues = direct({
      shots: [
        shot('t', 0, 8, 'title-card'),
        shot('m', 8, 16, 'map', { type: 'crossfade', duration: 0.4 }),
        shot('e', 16, 24, 'title-card', { type: 'crossfade', duration: 0.4 }),
      ],
      words: [word('Doom', 0.3), word('special:', 10), word('calculator', 10.6), word('1993', 13)],
    });
    expect(cues.find((cue) => cue.kind === 'text-in')).toMatchObject({ name: 'swoosh-in', t: 0.3 });
    expect(cues.find((cue) => cue.kind === 'emphasis-riser')).toMatchObject({
      name: 'riser',
      t: 9.2,
      durationS: 1.4,
    });
    expect(cues.find((cue) => cue.kind === 'emphasis-hit')).toMatchObject({ t: 10.6 });
    expect(cues.find((cue) => cue.kind === 'number')).toMatchObject({ name: 'hit-soft', t: 13 });
    expect(cues.find((cue) => cue.kind === 'end-card')).toMatchObject({ name: 'chime', t: 16.6 });
  });
});

describe('director', () => {
  const busy = (): DirectorInput => ({
    shots: Array.from({ length: 12 }, (_, index) =>
      shot(`s${String(index)}`, index * 5, index * 5 + 5, index % 2 === 0 ? 'kinetic-text' : 'map'),
    ),
    words: Array.from({ length: 60 }, (_, index) =>
      word(index % 7 === 0 ? String(index) : `w${String(index)}!`, index + 0.1),
    ),
    sceneSfx: Array.from({ length: 50 }, (_, index) => ({
      t: index * 1.2 + 0.05,
      name: ['pop', 'click', 'glitch', 'hit'][index % 4] ?? 'pop',
    })),
    anchors: [],
  });

  it('is deterministic', () => {
    const input = busy();
    const first = directCues(findGestures(input), input.shots, 60);
    expect(directCues(findGestures(busy()), busy().shots, 60)).toEqual(first);
  });

  it('keeps the density in budget and the spacing rules', () => {
    const input = busy();
    const cues = directCues(findGestures(input), input.shots, 60);
    const gestures = new Set(cues.map((cue) => `${cue.shotId}:${cue.kind}`));
    expect(gestures.size).toBeGreaterThan(5);
    const starts = [...new Map(cues.map((cue) => [`${cue.shotId}|${cue.kind}`, cue.t])).values()];
    expect(starts.length).toBeLessThanOrEqual(60 / DENSITY.secondsPerGesture + 2);
    for (const [index, cue] of cues.entries()) {
      const previous = cues[index - 1];
      const sameSeries =
        previous !== undefined && previous.shotId === cue.shotId && previous.kind === cue.kind;
      if (previous !== undefined && !sameSeries) {
        expect(
          cue.t - previous.t,
          `${previous.name}@${String(previous.t)} -> ${cue.name}`,
        ).toBeGreaterThanOrEqual(DENSITY.minCueGapS - 1e-9);
      }
      const owner = input.shots.find((candidate) => cue.t >= candidate.t0 && cue.t < candidate.t1);
      if (owner !== undefined && CUE_RULES[cue.kind].transition !== true) {
        expect(cue.t - owner.t0, `${cue.kind}@${String(cue.t)}`).toBeGreaterThanOrEqual(
          DENSITY.shotHeadS - 1e-9,
        );
      }
    }
  });

  it('never repeats the previous variant of the same recipe unless designed', () => {
    const input = busy();
    const cues = directCues(findGestures(input), input.shots, 60);
    cues.slice(1).forEach((cue, index) => {
      const previous = cues[index];
      if (previous === undefined || cue.kind === 'counter-step' || cue.kind === 'list-item') return;
      if (previous.name !== cue.name || SFX_VARIANTS[cue.name].length === 1) return;
      expect(`${cue.name}:${cue.variant}`).not.toBe(`${previous.name}:${previous.variant}`);
    });
    for (const cue of cues) {
      expect(SFX_VARIANTS[cue.name][sfxVariantIndex(cue.name, cue.seed)]).toBe(cue.variant);
    }
  });

  it('never picks a bass-heavy variant on its own', () => {
    const cues = direct({
      shots: [shot('a', 0, 60, 'map')],
      sceneSfx: Array.from({ length: 16 }, (_, index) => ({
        t: 1 + index * 3.5,
        name: index % 2 === 0 ? 'hit' : 'boom',
        shotId: 'a',
      })),
    });
    expect(cues.length).toBeGreaterThan(8);
    for (const cue of cues) {
      expect(HEAVY_VARIANTS[cue.name] ?? []).not.toContain(cue.variant);
    }
  });

  it('moves a scene sound slightly inside a shot head to its end and drops deeper ones', () => {
    const shots = [shot('a', 0, 5, 'map'), shot('b', 5, 10, 'map')];
    const cues = direct({
      shots,
      sceneSfx: [
        { t: 5.2, name: 'hit', shotId: 'b' },
        { t: 0.05, name: 'click', shotId: 'a' },
      ],
    });
    expect(cues.find((cue) => cue.name === 'hit')?.t).toBe(5.3);
    expect(cues.some((cue) => cue.name === 'click')).toBe(false);
  });
});
