/**
 * Taste learning (PLAN.md#12.13, ADR-022): `<app data>/taste.json`, ONE local profile of the
 * user's visual preferences across projects (never in a project, never in git, never sent
 * anywhere except as the condensed text the storyboard / scene prompts get). Counters per feature
 * value (look, roll, treatment, kit template, background, accent, tempo, mark density, camera
 * move, variant direction) collect weighted positive and negative evidence from the user's own
 * decisions: variant picks vs the rejected variants, locks (approved as is) and rebuilds. The
 * counters decay with time (`updatedAt`); the stages package turns them into the profile.
 */
import { z } from 'zod';

export const TASTE_PROFILE_VERSION = 1;
/** File name in the app data folder. */
export const TASTE_PROFILE_FILE = 'taste.json';

/** App setting: `off` = nothing is learned or sent; `auto` = learn and use the profile. */
export const TASTE_LEARNING_MODES = ['off', 'auto'] as const;
export const tasteLearningSchema = z.enum(TASTE_LEARNING_MODES);
export type TasteLearning = z.infer<typeof tasteLearningSchema>;

export const TASTE_FEATURES = [
  'look',
  'roll',
  'treatment',
  'template',
  'background',
  'accent',
  'tempo',
  'density',
  'camera',
  'direction',
] as const;
export const tasteFeatureSchema = z.enum(TASTE_FEATURES);
export type TasteFeature = z.infer<typeof tasteFeatureSchema>;

/**
 * Decisions that teach the profile: `pick` (a variant chosen over the others), `keep` (the
 * current scene kept over its variants), `discard` (all variants thrown away), `lock` (a shot
 * approved as it is), `rebuild` (a shot sent back to be built again).
 */
export const TASTE_SIGNAL_KINDS = ['pick', 'keep', 'discard', 'lock', 'rebuild'] as const;
export const tasteSignalKindSchema = z.enum(TASTE_SIGNAL_KINDS);
export type TasteSignalKind = z.infer<typeof tasteSignalKindSchema>;

export const tasteFeatureValueSchema = z.object({
  feature: tasteFeatureSchema,
  /** e.g. `retro-ui`, `orbit`, `violet`; lower-case kebab or a palette/kit name. */
  value: z.string().min(1).max(64),
});
export type TasteFeatureValue = z.infer<typeof tasteFeatureValueSchema>;

/** One decision: what it endorsed and what it turned down, with its weight. */
export interface TasteSignal {
  readonly kind: TasteSignalKind;
  readonly positive: readonly TasteFeatureValue[];
  readonly negative: readonly TasteFeatureValue[];
  /** Evidence per feature value (default 1). */
  readonly weight?: number;
}

export const MAX_TASTE_COUNTERS = 2_000;

export const tasteCounterSchema = tasteFeatureValueSchema.extend({
  /** Decayed evidence for / against, as of the file's `updatedAt`. */
  positive: z.number().nonnegative(),
  negative: z.number().nonnegative(),
});
export type TasteCounter = z.infer<typeof tasteCounterSchema>;

const countSchema = z.int().nonnegative().default(0);

export const tasteProfileFileSchema = z.object({
  version: z.literal(TASTE_PROFILE_VERSION),
  /** When the counters were last decayed and updated; null = nothing learned yet. */
  updatedAt: z.iso.datetime().nullable(),
  counters: z.array(tasteCounterSchema).max(MAX_TASTE_COUNTERS),
  /** Decisions recorded per kind (not decayed; shown in Settings → Taste). */
  signals: z
    .object({
      pick: countSchema,
      keep: countSchema,
      discard: countSchema,
      lock: countSchema,
      rebuild: countSchema,
    })
    .prefault({}),
});
export type TasteProfileFile = z.output<typeof tasteProfileFileSchema>;

export function emptyTasteProfile(): TasteProfileFile {
  return tasteProfileFileSchema.parse({
    version: TASTE_PROFILE_VERSION,
    updatedAt: null,
    counters: [],
  });
}
