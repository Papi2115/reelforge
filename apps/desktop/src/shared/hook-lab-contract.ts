/**
 * IPC payloads of the hook lab (PLAN.md#12.16, ADR-021) in the Script step: the current opening,
 * the newest set of three alternative openings, what a pick would affect (recorded voice-over,
 * locked shots covering the opening), "Generate" (one Claude turn, no web), "Use this opening"
 * and "Discard". Merged into ipc-contract.ts.
 */
import { HOOK_STYLES, hookSetSchema } from '@reelforge/shared';
import { z } from 'zod';

const noPayload = z.null();

export const hookLabViewSchema = z.object({
  /** The script's opening paragraph; null = no script yet. */
  opening: z.string().nullable(),
  /** The newest set (decided or not); null = the lab never ran in this project. */
  set: hookSetSchema.nullable(),
  /** Sets written so far in this project. */
  history: z.int().nonnegative(),
  /** The newest undecided set was written for another opening (the script changed since). */
  stale: z.boolean(),
  /** A voice-over was recorded: a pick means re-recording the opening. */
  voiceover: z.boolean(),
  /** Locked shots covering the current opening (kept as they are by a pick). */
  lockedShots: z.array(z.string()),
  /** Claude is writing openings for this project now. */
  generating: z.boolean(),
  /** The Script stage runs or waits (the lab waits for it). */
  scriptBusy: z.boolean(),
});
export type HookLabView = z.infer<typeof hookLabViewSchema>;

export const hookLabStateSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok'), view: hookLabViewSchema }),
  z.object({ status: z.literal('error'), message: z.string() }),
]);
export type HookLabState = z.infer<typeof hookLabStateSchema>;

export const hookLabPickRequestSchema = z.strictObject({
  number: z.int().min(1).max(999_999),
  index: z.int().min(1).max(HOOK_STYLES.length),
});
export type HookLabPickRequest = z.infer<typeof hookLabPickRequestSchema>;

export const hookLabDiscardRequestSchema = z.strictObject({
  number: z.int().min(1).max(999_999),
});

export const hookLabResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    view: hookLabViewSchema,
    /** One line for the UI ("Opening 2 (Question) is now the script's opening."). */
    message: z.string().nullable(),
    /** Re-record the voice-over, locked shots kept, checks of the openings. */
    warnings: z.array(z.string()),
    /** Stages marked out of date. */
    invalidated: z.array(z.string()),
  }),
  z.object({ status: z.literal('error'), message: z.string() }),
]);
export type HookLabResult = z.infer<typeof hookLabResultSchema>;

export const HOOK_LAB_IPC = {
  hookLabState: { name: 'hook-lab:state', request: noPayload, response: hookLabStateSchema },
  hookLabGenerate: { name: 'hook-lab:generate', request: noPayload, response: hookLabResultSchema },
  hookLabPick: {
    name: 'hook-lab:pick',
    request: hookLabPickRequestSchema,
    response: hookLabResultSchema,
  },
  hookLabDiscard: {
    name: 'hook-lab:discard',
    request: hookLabDiscardRequestSchema,
    response: hookLabResultSchema,
  },
} as const;

export interface HookLabApi {
  getHookLab(): Promise<HookLabState>;
  generateHooks(): Promise<HookLabResult>;
  pickHook(request: HookLabPickRequest): Promise<HookLabResult>;
  discardHooks(number: number): Promise<HookLabResult>;
}
