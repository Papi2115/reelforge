/**
 * The media side of an export (encode segments, concat + mux, thumbnail), behind an interface so
 * the orchestration (cache, resume, workers) is testable without ffmpeg. `createFfmpegMedia` is
 * the real implementation.
 */
import type { ExportError } from './errors.js';
import type { OutputScale } from './presets.js';
import type { Result } from '../result.js';

export interface SegmentSpec {
  /** File to write (the exporter renames it into the cache after a successful finish). */
  readonly file: string;
  readonly scale: OutputScale;
  readonly fps: number;
  readonly frames: number;
}

export interface SegmentWriter {
  /** Accepts one RGBA8 frame of `scale.renderWidth x scale.renderHeight`. */
  write(frame: Uint8Array): Promise<Result<void, ExportError>>;
  finish(): Promise<Result<void, ExportError>>;
  /** Stops writing and kills any encoder process; the partial file is left for the caller. */
  abort(): Promise<void>;
}

export interface MuxSpec {
  /** Segment files in playback order. */
  readonly segments: readonly string[];
  /** Scratch directory for list files. */
  readonly workDir: string;
  /** `mix.wav` (or any audio file) to mux, or null for a silent video. */
  readonly audio: string | null;
  /** Exact video duration (frames / fps); audio is padded or cut to it. */
  readonly durationS: number;
  readonly output: string;
}

export interface ThumbnailSpec {
  readonly file: string;
  readonly width: number;
  readonly height: number;
  /** Integer neighbour upscale factor. */
  readonly factor: number;
  /**
   * Exact output size, area-downscaled (the Grim Ink opening frame as a 1280x720 YouTube
   * thumbnail, PLAN.md#14.18); overrides `factor`.
   */
  readonly size?: { readonly width: number; readonly height: number } | undefined;
}

export interface ExportMedia {
  /** Fingerprint of everything that changes encoded bytes (encoder, quality, container). */
  readonly outputKey: string;
  /** Human-readable encoder name for progress / reports, e.g. "h264_nvenc (final)". */
  readonly encoderLabel: string;
  /** Extension of segment files, with the dot. */
  readonly segmentExtension: string;
  /**
   * Hardware encoders only: the CPU media an export switches to when this encoder cannot open a
   * session (encoder-fallback.ts). Media with a fallback also get one open retry per segment and
   * staggered first opens per worker.
   */
  readonly fallback?: () => ExportMedia;
  openSegment(spec: SegmentSpec, signal?: AbortSignal): SegmentWriter;
  concatAndMux(spec: MuxSpec, signal?: AbortSignal): Promise<Result<void, ExportError>>;
  writeThumbnail(
    spec: ThumbnailSpec,
    rgba: Uint8Array,
    signal?: AbortSignal,
  ): Promise<Result<void, ExportError>>;
}
