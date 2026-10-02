/**
 * Minimal deterministic WAV writer: 16-bit PCM or 32-bit IEEE float, interleaved, no metadata
 * chunks (so identical samples always give identical bytes).
 */
import { rename, rm, writeFile } from 'node:fs/promises';
import { describeError, type FfmpegError } from '../ffmpeg/errors.js';
import { err, ok, type Result } from '../result.js';

export type WavSampleFormat = 'pcm16' | 'float32';

const FORMAT_PCM = 1;
const FORMAT_FLOAT = 3;

function bytesPerSample(format: WavSampleFormat): number {
  return format === 'pcm16' ? 2 : 4;
}

/**
 * RIFF/WAVE header for `frames` frames. Float files get the 18-byte `fmt ` chunk and the `fact`
 * chunk the spec requires for non-PCM data.
 */
export function wavHeader(
  frames: number,
  channels: number,
  sampleRate: number,
  format: WavSampleFormat,
): Buffer {
  const sampleBytes = bytesPerSample(format);
  const isFloat = format === 'float32';
  const fmtSize = isFloat ? 18 : 16;
  const factSize = isFloat ? 12 : 0;
  const dataBytes = frames * channels * sampleBytes;
  const headerBytes = 12 + 8 + fmtSize + factSize + 8;
  const header = Buffer.alloc(headerBytes);
  let at = 0;
  const text = (value: string): void => {
    header.write(value, at, 'ascii');
    at += 4;
  };
  const u32 = (value: number): void => {
    header.writeUInt32LE(value, at);
    at += 4;
  };
  const u16 = (value: number): void => {
    header.writeUInt16LE(value, at);
    at += 2;
  };
  text('RIFF');
  u32(headerBytes - 8 + dataBytes);
  text('WAVE');
  text('fmt ');
  u32(fmtSize);
  u16(isFloat ? FORMAT_FLOAT : FORMAT_PCM);
  u16(channels);
  u32(sampleRate);
  u32(sampleRate * channels * sampleBytes);
  u16(channels * sampleBytes);
  u16(sampleBytes * 8);
  if (isFloat) {
    u16(0);
    text('fact');
    u32(4);
    u32(frames);
  }
  text('data');
  u32(dataBytes);
  return header;
}

/** Interleaves `channels[*][from, from + frames)` into sample bytes of `format`. */
export function encodeSamples(
  channels: readonly Float32Array[],
  from: number,
  frames: number,
  format: WavSampleFormat,
): Buffer {
  const count = channels.length;
  const sampleBytes = bytesPerSample(format);
  const out = Buffer.alloc(frames * count * sampleBytes);
  let at = 0;
  for (let frame = from; frame < from + frames; frame++) {
    for (const channel of channels) {
      const value = channel[frame] ?? 0;
      if (format === 'float32') {
        out.writeFloatLE(value, at);
      } else {
        const clamped = Math.max(-1, Math.min(1, value));
        out.writeInt16LE(Math.round(clamped * 32767), at);
      }
      at += sampleBytes;
    }
  }
  return out;
}

/** Complete WAV file bytes for planar `channels` (all the same length). */
export function encodeWav(
  channels: readonly Float32Array[],
  sampleRate: number,
  format: WavSampleFormat,
): Buffer {
  const frames = channels[0]?.length ?? 0;
  return Buffer.concat([
    wavHeader(frames, channels.length, sampleRate, format),
    encodeSamples(channels, 0, frames, format),
  ]);
}

/** Writes WAV bytes atomically (temp file + rename). */
export async function writeWavAtomic(
  filePath: string,
  channels: readonly Float32Array[],
  sampleRate: number,
  format: WavSampleFormat,
): Promise<Result<void, FfmpegError>> {
  const partial = `${filePath}.partial`;
  try {
    await writeFile(partial, encodeWav(channels, sampleRate, format));
    await rename(partial, filePath);
    return ok(undefined);
  } catch (error) {
    await rm(partial, { force: true });
    return err({
      kind: 'io',
      message: `cannot write ${filePath}: ${describeError(error)}`,
      path: filePath,
    });
  }
}
