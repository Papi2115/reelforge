/**
 * IPC payloads of the Tension panel (PLAN.md#12.22, ADR-017): saving an edited curve (points,
 * labelled segments, the curve lock), Reset (back to Claude's last proposal, or no curve) and
 * "Propose with Claude" (queues the storyboard's `tension` action). Main validates, keeps locked
 * shots' tension (pins), writes tension.json atomically and commits; the renderer reads the curve
 * from the project snapshot. Merged into ipc-contract.ts.
 */
import {
  MAX_TENSION_POINTS,
  tensionFileSchema,
  tensionPointSchema,
  tensionSegmentSchema,
} from '@reelforge/shared';
import { z } from 'zod';
import { stageCommandResultSchema, type StageCommandResult } from './stages-contract.js';

export const tensionSaveRequestSchema = z.strictObject({
  points: z.array(tensionPointSchema).min(1).max(MAX_TENSION_POINTS),
  /** Absent = keep the current labels. */
  segments: z.array(tensionSegmentSchema).max(60).optional(),
  /** Lock / unlock the curve (no proposal replaces a locked curve); absent = unchanged. */
  locked: z.boolean().optional(),
  /** What changed, for the commit subject ("moved a point", "preset three-act"). */
  change: z.string().trim().min(1).max(80),
});
export type TensionSaveRequest = z.infer<typeof tensionSaveRequestSchema>;

export const tensionSaveResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    /** The curve on disk; null after a Reset without a proposal (no curve). */
    file: tensionFileSchema.nullable(),
    /** False when nothing changed on disk or the commit failed (the file is saved either way). */
    committed: z.boolean(),
    /** Unlocked shots whose tension changed noticeably (their background follows right away). */
    changedShots: z.array(z.string()),
    /** Locked shots that keep the tension they were approved with. */
    keptLocked: z.array(z.string()),
  }),
  z.object({ status: z.literal('error'), message: z.string() }),
]);
export type TensionSaveResult = z.infer<typeof tensionSaveResultSchema>;

export const TENSION_IPC = {
  tensionSave: {
    name: 'tension:save',
    request: tensionSaveRequestSchema,
    response: tensionSaveResultSchema,
  },
  tensionReset: { name: 'tension:reset', request: z.null(), response: tensionSaveResultSchema },
  tensionPropose: {
    name: 'tension:propose',
    request: z.null(),
    response: stageCommandResultSchema,
  },
} as const;

export interface TensionApi {
  saveTension(request: TensionSaveRequest): Promise<TensionSaveResult>;
  resetTension(): Promise<TensionSaveResult>;
  proposeTension(): Promise<StageCommandResult>;
}
