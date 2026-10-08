/**
 * Sound palettes (PLAN.md#12.24): each look re-voices the sound director's events with its own
 * SFX and ambience. The rule table (`cue-rules.ts`: levels, leads, priorities, density) is shared
 * by every palette, so levels and the pixel crush keep the film coherent; a palette only says
 * which recipes play. Documented in docs/sfx.md ("Sound palettes").
 */
import type { AmbienceRecipe, SfxCategory, SfxRecipe } from '@reelforge/pipeline';
import type { StoryboardShot } from '@reelforge/shared';
import type { CueEventKind, RecipeChoice } from '../cue-rules.js';

export const SOUND_PALETTE_IDS = [
  'voxel',
  'retro-ui',
  'diorama',
  'blueprint',
  'flat-2d',
  'whiteboard',
  'paper-cutout',
  'sketchbook',
  'comic',
  'game-b2',
  'game-b1',
] as const;
export type SoundPaletteId = (typeof SOUND_PALETTE_IDS)[number];

export interface PaletteChoice extends RecipeChoice {
  /** Relative weight among the candidates of a slot (default 1). */
  readonly weight?: number | undefined;
  /** Overrides the rule's lead (s), for a sound whose hit is not at its start. */
  readonly leadS?: number | undefined;
  /** dB on top of the rule's trim. */
  readonly trimDb?: number | undefined;
}

/**
 * The candidates of one choice slot of a rule. Slots keep the meaning of `CUE_RULES[kind].choices`
 * (e.g. `transition-cut` slot 0 = into a UI-like shot, 1 = into a 3D scene; `counter-step` 0/1 =
 * tick/tock); a missing slot falls back to slot 0.
 */
export type PaletteSlot = readonly PaletteChoice[];

/** Event kinds a palette can re-voice (`scene` sounds go through `SceneTranslation`). */
export type PaletteKind = Exclude<CueEventKind, 'scene'>;

/** Recipes a scene asked for (`ctx.sfx.at`), moved into the palette. */
export interface SceneTranslation {
  /** Generic recipe -> this palette's recipe. */
  readonly map: Readonly<Partial<Record<SfxRecipe, SfxRecipe>>>;
  /** Any other recipe outside the palette, by its category. */
  readonly byCategory: Readonly<Record<SfxCategory, SfxRecipe>>;
}

export interface PaletteAmbience {
  /** Splits ambience groups inside the look (e.g. a diorama office vs a city); one bed per key. */
  readonly key: (shot: StoryboardShot) => string;
  /** The bed of a shot group; `groupIndex` counts every group of the film. */
  readonly bed: (key: string, groupIndex: number) => AmbienceRecipe;
  readonly gainDb: number;
  /** The bed under generated music (one per run of shots with the same key). */
  readonly underMusic: (key: string) => AmbienceRecipe;
  readonly underMusicGainDb: number;
}

export interface SoundPalette {
  readonly id: SoundPaletteId;
  readonly label: string;
  /**
   * The world (style id) whose looks use it. A world's style is exclusive (ADR-029): its films
   * never mix with the built-in looks, so a world palette may reuse their recipes; palettes of one
   * world (or of the built-in looks) keep their recipes apart.
   */
  readonly world?: string | undefined;
  /** Slots per re-voiced kind; kinds left out keep the `CUE_RULES` choices. */
  readonly sfx: Readonly<Partial<Record<PaletteKind, readonly PaletteSlot[]>>>;
  /**
   * Variant names of the palette's `list-item` recipe from low to high pitch (a list reveal rises
   * through them); undefined = the voxel `pop` order.
   */
  readonly listPitch?: readonly string[] | undefined;
  /** Undefined = scene sounds play as asked (voxel). */
  readonly scene?: SceneTranslation | undefined;
  /**
   * Signature sounds of a transition into this look from another look, by ambience key (`''` =
   * any key); none = the palette's usual transition sound.
   */
  readonly accents: Readonly<Record<string, PaletteSlot>>;
  readonly ambience: PaletteAmbience;
}

export const pick = (
  recipe: SfxRecipe,
  variants: readonly string[] = [],
  extra: Omit<PaletteChoice, 'recipe' | 'variants'> = {},
): PaletteChoice => ({ recipe, variants, ...extra });

/** One slot with one candidate. */
export const only = (recipe: SfxRecipe, ...variants: string[]): readonly PaletteSlot[] => [
  [pick(recipe, variants)],
];
