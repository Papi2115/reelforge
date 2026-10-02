/**
 * IPC payloads of the YouTube extras (PLAN.md#9.2): the suggestions in `out/metadata.json`,
 * "Suggest with Claude" (the template when Claude cannot help) and copying a text to the system
 * clipboard (the renderer has no clipboard permission). Merged into ipc-contract.ts.
 */
import { youtubeMetaFileSchema } from '@reelforge/shared';
import { z } from 'zod';

export const youtubeMetaResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    meta: youtubeMetaFileSchema,
    /** Why the template was written instead of Claude's suggestion (null: Claude's). */
    fallback: z.string().nullable(),
  }),
  z.object({ status: z.literal('error'), message: z.string() }),
]);
export type YoutubeMetaResult = z.infer<typeof youtubeMetaResultSchema>;

export const MAX_COPY_CHARS = 20_000;

export const copyTextResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('copied') }),
  z.object({ status: z.literal('error'), message: z.string() }),
]);
export type CopyTextResult = z.infer<typeof copyTextResultSchema>;

export const YOUTUBE_IPC = {
  youtubeMeta: {
    name: 'youtube:meta',
    request: z.null(),
    response: youtubeMetaFileSchema.nullable(),
  },
  youtubeMetaGenerate: {
    name: 'youtube:generate',
    request: z.null(),
    response: youtubeMetaResultSchema,
  },
  copyText: {
    name: 'clipboard:copy-text',
    request: z.strictObject({ text: z.string().max(MAX_COPY_CHARS) }),
    response: copyTextResultSchema,
  },
} as const;

export interface YoutubeApi {
  getYoutubeMeta(): Promise<z.infer<typeof youtubeMetaFileSchema> | null>;
  generateYoutubeMeta(): Promise<YoutubeMetaResult>;
  copyText(text: string): Promise<CopyTextResult>;
}
