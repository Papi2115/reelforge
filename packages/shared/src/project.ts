/**
 * `<project>/project.json` (PLAN.md §3.1: version, title, language, style, models per stage, fps)
 * and `<project>/brief.json` (the "Script" stage input, PLAN.md#7.1). Minimal v1 shapes: the app
 * (6.2/7.1) may add optional fields; required ones are what rendering and the pipeline rely on.
 */
import { z } from 'zod';
import { DEFAULT_AMBIENT_VARIATION } from './ambient-variation.js';
import {
  ALLOWLIST_SOURCES,
  DEFAULT_RESEARCH_MODE,
  researchModeSchema,
  type ResearchMode,
} from './assets.js';
import { paletteSchema } from './palette.js';
import { shotsPerMinuteSchema } from './scene-count.js';
import { stylePresetIdSchema } from './style-preset.js';
import { beatSyncModeSchema } from './beat-sync.js';
import { channelIdSchema } from './channels.js';
import { characterModeSchema, mascotChoiceSchema } from './characters.js';
import { repetitionControlModeSchema } from './repetition.js';
import { dramaturgyModeSchema } from './dramaturgy.js';
import { tensionMapModeSchema } from './tension.js';
import { videoFormatSchema } from './video-format.js';
import { worldLooksSchema } from './world-looks.js';
import { parentProjectSchema, projectKindSchema, shortSettingsSchema } from './shorts.js';

export const PROJECT_FILE_VERSION = 1;
export const BRIEF_FILE_VERSION = 1;

/** Video languages (CLAUDE.md §8: EN default, PL supported). */
export const videoLanguageSchema = z.enum(['en', 'pl']);
export type VideoLanguage = z.infer<typeof videoLanguageSchema>;

/**
 * How the storyboard picks looks (ADR-009): `voxel-only` = every shot in the voxel look, exactly
 * as before ReelForge 2.0; `mixed` = A/B/C rolls and the registered looks with rhythm rules.
 */
export const LOOK_MODES = ['voxel-only', 'mixed'] as const;
export const lookModeSchema = z.enum(LOOK_MODES);
export type LookMode = z.infer<typeof lookModeSchema>;

/** Projects without the field (made before 2.0) keep their exact behaviour. */
export const DEFAULT_LOOK_MODE: LookMode = 'voxel-only';

/**
 * Genre preset id (PLAN.md#13.8, genre-presets.ts). Not an enum: a project keeps its id after the
 * built-in list changes (an unknown id simply has no effect).
 */
export const genrePresetIdSchema = z
  .string()
  .max(64)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'genre preset ids are kebab-case, e.g. "true-crime"');
export type GenrePresetId = z.infer<typeof genrePresetIdSchema>;

/** Values of `project.json#captions`, a film's captions switch (PLAN.md#14.18). */
export const FILM_CAPTIONS = ['off', 'words'] as const;
export const filmCaptionsSchema = z.enum(FILM_CAPTIONS);
export type FilmCaptions = z.infer<typeof filmCaptionsSchema>;

export const projectFileSchema = z.object({
  version: z.literal(PROJECT_FILE_VERSION),
  title: z.string().min(1),
  language: videoLanguageSchema,
  /** Style preset id, e.g. `voxel-pixel-crisp640`. */
  style: stylePresetIdSchema,
  fps: z.int().min(1).max(120),
  /** Project seed (uint32): every shot derives its RNG stream from it. */
  seed: z.int().min(0).max(0xffffffff),
  /** Swatch overrides merged over the style palette. */
  palette: paletteSchema.optional(),
  /** Model per pipeline stage (app setting), e.g. `{ "scenes": "opus" }`. */
  models: z.record(z.string().min(1), z.string().min(1)).optional(),
  /** Look mode (absent = `voxel-only`; new projects get `mixed` from the template). */
  lookMode: lookModeSchema.optional(),
  /**
   * Ambient variation (PLAN.md#12.8): environments drift from shot to shot within the style's
   * budget. Absent = off (existing projects render frame for frame as before); new projects get
   * `true` from the template.
   */
  ambientVariation: z.boolean().optional(),
  /**
   * Asset research mode (PLAN.md#12.9, ADR-012). Absent = `off` (projects made before 2.1 never
   * touch the network); new projects get `ask` from the template.
   */
  researchMode: researchModeSchema.optional(),
  /** Sources the `allowlist` mode may use (subset of the global allowlist). */
  researchSources: z.array(z.enum(ALLOWLIST_SOURCES)).optional(),
  /**
   * Tension map (PLAN.md#12.22, ADR-017): `auto` = the storyboard, the sound design and the
   * render read `tension.json`. Absent = `off` (projects made before 2.2 are unchanged); new
   * projects get `auto` from the template.
   */
  tensionMap: tensionMapModeSchema.optional(),
  /**
   * Beat-synced editing (PLAN.md#12.21, ADR-018): `auto` = cuts, music and accents snap to the
   * beat grid (timing/beats.json). Absent = `off` (projects made before 2.2 are unchanged); new
   * projects get `auto` from the template.
   */
  beatSync: beatSyncModeSchema.optional(),
  /**
   * Film-level repetition control (PLAN.md#12.23, ADR-019): `auto` = repeated visuals,
   * transitions, SFX and phrases are found and replacements proposed. Absent = `off`.
   */
  repetitionControl: repetitionControlModeSchema.optional(),
  /**
   * Dramaturgy (PLAN.md#12.25–12.27, ADR-020): planned pattern interrupts, open loops and reveal
   * moments. Absent = `off` (projects made before 2.2 are unchanged); new projects get `auto`.
   */
  patternInterrupts: dramaturgyModeSchema.optional(),
  openLoops: dramaturgyModeSchema.optional(),
  revealMoments: dramaturgyModeSchema.optional(),
  /**
   * Characters (PLAN.md#12.20, ADR-025): `pack` = people from the character pack (`kit.cast`),
   * `classic` = the hoodie hero. Absent = `classic` (projects made before 2.3.5 are unchanged);
   * new projects get the app's default (`pack` in the template).
   */
  characters: characterModeSchema.optional(),
  /** The film's mascot (`none` or a pack mascot; in effect only with `pack`). Absent = `none`. */
  mascot: mascotChoiceSchema.optional(),
  /**
   * Shots per minute of film (ADR-027): the storyboard keeps the film's average in this range,
   * one idea per shot, cuts on sentence ends. Absent = no constraint (projects made before 2.3.6
   * and new ones without a choice are unchanged).
   */
  shotsPerMinute: shotsPerMinuteSchema.optional(),
  /** Faster checks (ADR-027): lighter scene QA, a small quality trade-off. Absent = off. */
  fasterChecks: z.boolean().optional(),
  /**
   * Continuity links (PLAN.md#13.2, continuity.ts): the storyboard may link shots through a shared
   * object. Absent = off (the storyboard prompt is exactly as before).
   */
  continuityLinks: z.boolean().optional(),
  /**
   * Anti-slop guards (PLAN.md#13.7, docs/worlds/QUALITY.md §8): ⚠ findings for invented text,
   * clutter, symmetry, uniform timing, missing human traces and repeated compositions. Warnings
   * only. Absent = on for a world's style, off for the built-in styles (existing projects are
   * unchanged); the template writes `false`, a world's project defaults `true`.
   */
  antiSlopGuards: z.boolean().optional(),
  /**
   * The looks of the world a project keeps ON (PLAN.md#14.12, world-looks.ts; only a world whose
   * looks are optional reads it: Grim Ink). Absent = all of the world's looks.
   */
  worldLooks: worldLooksSchema.optional(),
  /**
   * Channel of the project (PLAN.md#13.13, channels.ts). Absent = the default channel (projects
   * made before 3.1 are unchanged; no rewrite needed).
   */
  channelId: channelIdSchema.optional(),
  /**
   * Genre preset the project was created with (PLAN.md#13.8, genre-presets.ts): its fields were
   * written into this file at creation; the id is kept for display and the script's tone hint.
   * Absent = none (projects made before 3.1 and projects without a preset are unchanged).
   */
  genrePreset: genrePresetIdSchema.optional(),
  /**
   * Video format (PLAN.md#13.18, video-format.ts): `portrait` renders 9:16 (360x640 base,
   * 1080x1920 export). Absent = `landscape` (every project made before Shorts is unchanged).
   */
  format: videoFormatSchema.optional(),
  /**
   * Film or short (PLAN.md#13.18, shorts.ts). Absent = `film` (every project made before Shorts).
   * A short also has `parentProject` (the film it teases) and `short` (length, captions, end card).
   */
  kind: projectKindSchema.optional(),
  parentProject: parentProjectSchema.optional(),
  short: shortSettingsSchema.optional(),
  /**
   * Captions of a film (PLAN.md#14.18): `words` = the spoken words burned in (manifest
   * `captions`; Grim Ink draws them like its prototypes). Absent = `off` (every project made
   * before is unchanged). A short keeps its own `short.captions`.
   */
  captions: filmCaptionsSchema.optional(),
});
export type ProjectFile = z.infer<typeof projectFileSchema>;

export function projectResearchMode(project: Pick<ProjectFile, 'researchMode'>): ResearchMode {
  return project.researchMode ?? DEFAULT_RESEARCH_MODE;
}

export function projectLookMode(project: Pick<ProjectFile, 'lookMode'>): LookMode {
  return project.lookMode ?? DEFAULT_LOOK_MODE;
}

/** Whether the anti-slop guards run; `worldStyle`: the project's style is a world's. */
export function projectAntiSlopGuards(
  project: Pick<ProjectFile, 'antiSlopGuards'>,
  worldStyle: boolean,
): boolean {
  return project.antiSlopGuards ?? worldStyle;
}

export function projectAmbientVariation(project: Pick<ProjectFile, 'ambientVariation'>): boolean {
  return project.ambientVariation ?? DEFAULT_AMBIENT_VARIATION;
}

export const briefFileSchema = z.object({
  version: z.literal(BRIEF_FILE_VERSION),
  /** What the video is about, in a few sentences. */
  topic: z.string().min(1),
  language: videoLanguageSchema,
  /** Target length in minutes. */
  targetMinutes: z.number().positive().max(60).optional(),
  tone: z.string().optional(),
  audience: z.string().optional(),
  notes: z.string().optional(),
});
export type BriefFile = z.infer<typeof briefFileSchema>;
