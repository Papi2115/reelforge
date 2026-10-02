/**
 * Sound-design mix (PLAN 4.6): cues -> SFX / ambience / music buses rendered offline in Node ->
 * ffmpeg premix (VO + buses, music ducked by the VO) -> master: measure -> gain -> alimiter to the
 * target loudness with a true-peak ceiling (ADR-003, not two-pass loudnorm) -> `mix.wav`
 * (48 kHz 16-bit stereo) + optional float32 stems with the same master gain. Deterministic: the
 * same cues and inputs give a byte-identical `mix.wav`. Never throws for expected failures.
 */
import { mkdir, mkdtemp, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { describeError, type FfmpegError } from '../ffmpeg/errors.js';
import { parseMediaAudioInfo, type LoudnessStats } from '../audio/measure.js';
import {
  measureLoudness,
  type CleanStage,
  type FfmpegRunner,
  type PassContext,
} from '../audio/passes.js';
import { err, ok, type Result } from '../result.js';
import { writeBusWav } from './bus.js';
import { decodeAudioFile, type StereoClip } from './clip.js';
import type { CuesFile } from './cues.js';
import { MIX_SAMPLE_RATE, secondsToFrames } from './dsp.js';
import { MIX_REQUIRED_FILTERS, premixArgs, type MusicBusInput } from './graph.js';
import { STEM_FILE_NAMES, masterMix, writeStems } from './master.js';
import { cueFiles, planMix, type MixPlan } from './plan.js';
import { MIX_REPORT_VERSION, MixReportSchema, type MixReport, type StemName } from './report.js';

export type MixStage =
  'analyze' | 'decode' | 'synthesize' | 'premix' | 'master' | 'verify' | 'stems';

export interface MixProgress {
  readonly stage: MixStage;
  /** 0..1 within the current ffmpeg pass; null when unknown. */
  readonly ratio: number | null;
}

export interface MixAudioOptions {
  readonly ffmpeg: FfmpegRunner;
  /** Voice-over (normally `audio/vo.clean.wav`); also the ducking sidechain. */
  readonly voPath: string;
  /** Final mix (normally `audio/mix.wav`). */
  readonly outputPath: string;
  /** Folder that relative cue file paths are resolved against (the project folder). */
  readonly baseDir: string;
  /** When set, `vo.wav`, `sfx.wav`, `ambience.wav` and `music.wav` are written here. */
  readonly stemsDir?: string | undefined;
  /** Parent folder for temporary files (default: the output's folder); always cleaned up. */
  readonly workDir?: string | undefined;
  /** Allowed |after - target| for `withinTolerance` (default 0.5 LU). */
  readonly toleranceLu?: number;
  /** Re-render the master with a corrected gain when off by more than this (default 0.3 LU). */
  readonly correctionThresholdLu?: number;
  readonly signal?: AbortSignal | undefined;
  readonly onProgress?: ((progress: MixProgress) => void) | undefined;
}

const SILENT_LUFS = -70;

const CLEAN_TO_MIX_STAGE: Readonly<Record<CleanStage, MixStage>> = {
  analyze: 'analyze',
  render: 'master',
  verify: 'verify',
};

interface WorkFiles {
  readonly sfx: string;
  readonly ambience: string;
  readonly music: (index: number) => string;
  readonly premix: string;
  readonly voStem: string;
  readonly musicStem: string;
}

function workFiles(dir: string): WorkFiles {
  return {
    sfx: path.join(dir, 'sfx.bus.wav'),
    ambience: path.join(dir, 'ambience.bus.wav'),
    music: (index) => path.join(dir, `music-${String(index)}.bus.wav`),
    premix: path.join(dir, 'premix.wav'),
    voStem: path.join(dir, 'vo.stem.wav'),
    musicStem: path.join(dir, 'music.stem.wav'),
  };
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

function roundLoudness(stats: LoudnessStats): LoudnessStats {
  return {
    integratedLufs: round2(stats.integratedLufs),
    truePeakDbtp: round2(stats.truePeakDbtp),
    lraLu: round2(stats.lraLu),
  };
}

async function fileExists(filePath: string, label: string): Promise<Result<void, FfmpegError>> {
  const problem = await stat(filePath).then(
    (stats) => (stats.isFile() ? null : 'not a file'),
    (error: unknown) => describeError(error),
  );
  return problem === null
    ? ok(undefined)
    : err({ kind: 'io', message: `cannot read ${label}: ${problem}`, path: filePath });
}

function samePath(first: string, second: string): boolean {
  const a = path.resolve(first);
  const b = path.resolve(second);
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
}

class MixRun {
  private readonly pass: PassContext;
  private readonly files: WorkFiles;

  constructor(
    private readonly cues: CuesFile,
    private readonly options: MixAudioOptions,
    private readonly workDir: string,
  ) {
    const onProgress = options.onProgress;
    this.pass = {
      ffmpeg: options.ffmpeg,
      signal: options.signal,
      onProgress:
        onProgress === undefined
          ? undefined
          : (progress) => {
              onProgress({ stage: CLEAN_TO_MIX_STAGE[progress.stage], ratio: progress.ratio });
            },
    };
    this.files = workFiles(workDir);
  }

  private progress(stage: MixStage): void {
    this.options.onProgress?.({ stage, ratio: null });
  }

  private async decodeFiles(): Promise<Result<Map<string, StereoClip>, FfmpegError>> {
    this.progress('decode');
    const clips = new Map<string, StereoClip>();
    for (const [index, file] of cueFiles(this.cues, this.options.baseDir).entries()) {
      const exists = await fileExists(file, 'cue audio file');
      if (!exists.ok) return exists;
      const decoded = await decodeAudioFile(
        this.options.ffmpeg,
        file,
        this.workDir,
        index,
        this.options.signal,
      );
      if (!decoded.ok) return decoded;
      clips.set(file, decoded.value);
    }
    return ok(clips);
  }

  private async renderBuses(plan: MixPlan): Promise<Result<MusicBusInput[], FfmpegError>> {
    this.progress('synthesize');
    const { signal } = this.options;
    const sfx = await writeBusWav(this.files.sfx, plan.sfx, plan.totalFrames, signal);
    if (!sfx.ok) return sfx;
    const ambience = await writeBusWav(
      this.files.ambience,
      plan.ambience,
      plan.totalFrames,
      signal,
    );
    if (!ambience.ok) return ambience;
    const buses: MusicBusInput[] = [];
    for (const [index, bus] of plan.music.entries()) {
      const busPath = this.files.music(index);
      const written = await writeBusWav(busPath, bus.events, plan.totalFrames, signal);
      if (!written.ok) return written;
      buses.push({ path: busPath, ducking: bus.ducking });
    }
    return ok(buses);
  }

  private async premix(
    musicBuses: readonly MusicBusInput[],
    totalFrames: number,
  ): Promise<Result<void, FfmpegError>> {
    const onProgress = this.options.onProgress;
    const run = await this.options.ffmpeg.run(
      premixArgs(
        {
          voPath: this.options.voPath,
          sfxBusPath: this.files.sfx,
          ambienceBusPath: this.files.ambience,
          musicBuses,
          totalFrames,
          voGainDb: this.cues.global.voGainDb,
        },
        { premix: this.files.premix, voStem: this.files.voStem, musicStem: this.files.musicStem },
      ),
      {
        signal: this.options.signal,
        durationS: totalFrames / MIX_SAMPLE_RATE,
        onProgress:
          onProgress === undefined
            ? undefined
            : (progress) => {
                onProgress({ stage: 'premix', ratio: progress.ratio });
              },
      },
    );
    return run.ok ? ok(undefined) : run;
  }

  private stems(stemsDir: string, gainDb: number): Promise<Result<StemName[], FfmpegError>> {
    this.progress('stems');
    const sources: Readonly<Record<StemName, string>> = {
      vo: this.files.voStem,
      sfx: this.files.sfx,
      ambience: this.files.ambience,
      music: this.files.musicStem,
    };
    return writeStems(this.options.ffmpeg, sources, stemsDir, gainDb, this.options.signal);
  }

  async run(): Promise<Result<MixReport, FfmpegError>> {
    const { targetLufs, truePeakMaxDbtp } = this.cues.global;
    const vo = await measureLoudness(
      this.pass,
      this.options.voPath,
      [],
      targetLufs,
      'analyze',
      null,
    );
    if (!vo.ok) return vo;
    if (!(vo.value.loudness.integratedLufs > SILENT_LUFS)) {
      return err({
        kind: 'invalid-input',
        message: 'voice-over is silent (no measurable loudness)',
      });
    }
    const durationS = this.cues.global.durationS ?? parseMediaAudioInfo(vo.value.stderr).durationS;
    const totalFrames = durationS === null ? 0 : secondsToFrames(durationS);
    if (totalFrames <= 0) {
      return err({ kind: 'parse-failed', message: 'cannot determine the voice-over duration' });
    }
    const timelineS = totalFrames / MIX_SAMPLE_RATE;

    const clips = await this.decodeFiles();
    if (!clips.ok) return clips;
    const plan = planMix(this.cues, totalFrames, this.options.baseDir, clips.value);
    if (!plan.ok) return plan;
    const buses = await this.renderBuses(plan.value);
    if (!buses.ok) return buses;
    const premixed = await this.premix(buses.value, totalFrames);
    if (!premixed.ok) return premixed;

    const before = await measureLoudness(
      this.pass,
      this.files.premix,
      [],
      targetLufs,
      'analyze',
      timelineS,
    );
    if (!before.ok) return before;
    if (!(before.value.loudness.integratedLufs > SILENT_LUFS)) {
      return err({ kind: 'invalid-input', message: 'the mix is silent' });
    }
    const partialPath = `${this.options.outputPath}.partial`;
    const mastered = await masterMix(
      this.pass,
      this.files.premix,
      partialPath,
      before.value.loudness,
      {
        targetLufs,
        truePeakMaxDbtp,
        thresholdLu: this.options.correctionThresholdLu ?? 0.3,
        durationS: timelineS,
      },
    );
    if (!mastered.ok) return mastered;
    const stems =
      this.options.stemsDir === undefined
        ? ok<StemName[]>([])
        : await this.stems(this.options.stemsDir, mastered.value.gainDb);
    if (!stems.ok) return stems;
    try {
      await rename(partialPath, this.options.outputPath);
    } catch (error) {
      return err({
        kind: 'io',
        message: `cannot write mix: ${describeError(error)}`,
        path: this.options.outputPath,
      });
    }

    const after = roundLoudness(mastered.value.after);
    const toleranceLu = this.options.toleranceLu ?? 0.5;
    const report: MixReport = {
      version: MIX_REPORT_VERSION,
      durationS: timelineS,
      sampleRate: MIX_SAMPLE_RATE,
      channels: 2,
      targetLufs,
      truePeakMaxDbtp,
      toleranceLu,
      vo: roundLoudness(vo.value.loudness),
      before: roundLoudness(before.value.loudness),
      after,
      gainDb: round2(mastered.value.gainDb),
      limiterCeilingDb: round2(mastered.value.ceilingDb),
      renderPasses: mastered.value.passes,
      withinTolerance: Math.abs(after.integratedLufs - targetLufs) <= toleranceLu,
      truePeakOk: after.truePeakDbtp <= truePeakMaxDbtp,
      cues: {
        sfx: this.cues.sfx.length,
        ambience: this.cues.ambience.length,
        music: this.cues.music.length,
        duckedMusicBuses: plan.value.music.filter((bus) => bus.ducking !== null).length,
      },
      stems: stems.value,
      warnings: [...plan.value.warnings],
    };
    const checked = MixReportSchema.safeParse(report);
    return checked.success
      ? ok(checked.data)
      : err({ kind: 'parse-failed', message: `mix report invalid: ${checked.error.message}` });
  }
}

async function validate(options: MixAudioOptions): Promise<Result<void, FfmpegError>> {
  const missing = MIX_REQUIRED_FILTERS.filter((name) => !options.ffmpeg.hasFilter(name));
  if (missing.length > 0) {
    return err({
      kind: 'missing-capability',
      message: `this ffmpeg build lacks filters: ${missing.join(', ')}`,
      missing,
    });
  }
  if (samePath(options.voPath, options.outputPath)) {
    return err({ kind: 'invalid-input', message: 'output must differ from the voice-over' });
  }
  return fileExists(options.voPath, 'voice-over');
}

/** Renders the mix described by `cues`; see the module comment. */
export async function mixAudio(
  cues: CuesFile,
  options: MixAudioOptions,
): Promise<Result<MixReport, FfmpegError>> {
  const valid = await validate(options);
  if (!valid.ok) return valid;
  const parent = options.workDir ?? path.dirname(path.resolve(options.outputPath));
  let workDir: string;
  try {
    await mkdir(parent, { recursive: true });
    await mkdir(path.dirname(path.resolve(options.outputPath)), { recursive: true });
    workDir = await mkdtemp(path.join(parent, '.reelforge-mix-'));
  } catch (error) {
    return err({
      kind: 'io',
      message: `cannot create work folder: ${describeError(error)}`,
      path: parent,
    });
  }
  const result = await new MixRun(cues, options, workDir).run();
  const stemsDir = options.stemsDir;
  const leftovers = [
    workDir,
    `${options.outputPath}.partial`,
    ...(stemsDir === undefined
      ? []
      : Object.values(STEM_FILE_NAMES).map((name) => path.join(stemsDir, `${name}.partial`))),
  ];
  try {
    for (const leftover of leftovers) await rm(leftover, { recursive: true, force: true });
    return result;
  } catch (error) {
    const note = `could not delete temporary files in ${workDir}: ${describeError(error)}`;
    if (!result.ok) return err({ ...result.error, message: `${result.error.message}; ${note}` });
    return ok({ ...result.value, warnings: [...result.value.warnings, note] });
  }
}
