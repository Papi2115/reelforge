/**
 * The tendencies of a project's genre preset (PLAN.md#13.8 part b, ADR-035), looked up by
 * `project.json#genrePreset` when a stage runs: preferred music moods for the sound designer,
 * favoured looks and the wow-transition pace for the storyboard (prompt and validator). A project
 * without a (known) preset gets nothing, so its prompts and checks stay exactly as before.
 */
import type { Look } from '@reelforge/kit';
import { MUSIC_MOODS } from '@reelforge/pipeline';
import { genreWowScale, soundCuesGenreVars, storyboardGenreVars } from '@reelforge/prompts';
import { findGenrePreset, type GenrePreset, type ProjectFile } from '@reelforge/shared';
import { WORLD_MOODS } from './sound/acts.js';

type GenreProject = Pick<ProjectFile, 'genrePreset'>;

/** The project's built-in genre preset; undefined without one or for a retired id. */
export function projectGenrePreset(project: GenreProject): GenrePreset | undefined {
  return findGenrePreset(project.genrePreset);
}

/**
 * Sound-cues variables: the preset's moods that this style may use (a world's own moods, else
 * every music mood), only when the film has generated music beds (`hasMusic`).
 */
export function soundGenrePromptVars(
  project: GenreProject,
  styleId: string,
  hasMusic: boolean,
): Readonly<Record<string, string>> {
  if (!hasMusic) return {};
  const world = Object.hasOwn(WORLD_MOODS, styleId) ? WORLD_MOODS[styleId] : undefined;
  return soundCuesGenreVars(projectGenrePreset(project), world ?? MUSIC_MOODS);
}

/**
 * Storyboard variables on top of the look variables (`lookVars`, looks.ts): the favoured looks
 * where 2+ looks are offered, the genre's wow pace and budget where the prompt lists the wow
 * transitions with a budget (a world lists its own transitions instead).
 */
export function storyboardGenrePromptVars(
  project: GenreProject,
  lookVars: Readonly<Record<string, string | boolean>>,
  looks: readonly Look[],
  durationS: number,
): Readonly<Record<string, string>> {
  const preset = projectGenrePreset(project);
  if (preset === undefined) return {};
  const statesWow = lookVars['wowTransitions'] !== undefined && lookVars['wowBudget'] !== undefined;
  return storyboardGenreVars(preset, {
    looks: lookVars['multiLook'] === true ? looks.map((look) => look.id) : [],
    wowDurationS: statesWow ? durationS : undefined,
  });
}

/** Storyboard validator options: the wow multiplier when the preset changes it. */
export function storyboardGenreCheckOptions(project: GenreProject): { readonly wowScale?: number } {
  const scale = genreWowScale(projectGenrePreset(project));
  return scale === undefined ? {} : { wowScale: scale };
}
