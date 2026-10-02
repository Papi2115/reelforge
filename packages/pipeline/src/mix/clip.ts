/**
 * In-memory 48 kHz stereo clips (planar float32), seamless loop construction, and decoding of user
 * audio files through ffmpeg (any format/rate -> 48 kHz float, mono kept mono and duplicated here
 * so a mono sample is not attenuated by ffmpeg's -3 dB mono->stereo rematrix).
 */
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { describeError, type FfmpegError } from '../ffmpeg/errors.js';
import type { FfmpegRunner } from '../audio/passes.js';
import { err, ok, type Result } from '../result.js';
import { MIX_SAMPLE_RATE } from './dsp.js';

export interface StereoClip {
  readonly left: Float32Array;
  readonly right: Float32Array;
}

export function clipFrames(clip: StereoClip): number {
  return clip.left.length;
}

/** Wraps a mono signal as a stereo clip (both channels share the same samples). */
export function monoClip(samples: Float32Array): StereoClip {
  return { left: samples, right: samples };
}

export type LoopCurve = 'equal-power' | 'linear';

function crossfadeChannel(
  source: Float32Array,
  loopFrames: number,
  crossfade: number,
  curve: LoopCurve,
): Float32Array {
  const out = source.slice(0, loopFrames);
  for (let index = 0; index < crossfade; index++) {
    const position = (index + 0.5) / crossfade;
    const fadeIn = curve === 'linear' ? position : Math.sin((Math.PI / 2) * position);
    const fadeOut = curve === 'linear' ? 1 - position : Math.cos((Math.PI / 2) * position);
    out[index] = (source[index] ?? 0) * fadeIn + (source[loopFrames + index] ?? 0) * fadeOut;
  }
  return out;
}

/**
 * Turns a clip into a seamless loop of `frames - crossfade` frames: the tail after the loop point
 * is crossfaded into the head, so wrapping from the last frame to frame 0 continues the signal.
 * Equal-power suits uncorrelated material (noise beds); linear suits periodic material.
 */
export function makeSeamlessLoop(
  clip: StereoClip,
  crossfadeFrames: number,
  curve: LoopCurve = 'equal-power',
): StereoClip {
  const frames = clipFrames(clip);
  const crossfade = Math.max(0, Math.min(Math.floor(crossfadeFrames), Math.floor(frames / 2)));
  if (crossfade === 0) return clip;
  const loopFrames = frames - crossfade;
  const left = crossfadeChannel(clip.left, loopFrames, crossfade, curve);
  const right =
    clip.right === clip.left ? left : crossfadeChannel(clip.right, loopFrames, crossfade, curve);
  return { left, right };
}

const DECODED_STREAM = /Stream #\d+:\d+: Audio: pcm_f32le, (\d+) Hz, (mono|stereo)/g;

/** Channel count of the decoded (output) stream from ffmpeg's stderr, or null. */
export function decodedChannels(stderr: string): 1 | 2 | null {
  const matches = [...stderr.matchAll(DECODED_STREAM)];
  const last = matches.at(-1);
  if (last === undefined || Number(last[1]) !== MIX_SAMPLE_RATE) return null;
  return last[2] === 'mono' ? 1 : 2;
}

export function decodeArgs(inputPath: string, rawPath: string): string[] {
  return [
    '-i',
    inputPath,
    '-map',
    '0:a:0',
    '-af',
    `aresample=${String(MIX_SAMPLE_RATE)},aformat=sample_fmts=flt:channel_layouts=mono|stereo`,
    '-c:a',
    'pcm_f32le',
    '-f',
    'f32le',
    '-y',
    rawPath,
  ];
}

/** Splits interleaved little-endian float32 bytes into planar channels. */
export function clipFromRawF32(bytes: Buffer, channels: 1 | 2): StereoClip {
  const frames = Math.floor(bytes.length / (4 * channels));
  const left = new Float32Array(frames);
  const right = channels === 1 ? left : new Float32Array(frames);
  for (let frame = 0; frame < frames; frame++) {
    const offset = frame * 4 * channels;
    left[frame] = bytes.readFloatLE(offset);
    if (channels === 2) right[frame] = bytes.readFloatLE(offset + 4);
  }
  return { left, right };
}

/** Decodes the first audio stream of `inputPath` into a 48 kHz stereo clip via a temp raw file. */
export async function decodeAudioFile(
  ffmpeg: FfmpegRunner,
  inputPath: string,
  workDir: string,
  index: number,
  signal: AbortSignal | undefined,
): Promise<Result<StereoClip, FfmpegError>> {
  const rawPath = path.join(workDir, `decoded-${String(index)}.f32`);
  const run = await ffmpeg.run(decodeArgs(inputPath, rawPath), { signal });
  if (!run.ok) {
    if (run.error.kind !== 'exit-code') return run;
    return err({
      kind: 'invalid-input',
      message: `cannot decode audio ${path.basename(inputPath)}: ${run.error.message}`,
    });
  }
  const channels = decodedChannels(run.value.stderr);
  if (channels === null) {
    return err({
      kind: 'parse-failed',
      message: `cannot tell decoded format of ${path.basename(inputPath)}`,
    });
  }
  try {
    const bytes = await readFile(rawPath);
    await rm(rawPath, { force: true });
    const clip = clipFromRawF32(bytes, channels);
    if (clipFrames(clip) === 0) {
      return err({ kind: 'invalid-input', message: `${path.basename(inputPath)} has no audio` });
    }
    return ok(clip);
  } catch (error) {
    return err({
      kind: 'io',
      message: `cannot read decoded audio: ${describeError(error)}`,
      path: rawPath,
    });
  }
}
