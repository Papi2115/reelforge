/** ffmpeg passes of the clean stage: loudness / noise-floor measurement and normalised render. */
import type { FfmpegError } from '../ffmpeg/errors.js';
import type { FfmpegManager, FfmpegRunOptions } from '../ffmpeg/manager.js';
import { err, ok, type Result } from '../result.js';
import {
  loudnormAnalysisFilter,
  noiseFloorFromWindows,
  parseLoudnormJson,
  parseRmsWindows,
  rmsWindowFilters,
  type LoudnessStats,
} from './measure.js';
import {
  OUTPUT_SAMPLE_RATE,
  analysisArgs,
  formatSteps,
  gainSteps,
  highpassStep,
  joinFilters,
  renderArgs,
  type CleanPreset,
  type FilterStep,
  type OutputChannels,
} from './presets.js';

/** The subset of FfmpegManager the clean stage needs (lets callers wrap or fake it). */
export type FfmpegRunner = Pick<FfmpegManager, 'run' | 'hasFilter'>;

export type CleanStage = 'analyze' | 'render' | 'verify';

export interface CleanProgress {
  readonly stage: CleanStage;
  /** 0..1 within the current ffmpeg pass; null when unknown. */
  readonly ratio: number | null;
}

const NOISE_WINDOW_S = 0.05;
/** Up to two corrective renders (3 passes) when the limiter pulls loudness below target. */
const MAX_CORRECTIONS = 2;

export interface PassContext {
  readonly ffmpeg: FfmpegRunner;
  readonly signal: AbortSignal | undefined;
  readonly onProgress: ((progress: CleanProgress) => void) | undefined;
}

function runOptions(
  ctx: PassContext,
  stage: CleanStage,
  durationS: number | null,
): FfmpegRunOptions {
  const onProgress = ctx.onProgress;
  return {
    signal: ctx.signal,
    durationS: durationS ?? undefined,
    onProgress:
      onProgress === undefined
        ? undefined
        : (progress) => {
            onProgress({ stage, ratio: progress.ratio });
          },
  };
}

export interface Measured {
  readonly loudness: LoudnessStats;
  readonly stderr: string;
}

export async function measureLoudness(
  ctx: PassContext,
  inputPath: string,
  chain: readonly FilterStep[],
  targetLufs: number,
  stage: CleanStage,
  durationS: number | null,
): Promise<Result<Measured, FfmpegError>> {
  const filters = [...chain.map((entry) => entry.filter), loudnormAnalysisFilter(targetLufs)];
  const run = await ctx.ffmpeg.run(
    analysisArgs(inputPath, filters.join(',')),
    runOptions(ctx, stage, durationS),
  );
  if (!run.ok) return run;
  const loudness = parseLoudnormJson(run.value.stderr);
  if (!loudness.ok) return loudness;
  return ok({ loudness: loudness.value, stderr: run.value.stderr });
}

export async function measureNoiseFloor(
  ctx: PassContext,
  inputPath: string,
  preset: CleanPreset,
  channels: OutputChannels,
): Promise<Result<number, FfmpegError>> {
  const chain = [
    joinFilters([...formatSteps(channels), highpassStep(preset)]),
    ...rmsWindowFilters(NOISE_WINDOW_S, OUTPUT_SAMPLE_RATE),
  ].join(',');
  const run = await ctx.ffmpeg.run(analysisArgs(inputPath, chain), { signal: ctx.signal });
  if (!run.ok) return run;
  const floor = noiseFloorFromWindows(parseRmsWindows(run.value.stdout));
  if (floor === null) {
    return err({ kind: 'parse-failed', message: 'noise floor: no RMS windows in ffmpeg output' });
  }
  return ok(floor);
}

export interface RenderOutcome {
  readonly gainDb: number;
  readonly passes: number;
  readonly after: Measured;
}

/** Renders chain + gain + limiter and verifies loudness; re-renders with a corrected gain. */
export async function renderNormalized(
  ctx: PassContext,
  inputPath: string,
  partialPath: string,
  chain: readonly FilterStep[],
  initialGainDb: number,
  settings: {
    targetLufs: number;
    ceilingDb: number;
    thresholdLu: number;
    durationS: number | null;
  },
): Promise<Result<RenderOutcome, FfmpegError>> {
  const history: GainPoint[] = [];
  let gainDb = initialGainDb;
  for (let pass = 1; ; pass++) {
    const filters = joinFilters([...chain, ...gainSteps(gainDb, settings.ceilingDb)]);
    const render = await ctx.ffmpeg.run(
      renderArgs(inputPath, filters, partialPath),
      runOptions(ctx, 'render', settings.durationS),
    );
    if (!render.ok) return render;
    const after = await measureLoudness(ctx, partialPath, [], settings.targetLufs, 'verify', null);
    if (!after.ok) return after;
    const lufs = after.value.loudness.integratedLufs;
    if (Math.abs(settings.targetLufs - lufs) <= settings.thresholdLu || pass > MAX_CORRECTIONS) {
      return ok({ gainDb, passes: pass, after: after.value });
    }
    history.push({ gainDb, lufs });
    gainDb = nextGainDb(history, settings.targetLufs);
  }
}

export interface GainPoint {
  readonly gainDb: number;
  readonly lufs: number;
}

const MAX_GAIN_STEP_DB = 12;

/**
 * Corrected gain after a render: first a unit-slope step, then a secant step on the last two
 * renders (the limiter makes loudness grow slower than gain, so a unit step can undershoot).
 */
export function nextGainDb(history: readonly GainPoint[], targetLufs: number): number {
  const last = history.at(-1);
  if (last === undefined) return 0;
  const previous = history.at(-2);
  let slope = 1;
  if (previous !== undefined && last.gainDb !== previous.gainDb) {
    const measured = (last.lufs - previous.lufs) / (last.gainDb - previous.gainDb);
    if (measured >= 0.1 && measured <= 1.5) slope = measured;
  }
  const step = (targetLufs - last.lufs) / slope;
  return last.gainDb + Math.min(MAX_GAIN_STEP_DB, Math.max(-MAX_GAIN_STEP_DB, step));
}
