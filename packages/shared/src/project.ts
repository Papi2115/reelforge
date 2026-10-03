/**
 * `<project>/project.json` (PLAN.md §3.1: version, title, language, style, models per stage, fps)
 * and `<project>/brief.json` (the "Script" stage input, PLAN.md#7.1). Minimal v1 shapes: the app
 * (6.2/7.1) may add optional fields; required ones are what rendering and the pipeline rely on.
 */
import { z } from 'zod';
import { paletteSchema } from './palette.js';
import { stylePresetIdSchema } from './style-preset.js';

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
});
export type ProjectFile = z.infer<typeof projectFileSchema>;

export function projectLookMode(project: Pick<ProjectFile, 'lookMode'>): LookMode {
  return project.lookMode ?? DEFAULT_LOOK_MODE;
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
