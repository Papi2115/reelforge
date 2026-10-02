/**
 * ExportMedia on ffmpeg:
 * - segments: raw RGBA on stdin -> integer `neighbor` upscale -> final H.264 (one .mp4 per shot);
 * - concat demuxer with stream copy (no re-encode) + AAC 192k audio + `+faststart`;
 * - thumbnail: one frame -> upscaled RGB PNG.
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { upscaleFilter, videoCodecArgs, type EncoderChoice } from './encoders.js';
import { describeUnknown, fromFfmpegError, type ExportError } from './errors.js';
import type { ExportMedia, MuxSpec, SegmentSpec, SegmentWriter, ThumbnailSpec } from './media.js';
import { spawnStdinProcess } from './stdin-process.js';
import type { FfmpegManager } from '../ffmpeg/manager.js';
import { err, ok, type Result } from '../result.js';

export const AUDIO_BITRATE = '192k';
const SEGMENT_EXTENSION = '.mp4';

export type ExportFfmpeg = Pick<FfmpegManager, 'run' | 'binary'>;

function rawInputArgs(width: number, height: number, fps: number): string[] {
  return [
    '-f',
    'rawvideo',
    '-pix_fmt',
    'rgba',
    '-s',
    `${String(width)}x${String(height)}`,
    '-r',
    String(fps),
    '-i',
    'pipe:0',
  ];
}

export function segmentArgs(spec: SegmentSpec, choice: EncoderChoice): string[] {
  const { scale } = spec;
  return [
    '-hide_banner',
    '-nostdin',
    '-loglevel',
    'error',
    '-y',
    ...rawInputArgs(scale.renderWidth, scale.renderHeight, spec.fps),
    '-vf',
    upscaleFilter(scale.outputWidth, scale.outputHeight),
    ...videoCodecArgs(choice.encoder, choice.quality),
    '-an',
    '-f',
    'mp4',
    spec.file,
  ];
}

/** Concat-demuxer list: names relative to the list file, single quotes escaped. */
export function concatList(segments: readonly string[], listDir: string): string {
  return segments
    .map((segment) => {
      const relative = path.relative(listDir, segment).split(path.sep).join('/');
      return `file '${relative.replace(/'/g, "'\\''")}'\n`;
    })
    .join('');
}

export function muxArgs(spec: MuxSpec, listFile: string): string[] {
  // All inputs come first: options before an `-i` would apply to that input instead.
  const audioInput = spec.audio === null ? [] : ['-i', spec.audio];
  const audioOutput =
    spec.audio === null
      ? []
      : ['-map', '1:a:0', '-c:a', 'aac', '-b:a', AUDIO_BITRATE, '-af', 'apad'];
  return [
    '-loglevel',
    'error',
    '-y',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    listFile,
    ...audioInput,
    '-map',
    '0:v:0',
    '-c:v',
    'copy',
    ...audioOutput,
    '-t',
    spec.durationS.toFixed(6),
    '-movflags',
    '+faststart',
    '-f',
    'mp4',
    spec.output,
  ];
}

export function thumbnailArgs(spec: ThumbnailSpec): string[] {
  const outWidth = spec.width * spec.factor;
  const outHeight = spec.height * spec.factor;
  return [
    '-hide_banner',
    '-nostdin',
    '-loglevel',
    'error',
    '-y',
    ...rawInputArgs(spec.width, spec.height, 1),
    '-vf',
    `scale=${String(outWidth)}:${String(outHeight)}:flags=neighbor`,
    '-frames:v',
    '1',
    '-pix_fmt',
    'rgb24',
    '-f',
    'image2',
    spec.file,
  ];
}

function openSegment(
  ffmpeg: ExportFfmpeg,
  choice: EncoderChoice,
  spec: SegmentSpec,
  signal: AbortSignal | undefined,
): SegmentWriter {
  const child = spawnStdinProcess(ffmpeg.binary.ffmpegPath, segmentArgs(spec, choice), signal);
  const context = `encoding ${path.basename(spec.file)}`;
  return {
    async write(frame) {
      const written = await child.write(frame);
      return written.ok ? ok(undefined) : err(fromFfmpegError(context, written.error));
    },
    async finish() {
      const finished = await child.finish();
      return finished.ok ? ok(undefined) : err(fromFfmpegError(context, finished.error));
    },
    abort: () => child.kill(),
  };
}

async function concatAndMux(
  ffmpeg: ExportFfmpeg,
  spec: MuxSpec,
  signal: AbortSignal | undefined,
): Promise<Result<void, ExportError>> {
  const listFile = path.join(spec.workDir, 'concat.txt');
  try {
    await writeFile(listFile, concatList(spec.segments, spec.workDir), 'utf8');
  } catch (error) {
    return err({
      kind: 'io',
      message: `cannot write ${listFile}: ${describeUnknown(error)}`,
      path: listFile,
    });
  }
  const run = await ffmpeg.run(muxArgs(spec, listFile), { signal });
  return run.ok ? ok(undefined) : err(fromFfmpegError('concat + mux', run.error));
}

async function writeThumbnail(
  ffmpeg: ExportFfmpeg,
  spec: ThumbnailSpec,
  rgba: Uint8Array,
  signal: AbortSignal | undefined,
): Promise<Result<void, ExportError>> {
  const child = spawnStdinProcess(ffmpeg.binary.ffmpegPath, thumbnailArgs(spec), signal);
  const written = await child.write(rgba);
  if (!written.ok) {
    await child.kill();
    return err(fromFfmpegError('thumbnail', written.error));
  }
  const finished = await child.finish();
  return finished.ok ? ok(undefined) : err(fromFfmpegError('thumbnail', finished.error));
}

export function createFfmpegMedia(ffmpeg: ExportFfmpeg, choice: EncoderChoice): ExportMedia {
  return {
    outputKey: JSON.stringify({
      container: SEGMENT_EXTENSION,
      codec: videoCodecArgs(choice.encoder, choice.quality),
    }),
    encoderLabel: `${choice.encoder} (${choice.quality})`,
    segmentExtension: SEGMENT_EXTENSION,
    openSegment: (spec, signal) => openSegment(ffmpeg, choice, spec, signal),
    concatAndMux: (spec, signal) => concatAndMux(ffmpeg, spec, signal),
    writeThumbnail: (spec, rgba, signal) => writeThumbnail(ffmpeg, spec, rgba, signal),
  };
}
