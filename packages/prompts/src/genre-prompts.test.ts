/**
 * Genre preset hints in the prompts (PLAN.md#13.8 part b, ADR-035): without a preset the
 * storyboard and sound-cues prompts render byte for byte as before (the `legacy-all-*` fixtures,
 * every other section on); with one the sound designer gets the preferred moods the project may
 * use, the storyboard the favoured looks it offers and the genre's wow pace and budget.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { findGenrePreset, type GenrePreset } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { promptVariables, renderPrompt, type PromptId } from './catalog.js';
import {
  genreWowScale,
  soundCuesGenreVars,
  storyboardGenreVars,
  type GenrePromptPreset,
} from './genre-vars.js';
import type { TemplateVars } from './template.js';

function fixture(name: string): string {
  return readFileSync(path.join(import.meta.dirname, 'fixtures', name), 'utf8').replaceAll(
    '\r\n',
    '\n',
  );
}

function rendered(id: PromptId, vars: TemplateVars): string {
  const result = renderPrompt(id, vars);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}

/** Every variable except the world's and the genre's, as `<name>` (every other section on). */
function legacyVars(id: PromptId): Record<string, string> {
  const { required, optional } = promptVariables(id);
  return Object.fromEntries(
    [...required, ...optional]
      .filter((name) => !/^(world|craftBrief|genre)/.test(name))
      .map((name) => [name, `<${name}>`]),
  );
}

function preset(id: string): GenrePreset {
  const found = findGenrePreset(id);
  if (found === undefined) throw new Error(`no preset ${id}`);
  return found;
}

const ALL_MOODS = [
  'calm-tech',
  'lofi-chill',
  'tense-investigation',
  'bright-explainer',
  'retro-wave',
];
const BUILT_IN_LOOKS = ['voxel', 'retro-ui', 'diorama', 'blueprint', 'flat-2d', 'whiteboard'];
const SKETCHBOOK_LOOKS = ['sketch-story', 'sketch-graph', 'sketch-loud'];

describe('without a genre preset', () => {
  it.each(['storyboard', 'sound-cues'] as const)('%s renders byte for byte as before', (id) => {
    const legacy = legacyVars(id);
    expect(rendered(id, legacy)).toBe(fixture(`legacy-all-${id}.txt`));
    expect(rendered(id, { ...legacy, ...soundCuesGenreVars(undefined, ALL_MOODS) })).toBe(
      fixture(`legacy-all-${id}.txt`),
    );
    expect(
      rendered(id, {
        ...legacy,
        ...storyboardGenreVars(undefined, { looks: BUILT_IN_LOOKS, wowDurationS: 480 }),
      }),
    ).toBe(fixture(`legacy-all-${id}.txt`));
  });

  it('adds nothing for a preset whose hints do not apply here', () => {
    // Science: wow ×1; a world project offers none of the built-in looks.
    expect(
      storyboardGenreVars(preset('science'), { looks: SKETCHBOOK_LOOKS, wowDurationS: 480 }),
    ).toEqual({});
    // A single look (or voxel-only: no looks) gets no looks hint.
    expect(storyboardGenreVars(preset('science'), { looks: ['voxel'] })).toEqual({});
    // Sketchbook music: lofi-chill and calm-tech only.
    expect(soundCuesGenreVars(preset('pop-culture'), ['lofi-chill', 'calm-tech'])).toEqual({});
  });
});

describe('with a genre preset', () => {
  it('names the preferred moods the project may use, best first', () => {
    expect(soundCuesGenreVars(preset('true-crime'), ALL_MOODS)).toEqual({
      genreName: 'True crime',
      genreMoods: 'tense-investigation, calm-tech',
    });
    expect(soundCuesGenreVars(preset('history'), ['lofi-chill', 'calm-tech'])).toEqual({
      genreName: 'History',
      genreMoods: 'lofi-chill, calm-tech',
    });
  });

  it('adds one sentence to the sound-cues prompt', async () => {
    const legacy = legacyVars('sound-cues');
    const text = rendered('sound-cues', {
      ...legacy,
      ...soundCuesGenreVars(preset('true-crime'), ALL_MOODS),
    });
    const hint =
      " This film's genre (True crime) suits these moods, best first: tense-investigation, calm-tech; prefer them where they fit an act (the other moods stay allowed).";
    expect(text).toContain(`ducked.${hint}\n`);
    expect(text.replace(hint, '')).toBe(fixture('legacy-all-sound-cues.txt'));
    await expect(text).toMatchFileSnapshot('fixtures/genre-sound-cues.txt');
  });

  it('names the favoured looks the project offers, in the preset order', () => {
    expect(storyboardGenreVars(preset('finance'), { looks: BUILT_IN_LOOKS })).toEqual({
      genreName: 'Finance',
      genreLooks: '`flat-2d`, `blueprint`, `retro-ui`',
    });
    // Looks the style does not offer are left out (an older or narrower look list).
    expect(storyboardGenreVars(preset('history'), { looks: ['voxel', 'diorama'] })).toMatchObject({
      genreLooks: '`diorama`',
    });
  });

  it.each([
    ['true-crime', 0.5, 'about one per 80–180 s (the pace of this genre)', '6'],
    ['history', 0.75, 'about one per 53–120 s (the pace of this genre)', '9'],
    ['tech-explainer', 1.25, 'about one per 32–72 s (the pace of this genre)', '15'],
    ['pop-culture', 1.5, 'about one per 27–60 s (the pace of this genre)', '17'],
  ])('%s scales the wow pace by %s', (id, scale, pace, budget) => {
    expect(genreWowScale(preset(id))).toBe(scale);
    expect(storyboardGenreVars(preset(id), { looks: [], wowDurationS: 480 })).toEqual({
      genreWowPace: pace,
      wowBudget: budget,
    });
    // No stated budget (unknown length, a world, one look): no pace either.
    expect(storyboardGenreVars(preset(id), { looks: [] })).toEqual({});
  });

  it('keeps the multiplier in bounds and treats 1 as no change', () => {
    const base: GenrePromptPreset = { name: 'Test', musicMoodsPreferred: ['calm-tech'] };
    expect(genreWowScale(base)).toBeUndefined();
    expect(genreWowScale({ ...base, wowTransitionBudget: 1 })).toBeUndefined();
    expect(genreWowScale({ ...base, wowTransitionBudget: 0 })).toBe(0.25);
    expect(genreWowScale({ ...base, wowTransitionBudget: 3 })).toBe(2);
  });

  it('adds the looks hint and the genre pace to the storyboard prompt', async () => {
    const legacy = legacyVars('storyboard');
    const genre = storyboardGenreVars(preset('true-crime'), {
      looks: BUILT_IN_LOOKS,
      wowDurationS: 480,
    });
    const text = rendered('storyboard', { ...legacy, ...genre });
    const hint =
      "Looks that suit this film's genre (True crime): `blueprint`, `retro-ui`. Favour them where they tell the shot as well as another look; the roll and rhythm rules below still decide.\n";
    expect(text).toContain(`<looks>\n${hint}Rhythm:`);
    expect(text).toContain(
      'at most 6 in this film, about one per 80–180 s (the pace of this genre), never in the first 6 s',
    );
    const back = text
      .replace(hint, '')
      .replace('about one per 80–180 s (the pace of this genre)', 'about one per 40–90 s')
      .replace('at most 6 in this film', 'at most <wowBudget> in this film');
    expect(back).toBe(fixture('legacy-all-storyboard.txt'));
    await expect(text).toMatchFileSnapshot('fixtures/genre-storyboard.txt');
  });
});
