/**
 * Audio clean stage (PLAN 4.2, ADR-003): high-pass + measured-floor denoise (+ optional rnnoise and
 * pause shortening), then measure -> linear gain -> limiter to the target loudness, written as a
 * 48 kHz 16-bit WAV. Returns a CleanReport with loudness before/after; never throws for expected
 * failures.
 */
import { rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { describeError, type FfmpegError } from '../ffmpeg/errors.js';
import { err, ok, type Result } from '../result.js';
import { parseMediaAudioInfo, type LoudnessStats } from './measure.js';
import {
  measureLoudness,
  measureNoiseFloor,
  renderNormalized,
  type CleanProgress,
  type FfmpegRunner,
  type PassContext,
} from './passes.js';
import {
  OUTPUT_SAMPLE_RATE,
  buildCleanChain,
  gainSteps,
  type CleanChainParams,
  type CleanPreset,
  type OutputChannels,
  type SilenceShortening,
} from './presets.js';
import { CLEAN_REPORT_VERSION, CleanReportSchema, type CleanReport } from './report.js';

export type { CleanProgress, CleanStage, FfmpegRunner } from './passes.js';

export interface CleanAudioOptions {
  readonly ffmpeg: FfmpegRunner;
  /** Integrated loudness target for the VO stem (default -16 LUFS). */
  readonly targetLufs?: number;
  /** Allowed |after - target| for `withinTolerance` (default 0.5 LU). */
  readonly toleranceLu?: number;
  /** Re-render with a corrected gain (at most twice) when off by more than this (default 0.3 LU). */
  readonly correctionThresholdLu?: number;
  /** Limiter sample-peak ceiling (default -2 dBFS, measured true peak ~ -1.9 dBTP). */
  readonly limiterCeilingDb?: number;
  /** rnnoise model (e.g. `sh.rnnn`) for the heavy preset; skipped and reported when absent. */
  readonly arnndnModelPath?: string | undefined;
  /** Shorten pauses longer than `maxPauseS`; threshold defaults to noise floor + 3 dB. */
  readonly shortenSilence?:
    { readonly maxPauseS: number; readonly thresholdDb?: number } | undefined;
  /** 'mono' (default) down-mixes; 'source' keeps the input channel layout. */
  readonly channels?: OutputChannels;
  readonly signal?: AbortSignal | undefined;
  readonly onProgress?: ((progress: CleanProgress) => void) | undefined;
}

export const DEFAULT_TARGET_LUFS = -16;
const SILENT_INPUT_LUFS = -70;
const SILENCE_THRESHOLD_OVER_FLOOR_DB = 3;

const REQUIRED_FILTERS = [
  'aresample',
  'aformat',
  'highpass',
  'afftdn',
  'asetnsamples',
  'astats',
  'ametadata',
  'loudnorm',
  'volume',
  'alimiter',
];

async function resolveArnndn(
  ffmpeg: FfmpegRunner,
  preset: CleanPreset,
  modelPath: string | undefined,
): Promise<CleanChainParams['arnndn']> {
  if (preset !== 'heavy' || modelPath === undefined || modelPath.trim() === '') {
    return { unavailable: 'no-model' };
  }
  if (!ffmpeg.hasFilter('arnndn')) return { unavailable: 'filter-missing' };
  const isFile = await stat(modelPath).then(
    (stats) => stats.isFile(),
    () => false,
  );
  return isFile ? { modelPath: path.resolve(modelPath) } : { unavailable: 'model-missing' };
}

async function validateInput(
  ffmpeg: FfmpegRunner,
  inputPath: string,
  outputPath: string,
  needsSilenceRemove: boolean,
): Promise<Result<void, FfmpegError>> {
  const same =
    process.platform === 'win32'
      ? path.resolve(inputPath).toLowerCase() === path.resolve(outputPath).toLowerCase()
      : path.resolve(inputPath) === path.resolve(outputPath);
  if (same) return err({ kind: 'invalid-input', message: 'output must differ from input' });
  const inputStats = await stat(inputPath).then(
    (stats) => (stats.isFile() ? null : 'not a file'),
    (error: unknown) => describeError(error),
  );
  if (inputStats !== null) {
    return err({ kind: 'io', message: `cannot read input: ${inputStats}`, path: inputPath });
  }
  const required = needsSilenceRemove ? [...REQUIRED_FILTERS, 'silenceremove'] : REQUIRED_FILTERS;
  const missing = required.filter((name) => !ffmpeg.hasFilter(name));
  if (missing.length > 0) {
    return err({
      kind: 'missing-capability',
      message: `this ffmpeg build lacks filters: ${missing.join(', ')}`,
      missing,
    });
  }
  return ok(undefined);
}

/**
 * Deletes the partial render after a failure. A cleanup failure must not mask the primary error,
 * so it is appended to that error's message instead.
 */
async function failWithCleanup(
  error: FfmpegError,
  partialPath: string,
): Promise<Result<never, FfmpegError>> {
  try {
    await rm(partialPath, { force: true });
    return err(error);
  } catch (cleanupError) {
    const note = `; could not delete ${partialPath}: ${describeError(cleanupError)}`;
    return err({ ...error, message: error.message + note });
  }
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

function roundLoudness(stats: LoudnessStats): LoudnessStats {
  return {
    integratedLufs: round2(stats.integratedLufs),
    truePeakDbtp: round2(stats.truePeakDbtp),
    lraLu: round2(stats.lraLu),
  };
}

export async function cleanAudio(
  inputPath: string,
  outputPath: string,
  preset: CleanPreset,
  options: CleanAudioOptions,
): Promise<Result<CleanReport, FfmpegError>> {
  const ctx: PassContext = {
    ffmpeg: options.ffmpeg,
    signal: options.signal,
    onProgress: options.onProgress,
  };
  const targetLufs = options.targetLufs ?? DEFAULT_TARGET_LUFS;
  const toleranceLu = options.toleranceLu ?? 0.5;
  const ceilingDb = options.limiterCeilingDb ?? -2;
  const channels = options.channels ?? 'mono';

  const valid = await validateInput(
    ctx.ffmpeg,
    inputPath,
    outputPath,
    options.shortenSilence !== undefined,
  );
  if (!valid.ok) return valid;

  const [before, noiseFloor] = await Promise.all([
    measureLoudness(ctx, inputPath, [], targetLufs, 'analyze', null),
    measureNoiseFloor(ctx, inputPath, preset, channels),
  ]);
  if (!before.ok) return before;
  if (!noiseFloor.ok) return noiseFloor;
  const inputInfo = parseMediaAudioInfo(before.value.stderr);
  if (!(before.value.loudness.integratedLufs > SILENT_INPUT_LUFS)) {
    return err({ kind: 'invalid-input', message: 'input is silent (no measurable loudness)' });
  }

  const arnndn = await resolveArnndn(ctx.ffmpeg, preset, options.arnndnModelPath);
  const silence: SilenceShortening | null =
    options.shortenSilence === undefined
      ? null
      : {
          maxPauseS: options.shortenSilence.maxPauseS,
          thresholdDb:
            options.shortenSilence.thresholdDb ??
            noiseFloor.value + SILENCE_THRESHOLD_OVER_FLOOR_DB,
        };
  const chain = buildCleanChain({
    preset,
    noiseFloorDb: noiseFloor.value,
    arnndn,
    silence,
    channels,
  });

  const processed = await measureLoudness(
    ctx,
    inputPath,
    chain,
    targetLufs,
    'analyze',
    inputInfo.durationS,
  );
  if (!processed.ok) return processed;
  if (!(processed.value.loudness.integratedLufs > SILENT_INPUT_LUFS)) {
    return err({
      kind: 'invalid-input',
      message: 'cleaned signal is silent; try a lighter preset',
    });
  }

  const partialPath = `${outputPath}.partial`;
  const rendered = await renderNormalized(
    ctx,
    inputPath,
    partialPath,
    chain,
    targetLufs - processed.value.loudness.integratedLufs,
    {
      targetLufs,
      ceilingDb,
      thresholdLu: options.correctionThresholdLu ?? 0.3,
      durationS: inputInfo.durationS,
    },
  );
  if (!rendered.ok) {
    return failWithCleanup(rendered.error, partialPath);
  }
  try {
    await rename(partialPath, outputPath);
  } catch (error) {
    return failWithCleanup(
      { kind: 'io', message: `cannot write output: ${describeError(error)}`, path: outputPath },
      partialPath,
    );
  }

  const outputInfo = parseMediaAudioInfo(rendered.value.after.stderr);
  const after = roundLoudness(rendered.value.after.loudness);
  const inputDurationS = inputInfo.durationS ?? 0;
  const outputDurationS = outputInfo.durationS ?? 0;
  const report: CleanReport = {
    version: CLEAN_REPORT_VERSION,
    preset,
    targetLufs,
    toleranceLu,
    noiseFloorDb: noiseFloor.value,
    gainDb: round2(rendered.value.gainDb),
    limiterCeilingDb: ceilingDb,
    renderPasses: rendered.value.passes,
    filters: [...chain, ...gainSteps(rendered.value.gainDb, ceilingDb)].map((entry) => entry.label),
    skipped:
      preset === 'heavy' && 'unavailable' in arnndn
        ? [{ step: 'arnndn', reason: arnndn.unavailable }]
        : [],
    silence:
      silence === null
        ? null
        : {
            maxPauseS: silence.maxPauseS,
            thresholdDb: silence.thresholdDb,
            removedS: round2(inputDurationS - outputDurationS),
          },
    input: {
      durationS: inputDurationS,
      sampleRate: inputInfo.sampleRate,
      channels: inputInfo.channels,
    },
    output: {
      durationS: outputDurationS,
      sampleRate: OUTPUT_SAMPLE_RATE,
      channels: outputInfo.channels,
    },
    before: roundLoudness(before.value.loudness),
    after,
    withinTolerance: Math.abs(after.integratedLufs - targetLufs) <= toleranceLu,
  };
  const checked = CleanReportSchema.safeParse(report);
  if (!checked.success) {
    return err({ kind: 'parse-failed', message: `clean report invalid: ${checked.error.message}` });
  }
  return ok(checked.data);
}
