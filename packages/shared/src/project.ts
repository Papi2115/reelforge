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
});
export type ProjectFile = z.infer<typeof projectFileSchema>;

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
