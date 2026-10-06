import { describe, expect, it } from 'vitest';
import { abortableDelay, isEncoderOpenFailure, openFailureDetail } from './encoder-fallback.js';
import type { EncoderChoice } from './encoders.js';
import type { ExportError } from './errors.js';
import { createFfmpegMedia, type ExportFfmpeg } from './ffmpeg-media.js';
import { encoderOpenError } from './testing/fakes.js';
import { err } from '../result.js';

const exitError = (stderrTail: string): ExportError => ({
  kind: 'encoder',
  message: 'encoding x.mp4: ffmpeg.exe exited with 1',
  ffmpeg: {
    kind: 'exit-code',
    message: 'ffmpeg.exe exited with 1',
    code: 1,
    signal: null,
    stderrTail,
  },
});

describe('isEncoderOpenFailure', () => {
  it('recognizes the NVENC session failures of a busy GPU', () => {
    expect(isEncoderOpenFailure(encoderOpenError('x.mp4'))).toBe(true);
    expect(isEncoderOpenFailure(exitError('[h264_nvenc @ 0] No capable devices found'))).toBe(true);
    expect(isEncoderOpenFailure(exitError('Error while opening encoder for output stream'))).toBe(
      true,
    );
  });

  it('ignores other encoder errors, other kinds and cancellations', () => {
    expect(isEncoderOpenFailure(exitError('Conversion failed!'))).toBe(false);
    expect(
      isEncoderOpenFailure({
        kind: 'frame-source',
        message: 'renderer out of memory',
        shotId: 's',
      }),
    ).toBe(false);
    expect(isEncoderOpenFailure({ kind: 'cancelled', message: 'export cancelled' })).toBe(false);
  });

  it('names the failing ffmpeg line', () => {
    expect(openFailureDetail(encoderOpenError('x.mp4'))).toMatch(
      /^\[h264_nvenc @ 000001\] OpenEncodeSessionEx failed: out of memory \(10\)/,
    );
    expect(openFailureDetail(exitError('Conversion failed!'))).toBe(
      'encoding x.mp4: ffmpeg.exe exited with 1',
    );
  });
});

describe('abortableDelay', () => {
  it('waits, skips zero delays and stops on abort', async () => {
    const live = new AbortController();
    await expect(abortableDelay(5, live.signal)).resolves.toBe(true);
    await expect(abortableDelay(0, live.signal)).resolves.toBe(true);
    const pending = abortableDelay(60_000, live.signal);
    live.abort();
    await expect(pending).resolves.toBe(false);
    await expect(abortableDelay(0, live.signal)).resolves.toBe(false);
  });
});

describe('createFfmpegMedia fallback', () => {
  const ffmpeg: ExportFfmpeg = {
    binary: { ffmpegPath: 'ffmpeg', ffprobePath: null, source: 'path' },
    run: () => Promise.resolve(err({ kind: 'invalid-input', message: 'not run in this test' })),
  };
  const choice = (encoder: EncoderChoice['encoder']): EncoderChoice => ({
    encoder,
    quality: 'final',
    hardware: encoder !== 'libx264',
    probes: [],
  });

  it('gives hardware encoders a libx264 fallback of the same quality, libx264 none', () => {
    const nvenc = createFfmpegMedia(ffmpeg, choice('h264_nvenc'));
    const cpu = nvenc.fallback?.();
    expect(cpu?.encoderLabel).toBe('libx264 (final)');
    expect(cpu?.outputKey).toBe(createFfmpegMedia(ffmpeg, choice('libx264')).outputKey);
    expect(cpu?.outputKey).not.toBe(nvenc.outputKey);
    expect(cpu?.fallback).toBeUndefined();
    expect(createFfmpegMedia(ffmpeg, choice('libx264')).fallback).toBeUndefined();
  });
});
