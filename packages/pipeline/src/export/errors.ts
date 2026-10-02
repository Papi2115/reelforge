/** Every expected export failure, discriminated by `kind`. Export code returns these, never throws. */
import type { FfmpegError } from '../ffmpeg/errors.js';

export type ExportError =
  | { readonly kind: 'invalid-input'; readonly message: string }
  /** The target resolution is not an integer multiple of the render size. */
  | { readonly kind: 'preset-mismatch'; readonly message: string }
  /** The frame source (engine harness) failed to load the manifest or render a frame. */
  | { readonly kind: 'frame-source'; readonly message: string; readonly shotId?: string }
  | { readonly kind: 'encoder'; readonly message: string; readonly ffmpeg?: FfmpegError }
  | { readonly kind: 'no-encoder'; readonly message: string }
  | { readonly kind: 'io'; readonly message: string; readonly path: string }
  | { readonly kind: 'cancelled'; readonly message: string };

export type ExportErrorKind = ExportError['kind'];

export function describeUnknown(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Wraps an ffmpeg failure; cancellations stay cancellations. */
export function fromFfmpegError(context: string, error: FfmpegError): ExportError {
  if (error.kind === 'cancelled') return { kind: 'cancelled', message: `${context}: cancelled` };
  return { kind: 'encoder', message: `${context}: ${error.message}`, ffmpeg: error };
}
