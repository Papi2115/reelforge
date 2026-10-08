/**
 * The Game B1 world palette (PLAN.md#13.5 part b): it voices the world's three looks (and is the
 * world's own palette), every game-native transition sounds like itself with recipes of the
 * palette, the toolkits' cue names (score table, manual, cartridge, level select, game over) land
 * on the palette's own recipes, and a game-b1 film never falls back to voxel. The generic palette
 * checks (every event kind, existing light variants, no voxel recipes, every scene sound
 * translated) run for it in palettes.test.ts.
 */
import { GAME_B1_TRANSITION_IDS } from '@reelforge/engine';
import { SFX_VARIANTS, type SfxRecipe } from '@reelforge/pipeline';
import type { StoryboardShot } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { HEAVY_VARIANTS } from '../cue-rules.js';
import { ALL_LOOKS } from '../../testing/sound-films.js';
import {
  GAME_B1_TRANSITION_SFX,
  lookChangeSlot,
  paletteForShot,
  paletteRecipes,
  sceneRecipe,
  SOUND_PALETTES,
  worldPalette,
  worldTransitionSlot,
} from './index.js';

const shot = (look: string, style?: string): StoryboardShot => ({
  id: 's02',
  t0: 4,
  t1: 8,
  treatment: 'ui-mockup',
  intent: 'a shot',
  scene: 'scenes/s02.js',
  look,
  ...(style === undefined ? {} : { transitionIn: { type: 'wipe', duration: 0.8, style } }),
});

describe('game-b1 world palette', () => {
  it('voices the three game-b1 looks and is the world palette', () => {
    const palette = SOUND_PALETTES['game-b1'];
    expect(palette.world).toBe('game-b1');
    expect(worldPalette('game-b1')).toBe(palette);
    const looks = ALL_LOOKS.filter((entry) => entry.styles?.includes('game-b1'));
    expect(looks.map((look) => look.id).sort()).toEqual([
      'atari-boss',
      'atari-menu',
      'atari-story',
    ]);
    for (const look of looks) {
      expect(look.soundPalette, look.id).toBe('game-b1');
      expect(paletteForShot(shot(look.id), { style: 'game-b1', looks: ALL_LOOKS })).toBe(palette);
    }
    expect(paletteForShot(shot('rpg-menu'), { style: 'game-b1', looks: ALL_LOOKS })).toBe(palette);
  });

  it('gives every game-native transition its own sound from the palette', () => {
    const palette = SOUND_PALETTES['game-b1'];
    expect(Object.keys(GAME_B1_TRANSITION_SFX).sort()).toEqual([...GAME_B1_TRANSITION_IDS].sort());
    for (const [style, slot] of Object.entries(GAME_B1_TRANSITION_SFX)) {
      expect(slot.length, style).toBeGreaterThan(0);
      expect(worldTransitionSlot(style), style).toBe(slot);
      for (const choice of slot) {
        expect(paletteRecipes(palette)?.has(choice.recipe), `${style} ${choice.recipe}`).toBe(true);
        for (const variant of choice.variants) {
          expect(SFX_VARIANTS[choice.recipe], `${style}: ${variant}`).toContain(variant);
          expect(HEAVY_VARIANTS[choice.recipe] ?? []).not.toContain(variant);
        }
      }
    }
    const into = shot('atari-menu', 'game-b1-page-slide');
    expect(lookChangeSlot(palette, palette, into)).toBe(
      GAME_B1_TRANSITION_SFX['game-b1-page-slide'],
    );
  });

  it("plays the toolkits' cues as the console's own sounds", () => {
    const palette = SOUND_PALETTES['game-b1'];
    const expected: Readonly<Record<string, SfxRecipe>> = {
      click: 'relay-click', // the cartridge clicks home
      glitch: 'crt-zap', // the garbage frame
      hit: 'board-tap', // the high-score slam
      'blip-up': 'chime-up', // INSERT COIN
      blip: 'measure-blip', // a row prints, the cursor hops
      tick: 'terminal-tick', // initials, the countdown
      scribble: 'pencil-scratch', // the grease pencil, the manual's marks
      'swoosh-in': 'paper-slide', // the page slides in
      paper: 'page-flip', // the page turns
      success: 'chime-up', // the level is chosen
      'blip-down': 'window-close', // game over
    };
    for (const [cue, recipe] of Object.entries(expected))
      expect(sceneRecipe(palette, cue as SfxRecipe), cue).toBe(recipe);
  });
});
