/**
 * Prompt variables of a short (PLAN.md#13.18): the `short-script` prompt (the parent film's
 * script, beats and research, capped) and the short section of the storyboard prompt. Absent for
 * a film, so the storyboard prompt renders exactly as before.
 */
import {
  DEFAULT_SHORT_ANGLES,
  SHORT_END_CARD_SECONDS,
  shortNarrationSeconds,
  shortTargetWords,
  type ShortLength,
  type VideoLanguage,
} from '@reelforge/shared';
import { SHORT_MAX_FIRST_SENTENCE_WORDS, SHORT_MAX_HOOK_SHOT_S } from './validators/short.js';

/** Caps of the parent's texts in the prompt (a 10 min script is about 9 000 characters). */
export const SHORT_PARENT_SCRIPT_CHARS = 16_000;
export const SHORT_PARENT_BEATS_CHARS = 6_000;
export const SHORT_RESEARCH_DIGEST_CHARS = 8_000;

/** `text` cut to `max` characters at a line end, with a note that it was cut. */
export function capText(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  const cut = trimmed.slice(0, max);
  const lineEnd = cut.lastIndexOf('\n');
  return `${(lineEnd > max / 2 ? cut.slice(0, lineEnd) : cut).trimEnd()}\n[… cut to ${String(max)} characters]`;
}

export interface ShortScriptInput {
  readonly parentTitle: string;
  readonly parentScript: string;
  readonly parentBeats?: string | undefined;
  readonly research?: string | undefined;
  readonly channelName: string;
  readonly lengthS: ShortLength;
  readonly language: VideoLanguage;
  /** The angle chosen for this short; absent = the built-in one of its length. */
  readonly angle?: string | undefined;
  /** The brief's notes (e.g. the other short's angle). */
  readonly notes?: string | undefined;
}

export function shortScriptPromptVars(input: ShortScriptInput): Record<string, unknown> {
  const beats = input.parentBeats?.trim() ?? '';
  const research = input.research?.trim() ?? '';
  const notes = input.notes?.trim() ?? '';
  return {
    parentTitle: input.parentTitle,
    parentScript: capText(input.parentScript, SHORT_PARENT_SCRIPT_CHARS),
    ...(beats === '' ? {} : { parentBeats: capText(beats, SHORT_PARENT_BEATS_CHARS) }),
    ...(research === '' ? {} : { research: capText(research, SHORT_RESEARCH_DIGEST_CHARS) }),
    channelName: input.channelName,
    language: input.language,
    lengthS: input.lengthS,
    narrationS: shortNarrationSeconds(input.lengthS),
    endCardS: SHORT_END_CARD_SECONDS,
    targetWords: shortTargetWords(input.lengthS),
    maxFirstWords: SHORT_MAX_FIRST_SENTENCE_WORDS,
    angle: input.angle ?? DEFAULT_SHORT_ANGLES[input.lengthS],
    ...(notes === '' ? {} : { notes }),
    ...(input.lengthS === 60 ? { deeper: true } : {}),
  };
}

export interface ShortStoryboardInput {
  readonly lengthS: ShortLength;
  readonly parentTitle: string;
  readonly endCardText: string;
}

/** Storyboard prompt variables of a short; undefined input (a film) = none. */
export function storyboardShortVars(
  input: ShortStoryboardInput | undefined,
): Record<string, unknown> {
  if (input === undefined) return {};
  return {
    short: true,
    shortLengthS: input.lengthS,
    shortParentTitle: input.parentTitle,
    shortEndCard: input.endCardText,
    shortEndCardS: SHORT_END_CARD_SECONDS,
    shortHookS: SHORT_MAX_HOOK_SHOT_S,
  };
}

export interface ShortSceneBuildInput {
  readonly lengthS: ShortLength;
  readonly parentTitle: string;
  /** Word-by-word captions are drawn over the frame by the app. */
  readonly captions: boolean;
}

/** Scene-build prompt variables of a short; undefined input (a film) = none. */
export function sceneBuildShortVars(
  input: ShortSceneBuildInput | undefined,
): Record<string, unknown> {
  if (input === undefined) return {};
  return {
    short: true,
    shortLengthS: input.lengthS,
    shortParentTitle: input.parentTitle,
    ...(input.captions ? { shortCaptions: true } : {}),
  };
}
