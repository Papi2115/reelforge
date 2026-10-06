import { AMBIENCE_RECIPES, SFX_RECIPES, SFX_VARIANTS, type SfxRecipe } from '@reelforge/pipeline';
import { SKETCHBOOK_TRANSITION_IDS } from '@reelforge/engine';
import { WOW_STYLE_IDS, type StoryboardShot } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { directCues } from '../cue-director.js';
import { findGestures } from '../cue-events.js';
import { CUE_EVENT_KINDS, HEAVY_VARIANTS } from '../cue-rules.js';
import { ALL_LOOKS } from '../../testing/sound-films.js';
import {
  NO_HISTORY,
  SOUND_PALETTES,
  SOUND_PALETTE_IDS,
  VOXEL_PALETTE,
  dioramaKind,
  getSoundPalette,
  lookChangeSlot,
  paletteForShot,
  paletteRecipes,
  pick,
  pickRecipe,
  sceneRecipe,
  shotPalettes,
  TRANSITION_STYLE_SFX,
  WOW_PALETTE_SFX,
  WORLD_TRANSITION_SFX,
  WOW_STYLE_SFX,
  worldTransitionSlot,
  wowSlot,
  type PaletteKind,
} from './index.js';

const KINDS = CUE_EVENT_KINDS.filter((kind): kind is PaletteKind => kind !== 'scene');
const OTHERS = SOUND_PALETTE_IDS.filter((id) => id !== 'voxel').map((id) => SOUND_PALETTES[id]);

const shot = (look?: string, intent = 'a shot'): StoryboardShot => ({
  id: 's01',
  t0: 0,
  t1: 3,
  treatment: 'ui-mockup',
  intent,
  scene: 'scenes/s01.js',
  ...(look === undefined ? {} : { look }),
});

describe('palette lookup', () => {
  it('registers every palette under its id', () => {
    for (const id of SOUND_PALETTE_IDS) expect(getSoundPalette(id)?.id).toBe(id);
    expect(getSoundPalette('nope')).toBeUndefined();
    expect(getSoundPalette(undefined)).toBeUndefined();
  });

  it('every kit look names a registered palette', () => {
    for (const look of ALL_LOOKS) expect(getSoundPalette(look.soundPalette), look.id).toBeDefined();
  });

  it('follows the shot look in mixed projects', () => {
    const mixed = { lookMode: 'mixed' as const, looks: ALL_LOOKS };
    expect(paletteForShot(shot('retro-ui'), mixed).id).toBe('retro-ui');
    expect(paletteForShot(shot('diorama'), mixed).id).toBe('diorama');
    expect(paletteForShot(shot('blueprint'), mixed).id).toBe('blueprint');
    expect(paletteForShot(shot(), mixed).id).toBe('voxel');
    expect(paletteForShot(shot('voxel'), mixed).id).toBe('voxel');
  });

  it('falls back to voxel: voxel-only, no mode, unknown or unavailable looks, unknown palettes', () => {
    expect(paletteForShot(shot('retro-ui'))).toBe(VOXEL_PALETTE);
    expect(paletteForShot(shot('retro-ui'), { lookMode: 'voxel-only', looks: ALL_LOOKS })).toBe(
      VOXEL_PALETTE,
    );
    expect(paletteForShot(shot('paper'), { lookMode: 'mixed', looks: ALL_LOOKS })).toBe(
      VOXEL_PALETTE,
    );
    const unavailable = ALL_LOOKS.map((look) => ({ ...look, available: look.id === 'voxel' }));
    expect(paletteForShot(shot('retro-ui'), { lookMode: 'mixed', looks: unavailable })).toBe(
      VOXEL_PALETTE,
    );
    const odd = ALL_LOOKS.map((look) => ({ ...look, soundPalette: 'mystery' }));
    expect(paletteForShot(shot('retro-ui'), { lookMode: 'mixed', looks: odd })).toBe(VOXEL_PALETTE);
  });

  it('reads the diorama type from the intent', () => {
    expect(dioramaKind({ intent: 'Rows of server racks hum' })).toBe('server-room');
    expect(dioramaKind({ intent: 'Traffic in a small city' })).toBe('city');
    expect(dioramaKind({ intent: 'An open-plan office, desks' })).toBe('office');
    expect(dioramaKind({ intent: 'Biuro na piętrze' })).toBe('office');
    expect(dioramaKind({ intent: 'A cosy bedroom' })).toBe('room');
  });
});

describe('palette contents', () => {
  it('voxel re-voices nothing (the rule table as is) and translates no scene sound', () => {
    expect(VOXEL_PALETTE.sfx).toEqual({});
    expect(VOXEL_PALETTE.accents).toEqual({});
    expect(VOXEL_PALETTE.scene).toBeUndefined();
    expect(paletteRecipes(VOXEL_PALETTE)).toBeUndefined();
    expect(sceneRecipe(VOXEL_PALETTE, 'boom')).toBe('boom');
  });

  it.each(OTHERS)('$id voices every event kind with existing light recipes/variants', (palette) => {
    const slots = [
      ...KINDS.flatMap((kind) => {
        const own = palette.sfx[kind];
        expect(own, `${palette.id} ${kind}`).toBeDefined();
        return own ?? [];
      }),
      ...Object.values(palette.accents),
    ];
    for (const slot of slots) {
      expect(slot.length).toBeGreaterThan(0);
      for (const choice of slot) {
        expect(SFX_RECIPES).toContain(choice.recipe);
        for (const variant of choice.variants) {
          expect(SFX_VARIANTS[choice.recipe], choice.recipe).toContain(variant);
          expect(HEAVY_VARIANTS[choice.recipe] ?? []).not.toContain(variant);
        }
      }
    }
    const listRecipe = palette.sfx['list-item']?.[0]?.[0]?.recipe;
    expect(listRecipe).toBeDefined();
    for (const variant of palette.listPitch ?? []) {
      expect(SFX_VARIANTS[listRecipe ?? 'pop']).toContain(variant);
    }
  });

  it.each(OTHERS)('$id uses its own recipes, never the voxel set', (palette) => {
    const voxel = new Set<SfxRecipe>(SFX_RECIPES.slice(0, 32));
    const own = [...(paletteRecipes(palette) ?? [])];
    expect(own.length).toBeGreaterThan(4);
    expect(own.filter((recipe) => voxel.has(recipe))).toEqual([]);
    // A world's films never meet the built-in looks (ADR-029): only palettes that can share a
    // film keep their recipes apart.
    const others = OTHERS.filter(
      (other) => other !== palette && other.world === palette.world,
    ).flatMap((other) => [...(paletteRecipes(other) ?? [])]);
    expect(own.filter((recipe) => others.includes(recipe))).toEqual([]);
  });

  it.each(OTHERS)('$id translates every scene sound into the palette', (palette) => {
    const own = paletteRecipes(palette);
    for (const recipe of SFX_RECIPES) expect(own?.has(sceneRecipe(palette, recipe))).toBe(true);
    const ownRecipe = [...(own ?? [])][0];
    if (ownRecipe !== undefined) expect(sceneRecipe(palette, ownRecipe)).toBe(ownRecipe);
  });

  it('ambience beds are built-in recipes', () => {
    for (const palette of Object.values(SOUND_PALETTES)) {
      for (const key of ['', 'office', 'city', 'server-room', 'room']) {
        expect(AMBIENCE_RECIPES).toContain(palette.ambience.bed(key, 0));
        expect(AMBIENCE_RECIPES).toContain(palette.ambience.underMusic(key));
      }
    }
    expect(SOUND_PALETTES.diorama.ambience.bed('server-room', 0)).toBe('server-room');
    expect(SOUND_PALETTES.diorama.ambience.bed('room', 0)).toBe('room-tone');
  });

  it('look changes take the entered look accents (12.15 hook), never within one look or into voxel', () => {
    const retro = SOUND_PALETTES['retro-ui'];
    const diorama = SOUND_PALETTES.diorama;
    expect(lookChangeSlot(retro, retro, shot('retro-ui'))).toBeUndefined();
    expect(lookChangeSlot(retro, VOXEL_PALETTE, shot())).toBeUndefined();
    expect(lookChangeSlot(VOXEL_PALETTE, retro, shot('retro-ui'))).toBe(retro.accents['']);
    expect(lookChangeSlot(VOXEL_PALETTE, diorama, shot('diorama', 'A busy city street'))).toBe(
      diorama.accents['city'],
    );
  });

  it('look changes through a transition-kit style sound like the style (12.15)', () => {
    const retro = SOUND_PALETTES['retro-ui'];
    const styled = (style: string): StoryboardShot => ({
      ...shot('retro-ui'),
      transitionIn: { type: 'glitch', duration: 0.6, style },
    });
    expect(lookChangeSlot(VOXEL_PALETTE, retro, styled('crt-zoom'))).toBe(
      TRANSITION_STYLE_SFX['crt-zoom'],
    );
    // Plain styles and unknown ids keep the entered look's accents; one look stays silent.
    expect(lookChangeSlot(VOXEL_PALETTE, retro, styled('iris'))).toBe(retro.accents['']);
    expect(lookChangeSlot(VOXEL_PALETTE, retro, styled('nope'))).toBe(retro.accents['']);
    expect(lookChangeSlot(retro, retro, styled('crt-zoom'))).toBeUndefined();
    for (const [style, slot] of Object.entries(TRANSITION_STYLE_SFX)) {
      for (const choice of slot) {
        expect(SFX_RECIPES, style).toContain(choice.recipe);
        for (const variant of choice.variants) {
          expect(SFX_VARIANTS[choice.recipe], `${style}: ${variant}`).toContain(variant);
        }
      }
    }
  });
});

describe('sketchbook world palette (PLAN.md#13.6)', () => {
  it('voices the sketchbook looks and every page-native transition with light paper sounds', () => {
    const sketchbook = SOUND_PALETTES.sketchbook;
    expect(sketchbook.world).toBe('sketchbook');
    for (const look of ALL_LOOKS.filter((entry) => entry.styles?.includes('sketchbook'))) {
      expect(look.soundPalette, look.id).toBe('sketchbook');
    }
    expect(Object.keys(WORLD_TRANSITION_SFX).sort()).toEqual([...SKETCHBOOK_TRANSITION_IDS].sort());
    for (const [style, slot] of Object.entries(WORLD_TRANSITION_SFX)) {
      expect(slot.length, style).toBeGreaterThan(0);
      for (const choice of slot) {
        expect(paletteRecipes(sketchbook)?.has(choice.recipe), `${style} ${choice.recipe}`).toBe(
          true,
        );
        for (const variant of choice.variants) {
          expect(SFX_VARIANTS[choice.recipe], `${style}: ${variant}`).toContain(variant);
          expect(HEAVY_VARIANTS[choice.recipe] ?? []).not.toContain(variant);
        }
      }
    }
  });

  it('a page-native transition sounds like itself, within the look too; other ids do not', () => {
    const sketchbook = SOUND_PALETTES.sketchbook;
    const into = (style: string): StoryboardShot => ({
      ...shot('sketch-graph'),
      transitionIn: { type: 'wipe', duration: 0.8, style },
    });
    expect(lookChangeSlot(sketchbook, sketchbook, into('sketchbook-crumple-toss'))).toBe(
      WORLD_TRANSITION_SFX['sketchbook-crumple-toss'],
    );
    expect(worldTransitionSlot('sketchbook-page-flip')).toBe(
      WORLD_TRANSITION_SFX['sketchbook-page-flip'],
    );
    expect(worldTransitionSlot('iris')).toBeUndefined();
    expect(worldTransitionSlot('toString')).toBeUndefined();
    expect(lookChangeSlot(sketchbook, sketchbook, into('iris'))).toBeUndefined();
  });
});

describe('wow transition sounds (ADR-028)', () => {
  it('give every wow style a light sound in every palette, within one look too', () => {
    for (const id of SOUND_PALETTE_IDS) {
      for (const style of WOW_STYLE_IDS) {
        const slot = wowSlot(id, style);
        expect(slot, `${id} ${style}`).toBeDefined();
        for (const choice of slot ?? []) {
          expect(SFX_RECIPES, style).toContain(choice.recipe);
          const heavy = HEAVY_VARIANTS[choice.recipe] ?? [];
          for (const variant of choice.variants) {
            expect(SFX_VARIANTS[choice.recipe], `${style}: ${variant}`).toContain(variant);
            expect(heavy, `${style}: ${variant} is bass-heavy`).not.toContain(variant);
          }
        }
      }
    }
    expect(wowSlot('voxel', 'iris')).toBeUndefined();
    expect(wowSlot('retro-ui', 'enter-window')).toBe(WOW_PALETTE_SFX['retro-ui']?.['enter-window']);
    expect(wowSlot('voxel', 'shatter')).toBe(WOW_STYLE_SFX.shatter);
    const retro = SOUND_PALETTES['retro-ui'];
    const into = (look: string, style: string): StoryboardShot => ({
      ...shot(look),
      transitionIn: { type: 'glitch', duration: 1, style },
    });
    expect(lookChangeSlot(retro, retro, into('retro-ui', 'shatter'))).toBe(WOW_STYLE_SFX.shatter);
    expect(lookChangeSlot(VOXEL_PALETTE, VOXEL_PALETTE, into('voxel', 'sponge-wipe'))).toBe(
      WOW_STYLE_SFX['sponge-wipe'],
    );
  });

  it('plays the glass of a shatter in the sound design of a voxel film', () => {
    const shots: StoryboardShot[] = [0, 1, 2].map((index) => ({
      ...shot('voxel'),
      id: `s0${String(index + 1)}`,
      t0: index * 5,
      t1: (index + 1) * 5,
      scene: `scenes/s0${String(index + 1)}.js`,
      ...(index === 1
        ? { transitionIn: { type: 'glitch' as const, duration: 1, style: 'shatter' } }
        : {}),
    }));
    const gestures = findGestures({ shots, words: [], sceneSfx: [], anchors: [] });
    const cues = directCues(gestures, shots, 15, shotPalettes(shots));
    expect(cues.find((cue) => cue.shotId === 's02' && cue.kind === 'transition-glitch')?.name).toBe(
      'glass-crack',
    );
  });
});

describe('pickRecipe', () => {
  const slot = [pick('crt-zap'), pick('disk-seek'), pick('modem', [], { weight: 2 })];

  it('returns the only candidate (voxel rules) and nothing for an empty slot', () => {
    expect(pickRecipe({ candidates: [pick('pop')], salt: 'x', history: ['pop'] })?.recipe).toBe(
      'pop',
    );
    expect(pickRecipe({ candidates: [], salt: 'x', history: NO_HISTORY })).toBeUndefined();
  });

  it('is deterministic per salt and follows the weights', () => {
    const counts = new Map<string, number>();
    for (let index = 0; index < 400; index++) {
      const request = { candidates: slot, salt: `cue-${String(index)}`, history: NO_HISTORY };
      const recipe = pickRecipe(request)?.recipe ?? '';
      expect(pickRecipe(request)?.recipe).toBe(recipe);
      counts.set(recipe, (counts.get(recipe) ?? 0) + 1);
    }
    expect([...counts.keys()].sort()).toEqual(['crt-zap', 'disk-seek', 'modem']);
    expect(counts.get('modem') ?? 0).toBeGreaterThan(counts.get('crt-zap') ?? 0);
  });

  it('skips recently used recipes while another candidate is left (12.23)', () => {
    for (let index = 0; index < 50; index++) {
      const salt = `cue-${String(index)}`;
      const recipe = pickRecipe({ candidates: slot, salt, history: ['modem', 'crt-zap'] });
      expect(recipe?.recipe).toBe('disk-seek');
    }
    const all = pickRecipe({ candidates: slot, salt: 'y', history: ['crt-zap', 'disk-seek'] });
    expect(all?.recipe).toBe('modem');
    const exhausted = ['modem', 'crt-zap', 'disk-seek'] as const;
    expect(
      pickRecipe({ candidates: slot.slice(0, 2), salt: 'z', history: exhausted }),
    ).toBeDefined();
  });
});
