/**
 * Mastering and stem export for the mix: measure -> linear gain -> `alimiter` towards the target
 * loudness (ADR-003; reuses the clean stage's corrective render loop), with a sample-peak ceiling
 * 1 dB under the true-peak limit and one retry with a lower ceiling if the true peak is still over.
 */
import { mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { describeError, type FfmpegError } from '../ffmpeg/errors.js';
import type { LoudnessStats } from '../audio/measure.js';
import { renderNormalized, type FfmpegRunner, type PassContext } from '../audio/passes.js';
import { err, ok, type Result } from '../result.js';
import { stemArgs } from './graph.js';
import type { StemName } from './report.js';

export const STEM_FILE_NAMES: Readonly<Record<StemName, string>> = {
  vo: 'vo.wav',
  sfx: 'sfx.wav',
  ambience: 'ambience.wav',
  music: 'music.wav',
};

/** Sample-peak limiter ceiling below the true-peak limit (inter-sample overs). */
const CEILING_MARGIN_DB = 1;
const TRUE_PEAK_RETRY_MARGIN_DB = 0.5;

export interface MasterSettings {
  readonly targetLufs: number;
  readonly truePeakMaxDbtp: number;
  /** Re-render with a corrected gain when off by more than this (LU). */
  readonly thresholdLu: number;
  readonly durationS: number;
}

export interface Mastered {
  readonly gainDb: number;
  readonly ceilingDb: number;
  readonly after: LoudnessStats;
  readonly passes: number;
}

/** Renders `premixPath` -> `outputPath` (48 kHz 16-bit) at the target loudness. */
export async function masterMix(
  pass: PassContext,
  premixPath: string,
  outputPath: string,
  before: LoudnessStats,
  settings: MasterSettings,
): Promise<Result<Mastered, FfmpegError>> {
  const { targetLufs, truePeakMaxDbtp } = settings;
  let ceilingDb = truePeakMaxDbtp - CEILING_MARGIN_DB;
  let gainDb = targetLufs - before.integratedLufs;
  let passes = 0;
  for (let attempt = 0; ; attempt++) {
    const rendered = await renderNormalized(pass, premixPath, outputPath, [], gainDb, {
      targetLufs,
      ceilingDb,
      thresholdLu: settings.thresholdLu,
      durationS: settings.durationS,
    });
    if (!rendered.ok) return rendered;
    passes += rendered.value.passes;
    gainDb = rendered.value.gainDb;
    const after = rendered.value.after.loudness;
    if (after.truePeakDbtp <= truePeakMaxDbtp || attempt >= 1) {
      return ok({ gainDb, ceilingDb, after, passes });
    }
    ceilingDb -= after.truePeakDbtp - truePeakMaxDbtp + TRUE_PEAK_RETRY_MARGIN_DB;
  }
}

/** Writes every stem with the master gain applied (float32 WAV, via `.partial` + rename). */
export async function writeStems(
  ffmpeg: FfmpegRunner,
  sources: Readonly<Record<StemName, string>>,
  stemsDir: string,
  gainDb: number,
  signal: AbortSignal | undefined,
): Promise<Result<StemName[], FfmpegError>> {
  const names = Object.keys(STEM_FILE_NAMES) as StemName[];
  const jobs = names.map((name) => ({
    name,
    input: sources[name],
    output: path.join(stemsDir, `${STEM_FILE_NAMES[name]}.partial`),
  }));
  try {
    await mkdir(stemsDir, { recursive: true });
  } catch (error) {
    return err({
      kind: 'io',
      message: `cannot create ${stemsDir}: ${describeError(error)}`,
      path: stemsDir,
    });
  }
  const run = await ffmpeg.run(stemArgs(jobs, gainDb), { signal });
  if (!run.ok) return run;
  for (const job of jobs) {
    const target = path.join(stemsDir, STEM_FILE_NAMES[job.name]);
    try {
      await rename(job.output, target);
    } catch (error) {
      return err({
        kind: 'io',
        message: `cannot write stem: ${describeError(error)}`,
        path: target,
      });
    }
  }
  return ok(names);
}
