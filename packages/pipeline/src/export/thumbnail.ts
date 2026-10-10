/** `out/thumb.png`: one engine frame at a chosen time, neighbour-upscaled to >= 1280 px wide. */
import { rename, rm } from 'node:fs/promises';
import type { RenderManifest } from '@reelforge/shared';
import { describeUnknown, type ExportError } from './errors.js';
import type { FrameSourceFactory } from './frame-source.js';
import type { ExportMedia } from './media.js';
import { frameTime, shotAtTime, type ShotPlan } from './shot-plan.js';
import { err, ok, type Result } from '../result.js';

/** YouTube's recommended thumbnail width; 640x360 -> 1280x720 (x2), 480x270 -> 1440x810 (x3). */
export const THUMBNAIL_MIN_WIDTH = 1280;

export function thumbnailFactor(renderWidth: number): number {
  return Math.max(1, Math.ceil(THUMBNAIL_MIN_WIDTH / renderWidth));
}

/** The opening frame's still (Grim Ink, PLAN.md#14.18): a YouTube thumbnail, 1280x720. */
export const OPENING_THUMBNAIL_SIZE = { width: 1280, height: 720 } as const;
export const OPENING_THUMBNAIL_FILE = 'opening-frame.png';

/**
 * When the opening title card has landed: the last frame of the first shot (a title card thuds
 * in within its first ~2 s and then holds).
 */
export function openingSettledTime(plan: ShotPlan): number {
  const first = plan.shots[0];
  if (first === undefined) return 0;
  return frameTime(Math.max(first.startFrame, first.endFrame - 1), plan.fps);
}

/** Default thumbnail time: the middle of the first shot (usually the title card). */
export function defaultThumbnailTime(plan: ShotPlan): number {
  const first = plan.shots[0];
  if (first === undefined) return 0;
  const middle = Math.floor((first.startFrame + first.endFrame - 1) / 2);
  return frameTime(middle, plan.fps);
}

export interface ThumbnailOptions {
  readonly manifest: RenderManifest;
  readonly plan: ShotPlan;
  readonly t: number;
  readonly width: number;
  readonly height: number;
  readonly file: string;
  readonly media: ExportMedia;
  readonly createFrameSource: FrameSourceFactory;
  readonly signal: AbortSignal;
  /** Exact, area-downscaled output size (the opening frame); default the neighbour upscale. */
  readonly size?: { readonly width: number; readonly height: number } | undefined;
}

export async function renderThumbnail(
  options: ThumbnailOptions,
): Promise<Result<void, ExportError>> {
  const { plan, manifest } = options;
  const planned = shotAtTime(plan, options.t);
  if (planned === undefined) {
    return err({ kind: 'invalid-input', message: 'thumbnail: the video has no frames' });
  }
  // Snap to a frame inside the video, like playback would show it.
  const frame = Math.min(Math.max(Math.floor(options.t * plan.fps), 0), plan.totalFrames - 1);
  const t = frameTime(frame, plan.fps);
  const source = options.createFrameSource(0);
  const partial = `${options.file}.partial.png`;
  try {
    const shotIds =
      planned.incoming === null ? [planned.shot.id] : [planned.incoming.id, planned.shot.id];
    const opened = await source.open(manifest, {
      shotIds,
      t0: planned.shot.t0,
      t1: planned.shot.t1,
    });
    if (!opened.ok) return opened;
    const rendered = await source.renderFrame(t);
    if (!rendered.ok) return rendered;
    const written = await options.media.writeThumbnail(
      {
        file: partial,
        width: options.width,
        height: options.height,
        factor: thumbnailFactor(options.width),
        ...(options.size === undefined ? {} : { size: options.size }),
      },
      rendered.value,
      options.signal,
    );
    if (!written.ok) return written;
    await rename(partial, options.file);
    return ok(undefined);
  } catch (error) {
    return err({
      kind: 'io',
      message: `cannot write the thumbnail: ${describeUnknown(error)}`,
      path: options.file,
    });
  } finally {
    await rm(partial, { force: true });
    await source.close();
  }
}
