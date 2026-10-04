/**
 * IPC payloads of the Dramaturgy section (PLAN.md#12.25–12.27, ADR-020) under the final review:
 * the dramaturgy report (pattern interrupts planned vs realised, open-loop ⚠ warnings) and the
 * reveal moments — proposals for the biggest tension peaks merged with the decisions in
 * moments.json. Accept / Reject / back to proposed are written by main (atomic, committed); a
 * locked shot's moment cannot be accepted. Merged into ipc-contract.ts.
 */
import { dramaturgyModeSchema, dramaturgyReportSchema, momentSchema } from '@reelforge/shared';
import { z } from 'zod';

export const momentViewSchema = z.object({
  moment: momentSchema,
  /** The shot is locked (PLAN.md#11.4): the moment cannot be accepted now. */
  locked: z.boolean(),
});
export type MomentView = z.infer<typeof momentViewSchema>;

export const dramaturgyStateSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    switches: z.object({
      patternInterrupts: dramaturgyModeSchema,
      openLoops: dramaturgyModeSchema,
      revealMoments: dramaturgyModeSchema,
    }),
    /** The last dramaturgy report (storyboard or final review); null = none yet. */
    report: dramaturgyReportSchema.nullable(),
    moments: z.array(momentViewSchema),
    /** Why there are no proposals (no tension curve, no storyboard, …); null = none. */
    momentsNote: z.string().nullable(),
  }),
  z.object({ status: z.literal('error'), message: z.string() }),
]);
export type DramaturgyState = z.infer<typeof dramaturgyStateSchema>;

export const momentDecisionSchema = z.enum(['accepted', 'rejected', 'proposed']);
export type MomentDecision = z.infer<typeof momentDecisionSchema>;

export const momentDecideRequestSchema = z.strictObject({
  id: z.string().min(1).max(100),
  decision: momentDecisionSchema,
});
export type MomentDecideRequest = z.infer<typeof momentDecideRequestSchema>;

export const momentDecideResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    moments: z.array(momentViewSchema),
    /** False when nothing changed on disk or the commit failed (the file is saved either way). */
    committed: z.boolean(),
  }),
  z.object({ status: z.literal('error'), message: z.string() }),
]);
export type MomentDecideResult = z.infer<typeof momentDecideResultSchema>;

export const DRAMATURGY_IPC = {
  dramaturgyState: {
    name: 'dramaturgy:state',
    request: z.null(),
    response: dramaturgyStateSchema,
  },
  momentDecide: {
    name: 'dramaturgy:moment-decide',
    request: momentDecideRequestSchema,
    response: momentDecideResultSchema,
  },
} as const;

export interface DramaturgyApi {
  getDramaturgy(): Promise<DramaturgyState>;
  decideMoment(request: MomentDecideRequest): Promise<MomentDecideResult>;
}
