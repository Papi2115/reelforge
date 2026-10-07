import { GENRE_PRESETS } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import {
  chosenGenre,
  genreFormValues,
  genreLabel,
  genreOptions,
  genrePreviewLine,
  genreRowText,
  genreStyleNote,
  withTouched,
  type GenreFormInput,
  type GenreFormValues,
  type StyleOffer,
  type TouchedFields,
} from './genre-view.js';

const NONE: TouchedFields = new Set();

/** Built-ins always, Sketchbook with the switch; Comic and Game B2 not wired (whatever the kit wires). */
const BUILT_INS = new Set(['voxel-pixel-crisp640', 'noir-voxel', 'soft-480']);
const offer: StyleOffer = (id, experimental) =>
  BUILT_INS.has(id) || (experimental && id === 'sketchbook');

function formValues(overrides: Partial<GenreFormInput>, offered = offer): GenreFormValues {
  return genreFormValues(
    {
      genre: null,
      touched: NONE,
      experimentalWorlds: false,
      style: 'voxel-pixel-crisp640',
      shotsPerMinute: null,
      fasterChecks: false,
      ...overrides,
    },
    offered,
  );
}

function resolved(overrides: Partial<GenreFormInput>, offered = offer) {
  const { resolution } = formValues(overrides, offered);
  if (resolution === undefined) throw new Error('no genre resolved');
  return resolution;
}

describe('genre options and labels', () => {
  it('lists the six presets in table order with their one-line descriptions', () => {
    const options = genreOptions();
    expect(options.map((option) => option.id)).toEqual(GENRE_PRESETS.map((preset) => preset.id));
    expect(options).toHaveLength(6);
    expect(options[2]).toEqual({
      id: 'history',
      label: 'History',
      description: 'Hand-drawn notebook first, calmer pace, people and dates told as a story.',
    });
    expect(genreLabel('pop-culture')).toBe('Pop culture / gaming');
    expect(genreLabel('retired-genre')).toBe('retired-genre');
  });

  it('preselects the channel genre unless the user picked one or None', () => {
    expect(chosenGenre(undefined, 'finance')).toBe('finance');
    expect(chosenGenre(undefined, null)).toBeNull();
    expect(chosenGenre(undefined, 'not-a-genre')).toBeNull();
    expect(chosenGenre(null, 'finance')).toBeNull();
    expect(chosenGenre('science', 'finance')).toBe('science');
  });
});

describe('genreFormValues', () => {
  it('keeps the form as it is without a genre (today’s behaviour)', () => {
    expect(formValues({ shotsPerMinute: { min: 8, max: 12 } })).toEqual({
      resolution: undefined,
      style: 'voxel-pixel-crisp640',
      shotsPerMinute: { min: 8, max: 12 },
      fasterChecks: false,
    });
  });

  it('shows the preset’s first offered style and range while they are untouched', () => {
    const off = formValues({ genre: 'history' });
    expect(off.style).toBe('soft-480');
    expect(off.shotsPerMinute).toEqual({ min: 3, max: 5 });
    expect(off.resolution?.skippedStyles).toEqual(['sketchbook', 'comic']);
    expect(formValues({ genre: 'history', experimentalWorlds: true }).style).toBe('sketchbook');
  });

  it('keeps the fields the user touched', () => {
    const touched = withTouched(withTouched(NONE, 'style'), 'shotsPerMinute');
    const shown = formValues({
      genre: 'true-crime',
      touched,
      style: 'soft-480',
      shotsPerMinute: { min: 8, max: 12 },
    });
    expect(shown.style).toBe('soft-480');
    expect(shown.shotsPerMinute).toEqual({ min: 8, max: 12 });
    expect(shown.resolution?.patch).not.toHaveProperty('style');
    expect(shown.resolution?.patch).toMatchObject({ genrePreset: 'true-crime', lookMode: 'mixed' });
  });

  it('adds a field to the touched set once', () => {
    const once = withTouched(NONE, 'style');
    expect(withTouched(once, 'style')).toBe(once);
    expect([...withTouched(once, 'fasterChecks')]).toEqual(['style', 'fasterChecks']);
  });
});

describe('genre preview and style note', () => {
  it('says what the preset sets in plain words', () => {
    expect(genrePreviewLine(resolved({ genre: 'history', experimentalWorlds: true }), NONE)).toBe(
      'Hand-drawn notebook · calm pace · 3–5 scenes a minute · continuity links · no pattern interrupts',
    );
    expect(genrePreviewLine(resolved({ genre: 'tech-explainer' }), NONE)).toBe(
      'Chunky voxel 3D in crisp pixel art · mixed looks · fast pace · 8–12 scenes a minute',
    );
    expect(genrePreviewLine(resolved({ genre: 'true-crime' }), NONE)).toBe(
      'Low-key voxel 3D · mixed looks · steady pace · 5–8 scenes a minute · continuity links',
    );
  });

  it('names the user’s own choices', () => {
    const touched = withTouched(withTouched(NONE, 'style'), 'shotsPerMinute');
    expect(genrePreviewLine(resolved({ genre: 'finance', touched }), touched)).toBe(
      'your style · mixed looks · your scenes per minute',
    );
  });

  it('says which preferred style is not offered and what is used instead', () => {
    expect(genreStyleNote(resolved({ genre: 'history' }), false, offer)).toBe(
      'Sketchbook needs “Experimental worlds” (Settings → Projects) and Comic is in development, using Soft 480.',
    );
    expect(
      genreStyleNote(resolved({ genre: 'history', experimentalWorlds: true }), true, offer),
    ).toBeUndefined();
    expect(
      genreStyleNote(resolved({ genre: 'pop-culture', experimentalWorlds: true }), true, offer),
    ).toMatch(/^Game B2.* is in development, using Voxel Pixel · Crisp 640\.$/);
    // Comic wired: both worlds wait for the switch.
    const wired: StyleOffer = (id, experimental) =>
      BUILT_INS.has(id) || (experimental && (id === 'sketchbook' || id === 'comic'));
    expect(genreStyleNote(resolved({ genre: 'history' }, wired), false, wired)).toBe(
      'Sketchbook and Comic need “Experimental worlds” (Settings → Projects), using Soft 480.',
    );
  });
});

describe('genreRowText', () => {
  it('shows the preset name with its recipe, None, or an unknown id as is', () => {
    const history = genreRowText('history');
    expect(history.label).toBe('History');
    expect(history.recipe).toMatch(
      /^Recipe: Hand-drawn notebook first.* Script tone: storytelling/,
    );
    expect(genreRowText(undefined)).toMatchObject({ label: 'None', recipe: undefined });
    expect(genreRowText('retired')).toMatchObject({
      label: 'retired (not in this version)',
      recipe: undefined,
    });
  });
});
