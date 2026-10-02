/** Versioned zod schema for the audio-clean report (LUFS / true peak before and after). */
import { z } from 'zod';
import { ARNNDN_UNAVAILABLE_REASONS, CLEAN_PRESETS } from './presets.js';

export const CLEAN_REPORT_VERSION = 1;

export const LoudnessSchema = z.object({
  integratedLufs: z.number(),
  truePeakDbtp: z.number(),
  lraLu: z.number(),
});

const AudioFormatSchema = z.object({
  durationS: z.number().nonnegative(),
  sampleRate: z.number().int().positive().nullable(),
  channels: z.number().int().positive().nullable(),
});

export const CleanReportSchema = z.object({
  version: z.literal(CLEAN_REPORT_VERSION),
  preset: z.enum(CLEAN_PRESETS),
  targetLufs: z.number(),
  toleranceLu: z.number().positive(),
  /** Measured 10th-percentile window RMS (dBFS) after the high-pass; feeds afftdn `nf`. */
  noiseFloorDb: z.number(),
  /** Final linear gain applied before the limiter. */
  gainDb: z.number(),
  limiterCeilingDb: z.number(),
  /** Number of full render passes (1 + corrective passes, at most 3). */
  renderPasses: z.number().int().min(1).max(3),
  /** Filter chain as applied (model paths shortened to file names). */
  filters: z.array(z.string()),
  skipped: z.array(
    z.object({
      step: z.literal('arnndn'),
      reason: z.enum(ARNNDN_UNAVAILABLE_REASONS),
    }),
  ),
  silence: z
    .object({
      maxPauseS: z.number().positive(),
      thresholdDb: z.number(),
      /** Input duration minus output duration; > 0 means the timeline changed. */
      removedS: z.number(),
    })
    .nullable(),
  input: AudioFormatSchema,
  output: AudioFormatSchema,
  before: LoudnessSchema,
  after: LoudnessSchema,
  /** |after.integratedLufs - targetLufs| <= toleranceLu. */
  withinTolerance: z.boolean(),
});

export type CleanReport = z.infer<typeof CleanReportSchema>;
export type CleanSkippedStep = CleanReport['skipped'][number];
