/**
 * `words.raw.json` (whisper.cpp output, PLAN 4.3) and `words.json` (script-faithful timed words,
 * PLAN 4.4). Defined here until they move to @reelforge/shared; `words.json` is a superset of
 * shared's `wordsFileSchema` (version 1, words with text/t/tEnd/confidence/status).
 */
import { z } from 'zod';

export const WORDS_RAW_VERSION = 1;
export const WORDS_FILE_VERSION = 1;

const seconds = z.number().nonnegative();

export const AsrLanguageSchema = z.enum(['en', 'pl', 'auto']);
export type AsrLanguage = z.infer<typeof AsrLanguageSchema>;

export const WhisperBackendSchema = z.enum(['cuda', 'blas', 'cpu', 'custom']);
export type WhisperBackend = z.infer<typeof WhisperBackendSchema>;

export const RawWordSchema = z.object({
  text: z.string(),
  /** Calibrated start: DTW token time minus the model's lead (falls back to segment start). */
  t: seconds,
  /** Next word's start (last word: start + its segment length, max 1 s). */
  tEnd: seconds,
  /** Mean token probability. */
  p: z.number().min(0).max(1),
  /** Raw DTW time of the first token (absolute), null when whisper gave none. */
  tDtw: z.number().nullable(),
});
export type RawWord = z.infer<typeof RawWordSchema>;

export const WordsRawSchema = z.object({
  version: z.literal(WORDS_RAW_VERSION),
  engine: z.literal('whisper.cpp'),
  model: z.string().min(1),
  /** Requested language. */
  lang: AsrLanguageSchema,
  /** Language actually used for decoding (detected when `lang` is auto). */
  decodedLang: z.string().min(1),
  mode: z.literal('chunk'),
  backend: WhisperBackendSchema,
  usedGpu: z.boolean(),
  /** Backends tried before the one that succeeded, with the failure message. */
  fallbacks: z.array(z.object({ backend: z.string(), gpu: z.boolean(), message: z.string() })),
  dtwLeadS: z.number(),
  audioS: seconds,
  wallMs: z.number().nonnegative(),
  chunks: z.array(z.object({ start: seconds, end: seconds })),
  words: z.array(RawWordSchema),
});
export type WordsRaw = z.infer<typeof WordsRawSchema>;

export const WordStatusSchema = z.enum(['exact', 'folded', 'fuzzy', 'missing']);

export const TimedScriptWordSchema = z
  .object({
    i: z.number().int().nonnegative(),
    text: z.string().min(1),
    paragraph: z.number().int().nonnegative(),
    t: seconds,
    tEnd: seconds,
    confidence: z.number().min(0).max(1),
    status: WordStatusSchema,
    clamped: z.literal(true).optional(),
  })
  .refine((word) => word.tEnd >= word.t, { message: 'tEnd must be >= t', path: ['tEnd'] });

export const MismatchRegionSchema = z.object({
  kind: z.enum(['script', 'insertion']),
  from: z.number().int().nonnegative().nullable(),
  to: z.number().int().nonnegative().nullable(),
  script: z.string(),
  heard: z.string(),
  t: seconds,
  tEnd: seconds,
});

export const AlignmentStatsSchema = z.object({
  scriptWords: z.number().int().nonnegative(),
  asrWords: z.number().int().nonnegative(),
  wer: z.number().nonnegative(),
  werFolded: z.number().nonnegative(),
  exact: z.number().int().nonnegative(),
  folded: z.number().int().nonnegative(),
  fuzzy: z.number().int().nonnegative(),
  missing: z.number().int().nonnegative(),
  coverage: z.number().min(0).max(1),
  timedShare: z.number().min(0).max(1),
  insertions: z.number().int().nonnegative(),
  monotonic: z.boolean(),
  clamped: z.number().int().nonnegative(),
});

export const WordsFileSchema = z
  .object({
    version: z.literal(WORDS_FILE_VERSION),
    lang: z.string().min(1),
    /** ASR model the times came from (from words.raw.json). */
    asrModel: z.string().min(1).nullable(),
    words: z.array(TimedScriptWordSchema),
    mismatches: z.array(MismatchRegionSchema),
    stats: AlignmentStatsSchema,
  })
  .refine(
    (file) => file.words.every((word, k) => k === 0 || word.t >= (file.words[k - 1]?.t ?? 0)),
    {
      message: 'word starts must be non-decreasing',
      path: ['words'],
    },
  );
export type WordsFile = z.infer<typeof WordsFileSchema>;
