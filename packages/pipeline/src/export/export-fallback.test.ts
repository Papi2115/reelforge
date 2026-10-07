/** Hardware encoder open failures during an export: retry, then the CPU fallback (no GPU needed). */
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { ManifestShot, RenderManifest } from '@reelforge/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RenderIdentity } from './cache-key.js';
import { ENCODER_FALLBACK_MESSAGE } from './encoder-fallback.js';
import {
  exportVideo,
  type ExportProgress,
  type ExportVideoOptions,
  type ExportWarning,
} from './export-video.js';
import type { ExportMedia } from './media.js';
import { ExportStateSchema, exportPaths } from './state.js';
import { createFakeSourceFactory, createFlakyHardwareMedia } from './testing/fakes.js';

const WIDTH = 16;
const HEIGHT = 9;
const FPS = 10;
const FRAME_BYTES = WIDTH * HEIGHT * 4;
const TOTAL_FRAMES = 45;

const identity: RenderIdentity = {
  engineVersion: 'engine-1',
  kitVersion: 'kit-1',
  style: { id: 'test-style', width: WIDTH, height: HEIGHT, preset: { dither: 0.1 } },
};

const scene = (body: string): ManifestShot['scene'] => ({
  file: 'scenes/test.js',
  source: `export const meta = { id: 'x' };\nexport function build() { ${body} }\nexport function update() {}\n`,
});

const manifest: RenderManifest = {
  version: 1,
  fps: FPS,
  seed: 7,
  shots: [
    { id: 'a', t0: 0, t1: 1, scene: scene('return 1;') },
    { id: 'b', t0: 1, t1: 3, scene: scene('return 2;') },
    { id: 'c', t0: 3, t1: 4.5, scene: scene('return 3;') },
  ],
};

let projectDir = '';

beforeEach(async () => {
  projectDir = await mkdtemp(path.join(os.tmpdir(), 'reelforge fallback '));
});

afterEach(async () => {
  await rm(projectDir, { recursive: true, force: true });
});

async function run(media: ExportMedia, extra: Partial<ExportVideoOptions> = {}) {
  const source = createFakeSourceFactory({ width: WIDTH, height: HEIGHT });
  const events: ExportProgress[] = [];
  const warnings: ExportWarning[] = [];
  const result = await exportVideo({
    projectDir,
    title: 'v',
    manifest,
    identity,
    media,
    createFrameSource: source.factory,
    workers: 1,
    thumbnailAt: null,
    encoderRetryDelayMs: 5,
    encoderStaggerMs: 0,
    onProgress: (event) => events.push(event),
    onWarning: (warning) => warnings.push(warning),
    ...extra,
  });
  return { result, source, events, warnings };
}

/** The video is correct: every frame in order (byte 0 of frame i encodes t = i / fps). */
async function expectFullVideo(output: string): Promise<void> {
  const video = await readFile(output);
  expect(video.length).toBe(TOTAL_FRAMES * FRAME_BYTES);
  for (const index of [0, 10, 11, 29, 30, 44]) {
    expect(video[index * FRAME_BYTES]).toBe(Math.round((index / FPS) * 1000) % 251);
  }
}

describe('exportVideo with a hardware encoder that fails to open', () => {
  it('retries the segment once and stays on the GPU when the retry opens', async () => {
    const flaky = createFlakyHardwareMedia(1);
    const { result, events, warnings, source } = await run(flaky.media);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.encoder).toBe('raw-gpu (test)');
    await expectFullVideo(result.value.output);
    // Longest shot first: "b" failed, was retried, then "c" and "a".
    expect(flaky.stats.opened).toHaveLength(4);
    expect(flaky.cpu.stats.segmentsOpened).toBe(0);
    expect(warnings).toEqual([
      expect.objectContaining({ type: 'encoder-retry', shotId: 'b', encoder: 'raw-gpu (test)' }),
    ]);
    expect(result.value.warnings).toEqual(warnings);
    // Frames of the failed attempt are taken back: progress never passes 100 %.
    const frames = events.flatMap((event) => (event.type === 'frame' ? [event] : []));
    expect(frames.every((event) => event.renderedFrames <= event.framesToRender)).toBe(true);
    expect(frames.at(-1)?.renderedFrames).toBe(TOTAL_FRAMES);
    expect(source.stats.sourcesClosed).toBe(source.stats.sourcesCreated);
  });

  it('switches the whole export to the CPU encoder when the retry fails too', async () => {
    const flaky = createFlakyHardwareMedia(2);
    const { result, events, warnings } = await run(flaky.media);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(warnings.map((warning) => warning.type)).toEqual(['encoder-retry', 'encoder-fallback']);
    expect(warnings[1]).toMatchObject({
      type: 'encoder-fallback',
      from: 'raw-gpu (test)',
      to: 'raw-cpu (test)',
      message: ENCODER_FALLBACK_MESSAGE,
      detail: expect.stringContaining('out of memory (10)') as unknown,
    });
    expect(result.value.encoder).toBe('raw-cpu (test)');
    await expectFullVideo(result.value.output);
    // Every segment of the video comes from the CPU encoder (no mixed codec parameters).
    expect(flaky.cpu.stats.segmentsOpened).toBe(3);
    expect(await readdir(exportPaths(projectDir).segmentsDir)).toHaveLength(3);
    const plans = events.flatMap((event) => (event.type === 'plan' ? [event.encoder] : []));
    expect(plans).toEqual(['raw-gpu (test)', 'raw-cpu (test)']);
    const state = ExportStateSchema.parse(
      JSON.parse(await readFile(exportPaths(projectDir).stateFile, 'utf8')),
    );
    expect(state).toMatchObject({ status: 'complete', encoder: 'raw-cpu (test)' });

    // CPU segments are cached under the CPU media's key: the next fallback re-renders nothing.
    const again = createFlakyHardwareMedia(2);
    const second = await run(again.media);
    expect(second.result.ok && second.result.value.cachedShots).toHaveLength(3);
    expect(again.cpu.stats.segmentsOpened).toBe(0);
  });

  it('falls back with several workers and closes every frame source', async () => {
    const flaky = createFlakyHardwareMedia(Number.POSITIVE_INFINITY);
    const { result, source } = await run(flaky.media, { workers: 2 });
    expect(result.ok && result.value.encoder).toBe('raw-cpu (test)');
    if (result.ok) await expectFullVideo(result.value.output);
    expect(source.stats.sourcesClosed).toBe(source.stats.sourcesCreated);
  });

  it('fails as before when the media has no fallback', async () => {
    const flaky = createFlakyHardwareMedia(2, { fallback: false });
    const { result, warnings } = await run(flaky.media);
    expect(!result.ok && result.error.kind).toBe('encoder');
    expect(flaky.stats.opened).toHaveLength(1);
    expect(warnings).toEqual([]);
  });

  it('cancels during the retry pause', async () => {
    const controller = new AbortController();
    const flaky = createFlakyHardwareMedia(1);
    const { result } = await run(flaky.media, {
      encoderRetryDelayMs: 60_000,
      signal: controller.signal,
      onWarning: () => {
        controller.abort();
      },
    });
    expect(!result.ok && result.error.kind).toBe('cancelled');
    expect(await readdir(exportPaths(projectDir).segmentsDir)).toEqual([]);
  });

  it('staggers the first segment open of each worker', async () => {
    const flaky = createFlakyHardwareMedia(0);
    const opens: { worker: string; at: number }[] = [];
    const media: ExportMedia = {
      ...flaky.media,
      openSegment(spec, signal) {
        opens.push({ worker: /partial-(\d+)/.exec(spec.file)?.[1] ?? '?', at: performance.now() });
        return flaky.media.openSegment(spec, signal);
      },
    };
    const { result } = await run(media, { workers: 2, encoderStaggerMs: 80 });
    expect(result.ok).toBe(true);
    const first = (worker: string): number =>
      opens.find((open) => open.worker === worker)?.at ?? Number.NaN;
    expect(first('1') - first('0')).toBeGreaterThanOrEqual(60);
  });
});
