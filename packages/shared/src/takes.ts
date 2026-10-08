/**
 * `audio/takes/takes.json` (PLAN.md#13.14): every voice-over take generated through ElevenLabs.
 * A take is immutable (its audio file is never overwritten); a chunk (one script paragraph, or a
 * part of a very long one) points at its active take, and `timeline` says where each active take
 * sits in `audio/vo.original.wav`. Character alignment of a take lives next to it in
 * `<takeId>.alignment.json` (`voiceAlignmentFileSchema`).
 */
import { z } from 'zod';

export const VOICE_TAKES_FILE_VERSION = 1;
export const VOICE_ALIGNMENT_FILE_VERSION = 1;

const seconds = z.number().nonnegative();
const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/, 'sha256 must be 64 lower-case hex digits');
/** Project-relative path with forward slashes, e.g. `audio/takes/p03a-2.mp3`. */
const projectFileSchema = z
  .string()
  .min(1)
  .regex(/^[^\\:]+$/, 'project paths use forward slashes and no drive letter');

/** Chunk id: `p<paragraph>` + part letter, e.g. `p03a`, `p12b`. */
export const voiceChunkIdSchema = z.string().regex(/^p\d{2,}[a-z]$/, 'chunk id looks like p03a');
/** Take id: `<chunkId>-<n>`, e.g. `p03a-2`. */
export const voiceTakeIdSchema = z
  .string()
  .regex(/^p\d{2,}[a-z]-\d+$/, 'take id looks like p03a-2');
/** Sentence id: `p<paragraph>-s<k>`, e.g. `p03-s02`. */
export const voiceSentenceIdSchema = z
  .string()
  .regex(/^p\d{2,}-s\d{2,}$/, 'sentence id looks like p03-s02');

/** Voice settings sent to the vendor (absent = the voice's own default). */
export const ttsVoiceSettingsSchema = z.strictObject({
  stability: z.number().min(0).max(1).optional(),
  similarityBoost: z.number().min(0).max(1).optional(),
  style: z.number().min(0).max(1).optional(),
  speed: z.number().min(0.25).max(4).optional(),
  useSpeakerBoost: z.boolean().optional(),
});
export type TtsVoiceSettings = z.infer<typeof ttsVoiceSettingsSchema>;

export const voiceTakeSchema = z.object({
  id: voiceTakeIdSchema,
  chunkId: voiceChunkIdSchema,
  /** 1-based number of the take within its chunk. */
  n: z.number().int().positive(),
  /** Audio file as received (mp3) or wrapped losslessly (pcm -> wav). */
  file: projectFileSchema,
  textSha256: sha256Schema,
  /** Characters of the text sent (code points), the billing unit. */
  characters: z.number().int().nonnegative(),
  voiceId: z.string().min(1),
  modelId: z.string().min(1),
  voiceSettings: ttsVoiceSettingsSchema,
  seed: z.number().int().nonnegative().nullable(),
  outputFormat: z.string().min(1),
  /** `request-id` response header (stitching), null when absent. */
  requestId: z.string().min(1).nullable(),
  /** `character-cost` response header, null when absent. */
  characterCost: z.number().nonnegative().nullable(),
  alignmentFile: projectFileSchema.nullable(),
  durationS: seconds,
  createdAt: z.iso.datetime(),
});
export type VoiceTake = z.infer<typeof voiceTakeSchema>;

export const voiceChunkSchema = z.object({
  id: voiceChunkIdSchema,
  /** Script paragraph index (blank-line separated, as in words.json `paragraph`). */
  paragraph: z.number().int().nonnegative(),
  /** 0 for the first (usually only) part of the paragraph. */
  part: z.number().int().nonnegative(),
  sentenceIds: z.array(voiceSentenceIdSchema).min(1),
  /** Index of the chunk's first word in words.json (`i`). */
  firstWord: z.number().int().nonnegative(),
  wordCount: z.number().int().nonnegative(),
  textSha256: sha256Schema,
  activeTakeId: voiceTakeIdSchema.nullable(),
});
export type VoiceChunk = z.infer<typeof voiceChunkSchema>;

export const voiceTimelineEntrySchema = z
  .object({
    chunkId: voiceChunkIdSchema,
    takeId: voiceTakeIdSchema,
    /** Where the take starts / ends in vo.original.wav (seconds). */
    start: seconds,
    end: seconds,
  })
  .refine((entry) => entry.end >= entry.start, { message: 'end must be >= start', path: ['end'] });
export type VoiceTimelineEntry = z.infer<typeof voiceTimelineEntrySchema>;

export const voicePausesSchema = z.object({
  /** Silence between paragraphs (seconds). */
  paragraphS: seconds,
  /** Silence between two parts of one paragraph (seconds). */
  sentenceS: seconds,
});
export type VoicePauses = z.infer<typeof voicePausesSchema>;

export const voiceTakesFileSchema = z
  .object({
    version: z.literal(VOICE_TAKES_FILE_VERSION),
    provider: z.literal('elevenlabs'),
    scriptSha256: sha256Schema,
    voiceId: z.string().min(1),
    modelId: z.string().min(1),
    pauses: voicePausesSchema,
    chunks: z.array(voiceChunkSchema),
    takes: z.array(voiceTakeSchema),
    /** Assembled output; null until every chunk has an active take. */
    output: z
      .object({
        file: projectFileSchema,
        sha256: sha256Schema,
        sampleRate: z.number().int().positive(),
        durationS: seconds,
        timeline: z.array(voiceTimelineEntrySchema),
      })
      .nullable(),
  })
  .superRefine((file, ctx) => {
    // Takes of chunks that no longer exist (an edited script) stay: takes are history.
    const takeIds = new Set(file.takes.map((take) => take.id));
    if (takeIds.size !== file.takes.length) {
      ctx.addIssue({ code: 'custom', message: 'take ids must be unique', path: ['takes'] });
    }
    file.takes.forEach((take, index) => {
      if (take.id !== `${take.chunkId}-${String(take.n)}`) {
        ctx.addIssue({
          code: 'custom',
          message: 'take id must be <chunkId>-<n>',
          path: ['takes', index, 'id'],
        });
      }
    });
    file.chunks.forEach((chunk, index) => {
      if (chunk.activeTakeId === null) return;
      const take = file.takes.find((candidate) => candidate.id === chunk.activeTakeId);
      if (take?.chunkId !== chunk.id) {
        ctx.addIssue({
          code: 'custom',
          message: `active take ${chunk.activeTakeId} is not a take of ${chunk.id}`,
          path: ['chunks', index, 'activeTakeId'],
        });
      }
    });
  });
export type VoiceTakesFile = z.infer<typeof voiceTakesFileSchema>;

/** Character-level timing of a take's text, relative to the start of the take (seconds). */
export const voiceCharAlignmentSchema = z
  .object({
    characters: z.array(z.string()),
    starts: z.array(seconds),
    ends: z.array(seconds),
  })
  .refine(
    (alignment) =>
      alignment.starts.length === alignment.characters.length &&
      alignment.ends.length === alignment.characters.length,
    { message: 'characters, starts and ends must have the same length' },
  );
export type VoiceCharAlignment = z.infer<typeof voiceCharAlignmentSchema>;

export const voiceAlignmentFileSchema = z.object({
  version: z.literal(VOICE_ALIGNMENT_FILE_VERSION),
  takeId: voiceTakeIdSchema,
  /** Maps to the original text sent. */
  alignment: voiceCharAlignmentSchema,
  /** Maps to the vendor-normalised text (numbers spelled out); null when not returned. */
  normalized: voiceCharAlignmentSchema.nullable(),
});
export type VoiceAlignmentFile = z.infer<typeof voiceAlignmentFileSchema>;
