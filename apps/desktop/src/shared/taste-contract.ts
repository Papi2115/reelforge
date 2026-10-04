/**
 * IPC payloads of Settings → Taste (PLAN.md#12.13, ADR-022): the local taste profile's summary
 * (the condensed text the prompts get, the strongest preferences with their lean, the decisions
 * recorded), "Forget everything" and "Export profile" (main's save dialog; JSON). The on/off
 * switch is the app setting `taste.learning` (settings-contract.ts). Merged into ipc-contract.ts.
 */
import { TASTE_FEATURES, tasteLearningSchema } from '@reelforge/shared';
import { z } from 'zod';

const noPayload = z.null();

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
  tasteState: { name: 'taste:state', request: noPayload, response: tasteStateSchema },
  /** "Forget everything": back to an empty profile (the switch is left as it is). */
  tasteReset: { name: 'taste:reset', request: noPayload, response: tasteStateSchema },
  tasteExport: { name: 'taste:export', request: noPayload, response: tasteExportResultSchema },
} as const;

export interface TasteApi {
  getTasteState(): Promise<TasteState>;
  resetTaste(): Promise<TasteState>;
  exportTaste(): Promise<TasteExportResult>;
}
