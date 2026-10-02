/**
 * `.reelforge/cache/peaks-<key>.json`: waveform peaks of a project audio file, cached by the
 * desktop app's timeline (PLAN.md#6.5). Keyed by the source's path, size and mtime; a stale or
 * unreadable cache file is simply recomputed.
 */
import { z } from 'zod';

export const WAVEFORM_PEAKS_FILE_VERSION = 1;

export const waveformPeaksFileSchema = z.object({
  version: z.literal(WAVEFORM_PEAKS_FILE_VERSION),
  /** Project-relative source audio (forward slashes). */
  source: z.string().min(1),
  size: z.int().nonnegative(),
  mtimeMs: z.number().nonnegative(),
  peaksPerSecond: z.int().positive(),
  /** One byte per bucket (peak |amplitude| scaled to 0..255), base64-encoded. */
  peaks: z.base64(),
});
export type WaveformPeaksFile = z.infer<typeof waveformPeaksFileSchema>;
