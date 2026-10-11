/** Public types of `exportVideo`: options, progress events, result. */
import type { RenderManifest } from '@reelforge/shared';
import type { AnchorResolver, RenderIdentity } from './cache-key.js';
import type { Chapter } from './chapters.js';
import type { FrameSourceFactory } from './frame-source.js';
import type { ExportMedia } from './media.js';
import type { ExportPresetId } from './presets.js';

export type ExportProgress =
  | {
      readonly type: 'plan';
      readonly shots: number;
      readonly cachedShots: number;
      readonly totalFrames: number;
      readonly framesToRender: number;
      readonly workers: number;
      readonly encoder: string;
      readonly resumed: boolean;
    }
  /** First frame source of each worker: log the GPU, warn when it is software (SwiftShader). */
  | {
      readonly type: 'source';
      readonly worker: number;
      readonly gpu: string | null;
      readonly software: boolean;
    }
  | {
      readonly type: 'shot-start';
      readonly shotId: string;
      readonly frames: number;
      readonly worker: number;
    }
  | {
      readonly type: 'frame';
      readonly shotId: string;
      readonly frameInShot: number;
      readonly shotFrames: number;
      readonly renderedFrames: number;
      readonly framesToRender: number;
      /** Rendered frames per second so far (all workers). */
      readonly fps: number;
      /** Seconds until all frames are rendered, null until measurable. */
      readonly etaS: number | null;
    }
  | { readonly type: 'shot-done'; readonly shotId: string; readonly cached: boolean }
  | { readonly type: 'mux' }
  | { readonly type: 'thumbnail' }
  | { readonly type: 'done'; readonly output: string };

/**
 * Something the user should know about an export that still goes on (encoder-fallback.ts):
 * `encoder-retry`: a hardware encoder failed to open for one segment, retried after a pause;
 * `encoder-fallback`: it failed again, the whole export restarts on the CPU encoder (`message`
 * is the line for the UI). `detail` is the ffmpeg line naming the failure.
 */
export type ExportWarning =
  | {
      readonly type: 'encoder-retry';
      readonly encoder: string;
      readonly shotId: string;
      readonly detail: string;
      readonly message: string;
    }
  | {
      readonly type: 'encoder-fallback';
      readonly from: string;
      readonly to: string;
      readonly detail: string;
      readonly message: string;
    };

export interface ExportVideoOptions {
  readonly projectDir: string;
  /** Video title; the output is `out/<safe title>.mp4` unless `output` is set. */
  readonly title: string;
  /** Absolute path of the MP4 (any folder); chapters.txt and thumb.png stay in `out/`. */
  readonly output?: string;
  readonly manifest: RenderManifest;
  readonly identity: RenderIdentity;
  readonly media: ExportMedia;
  readonly createFrameSource: FrameSourceFactory;
  readonly preset?: ExportPresetId;
  /** Audio to mux. Default: `<project>/audio/mix.wav` when it exists. `null`: silent video. */
  readonly audio?: string | null;
  /** Thumbnail time in seconds (default: middle of the first shot); `null` skips the thumbnail. */
  readonly thumbnailAt?: number | null;
  /**
   * Grim Ink (PLAN.md#14.18): also save the opening frame (the title card, the moment it has
   * landed) as a 1280x720 YouTube thumbnail, `out/opening-frame.png`. Default false.
   */
  readonly openingThumbnail?: boolean;
  /** Chapters for `out/chapters.txt` (YouTube format); omitted -> no file. */
  readonly chapters?: readonly Chapter[];
  /** Resolves `anchor()` phrases for cache keys; without it every word change re-renders all. */
  readonly resolveAnchor?: AnchorResolver;
  /** Render workers (default max(1, floor(cores / 2))), each owning one frame source. */
  readonly workers?: number;
  /** Delete cached segments the finished export does not use (default true). */
  readonly pruneCache?: boolean;
  readonly signal?: AbortSignal;
  readonly onProgress?: (event: ExportProgress) => void;
  /** Encoder retries / the switch to the CPU encoder, as they happen (also in the result). */
  readonly onWarning?: (warning: ExportWarning) => void;
  /** Pause before retrying a segment whose hardware encoder failed to open (default 1500 ms). */
  readonly encoderRetryDelayMs?: number;
  /** Hardware encoders: worker n opens its first segment n x this later (default 400 ms). */
  readonly encoderStaggerMs?: number;
  /** Monotonic clock in ms (default performance.now), for ETA. */
  readonly now?: () => number;
}

export interface ExportResult {
  readonly output: string;
  readonly thumbnail: string | null;
  /** `out/opening-frame.png` when `openingThumbnail` asked for it, else null. */
  readonly openingThumbnail: string | null;
  readonly chaptersFile: string | null;
  readonly renderedShots: readonly string[];
  readonly cachedShots: readonly string[];
  readonly totalFrames: number;
  readonly durationS: number;
  readonly width: number;
  readonly height: number;
  /** The encoder of the final video (the CPU fallback after an `encoder-fallback`). */
  readonly encoder: string;
  readonly warnings: readonly ExportWarning[];
  readonly audio: string | null;
  /** An interrupted export of the same job was found and continued. */
  readonly resumed: boolean;
  readonly gpu: string | null;
  readonly wallMs: number;
}
