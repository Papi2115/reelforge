/**
 * Video format (PLAN.md#13.18): `landscape` (16:9, every project made before Shorts) or
 * `portrait` (9:16, YouTube Shorts). A style preset declares its landscape resolution; a portrait
 * project renders the same pixel budget turned upright (640x360 -> 360x640, x3 = 1080x1920).
 * Absent = landscape, so existing projects render exactly as before.
 */
import { z } from 'zod';

export const VIDEO_FORMATS = ['landscape', 'portrait'] as const;
export const videoFormatSchema = z.enum(VIDEO_FORMATS);
export type VideoFormat = z.infer<typeof videoFormatSchema>;

export const DEFAULT_VIDEO_FORMAT: VideoFormat = 'landscape';

export interface FrameSize {
  readonly width: number;
  readonly height: number;
}

/** The format of a project or manifest; absent = landscape. */
export function videoFormatOf(input: { readonly format?: VideoFormat | undefined }): VideoFormat {
  return input.format ?? DEFAULT_VIDEO_FORMAT;
}

/**
 * Render size of a style resolution in `format`: landscape keeps the style's size as declared;
 * portrait puts the long edge vertical (360x640 for a 640x360 style).
 */
export function orientFrameSize(resolution: FrameSize, format: VideoFormat): FrameSize {
  if (format === 'landscape') return { width: resolution.width, height: resolution.height };
  return {
    width: Math.min(resolution.width, resolution.height),
    height: Math.max(resolution.width, resolution.height),
  };
}

/** The format a frame of this size is in (taller than wide = portrait). */
export function frameSizeFormat(size: FrameSize): VideoFormat {
  return size.height > size.width ? 'portrait' : 'landscape';
}
