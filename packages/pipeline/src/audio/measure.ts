/**
 * Parsers + arg builders for audio measurement passes: loudnorm analysis JSON (integrated
 * loudness, true peak, LRA), per-window RMS from astats/ametadata (noise floor), and the input
 * description ffmpeg prints on stderr (duration, sample rate, channels).
 */
import { z } from 'zod';
import type { FfmpegError } from '../ffmpeg/errors.js';
import { err, ok, type Result } from '../result.js';

export interface LoudnessStats {
  readonly integratedLufs: number;
  readonly truePeakDbtp: number;
  readonly lraLu: number;
}

export interface MediaAudioInfo {
  readonly durationS: number | null;
  readonly sampleRate: number | null;
  readonly channels: number | null;
}

/** ffmpeg prints numbers as strings, with "-inf"/"inf" for silence. */
const loudnormNumber = z
  .union([z.string(), z.number()])
  .transform((value) => {
    if (typeof value === 'number') return value;
    const trimmed = value.trim();
    if (trimmed === '-inf') return Number.NEGATIVE_INFINITY;
    if (trimmed === 'inf' || trimmed === '+inf') return Number.POSITIVE_INFINITY;
    return Number(trimmed);
  })
  .refine((value) => !Number.isNaN(value), 'not a number');

const loudnormJsonSchema = z.object({
  input_i: loudnormNumber,
  input_tp: loudnormNumber,
  input_lra: loudnormNumber,
});

/** Analysis-only loudnorm filter: reports input stats as JSON on stderr at the end of the run. */
export function loudnormAnalysisFilter(targetLufs: number): string {
  return `loudnorm=I=${String(targetLufs)}:TP=-1.5:LRA=11:print_format=json`;
}

/** Parses the last `{...}` block printed by `loudnorm=print_format=json`. */
export function parseLoudnormJson(stderr: string): Result<LoudnessStats, FfmpegError> {
  const end = stderr.lastIndexOf('}');
  const start = end < 0 ? -1 : stderr.lastIndexOf('{', end);
  if (start < 0) {
    return err({ kind: 'parse-failed', message: 'loudnorm: no JSON block in ffmpeg output' });
  }
  let raw: unknown;
  try {
    raw = JSON.parse(stderr.slice(start, end + 1));
  } catch (error) {
    return err({
      kind: 'parse-failed',
      message: `loudnorm: invalid JSON (${error instanceof Error ? error.message : String(error)})`,
    });
  }
  const parsed = loudnormJsonSchema.safeParse(raw);
  if (!parsed.success) {
    return err({ kind: 'parse-failed', message: `loudnorm: ${parsed.error.message}` });
  }
  return ok({
    integratedLufs: parsed.data.input_i,
    truePeakDbtp: parsed.data.input_tp,
    lraLu: parsed.data.input_lra,
  });
}

/** Filters that print the RMS level of every `windowS` window to stdout (one `RMS_level=` line). */
export function rmsWindowFilters(windowS: number, sampleRate: number): string[] {
  const samples = Math.max(1, Math.round(windowS * sampleRate));
  return [
    `asetnsamples=n=${String(samples)}:p=0`,
    'astats=metadata=1:reset=1:measure_perchannel=none',
    'ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-',
  ];
}

/** Extracts RMS levels (dBFS) from ametadata output; digital silence ("-inf") is kept as -Infinity. */
export function parseRmsWindows(stdout: string): number[] {
  const values: number[] = [];
  for (const match of stdout.matchAll(/RMS_level=(-inf|-?\d+(?:\.\d+)?)/g)) {
    const token = match[1];
    if (token === undefined) continue;
    values.push(token === '-inf' ? Number.NEGATIVE_INFINITY : Number(token));
  }
  return values;
}

export interface NoiseFloorOptions {
  /** Percentile of window levels taken as the floor (default 0.1, as validated in spike 03). */
  readonly percentile?: number;
  readonly minDb?: number;
  readonly maxDb?: number;
}

/** Noise floor = low percentile of window RMS levels, rounded and clamped (afftdn `nf` range). */
export function noiseFloorFromWindows(
  levelsDb: readonly number[],
  options: NoiseFloorOptions = {},
): number | null {
  if (levelsDb.length === 0) return null;
  const percentile = options.percentile ?? 0.1;
  const minDb = options.minDb ?? -80;
  const maxDb = options.maxDb ?? -20;
  const sorted = [...levelsDb].sort((a, b) => a - b);
  const value = sorted[Math.floor(percentile * (sorted.length - 1))] ?? minDb;
  return Math.min(maxDb, Math.max(minDb, Math.round(value)));
}

function channelCount(layout: string): number | null {
  const named: Readonly<Record<string, number>> = {
    mono: 1,
    stereo: 2,
    '2.1': 3,
    '3.0': 3,
    quad: 4,
    '4.0': 4,
    '5.0': 5,
    '5.1': 6,
    '7.1': 8,
  };
  const base = layout.replace(/\(.*\)$/, '');
  const known = named[base];
  if (known !== undefined) return known;
  const counted = /^(\d+) channels/.exec(layout);
  return counted?.[1] === undefined ? null : Number(counted[1]);
}

/** Reads the first input's duration and first audio stream format from ffmpeg's stderr banner. */
export function parseMediaAudioInfo(stderr: string): MediaAudioInfo {
  const duration = /Duration: (\d+):(\d{2}):(\d{2}(?:\.\d+)?)/.exec(stderr);
  const durationS =
    duration === null
      ? null
      : Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3]);
  const stream = /Stream #0:\d+[^:]*: Audio: [^\n]*?, (\d+) Hz, ([^,\n]+)/.exec(stderr);
  return {
    durationS,
    sampleRate: stream?.[1] === undefined ? null : Number(stream[1]),
    channels: stream?.[2] === undefined ? null : channelCount(stream[2].trim()),
  };
}
