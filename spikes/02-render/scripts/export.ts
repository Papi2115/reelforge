/**
 * End-to-end export spike (Playwright Chromium, GPU backend, WebSocket transport):
 *  1. stream 300 frames (10 s @ 30 fps) -> ffmpeg libx264 -> out/spike.mp4, and -> h264_nvenc;
 *  2. dump raw RGBA to a file, verify transport integrity against in-page hashes, then time
 *     each encoder profile alone on that file;
 *  3. ffprobe-verify the MP4s and extract 3 PNG frames with blank-frame statistics.
 * Writes out/export-report.json; exits non-zero if any check fails.
 */
import { createHash } from 'node:crypto';
import { open, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { computeFrameStats, type FrameStats } from '../src/frame-stats.ts';
import { GPU_BACKEND } from './backends.ts';
import { SPIKE_INIT, type PageDriver } from './bench-core.ts';
import { buildSpike } from './build.ts';
import {
  dumpRawFrames,
  EXPORT_FPS,
  EXPORT_FRAMES,
  exportVideo,
  type ExportTiming,
} from './export-core.ts';
import {
  encodeFile,
  extractFrame,
  probeVideo,
  type ProbeResult,
  type VideoEncoder,
} from './ffmpeg.ts';
import { startFrameServer } from './frame-server.ts';
import { launchPlaywright } from './playwright-driver.ts';

const spikeRoot = path.resolve(import.meta.dirname, '..');
const outDir = path.join(spikeRoot, 'out');
const FRAME_BYTES = SPIKE_INIT.width * SPIKE_INIT.height * 4;
const ENCODER_PROFILES: readonly VideoEncoder[] = ['libx264', 'libx264-veryfast', 'h264_nvenc'];
const INTEGRITY_FRAMES: readonly number[] = [0, 75, 150, 299];
const PNG_SECONDS: readonly number[] = [1, 5, 9];

interface EncoderOnlyTiming {
  readonly encoder: VideoEncoder;
  readonly wallMs: number;
  readonly fps: number;
}

async function verifyIntegrity(driver: PageDriver, rawFile: string): Promise<boolean> {
  const handle = await open(rawFile, 'r');
  try {
    let allEqual = true;
    for (const index of INTEGRITY_FRAMES) {
      const frame = Buffer.alloc(FRAME_BYTES);
      await handle.read(frame, 0, FRAME_BYTES, index * FRAME_BYTES);
      const received = createHash('sha256').update(frame).digest('hex');
      const rendered = (await driver.evaluate(
        `window.__spike.hashAt(${String(index / EXPORT_FPS)})`,
      )) as string;
      if (received !== rendered) allEqual = false;
    }
    return allEqual;
  } finally {
    await handle.close();
  }
}

async function timeEncoders(rawFile: string): Promise<EncoderOnlyTiming[]> {
  const timings: EncoderOnlyTiming[] = [];
  for (const encoder of ENCODER_PROFILES) {
    const start = performance.now();
    await encodeFile({
      inputFile: rawFile,
      output: path.join(outDir, `encoder-only-${encoder}.mp4`),
      encoder,
      width: SPIKE_INIT.width,
      height: SPIKE_INIT.height,
      fps: EXPORT_FPS,
    });
    const wallMs = performance.now() - start;
    timings.push({ encoder, wallMs, fps: (EXPORT_FRAMES / wallMs) * 1000 });
  }
  return timings;
}

function probeOk(probe: ProbeResult): boolean {
  return (
    probe.width === 1920 &&
    probe.height === 1080 &&
    probe.frameRate === '30/1' &&
    probe.frames === EXPORT_FRAMES &&
    Math.abs(probe.durationSeconds - 10) < 0.05
  );
}

async function extractPngs(video: string): Promise<{ png: string; stats: FrameStats }[]> {
  const results: { png: string; stats: FrameStats }[] = [];
  for (const seconds of PNG_SECONDS) {
    const png = path.join(outDir, `frame-${String(seconds).padStart(2, '0')}s.png`);
    const rgb = await extractFrame(video, seconds, png);
    results.push({ png, stats: computeFrameStats(rgb, 3) });
  }
  return results;
}

async function main(): Promise<void> {
  await buildSpike();
  const server = await startFrameServer(outDir);
  const session = await launchPlaywright(GPU_BACKEND);
  try {
    await session.driver.load(server.pageUrl);
    await session.driver.evaluate(`window.__spike.init(${JSON.stringify(SPIKE_INIT)})`);

    const streamed: ExportTiming[] = [];
    streamed.push(
      await exportVideo(session.driver, server, 'libx264', path.join(outDir, 'spike.mp4')),
    );
    streamed.push(
      await exportVideo(session.driver, server, 'h264_nvenc', path.join(outDir, 'spike-nvenc.mp4')),
    );

    const rawFile = path.join(outDir, 'frames.rgba');
    const rawDump = await dumpRawFrames(session.driver, server, rawFile);
    const transportIntegrity = await verifyIntegrity(session.driver, rawFile);
    const encoderOnly = await timeEncoders(rawFile);
    await rm(rawFile);

    const probes = {
      libx264: await probeVideo(path.join(outDir, 'spike.mp4')),
      h264_nvenc: await probeVideo(path.join(outDir, 'spike-nvenc.mp4')),
    };
    const pngs = await extractPngs(path.join(outDir, 'spike.mp4'));
    const nonBlank = pngs.every(
      ({ stats }) => stats.uniqueColors >= 8 && stats.dominantColorShare < 0.9,
    );
    const passed =
      probeOk(probes.libx264) && probeOk(probes.h264_nvenc) && transportIntegrity && nonBlank;

    const report = {
      streamed,
      rawDump,
      transportIntegrity,
      encoderOnly,
      probes,
      pngs,
      nonBlank,
      passed,
      pageErrors: session.pageErrors,
    };
    await writeFile(path.join(outDir, 'export-report.json'), JSON.stringify(report, null, 2));

    for (const timing of [...streamed, rawDump]) {
      console.log(
        `stream -> ${timing.encoder}: ${timing.effectiveFps.toFixed(1)} fps end-to-end (${timing.wallMs.toFixed(0)} ms, page ${timing.page.fps.toFixed(1)} fps)`,
      );
    }
    for (const timing of encoderOnly) {
      console.log(
        `encoder only ${timing.encoder}: ${timing.fps.toFixed(1)} fps (${timing.wallMs.toFixed(0)} ms)`,
      );
    }
    console.log(`transport integrity (Node bytes == in-page hash): ${String(transportIntegrity)}`);
    console.log(`ffprobe libx264: ${JSON.stringify(probes.libx264)}`);
    console.log(`ffprobe nvenc:   ${JSON.stringify(probes.h264_nvenc)}`);
    for (const { png, stats } of pngs) {
      const mean = stats.meanRgb.map((value) => value.toFixed(1)).join('/');
      console.log(
        `${path.basename(png)}: ${String(stats.uniqueColors)} colors, mean RGB ${mean}, dominant ${(stats.dominantColorShare * 100).toFixed(1)}%`,
      );
    }
    console.log(passed ? 'EXPORT CHECKS PASSED' : 'EXPORT CHECKS FAILED');
    if (!passed) process.exitCode = 1;
  } finally {
    await session.browser.close();
    await server.close();
  }
}

await main();
