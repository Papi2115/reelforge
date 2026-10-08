/**
 * IPC payloads of Settings → Taste (PLAN.md#12.13, ADR-022): the local taste profile's summary
 * (the condensed text the prompts get, the strongest preferences with their lean, the decisions
 * recorded), "Forget everything" and "Export profile" (main's save dialog; JSON). Taste belongs to
 * a channel (PLAN.md#13.13, ADR-031): every call acts on ONE profile — the open project's channel
 * (and world, when the channel keeps one per world), else the requested channel / world. The
 * on/off switch is the channel's `tasteLearning` (absent = the app setting `taste.learning`).
 * Merged into ipc-contract.ts.
 */
import {
  MAX_CHANNELS,
  TASTE_FEATURES,
  channelColorSchema,
  channelIdSchema,
  stylePresetIdSchema,
  tasteLearningSchema,
} from '@reelforge/shared';
import { z } from 'zod';

/**
 * Which profile, when no project is open (with a project open its channel and world are used and
 * this is ignored). Absent channel = the default channel; absent world = the first one known.
 */
export const tasteScopeRequestSchema = z.strictObject({
  channelId: channelIdSchema.optional(),
  world: stylePresetIdSchema.optional(),
});
export type TasteScopeRequest = z.infer<typeof tasteScopeRequestSchema>;

/** The profile a state describes. */
export const tasteScopeViewSchema = z.object({
  /** null: channels.json cannot be read (the default channel's taste.json is used). */
  channelId: channelIdSchema.nullable(),
  channelName: z.string().nullable(),
  color: channelColorSchema.nullable(),
  /** The channel's own switch; null = it follows the app setting. */
  channelLearning: tasteLearningSchema.nullable(),
  /** The open project's channel (no picker). */
  fromProject: z.boolean(),
  /** The channel keeps one profile per world. */
  perWorld: z.boolean(),
  /** The world (style id) of this profile; null without per-world profiles. */
  world: stylePresetIdSchema.nullable(),
  /** Worlds with a profile of the channel (per-world only), sorted. */
  worlds: z.array(stylePresetIdSchema).max(200),
  /** Every channel (for the picker). */
  channels: z
    .array(
      z.object({ id: channelIdSchema, name: z.string(), color: channelColorSchema.nullable() }),
    )
    .max(MAX_CHANNELS),
});
export type TasteScopeView = z.infer<typeof tasteScopeViewSchema>;

export const tastePreferenceViewSchema = z.object({
  feature: z.enum(TASTE_FEATURES),
  value: z.string(),
  label: z.string(),
  /** −1 (always turned down) … +1 (always chosen). */
  strength: z.number().min(-1).max(1),
  evidence: z.number().nonnegative(),
});
export type TastePreferenceView = z.infer<typeof tastePreferenceViewSchema>;

const count = z.int().nonnegative();
/** Decisions recorded per kind (`TASTE_SIGNAL_KINDS`). */
const signalCountsSchema = z.object({
  pick: count,
  keep: count,
  discard: count,
  lock: count,
  rebuild: count,
});

export const tasteStateSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    learning: tasteLearningSchema,
    /** What the storyboard / scene prompts get; null = nothing (off or too little evidence). */
    profile: z.string().nullable(),
    preferences: z.array(tastePreferenceViewSchema).max(40),
    signals: signalCountsSchema,
    /** Decisions needed before a profile is used. */
    minSignals: z.int().nonnegative(),
    updatedAt: z.string().nullable(),
    /** Where the profile lives (shown in the UI). */
    file: z.string(),
    scope: tasteScopeViewSchema,
  }),
  z.object({ status: z.literal('error'), message: z.string() }),
]);
export type TasteState = z.infer<typeof tasteStateSchema>;

export const tasteExportResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('saved'), file: z.string() }),
  z.object({ status: z.literal('cancelled') }),
  z.object({ status: z.literal('error'), message: z.string() }),
]);
export type TasteExportResult = z.infer<typeof tasteExportResultSchema>;

export const TASTE_IPC = {
  tasteState: { name: 'taste:state', request: tasteScopeRequestSchema, response: tasteStateSchema },
  /** "Forget everything" of that profile only (the switch is left as it is). */
  tasteReset: { name: 'taste:reset', request: tasteScopeRequestSchema, response: tasteStateSchema },
  tasteExport: {
    name: 'taste:export',
    request: tasteScopeRequestSchema,
    response: tasteExportResultSchema,
  },
} as const;

export interface TasteApi {
  getTasteState(scope?: TasteScopeRequest): Promise<TasteState>;
  resetTaste(scope?: TasteScopeRequest): Promise<TasteState>;
  exportTaste(scope?: TasteScopeRequest): Promise<TasteExportResult>;
}
