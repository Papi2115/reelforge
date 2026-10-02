/**
 * `timing/words.json`: script words with spoken times (seconds), produced by the
 * "Words timed" stage (whisper.cpp + alignment, PLAN.md#4.x). Anchors resolve against it.
 */
import { z } from 'zod';

export const WORDS_FILE_VERSION = 1;

export const wordStatusSchema = z.enum(['exact', 'folded', 'fuzzy', 'missing']);
export type WordStatus = z.infer<typeof wordStatusSchema>;

export const timedWordSchema = z
  .object({
    text: z.string().min(1),
    t: z.number().nonnegative(),
    tEnd: z.number().nonnegative(),
    confidence: z.number().min(0).max(1).optional(),
    status: wordStatusSchema.optional(),
  })
  .refine((word) => word.tEnd >= word.t, { message: 'tEnd must be >= t', path: ['tEnd'] });
export type TimedWord = z.infer<typeof timedWordSchema>;

export const wordsFileSchema = z.object({
  version: z.literal(WORDS_FILE_VERSION),
  words: z.array(timedWordSchema),
});
export type WordsFile = z.infer<typeof wordsFileSchema>;
