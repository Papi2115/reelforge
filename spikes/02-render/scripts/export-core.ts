/** Streams frames from an initialised harness page into ffmpeg (or a raw file) via the frame server. */
import { createWriteStream } from 'node:fs';
import { once } from 'node:events';
import type { StreamResult } from '../src/harness-types.ts';
import type { PageDriver } from './bench-core.ts';
import { startRawEncoder, type VideoEncoder } from './ffmpeg.ts';
import type { FrameTransport } from './frame-server.ts';

export interface ExportTiming {
  readonly encoder: VideoEncoder | 'raw-file';
  readonly output: string;
  readonly frames: number;
  /** Wall time from first frame request to ffmpeg exit (ms). */
  readonly wallMs: number;
  readonly effectiveFps: number;
  readonly page: StreamResult;
}

export const EXPORT_FPS = 30;
export const EXPORT_FRAMES = 300;

const streamCall = (transport: FrameTransport): string =>
  `window.__spike.stream(${JSON.stringify({ sink: transport.sink, frames: EXPORT_FRAMES, fps: EXPORT_FPS })})`;

export async function exportVideo(
  driver: PageDriver,
  transport: FrameTransport,
  encoder: VideoEncoder,
  output: string,
): Promise<ExportTiming> {
  const start = performance.now();
  const ffmpeg = startRawEncoder({ output, encoder, width: 640, height: 360, fps: EXPORT_FPS });
  transport.setFrameHandler((_index, frame) => ffmpeg.write(frame));
  try {
    // Trusted in-repo harness: shape defined in src/harness-types.ts.
    const page = (await driver.evaluate(streamCall(transport))) as StreamResult;
    await ffmpeg.finish();
    const wallMs = performance.now() - start;
    return {
      encoder,
      output,
      frames: EXPORT_FRAMES,
      wallMs,
      effectiveFps: (EXPORT_FRAMES / wallMs) * 1000,
      page,
    };
  } catch (error: unknown) {
    ffmpeg.kill();
    throw error;
  } finally {
    transport.setFrameHandler(undefined);
  }
}

export async function dumpRawFrames(
  driver: PageDriver,
  transport: FrameTransport,
  output: string,
): Promise<ExportTiming> {
  const start = performance.now();
  const file = createWriteStream(output);
  transport.setFrameHandler(async (_index, frame) => {
    if (!file.write(frame)) await once(file, 'drain');
  });
  try {
    const page = (await driver.evaluate(streamCall(transport))) as StreamResult;
    file.end();
    await once(file, 'finish');
    const wallMs = performance.now() - start;
    return {
      encoder: 'raw-file',
      output,
      frames: EXPORT_FRAMES,
      wallMs,
      effectiveFps: (EXPORT_FRAMES / wallMs) * 1000,
      page,
    };
  } finally {
    transport.setFrameHandler(undefined);
  }
}
