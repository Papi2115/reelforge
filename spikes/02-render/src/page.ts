/**
 * Browser-side harness (bundled to out/page.js). Timing code lives here, NOT in the scene:
 * the scene itself stays a pure function of t.
 */
import type {
  BenchOptions,
  BenchResult,
  InitOptions,
  InitResult,
  SpikeHarness,
  StreamOptions,
  StreamResult,
} from './harness-types.ts';
import { openFrameSink } from './frame-sinks.ts';
import { createSpikeRenderer, type SpikeRenderer } from './spike-renderer.ts';

declare global {
  interface Window {
    __spike: SpikeHarness;
  }
}

/** RGBA8 frame backed by a plain (non-shared) ArrayBuffer, as required by WebSocket/crypto APIs. */
type FrameBuffer = Uint8Array<ArrayBuffer>;

let active: { renderer: SpikeRenderer; buffer: FrameBuffer } | undefined;

function requireActive(): { renderer: SpikeRenderer; buffer: FrameBuffer } {
  if (!active) throw new Error('Harness not initialised: call init() first');
  return active;
}

function renderInto(t: number): FrameBuffer {
  const { renderer, buffer } = requireActive();
  renderer.seek(t);
  renderer.readFrame(buffer);
  return buffer;
}

function percentile(sorted: readonly number[], fraction: number): number {
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * fraction));
  return sorted[index] ?? Number.NaN;
}

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function toBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

const harness: SpikeHarness = {
  init(options: InitOptions): InitResult {
    const setupStart = performance.now();
    const canvas = document.createElement('canvas');
    canvas.width = options.width;
    canvas.height = options.height;
    document.body.appendChild(canvas);
    const renderer = createSpikeRenderer({ canvas, ...options });
    active = { renderer, buffer: new Uint8Array(options.width * options.height * 4) };
    const setupMs = performance.now() - setupStart;
    const frameStart = performance.now();
    renderInto(0);
    const firstFrameMs = performance.now() - frameStart;
    return { gpu: renderer.gpuInfo(), setupMs, firstFrameMs };
  },

  async hashAt(t: number): Promise<string> {
    const frame = renderInto(t);
    return toHex(await crypto.subtle.digest('SHA-256', frame));
  },

  frameBase64(t: number): string {
    return toBase64(renderInto(t));
  },

  bench(options: BenchOptions): BenchResult {
    for (let index = 0; index < options.warmupFrames; index += 1) renderInto(index / options.fps);
    const samples: number[] = [];
    const start = performance.now();
    for (let index = 0; index < options.frames; index += 1) {
      const frameStart = performance.now();
      renderInto(index / options.fps);
      samples.push(performance.now() - frameStart);
    }
    const totalMs = performance.now() - start;
    samples.sort((a, b) => a - b);
    return {
      frames: options.frames,
      totalMs,
      fps: (options.frames / totalMs) * 1000,
      msPerFrameP50: percentile(samples, 0.5),
      msPerFrameP95: percentile(samples, 0.95),
    };
  },

  async stream(options: StreamOptions): Promise<StreamResult> {
    const sink = await openFrameSink(options.sink);
    const start = performance.now();
    for (let index = 0; index < options.frames; index += 1) {
      await sink.send(renderInto(index / options.fps));
    }
    await sink.close();
    const totalMs = performance.now() - start;
    return { frames: options.frames, totalMs, fps: (options.frames / totalMs) * 1000 };
  },
};

window.__spike = harness;
