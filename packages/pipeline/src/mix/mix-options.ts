/**
 * Options of a sound-design mix (mix.ts): progress stages, inputs and outputs, silence windows of
 * the bed, and the run's temporary files.
 */
import path from 'node:path';
import type { FfmpegRunner } from '../audio/passes.js';
import type { BusSilence } from './bus.js';
import { secondsToFrames } from './dsp.js';

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
  /** Position in the voice-over that plays at 0 s (preview windows, see preview.ts). */
  readonly voStartS?: number | undefined;
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
  /**
   * Silences of the bed (SFX, ambience, music; never the VO) before the hits of accepted reveal
   * moments (PLAN.md#12.27), film seconds. Absent/empty = the mix is byte-identical to before.
   */
  readonly silences?: readonly MixSilenceWindow[] | undefined;
}

/** A silence of the bed, film seconds (`from` < `to`). */
export interface MixSilenceWindow {
  readonly from: number;
  readonly to: number;
}

export interface WorkFiles {
  readonly sfx: string;
  readonly ambience: string;
  readonly music: (index: number) => string;
  readonly premix: string;
  readonly voStem: string;
  readonly musicStem: string;
}

export function workFiles(dir: string): WorkFiles {
  return {
    sfx: path.join(dir, 'sfx.bus.wav'),
    ambience: path.join(dir, 'ambience.bus.wav'),
    music: (index) => path.join(dir, `music-${String(index)}.bus.wav`),
    premix: path.join(dir, 'premix.wav'),
    voStem: path.join(dir, 'vo.stem.wav'),
    musicStem: path.join(dir, 'music.stem.wav'),
  };
}

/** Silence windows (s) -> bus frames; the window ends exactly on the hit's first frame. */
export function busSilences(windows: readonly MixSilenceWindow[]): BusSilence[] {
  return windows
    .map((window) => ({
      startFrame: secondsToFrames(window.from),
      endFrame: secondsToFrames(window.to),
    }))
    .filter((silence) => silence.endFrame > silence.startFrame);
}
