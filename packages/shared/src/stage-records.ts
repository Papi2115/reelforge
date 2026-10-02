/**
 * App-side records of the pipeline stages (PLAN.md#7.1-7.3, #8.1, #8.3), all under
 * `<project>/.reelforge/` (not tracked by git): the imported voice-over, the VO <-> script
 * discrepancy report and the per-stage reports (script stats, words timing attempts, storyboard).
 * The audio clean and mix reports keep their own schemas in `@reelforge/pipeline`.
 */
import { z } from 'zod';

export const VOICEOVER_RECORD_VERSION = 1;
export const VO_REPORT_VERSION = 1;
export const SCRIPT_REPORT_VERSION = 1;
export const WORDS_REPORT_VERSION = 1;
export const STORYBOARD_REPORT_VERSION = 1;

/** Formats the voice-over import accepts. */
export const VOICEOVER_EXTENSIONS = ['wav', 'mp3', 'm4a', 'ogg', 'flac'] as const;
export const voiceoverExtensionSchema = z.enum(VOICEOVER_EXTENSIONS);
export type VoiceoverExtension = z.infer<typeof voiceoverExtensionSchema>;

const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/, 'sha256 hex digest');

/** `.reelforge/voiceover.json`: which recording `audio/vo.original.<ext>` is. */
export const voiceoverRecordSchema = z.object({
  version: z.literal(VOICEOVER_RECORD_VERSION),
  /** Project-relative, e.g. `audio/vo.original.wav`. */
  file: z.string().min(1),
  sha256: sha256Schema,
  /** File name the user imported (no folder). */
  sourceName: z.string().min(1),
  importedAt: z.iso.datetime(),
  durationS: z.number().nonnegative().nullable(),
  /** The replaced recording, when it was archived as `audio/vo.original.prev.<ext>`. */
  previous: z
    .object({ file: z.string().min(1), sha256: sha256Schema })
    .nullable()
    .default(null),
});
export type VoiceoverRecord = z.output<typeof voiceoverRecordSchema>;

export const voVerdictSchema = z.enum(['ok', 'too-short', 'too-long', 'unknown']);
export type VoVerdict = z.infer<typeof voVerdictSchema>;

/** `.reelforge/reports/voiceover.json`: does the recording fit the script? */
export const voReportSchema = z.object({
  version: z.literal(VO_REPORT_VERSION),
  durationS: z.number().nonnegative().nullable(),
  /** Null when there is no script yet. */
  scriptWords: z.int().nonnegative().nullable(),
  /** Script length at 150 words per minute. */
  expectedDurationS: z.number().nonnegative().nullable(),
  /** Spoken words per minute implied by the recording length. */
  wordsPerMinute: z.number().nonnegative().nullable(),
  verdict: voVerdictSchema,
  messages: z.array(z.string()),
  /** Filled in by "Words timed": how much of the script was found in the recording. */
  alignment: z
    .object({
      coverage: z.number().min(0).max(1),
      mismatches: z.int().nonnegative(),
      missingWords: z.int().nonnegative(),
    })
    .nullable(),
});
export type VoReport = z.infer<typeof voReportSchema>;

/** `.reelforge/reports/script.json`. */
export const scriptReportSchema = z.object({
  version: z.literal(SCRIPT_REPORT_VERSION),
  wordCount: z.int().nonnegative(),
  targetWords: z.int().positive(),
  estimatedSeconds: z.number().nonnegative(),
  /** Claude repair turns needed (0 or 1). */
  repairs: z.int().nonnegative(),
  researchSources: z.int().nonnegative(),
  issues: z.array(z.string()),
});
export type ScriptReport = z.infer<typeof scriptReportSchema>;

export const wordsAttemptSchema = z.object({
  model: z.string().min(1),
  beamSize: z.int().positive().nullable(),
  temperature: z.number().min(0).max(1).nullable(),
  coverage: z.number().min(0).max(1).nullable(),
  /** A repeated n-gram run (decoder loop) was found in the raw words. */
  loop: z.boolean(),
  error: z.string().nullable(),
});
export type WordsAttempt = z.infer<typeof wordsAttemptSchema>;

/** `.reelforge/reports/words.json`: ASR attempts and the alignment result kept. */
export const wordsReportSchema = z.object({
  version: z.literal(WORDS_REPORT_VERSION),
  /** Project-relative audio that was transcribed. */
  audio: z.string().min(1),
  lang: z.string().min(1),
  attempts: z.array(wordsAttemptSchema).min(1),
  /** Index into `attempts` of the result written to timing/. */
  chosen: z.int().nonnegative(),
  coverage: z.number().min(0).max(1),
  mismatches: z.array(
    z.object({ t: z.number(), tEnd: z.number(), script: z.string(), heard: z.string() }),
  ),
  warnings: z.array(z.string()),
  /** whisper.cpp build of the kept result (absent in reports written before it existed). */
  engine: z
    .object({
      /** `cuda` / `blas` / `cpu` (app-managed builds) or `custom`. */
      backend: z.string().min(1),
      usedGpu: z.boolean(),
      wallMs: z.number().nonnegative(),
      audioS: z.number().nonnegative(),
      /** Why it ran on the CPU although a GPU build was tried (shown as a hint), else null. */
      cpuReason: z.string().nullable(),
    })
    .optional(),
});
export type WordsReport = z.infer<typeof wordsReportSchema>;

/** `.reelforge/reports/storyboard.json`. */
export const storyboardReportSchema = z.object({
  version: z.literal(STORYBOARD_REPORT_VERSION),
  shots: z.int().nonnegative(),
  treatments: z.record(z.string(), z.int().nonnegative()),
  missingProps: z.array(z.string()),
  /** Scene files created as placeholders (project-relative). */
  stubs: z.array(z.string()),
  repairs: z.int().nonnegative(),
  warnings: z.array(z.string()),
});
export type StoryboardReport = z.infer<typeof storyboardReportSchema>;
