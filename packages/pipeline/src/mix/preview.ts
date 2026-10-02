/**
 * Preview mix of a short window (PLAN.md#8.2): an edited cue becomes audible in a few seconds
 * without re-rendering the whole mix. The cues are cut to [startS, startS + durationS) and moved
 * to 0 s (synth seeds pinned to their full-timeline values, so a sound does not change because it
 * moved into a window), the voice-over is read from `startS`, and the premix gets the full mix's
 * master gain + the same limiter instead of a loudness pass, so the window sounds like that place
 * in the final mix. Output: 48 kHz 16-bit stereo WAV (the format of `mix.wav`).
 */
import { mkdir, mkdtemp, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { measureLoudness, type FfmpegRunner } from '../audio/passes.js';
import { gainSteps, joinFilters, renderArgs } from '../audio/presets.js';
import { describeError, type FfmpegError } from '../ffmpeg/errors.js';
import { err, ok, type Result } from '../result.js';
import type { AmbienceCue, CuesFile, MusicCue, SfxCue } from './cues.js';
import { hashSeed, secondsToFrames } from './dsp.js';
import { MIX_REQUIRED_FILTERS } from './graph.js';
import { MixRun } from './mix.js';
import { planMix } from './plan.js';

/** Longest preview window (s). */
export const MAX_PREVIEW_WINDOW_S = 20;
/** Same margin as the master: sample-peak ceiling 1 dB under the true-peak limit. */
const CEILING_MARGIN_DB = 1;
const SILENT_LUFS = -70;

const round3 = (value: number): number => Math.round(value * 1000) / 1000;

interface Window {
  readonly start: number;
  readonly end: number;
}

function windowSfx(cue: SfxCue, window: Window): SfxCue | null {
  if (cue.t < window.start || cue.t >= window.end) return null;
  const seed =
    cue.name === undefined ? cue.seed : (cue.seed ?? hashSeed(`${cue.name}@${cue.t.toFixed(3)}`));
  const moved: SfxCue = { ...cue, t: round3(cue.t - window.start) };
  return seed === undefined ? moved : { ...moved, seed };
}

/** The part of a range inside the window (fades only where the range really starts / ends). */
function clipRange<Cue extends { from: number; to: number; fadeInS: number; fadeOutS: number }>(
  cue: Cue,
  window: Window,
): Cue | null {
  const from = Math.max(cue.from, window.start);
  const to = Math.min(cue.to, window.end);
  if (!(to - from > 0.001)) return null;
  return {
    ...cue,
    from: round3(from - window.start),
    to: round3(to - window.start),
    fadeInS: cue.from < window.start ? 0 : cue.fadeInS,
    fadeOutS: cue.to > window.end ? 0 : cue.fadeOutS,
  };
}

function windowAmbience(cue: AmbienceCue, window: Window): AmbienceCue | null {
  const clipped = clipRange(cue, window);
  if (clipped === null || cue.name === undefined) return clipped;
  return { ...clipped, seed: cue.seed ?? hashSeed(`${cue.name}@${cue.from.toFixed(3)}`) };
}

function windowMusic(cue: MusicCue, window: Window): MusicCue | null {
  const clipped = clipRange(cue, window);
  if (clipped === null) return null;
  return { ...clipped, offsetS: round3(cue.offsetS + Math.max(0, window.start - cue.from)) };
}

function present<T>(value: T | null): value is T {
  return value !== null;
}

/** `cues` cut to the window and moved to start at 0 s; the timeline is the window. */
export function windowCues(cues: CuesFile, startS: number, durationS: number): CuesFile {
  const window: Window = { start: startS, end: startS + durationS };
  return {
    ...cues,
    global: { ...cues.global, durationS },
    sfx: cues.sfx.map((cue) => windowSfx(cue, window)).filter(present),
    ambience: cues.ambience.map((cue) => windowAmbience(cue, window)).filter(present),
    music: cues.music.map((cue) => windowMusic(cue, window)).filter(present),
  };
}

export interface MixPreviewOptions {
  readonly ffmpeg: FfmpegRunner;
  /** The voice-over of the full mix (normally `audio/vo.clean.wav`). */
  readonly voPath: string;
  readonly outputPath: string;
  /** Folder relative cue files are resolved against (the project folder). */
  readonly baseDir: string;
  /** Parent folder of the temporary files (always cleaned up). */
  readonly workDir: string;
  readonly startS: number;
  /** Clamped to MAX_PREVIEW_WINDOW_S. */
  readonly durationS: number;
  /** Master gain of the full mix (its report's `gainDb`); null = measured on the window. */
  readonly gainDb: number | null;
  readonly signal?: AbortSignal | undefined;
}

export interface MixPreviewResult {
  readonly startS: number;
  readonly durationS: number;
  readonly gainDb: number;
}

async function windowGain(
  ffmpeg: FfmpegRunner,
  premix: string,
  cues: CuesFile,
  options: MixPreviewOptions,
): Promise<Result<number, FfmpegError>> {
  if (options.gainDb !== null) return ok(options.gainDb);
  const pass = { ffmpeg, signal: options.signal, onProgress: undefined };
  const measured = await measureLoudness(pass, premix, [], cues.global.targetLufs, 'analyze', null);
  if (!measured.ok) return measured;
  const lufs = measured.value.loudness.integratedLufs;
  return ok(lufs > SILENT_LUFS ? cues.global.targetLufs - lufs : 0);
}

async function renderWindow(
  cues: CuesFile,
  options: MixPreviewOptions,
  workDir: string,
): Promise<Result<MixPreviewResult, FfmpegError>> {
  const durationS = Math.min(Math.max(options.durationS, 0), MAX_PREVIEW_WINDOW_S);
  const totalFrames = secondsToFrames(durationS);
  if (totalFrames <= 0) return err({ kind: 'invalid-input', message: 'empty preview window' });
  const windowed = windowCues(cues, options.startS, durationS);
  const run = new MixRun(
    windowed,
    {
      ffmpeg: options.ffmpeg,
      voPath: options.voPath,
      outputPath: options.outputPath,
      baseDir: options.baseDir,
      voStartS: options.startS,
      signal: options.signal,
    },
    workDir,
  );
  const clips = await run.decodeFiles();
  if (!clips.ok) return clips;
  const plan = planMix(windowed, totalFrames, options.baseDir, clips.value);
  if (!plan.ok) return plan;
  const buses = await run.renderBuses(plan.value);
  if (!buses.ok) return buses;
  const premixed = await run.premix(buses.value, totalFrames);
  if (!premixed.ok) return premixed;
  const gain = await windowGain(options.ffmpeg, run.files.premix, cues, options);
  if (!gain.ok) return gain;
  const ceilingDb = cues.global.truePeakMaxDbtp - CEILING_MARGIN_DB;
  const partial = `${options.outputPath}.partial`;
  const rendered = await options.ffmpeg.run(
    renderArgs(run.files.premix, joinFilters(gainSteps(gain.value, ceilingDb)), partial),
    { signal: options.signal },
  );
  if (!rendered.ok) return rendered;
  try {
    await rename(partial, options.outputPath);
  } catch (error) {
    return err({
      kind: 'io',
      message: `cannot write the preview: ${describeError(error)}`,
      path: options.outputPath,
    });
  }
  return ok({ startS: options.startS, durationS, gainDb: gain.value });
}

/** Renders the preview window; see the module comment. Never throws for expected failures. */
export async function mixPreview(
  cues: CuesFile,
  options: MixPreviewOptions,
): Promise<Result<MixPreviewResult, FfmpegError>> {
  const missing = MIX_REQUIRED_FILTERS.filter((name) => !options.ffmpeg.hasFilter(name));
  if (missing.length > 0) {
    return err({
      kind: 'missing-capability',
      message: `this ffmpeg build lacks filters: ${missing.join(', ')}`,
      missing,
    });
  }
  let workDir: string;
  try {
    await mkdir(options.workDir, { recursive: true });
    await mkdir(path.dirname(path.resolve(options.outputPath)), { recursive: true });
    workDir = await mkdtemp(path.join(options.workDir, '.reelforge-preview-'));
  } catch (error) {
    return err({
      kind: 'io',
      message: `cannot create work folder: ${describeError(error)}`,
      path: options.workDir,
    });
  }
  try {
    return await renderWindow(cues, options, workDir);
  } finally {
    await rm(workDir, { recursive: true, force: true });
    await rm(`${options.outputPath}.partial`, { force: true });
  }
}
