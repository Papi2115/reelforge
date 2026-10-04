/**
 * Replacements for repeated sounds, transitions and visuals (PLAN.md#12.23, pure, deterministic):
 * - SFX: another recipe of the shot's sound palette in the same category (voxel: a short list of
 *   sounds that do the same job), re-picked with `pickRecipe` and a history of what repeats, so
 *   the same film always gets the same proposal;
 * - transitions: `transitionFor` with the repeated styles as `recent` (mixed projects), or another
 *   plain type (voxel-only projects, which never get kit styles);
 * - visuals: a hint for a shot variant (the user still picks the variant).
 */
import { SFX_CATEGORY, type SfxRecipe } from '@reelforge/pipeline';
import {
  getTransitionStyle,
  shotLook,
  transitionFor,
  transitionHash,
  type LookMode,
  type StoryboardShot,
  type Transition,
} from '@reelforge/shared';
import { CATEGORY_GAIN_DB } from '../sound/cue-rules.js';
import { paletteForShot, paletteRecipes, pickRecipe } from '../sound/palettes/index.js';

/** Voxel stand-ins (the voxel palette plays any recipe): light sounds that do the same job. */
const VOXEL_ALTERNATIVES: Readonly<Partial<Record<SfxRecipe, readonly SfxRecipe[]>>> = {
  whoosh: ['swoosh-in', 'swoosh-out'],
  'swoosh-in': ['whoosh', 'swoosh-out'],
  'swoosh-out': ['swoosh-in', 'whoosh'],
  'whoosh-impact': ['hit-soft', 'swoosh-in'],
  hit: ['hit-soft', 'snap'],
  'hit-soft': ['snap', 'hit'],
  pop: ['bubble', 'blip'],
  bubble: ['pop', 'blip'],
  blip: ['pop', 'bubble'],
  click: ['snap', 'blip'],
  snap: ['click', 'blip'],
  tick: ['tock'],
  tock: ['tick'],
  ding: ['chime', 'success'],
  chime: ['ding', 'sparkle'],
  glitch: ['blip-down', 'downer'],
  riser: ['swoosh-in'],
  typewriter: ['scribble'],
  stamp: ['hit-soft'],
};

/** Recipes that could replace `recipe` in a shot (palette-aware); empty = none. */
export function sfxAlternatives(
  recipe: SfxRecipe,
  shot: StoryboardShot | undefined,
  lookMode: LookMode,
): SfxRecipe[] {
  const palette = shot === undefined ? undefined : paletteForShot(shot, { lookMode });
  const own = palette === undefined ? undefined : paletteRecipes(palette);
  if (own === undefined) return [...(VOXEL_ALTERNATIVES[recipe] ?? [])];
  return [...own].filter(
    (candidate) => candidate !== recipe && SFX_CATEGORY[candidate] === SFX_CATEGORY[recipe],
  );
}

/** A different recipe for one repeated cue, avoiding `history` (most recent last). */
export function repickSfx(
  recipe: SfxRecipe,
  shot: StoryboardShot | undefined,
  lookMode: LookMode,
  salt: string,
  history: readonly SfxRecipe[],
): SfxRecipe | undefined {
  const candidates = sfxAlternatives(recipe, shot, lookMode).map((candidate) => ({
    recipe: candidate,
    variants: [],
  }));
  const picked = pickRecipe({ candidates, salt: `${salt}|repeat`, history: [...history, recipe] });
  return picked === undefined || picked.recipe === recipe ? undefined : picked.recipe;
}

/** Gain of a swapped cue: the same place in the mix for the new recipe's category. */
export function swappedGainDb(gainDb: number, from: SfxRecipe, to: SfxRecipe): number {
  const delta = CATEGORY_GAIN_DB[SFX_CATEGORY[to]] - CATEGORY_GAIN_DB[SFX_CATEGORY[from]];
  return Math.round((gainDb + delta) * 10) / 10;
}

const PLAIN_TYPES = ['crossfade', 'wipe', 'glitch'] as const;

/** The style id (or plain type) a transition shows. */
export function transitionStyleOf(transition: Transition | undefined): string | undefined {
  if (transition === undefined || transition.type === 'cut') return undefined;
  return transition.style ?? transition.type;
}

/** Another transition into `shot` that avoids `recent` (see the module comment). */
export function repickTransition(
  shot: StoryboardShot,
  previous: StoryboardShot,
  lookMode: LookMode,
  seed: number,
  recent: readonly string[],
): Transition | undefined {
  const current = shot.transitionIn;
  if (current === undefined || current.type === 'cut') return undefined;
  if (lookMode === 'voxel-only' || current.style === undefined) {
    const type = PLAIN_TYPES.find((candidate) => !recent.includes(candidate));
    return type === undefined || type === current.type
      ? undefined
      : { type, duration: current.duration };
  }
  const choice = transitionFor(
    shotLook(previous),
    shotLook(shot),
    { from: previous.roll, to: shot.roll },
    transitionHash(`${String(seed >>> 0)}|${shot.id}|repeat`),
    { recent, avoidRecent: recent.length },
  );
  if (choice.style === current.style) return undefined;
  const style = getTransitionStyle(choice.style);
  const keeps =
    style !== undefined &&
    current.duration >= style.duration.min &&
    current.duration <= style.duration.max;
  return { ...choice, duration: keeps ? current.duration : choice.duration };
}

/** Longest note a shot-variant build takes. */
export const MAX_HINT_LENGTH = 300;

/** The note a visual repeat gives the shot-variant build. */
export function variantHint(subject: string, otherShotId: string, otherT: number): string {
  const hint = `Avoid repeating ${otherShotId} (${otherT.toFixed(1)} s), which already shows ${subject}: use a different composition, kit definitions or chart/template (or another look the storyboard allows).`;
  return hint.length <= MAX_HINT_LENGTH ? hint : `${hint.slice(0, MAX_HINT_LENGTH - 1)}…`;
}
