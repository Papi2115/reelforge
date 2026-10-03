/**
 * IPC payloads of shot variants (PLAN.md#11.3): the variant sets of the open project as cards
 * (the current scene + 2–3 variants with direction, QA badge and critic notes), the cost estimate
 * before generating, the operations (generate / regenerate one / pick / keep current / discard,
 * queued as Scenes built runs), the low-res looping clip of a card (PNG frames under
 * `.reelforge/frames/variants/`, served by the media protocol) and the preview manifest with a
 * variant in place of the shot's scene. Merged into ipc-contract.ts.
 */
import { shotIdSchema } from '@reelforge/shared';
import { z } from 'zod';
import { projectManifestResultSchema } from './snapshot-contract.js';
import { stageCommandResultSchema } from './stages-contract.js';

/** `current` = the shot's scene now; `v1`..`v3` = the variants. */
export const variantKeySchema = z.enum(['current', 'v1', 'v2', 'v3']);
export type VariantKey = z.infer<typeof variantKeySchema>;

export const variantCountSchema = z.union([z.literal(2), z.literal(3)]);
export type VariantCount = z.infer<typeof variantCountSchema>;

export const MAX_VARIANT_NOTE = 300;

export const variantCardSchema = z.object({
  key: variantKeySchema,
  /** "Current scene" / "Variant 2". */
  title: z.string(),
  /** Creative direction label (null for the current scene). */
  direction: z.string().nullable(),
  status: z.enum(['current', 'building', 'ready', 'dropped']),
  /** QA result: ✓ ok / ⚠ warning / ✗ failed; null = not built / unknown. */
  qa: z.enum(['ok', 'warning', 'failed']).nullable(),
  /** Critic notes and QA findings, one line each. */
  notes: z.array(z.string()),
  /** Why a variant was dropped. */
  reason: z.string().nullable(),
});
export type VariantCard = z.infer<typeof variantCardSchema>;

export const variantSetViewSchema = z.object({
  shotId: z.string(),
  note: z.string().nullable(),
  /** The current scene first, then the variants in order. */
  cards: z.array(variantCardSchema),
});
export type VariantSetView = z.infer<typeof variantSetViewSchema>;

export const variantsStateSchema = z.object({
  projectDir: z.string().nullable(),
  sets: z.array(variantSetViewSchema),
});
export type VariantsState = z.infer<typeof variantsStateSchema>;

export const variantEstimateSchema = z.object({
  /** "≈ 3 Opus turns, about 2–4 min". */
  text: z.string(),
  turns: z.int().nonnegative(),
  model: z.string(),
});
export type VariantEstimateView = z.infer<typeof variantEstimateSchema>;

export const variantOpSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('generate'),
    count: variantCountSchema,
    note: z.string().trim().max(MAX_VARIANT_NOTE).optional(),
    /** Regenerate only this variant (1..3). */
    only: z.int().min(1).max(3).optional(),
  }),
  z.strictObject({
    kind: z.literal('pick'),
    index: z.int().min(1).max(3),
    lock: z.boolean(),
  }),
  z.strictObject({ kind: z.literal('keep-current') }),
  z.strictObject({ kind: z.literal('discard') }),
]);
export type VariantOpRequest = z.infer<typeof variantOpSchema>;

const cardRequest = z.strictObject({ shotId: shotIdSchema.max(64), key: variantKeySchema });

export const variantClipSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    /** Project-relative PNG frames (in time order), served by `reelforge-media://`. */
    frames: z.array(z.string()),
    /** Playback rate of the loop (frames per second). */
    fps: z.number().positive(),
    /** Changes when the frames were rendered again (media cache busting). */
    revision: z.number(),
  }),
  z.object({ status: z.literal('error'), message: z.string() }),
]);
export type VariantClip = z.infer<typeof variantClipSchema>;

const noPayload = z.null();

export const VARIANTS_IPC = {
  variantsState: { name: 'variants:state', request: noPayload, response: variantsStateSchema },
  variantsEstimate: {
    name: 'variants:estimate',
    request: z.strictObject({ count: variantCountSchema }),
    response: variantEstimateSchema,
  },
  /** Queues a Scenes built run on one shot's variants. */
  variantsRun: {
    name: 'variants:run',
    request: z.strictObject({ shotId: shotIdSchema.max(64), op: variantOpSchema }),
    response: stageCommandResultSchema,
  },
  /** Renders (or reuses) a card's looping low-res clip. */
  variantsClip: { name: 'variants:clip', request: cardRequest, response: variantClipSchema },
  /** The project's preview manifest with this card's scene as the shot's scene. */
  variantsManifest: {
    name: 'variants:manifest',
    request: cardRequest,
    response: projectManifestResultSchema,
  },
} as const;

export interface VariantsApi {
  getVariantsState(): Promise<VariantsState>;
  estimateVariants(count: VariantCount): Promise<VariantEstimateView>;
  runVariants(
    shotId: string,
    op: VariantOpRequest,
  ): Promise<z.infer<typeof stageCommandResultSchema>>;
  getVariantClip(shotId: string, key: VariantKey): Promise<VariantClip>;
  getVariantManifest(
    shotId: string,
    key: VariantKey,
  ): Promise<z.infer<typeof projectManifestResultSchema>>;
}
