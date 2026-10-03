/**
 * Sound palette registry and lookup (PLAN.md#12.24): a shot's palette is its look's `soundPalette`
 * (kit look registry). `voxel-only` projects, shots without a look, unknown or not-yet-available
 * looks and unknown palette ids all get `voxel`, whose rules are the 1.x sound design exactly.
 */
import { getLook, type Look } from '@reelforge/kit';
import { SFX_CATEGORY, type SfxRecipe } from '@reelforge/pipeline';
import { shotLook, type LookMode, type StoryboardShot } from '@reelforge/shared';
import { CUE_RULES } from '../cue-rules.js';
import { BLUEPRINT_PALETTE } from './blueprint.js';
import { DIORAMA_PALETTE } from './diorama.js';
import { RETRO_UI_PALETTE } from './retro-ui.js';
import type { PaletteKind, PaletteSlot, SoundPalette, SoundPaletteId } from './types.js';
import { VOXEL_PALETTE } from './voxel.js';

export * from './types.js';
export { NO_HISTORY, pickRecipe, type RecipePickRequest } from './pick.js';
export { dioramaKind } from './diorama.js';
export { VOXEL_PALETTE };

export const SOUND_PALETTES: Readonly<Record<SoundPaletteId, SoundPalette>> = {
  voxel: VOXEL_PALETTE,
  'retro-ui': RETRO_UI_PALETTE,
  diorama: DIORAMA_PALETTE,
  blueprint: BLUEPRINT_PALETTE,
};

/** A palette by id (undefined for unknown ids). */
export function getSoundPalette(id: string | undefined): SoundPalette | undefined {
  return Object.values(SOUND_PALETTES).find((palette) => palette.id === id);
}

export interface PaletteOptions {
  /** Absent = `voxel-only`. */
  readonly lookMode?: LookMode | undefined;
  /** The kit's looks (tests pass their own). */
  readonly looks?: readonly Look[] | undefined;
}

/** The palette a shot sounds in (see the module comment). */
export function paletteForShot(
  shot: Pick<StoryboardShot, 'look'>,
  options: PaletteOptions = {},
): SoundPalette {
  if ((options.lookMode ?? 'voxel-only') === 'voxel-only') return VOXEL_PALETTE;
  const look = getLook(shotLook(shot), options.looks);
  return getSoundPalette(look?.soundPalette) ?? VOXEL_PALETTE;
}

/** Palette per shot id. */
export type ShotPalettes = ReadonlyMap<string, SoundPalette>;

export function shotPalettes(
  shots: readonly StoryboardShot[],
  options: PaletteOptions = {},
): ShotPalettes {
  return new Map(shots.map((shot) => [shot.id, paletteForShot(shot, options)]));
}

/** The palette's slots for `kind`; the rule table's own choices (one candidate each) otherwise. */
export function paletteSlots(palette: SoundPalette, kind: PaletteKind): readonly PaletteSlot[] {
  const own = palette.sfx[kind];
  if (own !== undefined) return own;
  const { choices } = CUE_RULES[kind];
  return choices === 'event' ? [] : choices.map((choice) => [choice]);
}

/**
 * Hook for PLAN.md#12.15 (transition sounds per look pair): the slot of a transition into a shot
 * of palette `to` from a shot of palette `from`. Today: `to`'s accents when the look changes,
 * otherwise none (the palette's usual transition sound).
 */
export function lookChangeSlot(
  from: SoundPalette,
  to: SoundPalette,
  toShot: StoryboardShot,
): PaletteSlot | undefined {
  if (from.id === to.id) return undefined;
  const slot = to.accents[to.ambience.key(toShot)] ?? to.accents[''];
  return slot !== undefined && slot.length > 0 ? slot : undefined;
}

const recipeSets = new WeakMap<SoundPalette, ReadonlySet<SfxRecipe>>();

/** Every recipe a palette can play (undefined for voxel: it plays any recipe a scene asks for). */
export function paletteRecipes(palette: SoundPalette): ReadonlySet<SfxRecipe> | undefined {
  if (palette.scene === undefined) return undefined;
  const cached = recipeSets.get(palette);
  if (cached !== undefined) return cached;
  const slots = [...Object.values(palette.sfx).flat(), ...Object.values(palette.accents)];
  const recipes = new Set<SfxRecipe>([
    ...slots.flat().map((choice) => choice.recipe),
    ...Object.values(palette.scene.map),
    ...Object.values(palette.scene.byCategory),
  ]);
  recipeSets.set(palette, recipes);
  return recipes;
}

/** A recipe a scene asked for, as the palette plays it. */
export function sceneRecipe(palette: SoundPalette, recipe: SfxRecipe): SfxRecipe {
  const translation = palette.scene;
  if (translation === undefined || paletteRecipes(palette)?.has(recipe) === true) return recipe;
  return translation.map[recipe] ?? translation.byCategory[SFX_CATEGORY[recipe]];
}
