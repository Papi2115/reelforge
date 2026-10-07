/**
 * Sound palette registry and lookup (PLAN.md#12.24): a shot's palette is its look's `soundPalette`
 * (kit look registry). `voxel-only` projects, shots without a look, unknown or not-yet-available
 * looks and unknown palette ids all get `voxel`, whose rules are the 1.x sound design exactly. In
 * a world's style (PLAN.md#13.6) every shot sounds in a palette of that world: its look's, else the
 * world's own (`World.soundPalette`), never voxel.
 */
import { getLook, WORLDS, type Look } from '@reelforge/kit';
import { SFX_CATEGORY, type SfxRecipe } from '@reelforge/pipeline';
import {
  shotLook,
  type LookMode,
  type StoryboardShot,
  type TransitionStyleId,
} from '@reelforge/shared';
import { CUE_RULES } from '../cue-rules.js';
import { BLUEPRINT_PALETTE } from './blueprint.js';
import { COMIC_PALETTE, COMIC_TRANSITION_SFX } from './comic.js';
import { DIORAMA_PALETTE } from './diorama.js';
import { FLAT_2D_PALETTE } from './flat-2d.js';
import { GAME_B2_PALETTE, GAME_B2_TRANSITION_SFX } from './game-b2.js';
import { PAPER_CUTOUT_PALETTE } from './paper-cutout.js';
import { RETRO_UI_PALETTE } from './retro-ui.js';
import { SKETCHBOOK_PALETTE, WORLD_TRANSITION_SFX } from './sketchbook.js';
import { WHITEBOARD_PALETTE } from './whiteboard.js';
import {
  pick,
  type PaletteKind,
  type PaletteSlot,
  type SoundPalette,
  type SoundPaletteId,
} from './types.js';
import { VOXEL_PALETTE } from './voxel.js';
import { wowSlot } from './wow-sfx.js';

export * from './types.js';
export { NO_HISTORY, pickRecipe, type RecipePickRequest } from './pick.js';
export { dioramaKind } from './diorama.js';
export { VOXEL_PALETTE };
export { WOW_PALETTE_SFX, WOW_STYLE_SFX, wowSlot } from './wow-sfx.js';
export { SKETCHBOOK_PALETTE, WORLD_TRANSITION_SFX };
export { COMIC_PALETTE, COMIC_TRANSITION_SFX };
export { GAME_B2_PALETTE, GAME_B2_TRANSITION_SFX };

export const SOUND_PALETTES: Readonly<Record<SoundPaletteId, SoundPalette>> = {
  voxel: VOXEL_PALETTE,
  'retro-ui': RETRO_UI_PALETTE,
  diorama: DIORAMA_PALETTE,
  blueprint: BLUEPRINT_PALETTE,
  'flat-2d': FLAT_2D_PALETTE,
  whiteboard: WHITEBOARD_PALETTE,
  'paper-cutout': PAPER_CUTOUT_PALETTE,
  sketchbook: SKETCHBOOK_PALETTE,
  comic: COMIC_PALETTE,
  'game-b2': GAME_B2_PALETTE,
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
  /** The project's style: a world's style falls back to the world's palette. */
  readonly style?: string | undefined;
}

/** The sound palette of a world's style (undefined for the built-in styles). */
export function worldPalette(style: string | undefined): SoundPalette | undefined {
  const world = WORLDS.find((entry) => entry.id === style);
  return world === undefined ? undefined : getSoundPalette(world.soundPalette);
}

/** The palette a shot sounds in (see the module comment). */
export function paletteForShot(
  shot: Pick<StoryboardShot, 'look'>,
  options: PaletteOptions = {},
): SoundPalette {
  const world = worldPalette(options.style);
  if (world === undefined && (options.lookMode ?? 'voxel-only') === 'voxel-only') {
    return VOXEL_PALETTE;
  }
  const look = getLook(shotLook(shot), options.looks);
  const own = getSoundPalette(look?.soundPalette);
  if (world === undefined) return own ?? VOXEL_PALETTE;
  return own !== undefined && own.world === world.world ? own : world;
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
 * Signature sounds of the look-change transition styles (PLAN.md#12.15): a look change through
 * one of them sounds like the style (the CRT powers on, tiles flip, the pen draws, pixels melt).
 */
export const TRANSITION_STYLE_SFX: Readonly<Partial<Record<TransitionStyleId, PaletteSlot>>> = {
  'crt-zoom': [pick('crt-zap', ['power-on', 'degauss'], { leadS: 0.02 })],
  'tile-flip': [pick('paper-shuffle', ['flip']), pick('servo', ['step'], { weight: 0.5 })],
  'draw-over': [pick('pencil-scratch', ['line']), pick('plotter-pen', ['line'], { weight: 0.5 })],
  'pixel-sort-melt': [pick('glitch'), pick('downer', [], { weight: 0.5 })],
};

/**
 * The slot of a transition into a shot of palette `to` from a shot of palette `from` (PLAN.md
 * #12.15): a world's page-native transition (PLAN.md#13.6, `WORLD_TRANSITION_SFX`) and a wow style
 * (ADR-028) always sound like themselves (`wow-sfx.ts` in `to`'s voice), look or no look change;
 * when the look changes, the transition style's own sound (TRANSITION_STYLE_SFX), else `to`'s
 * accents; no look change = none (the palette's usual transition sound).
 */
export function lookChangeSlot(
  from: SoundPalette,
  to: SoundPalette,
  toShot: StoryboardShot,
): PaletteSlot | undefined {
  const transition = toShot.transitionIn;
  const style =
    transition === undefined || transition.type === 'cut' ? undefined : transition.style;
  const world = worldTransitionSlot(style);
  if (world !== undefined) return world;
  const wow = wowSlot(to.id, style);
  if (wow !== undefined) return wow;
  if (from.id === to.id) return undefined;
  const styled = style === undefined ? undefined : TRANSITION_STYLE_SFX[style as TransitionStyleId];
  if (styled !== undefined) return styled;
  const slot = to.accents[to.ambience.key(toShot)] ?? to.accents[''];
  return slot !== undefined && slot.length > 0 ? slot : undefined;
}

/** The sound of a world's page-native transition style (undefined: not one). */
export function worldTransitionSlot(style: string | undefined): PaletteSlot | undefined {
  if (style === undefined) return undefined;
  if (Object.hasOwn(WORLD_TRANSITION_SFX, style)) {
    return WORLD_TRANSITION_SFX[style as keyof typeof WORLD_TRANSITION_SFX];
  }
  if (Object.hasOwn(COMIC_TRANSITION_SFX, style)) {
    return COMIC_TRANSITION_SFX[style as keyof typeof COMIC_TRANSITION_SFX];
  }
  if (Object.hasOwn(GAME_B2_TRANSITION_SFX, style)) {
    return GAME_B2_TRANSITION_SFX[style as keyof typeof GAME_B2_TRANSITION_SFX];
  }
  return undefined;
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
