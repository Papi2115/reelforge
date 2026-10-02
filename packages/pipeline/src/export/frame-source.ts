/**
 * Where export frames come from. The exporter never talks to a browser itself: each render worker
 * owns one `FrameSource` created by an injected factory. Implementations:
 * - `PlaywrightFrameSource` (`testing/playwright-frame-source.ts`): headless Chromium driving the
 *   engine harness, for tests and dev tooling;
 * - the app's hidden Electron window (phase 6), same interface.
 * Every implementation must render through `packages/engine` (preview = export, CLAUDE.md §3.3).
 */
import type { RenderManifest } from '@reelforge/shared';
import type { ExportError } from './errors.js';
import type { Result } from '../result.js';

/** The shots a worker is about to render, with the global time span they cover. */
export interface ShotRange {
  /** Shot ids in manifest order (a contiguous run of the manifest's shots). */
  readonly shotIds: readonly string[];
  /** Global time span [t0, t1) in seconds. */
  readonly t0: number;
  readonly t1: number;
}

export interface FrameSourceInfo {
  /** Render size of the frames returned by `renderFrame` (RGBA8, top-down). */
  readonly width: number;
  readonly height: number;
  /** WebGL renderer string (UNMASKED_RENDERER_WEBGL) when known, e.g. "ANGLE (NVIDIA ...)". */
  readonly gpu: string | null;
}

export interface FrameSource {
  /**
   * Prepares rendering of `range` of `manifest`. May be called several times on one source (one
   * call per shot); implementations may keep the loaded video when the manifest is unchanged.
   * Shots with a transition read frames of the previous shot, so sources load the whole manifest.
   */
  open(manifest: RenderManifest, range: ShotRange): Promise<Result<FrameSourceInfo, ExportError>>;
  /**
   * Renders global time `t` (seconds) and returns `width*height*4` RGBA8 bytes, top-down. The
   * buffer may be reused by the next call, so consumers must finish with it first.
   */
  renderFrame(t: number): Promise<Result<Uint8Array, ExportError>>;
  /** Releases the source; safe to call more than once. */
  close(): Promise<void>;
}

/** Creates the source owned by render worker `workerIndex` (0-based). */
export type FrameSourceFactory = (workerIndex: number) => FrameSource;

/** True when the GPU string says Chromium fell back to software WebGL (5–15× slower). */
export function isSoftwareRenderer(gpu: string | null): boolean {
  return gpu !== null && /swiftshader|llvmpipe|software/i.test(gpu);
}
