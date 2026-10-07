/**
 * Genre presets in the UI (PLAN.md#13.8, ADR-035): the New project form's "Genre" choice (its
 * options, the one-line preview of what it sets, the style fallback note, and which form fields the
 * user touched so they beat the preset), Settings → Channels → "Genre of new projects", and the
 * read-only "Genre" row of Project settings. Pure: no React, no IPC.
 */
import {
  findGenrePreset,
  GENRE_PRESETS,
  resolveGenrePreset,
  SHOT_RANGE_PRESETS,
  shotRangeChoice,
  type GenrePreset,
  type GenrePresetResolution,
  type ShotsPerMinute,
} from '@reelforge/shared';
import type { NewProjectFormField } from '../../shared/project-contract.js';
import { describeStyle, isOfferedStyle, styleLabel } from '../../shared/style-choices.js';

export const GENRE_NONE_LABEL = 'None';
export const GENRE_FIELD_HINT =
  'One choice that sets the style, pace and direction for this kind of film. What you change below stays your choice.';
export const CHANNEL_GENRE_HINT =
  'New projects of this channel start with this genre; the New project form can pick another.';
export const GENRE_ROW_NOTE =
  'Chosen when the project was created: it filled in the style, pace and direction. Change those options here any time.';
export const GENRE_ROW_NONE_NOTE =
  'A genre is chosen when a project is created (New project → Genre). This project has none.';

export interface GenreOption {
  readonly id: string;
  readonly label: string;
  readonly description: string;
}

/** The presets in the form's order. */
export function genreOptions(presets: readonly GenrePreset[] = GENRE_PRESETS): GenreOption[] {
  return presets.map(({ id, name, description }) => ({ id, label: name, description }));
}

/** The name of a genre preset id; an id this build does not know is shown as is. */
export function genreLabel(id: string, presets: readonly GenrePreset[] = GENRE_PRESETS): string {
  return findGenrePreset(id, presets)?.name ?? id;
}

/**
 * The genre the New project form shows: the user's pick (null = None), else the channel's when
 * the app knows it, else none.
 */
export function chosenGenre(
  picked: string | null | undefined,
  channelGenre: string | null | undefined,
  presets: readonly GenrePreset[] = GENRE_PRESETS,
): string | null {
  if (picked !== undefined) return picked;
  return findGenrePreset(channelGenre, presets)?.id ?? null;
}

/** The form fields the user changed by hand (they beat the preset). */
export type TouchedFields = ReadonlySet<NewProjectFormField>;

export function withTouched(touched: TouchedFields, field: NewProjectFormField): TouchedFields {
  return touched.has(field) ? touched : new Set([...touched, field]);
}

/** What the form shows and sends with the genre applied. */
export interface GenreFormValues {
  /** Undefined without a genre. */
  readonly resolution: GenrePresetResolution | undefined;
  readonly style: string | undefined;
  readonly shotsPerMinute: ShotsPerMinute | null;
  readonly fasterChecks: boolean;
}

export interface GenreFormInput {
  readonly genre: string | null;
  readonly touched: TouchedFields;
  readonly experimentalWorlds: boolean;
  /** What the form shows without a genre (the user's pick, else the channel's / app's). */
  readonly style: string | undefined;
  readonly shotsPerMinute: ShotsPerMinute | null;
  readonly fasterChecks: boolean;
}

/** Whether a new project may get style `id` (style-choices.ts; injectable for tests). */
export type StyleOffer = (id: string, experimentalWorlds: boolean) => boolean;

/** The form's values: the preset's for every field the user has not touched. */
export function genreFormValues(
  input: GenreFormInput,
  offered: StyleOffer = isOfferedStyle,
): GenreFormValues {
  const resolution =
    input.genre === null
      ? undefined
      : resolveGenrePreset(input.genre, {
          isStyleAvailable: (id) => offered(id, input.experimentalWorlds),
          explicit: input.touched,
        });
  const patch = resolution?.patch ?? {};
  return {
    resolution,
    style: patch.style ?? input.style,
    shotsPerMinute: patch.shotsPerMinute ?? input.shotsPerMinute,
    fasterChecks: patch.fasterChecks ?? input.fasterChecks,
  };
}

const PACE_WORDS: Readonly<Record<keyof typeof SHOT_RANGE_PRESETS, string>> = {
  calm: 'calm pace',
  balanced: 'steady pace',
  dynamic: 'fast pace',
};

function rangeText(range: ShotsPerMinute): string {
  return `${String(range.min)}–${String(range.max)} scenes a minute`;
}

/** "Hand-drawn notebook": the part of the style's line before its colon. */
function styleLook(id: string): string {
  const description = describeStyle(id)?.description ?? '';
  const head = description.split(':')[0]?.trim() ?? '';
  return head === '' ? styleLabel(id) : head;
}

/**
 * One line of what the preset sets, in plain words:
 * "Hand-drawn notebook · calm pace · 3–5 scenes a minute · continuity links · no pattern interrupts".
 * Fields the user chose say "your …".
 */
export function genrePreviewLine(
  resolution: GenrePresetResolution,
  touched: TouchedFields,
): string {
  const { patch } = resolution;
  const parts: string[] = [];
  if (touched.has('style')) parts.push('your style');
  else if (patch.style !== undefined) parts.push(styleLook(patch.style));
  const world = patch.style !== undefined && describeStyle(patch.style)?.world === true;
  if (patch.lookMode === 'mixed' && !world) parts.push('mixed looks');
  const range = patch.shotsPerMinute;
  if (touched.has('shotsPerMinute')) {
    parts.push('your scenes per minute');
  } else if (range !== undefined) {
    const choice = shotRangeChoice(range);
    if (choice === 'calm' || choice === 'balanced' || choice === 'dynamic') {
      parts.push(PACE_WORDS[choice]);
    }
    parts.push(rangeText(range));
  }
  if (patch.continuityLinks === true) parts.push('continuity links');
  if (patch.patternInterrupts === 'off') parts.push('no pattern interrupts');
  if (patch.fasterChecks === true) parts.push('faster checks');
  return parts.join(' · ');
}

type SkipKind = 'switch' | 'development' | 'unknown';

/** Why the app passes over a style the preset prefers. */
function skipKind(id: string, experimentalWorlds: boolean, offered: StyleOffer): SkipKind {
  const style = describeStyle(id);
  if (style === undefined) return 'unknown';
  return style.preview && !experimentalWorlds && offered(id, true) ? 'switch' : 'development';
}

/** "Sketchbook", "Sketchbook and Comic", "A, B and C". */
function listNames(names: readonly string[]): string {
  return names.length < 2
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} and ${names.at(-1) ?? ''}`;
}

function skipPhrase(kind: SkipKind, names: readonly string[]): string {
  const one = names.length === 1;
  switch (kind) {
    case 'switch':
      return `${listNames(names)} ${one ? 'needs' : 'need'} “Experimental worlds” (Settings → Projects)`;
    case 'development':
      return `${listNames(names)} ${one ? 'is' : 'are'} in development`;
    case 'unknown':
      return `${listNames(names)} ${one ? 'is' : 'are'} not in this version of the app`;
  }
}

/**
 * Said when a preferred style is not offered: "Comic is in development, using Sketchbook.";
 * undefined when the preset's first style is used (or the user chose the style).
 */
export function genreStyleNote(
  resolution: GenrePresetResolution,
  experimentalWorlds: boolean,
  offered: StyleOffer = isOfferedStyle,
): string | undefined {
  if (resolution.skippedStyles.length === 0) return undefined;
  const groups = new Map<SkipKind, string[]>();
  for (const id of resolution.skippedStyles) {
    const kind = skipKind(id, experimentalWorlds, offered);
    groups.set(kind, [...(groups.get(kind) ?? []), styleLabel(id)]);
  }
  const phrases = [...groups].map(([kind, names]) => skipPhrase(kind, names));
  const using =
    resolution.style === undefined
      ? 'so the style stays as chosen below'
      : `using ${styleLabel(resolution.style)}`;
  return `${listNames(phrases)}, ${using}.`;
}

/** Project settings → Genre: the name shown, its "Recipe: …" tooltip and the row's note. */
export function genreRowText(
  id: string | undefined,
  presets: readonly GenrePreset[] = GENRE_PRESETS,
): { readonly label: string; readonly recipe: string | undefined; readonly note: string } {
  if (id === undefined) {
    return { label: GENRE_NONE_LABEL, recipe: undefined, note: GENRE_ROW_NONE_NOTE };
  }
  const preset = findGenrePreset(id, presets);
  if (preset === undefined) {
    return { label: `${id} (not in this version)`, recipe: undefined, note: GENRE_ROW_NOTE };
  }
  return {
    label: preset.name,
    recipe: `Recipe: ${preset.description} Script tone: ${preset.scriptTone}.`,
    note: GENRE_ROW_NOTE,
  };
}
