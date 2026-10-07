/**
 * The Game B2 world palette (PLAN.md#13.4): it voices the world's three looks (and is the world's
 * own palette), every game-native transition sounds like itself with recipes of the palette, and a
 * game-b2 film never falls back to voxel. The generic palette checks (every event kind, existing
 * light variants, no voxel recipes, every scene sound translated) run for it in palettes.test.ts.
 */
import { GAME_B2_TRANSITION_IDS } from '@reelforge/engine';
import { SFX_VARIANTS } from '@reelforge/pipeline';
import type { StoryboardShot } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { HEAVY_VARIANTS } from '../cue-rules.js';
import { ALL_LOOKS } from '../../testing/sound-films.js';
import {
  GAME_B2_TRANSITION_SFX,
  lookChangeSlot,
  paletteForShot,
  paletteRecipes,
  SOUND_PALETTES,
  worldPalette,
  worldTransitionSlot,
} from './index.js';

const shot = (look: string, style?: string): StoryboardShot => ({
  id: 's02',
  t0: 4,
  t1: 8,
  treatment: 'map',
  intent: 'a shot',
  scene: 'scenes/s02.js',
  look,
  ...(style === undefined ? {} : { transitionIn: { type: 'wipe', duration: 0.9, style } }),
});

describe('game-b2 world palette', () => {
  it('voices the three game-b2 looks and is the world palette', () => {
    const palette = SOUND_PALETTES['game-b2'];
    expect(palette.world).toBe('game-b2');
    expect(worldPalette('game-b2')).toBe(palette);
    const looks = ALL_LOOKS.filter((entry) => entry.styles?.includes('game-b2'));
    expect(looks.map((look) => look.id).sort()).toEqual(['rpg-boss', 'rpg-explore', 'rpg-menu']);
    for (const look of looks) {
      expect(look.soundPalette, look.id).toBe('game-b2');
      expect(paletteForShot(shot(look.id), { style: 'game-b2', looks: ALL_LOOKS })).toBe(palette);
    }
    expect(paletteForShot(shot('retro-ui'), { style: 'game-b2', looks: ALL_LOOKS })).toBe(palette);
  });

  it('gives every game-native transition its own sound from the palette', () => {
    const palette = SOUND_PALETTES['game-b2'];
    expect(Object.keys(GAME_B2_TRANSITION_SFX).sort()).toEqual([...GAME_B2_TRANSITION_IDS].sort());
    for (const [style, slot] of Object.entries(GAME_B2_TRANSITION_SFX)) {
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
    const into = shot('rpg-explore', 'game-b2-door');
    expect(lookChangeSlot(palette, palette, into)).toBe(GAME_B2_TRANSITION_SFX['game-b2-door']);
    expect(worldTransitionSlot('game-b2-nope')).toBeUndefined();
  });
});
