/** Versioned zod schema for the mix report (loudness before/after mastering, stems, warnings). */
import { z } from 'zod';
import { LoudnessSchema } from '../audio/report.js';

export const MIX_REPORT_VERSION = 1;

export const STEM_NAMES = ['vo', 'sfx', 'ambience', 'music'] as const;
export type StemName = (typeof STEM_NAMES)[number];

/** `mix/qa.ts` measurements (absent when the analysis was skipped or failed: see warnings). */
export const MixQaMeasurementsSchema = z.object({
  speechS: z.number().nonnegative(),
  musicLowShare: z.number().min(0).max(1).nullable(),
  duckingDepthDb: z.number().nullable(),
  speechMarginDb: z.number().nullable(),
  speechMarginMinDb: z.number().nullable(),
  clippedSamples: z.int().nonnegative(),
});

export const MixReportSchema = z.object({
  version: z.literal(MIX_REPORT_VERSION),
  durationS: z.number().positive(),
  sampleRate: z.literal(48_000),
  channels: z.literal(2),
  targetLufs: z.number(),
  truePeakMaxDbtp: z.number(),
  toleranceLu: z.number().positive(),
  /** Voice-over input as given (before voGain). */
  vo: LoudnessSchema,
  /** Summed buses before the master gain + limiter. */
  before: LoudnessSchema,
  /** Final `mix.wav`. */
  after: LoudnessSchema,
  /** Master gain applied before the limiter (also applied to the stems). */
  gainDb: z.number(),
  limiterCeilingDb: z.number(),
  /** Master render passes (1 + loudness corrections, + true-peak retries). */
  renderPasses: z.number().int().min(1),
  /** |after.integratedLufs - targetLufs| <= toleranceLu. */
  withinTolerance: z.boolean(),
  /** after.truePeakDbtp <= truePeakMaxDbtp. */
  truePeakOk: z.boolean(),
  cues: z.object({
    sfx: z.number().int().nonnegative(),
    ambience: z.number().int().nonnegative(),
    music: z.number().int().nonnegative(),
    /** Distinct ducked music buses (one sidechain compressor each). */
    duckedMusicBuses: z.number().int().nonnegative(),
  }),
  /** Stems written (empty when no stems directory was requested). */
  stems: z.array(z.enum(STEM_NAMES)),
  qa: MixQaMeasurementsSchema.optional(),
  warnings: z.array(z.string()),
});

export type MixReport = z.infer<typeof MixReportSchema>;
