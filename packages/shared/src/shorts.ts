/**
 * Shorts (PLAN.md#13.18): a SHORT is its own project (`kind: 'short'`) made from a long film: a
 * 30 s or 60 s vertical teaser with a curiosity gap (hook, stakes, withheld answer) that sends
 * the viewer to the full film. It keeps the film's style, channel (so its voice), language and
 * genre; every scene is new. The last 2 s are a fixed end card ("Full video on YT: <channel>")
 * the storyboard stage appends. Absent `kind` = a film (every project made before 3.4).
 */
import { z } from 'zod';
import type { StoryboardShot } from './storyboard.js';
import { WORLD_ASSET_WORLDS } from './world-assets.js';

export const PROJECT_KINDS = ['film', 'short'] as const;
export const projectKindSchema = z.enum(PROJECT_KINDS);
export type ProjectKind = z.infer<typeof projectKindSchema>;

/** Lengths a short is made in, seconds. */
export const SHORT_LENGTHS = [30, 60] as const;
export const shortLengthSchema = z.union([z.literal(30), z.literal(60)]);
export type ShortLength = z.infer<typeof shortLengthSchema>;

/** The film a short was made from: its folder (absolute) and title at creation. */
export const parentProjectSchema = z.object({
  folder: z.string().min(1).max(4_096),
  title: z.string().min(1).max(200),
});
export type ParentProject = z.infer<typeof parentProjectSchema>;

export const MAX_SHORT_ANGLE_LENGTH = 300;

export const shortSettingsSchema = z.object({
  lengthS: shortLengthSchema,
  /** Word-by-word captions (optional, built by a later step). */
  captions: z.boolean(),
  /** Text of the fixed end card, e.g. `Full video on YT: Voxplain`. */
  endCardText: z.string().min(1).max(120),
  /** The teaser's angle (what the hook opens on); absent = the script picks one. */
  angle: z.string().min(1).max(MAX_SHORT_ANGLE_LENGTH).optional(),
});
export type ShortSettings = z.infer<typeof shortSettingsSchema>;

/** Seconds of the fixed end card at the end of every short. */
export const SHORT_END_CARD_SECONDS = 2;

/** Speaking rate a short's script is planned with (faster than a film's 150 wpm). */
export const SHORT_WORDS_PER_SECOND = 2.6;

/** The end card text of a channel. */
export function shortEndCardText(channelName: string): string {
  return `Full video on YT: ${channelName.trim()}`;
}

interface MaybeShort {
  readonly kind?: ProjectKind | undefined;
  readonly short?: ShortSettings | undefined;
}

/** Whether a project is a short (absent kind = a film). */
export function isShort<T extends MaybeShort>(
  project: T,
): project is T & { readonly kind: 'short'; readonly short: ShortSettings } {
  return project.kind === 'short' && project.short !== undefined;
}

/** Why a film of another world cannot have shorts (the UI shows it on the disabled action). */
export const SHORTS_UNSUPPORTED_MESSAGE = 'Shorts are available for voxel and Comic films for now.';

/** Worlds whose films can have shorts (the voxel styles always can). */
const SHORT_WORLDS: readonly string[] = ['comic'];

/**
 * Whether films in `style` can have shorts: the voxel styles and Comic. The other worlds
 * (Sketchbook, Game B1, Game B2) are not laid out for portrait yet.
 */
export function supportsShorts(style: string): boolean {
  const world = (WORLD_ASSET_WORLDS as readonly string[]).includes(style);
  return !world || SHORT_WORLDS.includes(style);
}

/** Whether the engine draws word-by-word captions (a short with `short.captions`; never a film). */
export function captionsOn(project: MaybeShort): boolean {
  return isShort(project) && project.short.captions;
}

/** Total length of a short (end card included), seconds; undefined for a film. */
export function shortTargetSeconds(project: MaybeShort): ShortLength | undefined {
  return isShort(project) ? project.short.lengthS : undefined;
}

/** Seconds of narration in a short of `lengthS` (the end card takes the rest). */
export function shortNarrationSeconds(lengthS: ShortLength): number {
  return lengthS - SHORT_END_CARD_SECONDS;
}

/** Spoken words a short's script aims for: 30 s ≈ 73, 60 s ≈ 151. */
export function shortTargetWords(lengthS: ShortLength): number {
  return Math.round(shortNarrationSeconds(lengthS) * SHORT_WORDS_PER_SECOND);
}

/** Id (and `scenes/<id>.js`) of the appended end card shot. */
export const END_CARD_SHOT_ID = 'end_card';

/**
 * The fixed end card shot after `lastT1` (the end of the narration shots): 2 s, a cut, marked
 * `endCard` (built by the stage; its scene comes from the app, not from Claude).
 */
export function endCardShot(lastT1: number, text: string): StoryboardShot {
  return {
    id: END_CARD_SHOT_ID,
    t0: lastT1,
    t1: Math.round((lastT1 + SHORT_END_CARD_SECONDS) * 1000) / 1000,
    treatment: 'title-card',
    intent: `End card (built by the app): "${text}" in big short text, centred in the safe zone.`,
    scene: `scenes/${END_CARD_SHOT_ID}.js`,
    transitionIn: { type: 'cut' },
    endCard: true,
  };
}

/**
 * Whether `shot` is a short's end card: the app writes and checks its scene, so it never gets
 * Claude work (build, review, critic, fix turns, variants). The one test every path uses.
 */
export function isEndCardShot(shot: { readonly endCard?: boolean | undefined }): boolean {
  return shot.endCard === true;
}

/** The shots without the trailing end card(s): what the storyboard checks look at. */
export function withoutEndCard<T extends { readonly endCard?: boolean | undefined }>(
  shots: readonly T[],
): T[] {
  let end = shots.length;
  while (end > 0 && isEndCardShot(shots[end - 1] ?? {})) end -= 1;
  return shots.slice(0, end);
}

/** Built-in angles: the two shorts of a film take different ones (30 s, 60 s). */
export const DEFAULT_SHORT_ANGLES: Readonly<Record<ShortLength, string>> = {
  30: 'the single most surprising true fact of the film: open on it and make the viewer need the explanation',
  60: "the film's central question or mystery: raise it, go one step deeper into the stakes, still withhold the answer",
};
