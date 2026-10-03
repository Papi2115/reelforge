/**
 * Sound palettes on a film over all four looks (PLAN.md#12.24): every look's shots sound only in
 * their own palette, the ambience follows the looks with crossfades, and the result (cues and the
 * synthesized SFX + ambience buses) is deterministic byte for byte.
 */
import { CuesFileSchema, SFX_RECIPES, type SfxRecipe } from '@reelforge/pipeline';
import { describe, expect, it } from 'vitest';
import { generateDefaultCues } from '../stages/default-cues.js';
import { ALL_LOOKS, MIXED_FILM, busHash } from '../testing/sound-films.js';
import { directCues } from './cue-director.js';
import { findGestures } from './cue-events.js';
import { LOOK_CROSSFADE_S } from './ambience-plan.js';
import { paletteRecipes, shotPalettes } from './palettes/index.js';

const OPTIONS = { lookMode: 'mixed' as const, looks: ALL_LOOKS };
const palettes = shotPalettes(MIXED_FILM.shots, OPTIONS);
const durationS = MIXED_FILM.shots.at(-1)?.t1 ?? 0;
const directed = directCues(
  findGestures({
    shots: MIXED_FILM.shots,
    words: MIXED_FILM.words,
    sceneSfx: MIXED_FILM.sceneSfx ?? [],
    anchors: MIXED_FILM.anchors ?? [],
  }),
  MIXED_FILM.shots,
  durationS,
  palettes,
);
const VOXEL_RECIPES = new Set<SfxRecipe>(SFX_RECIPES.slice(0, 32));

describe('a film over four looks', () => {
  it('voices each look only with its own palette', () => {
    const used = new Map<string, Set<SfxRecipe>>();
    for (const cue of directed) {
      const palette = palettes.get(cue.shotId);
      expect(palette, cue.shotId).toBeDefined();
      if (palette === undefined) continue;
      const own = paletteRecipes(palette) ?? VOXEL_RECIPES;
      expect(own.has(cue.name), `${cue.shotId} (${palette.id}) ${cue.kind}: ${cue.name}`).toBe(
        true,
      );
      used.set(palette.id, (used.get(palette.id) ?? new Set()).add(cue.name));
    }
    // Every palette is really exercised (not a vacuous pass).
    expect([...used.keys()].sort()).toEqual(['blueprint', 'diorama', 'retro-ui', 'voxel']);
    for (const recipes of used.values()) expect(recipes.size).toBeGreaterThanOrEqual(2);
  });

  it('marks a cut into another look with the look accent and keeps the density rules', () => {
    const shots = MIXED_FILM.shots;
    const lookChanges = directed.filter((cue) => {
      const index = shots.findIndex((shot) => shot.id === cue.shotId);
      const previous = shots[index - 1];
      const palette = palettes.get(cue.shotId);
      return (
        cue.kind.startsWith('transition-') &&
        previous !== undefined &&
        palette !== undefined &&
        palette.id !== 'voxel' &&
        palettes.get(previous.id)?.id !== palette.id
      );
    });
    expect(lookChanges.length).toBeGreaterThan(0);
    for (const cue of lookChanges) {
      const palette = palettes.get(cue.shotId);
      const accents = Object.values(palette?.accents ?? {}).flatMap((slot) =>
        slot.map((choice) => choice.recipe),
      );
      expect(accents, `${cue.shotId} ${cue.kind}`).toContain(cue.name);
    }
    const starts = directed.map((cue) => cue.t).sort((a, b) => a - b);
    starts.forEach((t, index) => {
      const next = starts[index + 1];
      if (next !== undefined) expect(next - t).toBeGreaterThanOrEqual(0.15 - 1e-9);
    });
  });

  it('rises through the palette list pitches in a list reveal', () => {
    const list = directed.filter((cue) => cue.kind === 'list-item');
    expect(list.map((cue) => [cue.name, cue.variant])).toEqual([
      ['terminal-tick', 'low'],
      ['terminal-tick', 'mid'],
      ['terminal-tick', 'high'],
    ]);
  });

  it('gives each look its ambience bed, crossfaded at look boundaries', () => {
    const cues = CuesFileSchema.parse(generateDefaultCues({ ...MIXED_FILM, palettes: OPTIONS }));
    expect(cues.ambience.map((cue) => [cue.name, cue.from, cue.to])).toEqual([
      ['room-tone', 0, 4.5],
      ['crt-hum', 3.5, 10],
      ['crt-hum', 10, 16.5],
      ['electric-tick', 15.5, 22],
      ['crt-hum', 22, 29],
      ['server-room', 29, 35.5],
      ['electric-tick', 34.5, 41.5],
      ['city', 40.5, 46],
      ['room-tone', 46, 50],
    ]);
    for (const [index, cue] of cues.ambience.entries()) {
      const next = cues.ambience[index + 1];
      if (next !== undefined && next.from < cue.to) {
        expect(cue.to - next.from).toBeCloseTo(LOOK_CROSSFADE_S, 6);
        expect(cue.fadeOutS).toBe(LOOK_CROSSFADE_S);
        expect(next.fadeInS).toBe(LOOK_CROSSFADE_S);
      }
    }
  });

  it('under generated music: one faint bed per look run, over the whole film', () => {
    const music = {
      cues: [{ id: 'music-01', from: 0, to: 50, file: 'audio/music/gen-a.wav' }],
      moods: ['calm-tech' as const],
    };
    const cues = CuesFileSchema.parse(
      generateDefaultCues({ ...MIXED_FILM, music, palettes: OPTIONS }),
    );
    expect(cues.ambience.map((cue) => cue.name)).toEqual([
      'room-tone',
      'crt-hum',
      'electric-tick',
      'crt-hum',
      'server-room',
      'electric-tick',
      'city',
      'room-tone',
    ]);
    expect(cues.ambience[0]?.from).toBe(0);
    expect(cues.ambience.at(-1)?.to).toBe(50);
    for (const cue of cues.ambience) expect(cue.gainDb).toBeLessThanOrEqual(-32);
  });

  it('is deterministic byte for byte (cues and SFX + ambience buses)', () => {
    const first = generateDefaultCues({ ...MIXED_FILM, palettes: OPTIONS });
    const second = generateDefaultCues({ ...MIXED_FILM, palettes: OPTIONS });
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(busHash(second)).toBe(busHash(first));
  }, 60_000);
});
