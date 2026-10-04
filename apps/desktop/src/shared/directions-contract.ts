/**
 * IPC payloads of live co-direction (PLAN.md#12.14, ADR-023): the renderer parses a typed command
 * into the shot's next direction (pure, @reelforge/shared) and main writes directions.json (zod,
 * atomic) and commits it (`ReelForge-Step: direction`). A locked shot is refused, never changed.
 * Merged into ipc-contract.ts.
 */
import { directionsFileSchema, shotDirectionSchema, shotIdSchema } from '@reelforge/shared';
import { z } from 'zod';

export const directionsStateSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    directions: directionsFileSchema,
    /** Locked shots (PLAN.md#11.4): commands on them are refused. */
    locked: z.array(shotIdSchema),
  }),
  z.object({ status: z.literal('error'), message: z.string() }),
]);
export type DirectionsState = z.infer<typeof directionsStateSchema>;

export const directionApplyRequestSchema = z.strictObject({
  shotId: shotIdSchema,
  /** The shot's next direction; null clears it. */
  next: shotDirectionSchema.nullable(),
  /** The command as typed (commit message). */
  command: z.string().min(1).max(200),
});
export type DirectionApplyRequest = z.infer<typeof directionApplyRequestSchema>;

export const directionApplyResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    directions: directionsFileSchema,
    /** False when nothing changed on disk or the commit failed (the file is saved either way). */
    committed: z.boolean(),
  }),
  z.object({ status: z.literal('locked'), shotId: shotIdSchema, message: z.string() }),
  z.object({ status: z.literal('error'), message: z.string() }),
]);
export type DirectionApplyResult = z.infer<typeof directionApplyResultSchema>;

export const DIRECTIONS_IPC = {
  directionsState: {
    name: 'directions:state',
    request: z.null(),
    response: directionsStateSchema,
  },
  directionApply: {
    name: 'directions:apply',
    request: directionApplyRequestSchema,
    response: directionApplyResultSchema,
  },
} as const;

export interface DirectionsApi {
  getDirections(): Promise<DirectionsState>;
  applyDirection(request: DirectionApplyRequest): Promise<DirectionApplyResult>;
}
