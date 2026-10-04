/**
 * IPC payloads of the Editing section under the final review (PLAN.md#12.21, #12.23): the
 * beat-sync report (cuts / whooshes on the beat) and the film-level repetition list with
 * per-item Apply / Ignore. Apply swaps SFX or transitions (written and committed by main) or
 * queues a shot-variant build; locked shots are never touched. Merged into ipc-contract.ts.
 */
import {
  beatSyncModeSchema,
  beatSyncReportSchema,
  repetitionControlModeSchema,
  repetitionsFileSchema,
} from '@reelforge/shared';
import { z } from 'zod';

export const editingStateSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    switches: z.object({
      beatSync: beatSyncModeSchema,
      repetitionControl: repetitionControlModeSchema,
    }),
    /** `.reelforge/beat-sync-report.json`; null = not written yet. */
    beatSync: beatSyncReportSchema.nullable(),
    /** `.reelforge/repetitions.json`; null = not analysed yet. */
    repetitions: repetitionsFileSchema.nullable(),
  }),
  z.object({ status: z.literal('error'), message: z.string() }),
]);
export type EditingState = z.infer<typeof editingStateSchema>;

export const repetitionActionRequestSchema = z.strictObject({
  id: z.string().min(1).max(400),
  /** `apply` the proposal, `ignore` the item, or `reopen` an ignored one. */
  action: z.enum(['apply', 'ignore', 'reopen']),
});
export type RepetitionActionRequest = z.infer<typeof repetitionActionRequestSchema>;

export const repetitionActionResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    message: z.string(),
    /** A project commit was made (SFX / transition swaps). */
    committed: z.boolean(),
    /** Shot-variant builds were queued (visual repeats). */
    queued: z.boolean(),
  }),
  z.object({ status: z.literal('error'), message: z.string() }),
]);
export type RepetitionActionResult = z.infer<typeof repetitionActionResultSchema>;

export const EDITING_IPC = {
  editingState: {
    name: 'editing:state',
    request: z.null(),
    response: editingStateSchema,
  },
  repetitionAction: {
    name: 'editing:repetition',
    request: repetitionActionRequestSchema,
    response: repetitionActionResultSchema,
  },
} as const;

export interface EditingApi {
  getEditing(): Promise<EditingState>;
  actOnRepetition(request: RepetitionActionRequest): Promise<RepetitionActionResult>;
}
