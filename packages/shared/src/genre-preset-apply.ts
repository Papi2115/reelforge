/**
 * Applying a genre preset (PLAN.md#13.8, ADR-035): pure functions from a preset id to the
 * project.json fields it writes. Precedence lives with the caller (createProject): the user's
 * explicit choices in the same form beat the preset (`explicit`), the preset beats the channel's
 * and the app's defaults. The style is the first of the preset's styles the app offers
 * (`isStyleAvailable`: built-ins; worlds only when wired and, if experimental, with the switch on).
 */
import { findGenrePreset, GENRE_PRESETS, type GenrePreset } from './genre-presets.js';
import type { ProjectFile } from './project.js';

/** project.json fields a preset writes (besides `genrePreset` itself). */
export const GENRE_PRESET_FIELDS = [
  'style',
  'lookMode',
  'shotsPerMinute',
  'fasterChecks',
  'tensionMap',
  'beatSync',
  'patternInterrupts',
  'openLoops',
  'revealMoments',
  'repetitionControl',
  'ambientVariation',
  'researchMode',
  'continuityLinks',
] as const;
export type GenrePresetField = (typeof GENRE_PRESET_FIELDS)[number];

export type GenrePresetPatch = Partial<Pick<ProjectFile, GenrePresetField | 'genrePreset'>>;

export interface ApplyGenrePresetOptions {
  /** True when the app offers style `id` for a new project right now. */
  readonly isStyleAvailable: (id: string) => boolean;
  /** Fields the user set in the same form: the preset leaves them alone. */
  readonly explicit?: Iterable<GenrePresetField> | undefined;
}

export interface GenrePresetResolution {
  readonly preset: GenrePreset;
  /** The project.json fields to write (always includes `genrePreset`). */
  readonly patch: GenrePresetPatch;
  /** The preset's style that won; undefined when none is offered or the user chose the style. */
  readonly style: string | undefined;
  /** Preferred styles passed over because the app does not offer them, in order. */
  readonly skippedStyles: readonly string[];
}

function pickStyle(
  preset: GenrePreset,
  isStyleAvailable: (id: string) => boolean,
): { style: string | undefined; skipped: string[] } {
  const skipped: string[] = [];
  for (const id of preset.styles) {
    if (isStyleAvailable(id)) return { style: id, skipped };
    skipped.push(id);
  }
  return { style: undefined, skipped };
}

/** Every field the preset sets, before the user's explicit choices are taken out. */
function presetFields(preset: GenrePreset, style: string | undefined): GenrePresetPatch {
  return {
    ...(style === undefined ? {} : { style }),
    lookMode: preset.lookMode,
    shotsPerMinute: { ...preset.shotsPerMinute },
    ...(preset.fasterChecks === undefined ? {} : { fasterChecks: preset.fasterChecks }),
    ...preset.direction,
    ambientVariation: preset.ambientVariation,
    researchMode: preset.researchMode,
    continuityLinks: preset.continuityLinks,
  };
}

/** The patch of preset `presetId`; undefined for an unknown id. */
export function resolveGenrePreset(
  presetId: string,
  options: ApplyGenrePresetOptions,
  presets: readonly GenrePreset[] = GENRE_PRESETS,
): GenrePresetResolution | undefined {
  const preset = findGenrePreset(presetId, presets);
  if (preset === undefined) return undefined;
  const explicit = new Set<string>(options.explicit ?? []);
  const { style, skipped } = explicit.has('style')
    ? { style: undefined, skipped: [] }
    : pickStyle(preset, options.isStyleAvailable);
  const fields = Object.entries(presetFields(preset, style)).filter(([key]) => !explicit.has(key));
  return {
    preset,
    patch: { ...(Object.fromEntries(fields) as GenrePresetPatch), genrePreset: preset.id },
    style,
    skippedStyles: skipped,
  };
}

/**
 * `project` with preset `presetId` applied (the explicit fields kept); undefined for an unknown id.
 * For previews such as the New project form; createProject applies the patch itself.
 */
export function applyGenrePreset<T extends object>(
  project: T,
  presetId: string,
  options: ApplyGenrePresetOptions,
  presets: readonly GenrePreset[] = GENRE_PRESETS,
): (T & GenrePresetPatch) | undefined {
  const resolution = resolveGenrePreset(presetId, options, presets);
  return resolution === undefined ? undefined : { ...project, ...resolution.patch };
}
