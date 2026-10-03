/**
 * Shot variants (PLAN.md#11.3), app state under `<project>/.reelforge/` (not tracked by git):
 * - `variants/<shot>/variants.json`: the 2–3 alternative scenes built for one shot, each from its
 *   own creative direction, with their QA record; the scene files sit next to it (`v1.js` …).
 *   Nothing reaches `scenes/` (or git) until the user picks one.
 * - `taste.json`: every pick / keep-current / discard decision, a local preference signal for the
 *   later taste learning (PLAN.md#12.13). Never sent anywhere.
 */
import { z } from 'zod';
import { shotBuildRecordSchema, shotBuildStatusSchema } from './scene-reports.js';
import { shotIdSchema, treatmentSchema } from './storyboard.js';

export const SHOT_VARIANTS_VERSION = 1;
export const TASTE_LOG_VERSION = 1;
/** Project-relative folder of all variant sets (git-ignored app state). */
export const SHOT_VARIANTS_DIR = '.reelforge/variants';
/** Project-relative taste log (git-ignored app state). */
export const TASTE_LOG_FILE = '.reelforge/taste.json';
/** Variants per request: 2 (Economy default) or 3 (default). */
export const VARIANT_COUNTS = [2, 3] as const;
export const MAX_VARIANTS = 3;

export const variantDirectionRefSchema = z.object({
  /** Id in the direction library (stages `VARIANT_DIRECTIONS`). */
  id: z.string().min(1),
  label: z.string().min(1),
});
export type VariantDirectionRef = z.infer<typeof variantDirectionRefSchema>;

/** `building`: turns in flight (or interrupted) · `ready`: passed QA, can be picked · `dropped`. */
export const variantStatusSchema = z.enum(['building', 'ready', 'dropped']);
export type VariantStatus = z.infer<typeof variantStatusSchema>;

export const shotVariantSchema = z.object({
  /** 1-based, the `v<index>.js` file name and the 1/2/3 key in the UI. */
  index: z.int().min(1).max(MAX_VARIANTS),
  direction: variantDirectionRefSchema,
  status: variantStatusSchema,
  /** Project-relative scene file of a ready variant. */
  file: z.string().min(1).optional(),
  /** QA result of the variant (status ✓/⚠, findings, critic notes). */
  record: shotBuildRecordSchema.optional(),
  /** Why a variant was dropped (QA failure, turn error, cancelled). */
  reason: z.string().optional(),
  updatedAt: z.iso.datetime(),
});
export type ShotVariant = z.infer<typeof shotVariantSchema>;

/** What the variants were built against: when it changes the variants are stale (removed). */
export const variantBaseSchema = z.object({
  /** Project-relative storyboard scene path of the shot. */
  scene: z.string().min(1),
  /** sha256 of the shot's scene source when the set was made ('' = no scene file). */
  sceneHash: z.string(),
  /** sha256 of the storyboard shot (times, treatment, intent, scene path). */
  shotHash: z.string().min(1),
});
export type VariantBase = z.infer<typeof variantBaseSchema>;

export const shotVariantSetSchema = z.object({
  version: z.literal(SHOT_VARIANTS_VERSION),
  shotId: shotIdSchema,
  /** Rotation round of the direction library for this shot (0 = first set). */
  round: z.int().nonnegative(),
  /** The user's note sent with every variant prompt ("make it calmer"). */
  note: z.string().optional(),
  base: variantBaseSchema,
  variants: z.array(shotVariantSchema).min(1).max(MAX_VARIANTS),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type ShotVariantSet = z.infer<typeof shotVariantSetSchema>;

export const tasteDecisionSchema = z.enum(['pick', 'keep-current', 'discard']);
export type TasteDecision = z.infer<typeof tasteDecisionSchema>;

export const tasteScoreSchema = z.object({
  direction: z.string().min(1),
  /** `dropped`: failed QA / the turn failed. */
  status: z.union([shotBuildStatusSchema, z.literal('dropped')]),
  /** QA findings left on the variant. */
  findings: z.int().nonnegative(),
});
export type TasteScore = z.infer<typeof tasteScoreSchema>;

export const tasteEntrySchema = z.object({
  shotId: shotIdSchema,
  treatment: treatmentSchema,
  decision: tasteDecisionSchema,
  /** Direction ids offered, in variant order. */
  offered: z.array(z.string().min(1)),
  /** The picked direction id, or `none` (kept the current scene / discarded all). */
  chosen: z.string().min(1),
  note: z.string().optional(),
  scores: z.array(tasteScoreSchema),
  at: z.iso.datetime(),
});
export type TasteEntry = z.infer<typeof tasteEntrySchema>;

export const tasteLogSchema = z.object({
  version: z.literal(TASTE_LOG_VERSION),
  entries: z.array(tasteEntrySchema),
});
export type TasteLog = z.infer<typeof tasteLogSchema>;

export function emptyTasteLog(): TasteLog {
  return { version: TASTE_LOG_VERSION, entries: [] };
}

/** Project-relative folder of one shot's variant set. */
export function shotVariantsDir(shotId: string): string {
  return `${SHOT_VARIANTS_DIR}/${shotId}`;
}

export function shotVariantsFile(shotId: string): string {
  return `${shotVariantsDir(shotId)}/variants.json`;
}

/** Project-relative scene file of variant `index` (stored, after its build). */
export function shotVariantFile(shotId: string, index: number): string {
  return `${shotVariantsDir(shotId)}/v${String(index)}.js`;
}
