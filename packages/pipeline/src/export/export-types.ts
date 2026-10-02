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

export interface ExportVideoOptions {
  readonly projectDir: string;
  /** Video title; the output is `out/<safe title>.mp4`. */
  readonly title: string;
  readonly manifest: RenderManifest;
  readonly identity: RenderIdentity;
  readonly media: ExportMedia;
  readonly createFrameSource: FrameSourceFactory;
  readonly preset?: ExportPresetId;
  /** Audio to mux. Default: `<project>/audio/mix.wav` when it exists. `null`: silent video. */
  readonly audio?: string | null;
  /** Thumbnail time in seconds (default: middle of the first shot); `null` skips the thumbnail. */
  readonly thumbnailAt?: number | null;
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
  /** Monotonic clock in ms (default performance.now), for ETA. */
  readonly now?: () => number;
}

export interface ExportResult {
  readonly output: string;
  readonly thumbnail: string | null;
  readonly chaptersFile: string | null;
  readonly renderedShots: readonly string[];
  readonly cachedShots: readonly string[];
  readonly totalFrames: number;
  readonly durationS: number;
  readonly width: number;
  readonly height: number;
  readonly encoder: string;
  readonly audio: string | null;
  /** An interrupted export of the same job was found and continued. */
  readonly resumed: boolean;
  readonly gpu: string | null;
  readonly wallMs: number;
}
