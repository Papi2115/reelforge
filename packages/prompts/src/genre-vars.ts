/**
 * Prompt variables of a project's genre preset (PLAN.md#13.8, ADR-035): its preferred music moods
 * (sound-cues `{{#genreMoods}}`), the looks it favours (storyboard `{{#genreLooks}}`) and its
 * wow-transition pace (storyboard `{{#genreWowPace}}`, the `wowBudget` number, the validator's
 * `wowScale`). No preset, or nothing of it that applies here, adds no variable, so the prompts
 * render byte for byte as before presets. Hints only: every mood and look stays allowed.
 */
import {
  clampWowScale,
  wowBudget,
  wowPacing,
  type GenrePreset,
  type GenreMusicMood,
} from '@reelforge/shared';

export type GenrePromptPreset = Pick<
  GenrePreset,
  'name' | 'musicMoodsPreferred' | 'preferredLooks' | 'wowTransitionBudget'
>;

const ids = (list: readonly string[]): string => list.map((id) => `\`${id}\``).join(', ');

/**
 * Sound-cues variables: the preset's moods, best first, that the project may use (`allowedMoods`:
 * every music mood, or a world's own); none of them allowed = nothing.
 */
export function soundCuesGenreVars(
  preset: GenrePromptPreset | undefined,
  allowedMoods: readonly string[],
): Readonly<Record<string, string>> {
  const moods = (preset?.musicMoodsPreferred ?? []).filter((mood: GenreMusicMood) =>
    allowedMoods.includes(mood),
  );
  if (preset === undefined || moods.length === 0) return {};
  return { genreName: preset.name, genreMoods: moods.join(', ') };
}

/** The preset's wow multiplier when it changes anything (clamped; 1 = undefined). */
export function genreWowScale(preset: GenrePromptPreset | undefined): number | undefined {
  const scale = preset?.wowTransitionBudget;
  if (scale === undefined) return undefined;
  const clamped = clampWowScale(scale);
  return clamped === 1 ? undefined : clamped;
}

export interface StoryboardGenreOptions {
  /**
   * Look ids the storyboard may use, only in a `mixed` project with 2+ looks (otherwise empty: no
   * looks hint). A world offers only its own looks, so the built-in looks of a preset never match.
   */
  readonly looks: readonly string[];
  /** Film length when the prompt states the wow budget (`wowBudget` is set); else undefined. */
  readonly wowDurationS?: number | undefined;
}

/**
 * Storyboard variables: `genreLooks` (the preset's looks the project offers, in its order) and,
 * for a multiplier other than 1, `genreWowPace` with the scaled `wowBudget`.
 */
export function storyboardGenreVars(
  preset: GenrePromptPreset | undefined,
  options: StoryboardGenreOptions,
): Readonly<Record<string, string>> {
  if (preset === undefined) return {};
  const looks =
    options.looks.length >= 2
      ? (preset.preferredLooks ?? []).filter((look) => options.looks.includes(look))
      : [];
  const scale = genreWowScale(preset);
  const pacing = scale === undefined ? undefined : wowPacing(scale);
  const durationS = options.wowDurationS;
  return {
    ...(looks.length === 0 ? {} : { genreName: preset.name, genreLooks: ids(looks) }),
    ...(pacing === undefined || durationS === undefined
      ? {}
      : {
          genreWowPace: `about one per ${String(pacing.warnSpacingS)}–${String(pacing.maxSpacingS)} s (the pace of this genre)`,
          wowBudget: String(wowBudget(durationS, scale)),
        }),
  };
}
