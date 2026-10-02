/** zod validation of the render page's replies (render-host-contract.ts) before main uses them. */
import { cardDiagnosticSchema, loadInfoSchema } from '@reelforge/engine';
import { z } from 'zod';

export const renderHostReplySchema = z.union([
  z.object({ id: z.int(), ok: z.literal(true), method: z.literal('load'), info: loadInfoSchema }),
  z.object({
    id: z.int(),
    ok: z.literal(true),
    method: z.literal('frame'),
    frame: z.instanceof(Uint8Array),
  }),
  z.object({
    id: z.int(),
    ok: z.literal(true),
    method: z.literal('cards'),
    cards: z.array(cardDiagnosticSchema),
  }),
  z.object({
    id: z.int(),
    ok: z.literal(false),
    error: z.object({ code: z.string(), message: z.string() }),
  }),
]);
export type ValidatedReply = z.infer<typeof renderHostReplySchema>;
