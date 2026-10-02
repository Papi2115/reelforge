/** Contract between the in-page harness (page.ts) and the Node drivers (scripts/). */
import type { GpuInfo } from './spike-renderer.ts';

export interface InitOptions {
  readonly width: number;
  readonly height: number;
  readonly seed: number;
  readonly powerPreference: WebGLPowerPreference;
}

export interface InitResult {
  readonly gpu: GpuInfo;
  /** Renderer + scene construction (ms). */
  readonly setupMs: number;
  /** First seek + readPixels incl. shader compilation (ms). */
  readonly firstFrameMs: number;
}

export interface BenchOptions {
  readonly frames: number;
  readonly warmupFrames: number;
  readonly fps: number;
}

export interface BenchResult {
  readonly frames: number;
  readonly totalMs: number;
  readonly fps: number;
  readonly msPerFrameP50: number;
  readonly msPerFrameP95: number;
}

/**
 * Where frames go. `ws`: WebSocket to the Node frame server, with up to `window` unacked frames
 * in flight. `ipc`: Electron preload bridge (`window.__spikeIpc`), one awaited invoke per frame.
 */
export type FrameSinkSpec =
  { readonly kind: 'ws'; readonly url: string; readonly window: number } | { readonly kind: 'ipc' };

export interface StreamOptions {
  readonly sink: FrameSinkSpec;
  readonly frames: number;
  readonly fps: number;
}

/** Exposed by the Electron preload (scripts/electron-preload.ts). */
export interface IpcFrameBridge {
  sendFrame(frame: Uint8Array<ArrayBuffer>): Promise<void>;
}

export const IPC_FRAME_CHANNEL = 'spike:frame';

export interface StreamResult {
  readonly frames: number;
  readonly totalMs: number;
  readonly fps: number;
}

export interface SpikeHarness {
  init(options: InitOptions): InitResult;
  /** SHA-256 (hex) of the RGBA frame at time t. */
  hashAt(t: number): Promise<string>;
  /** Base64 of the RGBA frame at time t. */
  frameBase64(t: number): string;
  /** seek + readPixels loop, timed in-page. */
  bench(options: BenchOptions): BenchResult;
  /** seek + readPixels + transfer of every frame to the given sink, in order. */
  stream(options: StreamOptions): Promise<StreamResult>;
}
