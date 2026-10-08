import { describe, expect, it } from 'vitest';
import {
  applyGenrePreset,
  GENRE_PRESET_FIELDS,
  resolveGenrePreset,
  type GenrePresetField,
} from './genre-preset-apply.js';
import {
  findGenrePreset,
  GENRE_PRESET_IDS,
  GENRE_PRESETS,
  genrePresetSchema,
  genrePresetScriptTone,
} from './genre-presets.js';
import { projectFileSchema, type ProjectFile } from './project.js';

const BUILT_IN = new Set(['voxel-pixel-crisp640', 'noir-voxel', 'soft-480']);
/** Today's app with Experimental worlds off: built-in styles only. */
const builtInOnly = (id: string): boolean => BUILT_IN.has(id);
/** Experimental worlds on: Sketchbook is wired, Comic and Game B2 are not. */
const withSketchbook = (id: string): boolean => BUILT_IN.has(id) || id === 'sketchbook';
/** A later build where every world is wired and offered. */
const everyWorld = (): boolean => true;

const PROJECT: ProjectFile = projectFileSchema.parse({
  version: 1,
  title: 'Film',
  language: 'en',
  style: 'voxel-pixel-crisp640',
  fps: 30,
  seed: 1,
});

describe('genre preset table', () => {
  it('lists the seven genres, each valid and with a distinct id', () => {
    expect(GENRE_PRESET_IDS).toEqual([
      'true-crime',
      'tech-explainer',
      'history',
      'finance',
      'science',
      'pop-culture',
      'explained-as-a-game',
    ]);
    for (const preset of GENRE_PRESETS) expect(genrePresetSchema.parse(preset)).toEqual(preset);
    expect(Object.isFrozen(GENRE_PRESETS)).toBe(true);
  });

  it('every preset has a built-in style in its list (always offered)', () => {
    for (const preset of GENRE_PRESETS) {
      expect(preset.styles.some((id) => BUILT_IN.has(id))).toBe(true);
    }
  });

  it('refuses multi-line descriptions, unknown moods and unknown keys', () => {
    const base = GENRE_PRESETS[0];
    expect(genrePresetSchema.safeParse({ ...base, description: 'a\nb' }).success).toBe(false);
    expect(genrePresetSchema.safeParse({ ...base, musicMoodsPreferred: ['epic'] }).success).toBe(
      false,
    );
    expect(genrePresetSchema.safeParse({ ...base, extra: 1 }).success).toBe(false);
    expect(genrePresetSchema.safeParse({ ...base, styles: [] }).success).toBe(false);
  });

  it('finds presets by id and has no tone hint without one', () => {
    expect(findGenrePreset('finance')?.name).toBe('Finance');
    expect(findGenrePreset('tech')).toBeUndefined();
    expect(findGenrePreset(null)).toBeUndefined();
    expect(genrePresetScriptTone({})).toBeUndefined();
    expect(genrePresetScriptTone({ genrePreset: 'retired-genre' })).toBeUndefined();
    expect(genrePresetScriptTone({ genrePreset: 'true-crime' })).toMatch(/^investigative/);
  });

  it('frames the game-run preset for Game B2 with a voxel fallback and a game tone', () => {
    const game = findGenrePreset('explained-as-a-game');
    expect(game?.name).toBe('Explained as a game');
    expect(game?.styles).toEqual(['game-b2', 'voxel-pixel-crisp640']);
    expect(game?.continuityLinks).toBe(true);
    expect(genrePresetScriptTone({ genrePreset: 'explained-as-a-game' })).toMatch(
      /^a game run in the second person: levels as chapters.*every game term a true fact$/,
    );
  });
});

describe('resolveGenrePreset: style fallback by availability', () => {
  const cases: readonly [string, (id: string) => boolean, string, readonly string[]][] = [
    ['true-crime', builtInOnly, 'noir-voxel', []],
    ['tech-explainer', builtInOnly, 'voxel-pixel-crisp640', []],
    ['history', builtInOnly, 'soft-480', ['sketchbook', 'comic']],
    ['history', withSketchbook, 'sketchbook', []],
    ['history', (id) => id !== 'sketchbook', 'comic', ['sketchbook']],
    ['finance', builtInOnly, 'voxel-pixel-crisp640', []],
    ['science', builtInOnly, 'voxel-pixel-crisp640', ['sketchbook']],
    ['science', withSketchbook, 'sketchbook', []],
    ['pop-culture', withSketchbook, 'voxel-pixel-crisp640', ['game-b2']],
    ['pop-culture', everyWorld, 'game-b2', []],
    ['explained-as-a-game', withSketchbook, 'voxel-pixel-crisp640', ['game-b2']],
    ['explained-as-a-game', everyWorld, 'game-b2', []],
  ];
  it.each(cases)('%s → first offered style', (id, available, style, skipped) => {
    const resolution = resolveGenrePreset(id, { isStyleAvailable: available });
    expect(resolution?.style).toBe(style);
    expect(resolution?.patch.style).toBe(style);
    expect(resolution?.skippedStyles).toEqual(skipped);
  });

  it('leaves the style alone when none of the preset styles is offered', () => {
    const resolution = resolveGenrePreset('history', { isStyleAvailable: () => false });
    expect(resolution?.style).toBeUndefined();
    expect(resolution?.patch).not.toHaveProperty('style');
    expect(resolution?.patch.lookMode).toBe('mixed');
  });

  it('returns undefined for an unknown preset', () => {
    expect(resolveGenrePreset('tech', { isStyleAvailable: everyWorld })).toBeUndefined();
    expect(applyGenrePreset(PROJECT, 'tech', { isStyleAvailable: everyWorld })).toBeUndefined();
  });
});

describe('resolveGenrePreset: the patch', () => {
  it('writes every preset field plus the id, as valid project.json fields', () => {
    const resolution = resolveGenrePreset('true-crime', { isStyleAvailable: builtInOnly });
    expect(resolution?.patch).toEqual({
      genrePreset: 'true-crime',
      style: 'noir-voxel',
      lookMode: 'mixed',
      shotsPerMinute: { min: 5, max: 8 },
      tensionMap: 'auto',
      beatSync: 'auto',
      patternInterrupts: 'auto',
      openLoops: 'auto',
      revealMoments: 'auto',
      repetitionControl: 'auto',
      ambientVariation: true,
      researchMode: 'ask',
      continuityLinks: true,
    });
    for (const id of GENRE_PRESET_IDS) {
      const applied = applyGenrePreset(PROJECT, id, { isStyleAvailable: everyWorld });
      expect(projectFileSchema.parse(applied)).toEqual(applied);
    }
  });

  it('never overrides the fields the user set in the same form', () => {
    const explicit: GenrePresetField[] = ['style', 'shotsPerMinute', 'researchMode'];
    const resolution = resolveGenrePreset('history', {
      isStyleAvailable: withSketchbook,
      explicit,
    });
    expect(resolution?.style).toBeUndefined();
    expect(resolution?.skippedStyles).toEqual([]);
    for (const key of explicit) expect(resolution?.patch).not.toHaveProperty(key);
    expect(resolution?.patch).toMatchObject({ genrePreset: 'history', patternInterrupts: 'off' });
    const user = { ...PROJECT, style: 'noir-voxel', researchMode: 'off' as const };
    expect(
      applyGenrePreset(user, 'history', { isStyleAvailable: withSketchbook, explicit }),
    ).toMatchObject({ style: 'noir-voxel', researchMode: 'off', lookMode: 'mixed' });
  });

  it('every patch key is a preset field or the id', () => {
    const allowed = new Set<string>([...GENRE_PRESET_FIELDS, 'genrePreset']);
    for (const id of GENRE_PRESET_IDS) {
      const patch = resolveGenrePreset(id, { isStyleAvailable: everyWorld })?.patch ?? {};
      for (const key of Object.keys(patch)) expect(allowed.has(key)).toBe(true);
    }
  });

  it('does not share the table objects with the patch', () => {
    const patch = resolveGenrePreset('finance', { isStyleAvailable: builtInOnly })?.patch;
    expect(patch?.shotsPerMinute).not.toBe(findGenrePreset('finance')?.shotsPerMinute);
  });
});

describe('project.json genrePreset', () => {
  it('is optional and kebab-case', () => {
    expect(projectFileSchema.parse(PROJECT)).not.toHaveProperty('genrePreset');
    expect(projectFileSchema.parse({ ...PROJECT, genrePreset: 'finance' }).genrePreset).toBe(
      'finance',
    );
    expect(projectFileSchema.safeParse({ ...PROJECT, genrePreset: 'True Crime' }).success).toBe(
      false,
    );
  });
});
