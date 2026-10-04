/**
 * Preview = export for the transition kit (CLAUDE.md §3.3, PLAN.md#12.15): a 3-shot film with two
 * transition-kit styles is exported through `exportVideo` (real engine in Playwright Chromium,
 * SwiftShader; raw-frame media, so no ffmpeg) and every exported frame of the transitions must be
 * byte-equal to the frame the preview harness shows at that time (seeked backwards, from a fresh
 * page). Skipped when Playwright's Chromium is missing.
 */
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { launchHarnessBrowser, type HarnessBrowser } from '@reelforge/engine/cli';
import type { RenderManifest, WordsFile } from '@reelforge/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { RenderIdentity } from './cache-key.js';
import { describeUnknown } from './errors.js';
import { exportVideo } from './export-video.js';
import { createRawMedia } from './testing/fakes.js';
import { createPlaywrightFrameSources } from './testing/playwright-frame-source.js';

const engineDir = path.resolve(import.meta.dirname, '..', '..', '..', 'engine');
const WIDTH = 640;
const HEIGHT = 360;
const FPS = 30;
const FRAME_BYTES = WIDTH * HEIGHT * 4;

const unavailable = await launchHarnessBrowser().then(
  async (browser) => {
    await browser.close();
    return null;
  },
  (error: unknown) => describeUnknown(error).split('\n')[0] ?? 'unknown error',
);

/** Frame indices covered by the transitions (into s02 at 1 s, into s03 at 2 s). */
const TRANSITION_FRAMES = [
  ...Array.from({ length: 18 }, (_, index) => 30 + index),
  ...Array.from({ length: 21 }, (_, index) => 60 + index),
];

describe.skipIf(unavailable !== null)(
  unavailable === null
    ? 'transition kit: export = preview'
    : `transition kit: export = preview (SKIPPED: ${unavailable})`,
  () => {
    const sources = createPlaywrightFrameSources();
    let browser: HarnessBrowser;
    let projectDir = '';
    let manifest: RenderManifest;
    let identity: RenderIdentity;

    beforeAll(async () => {
      browser = await launchHarnessBrowser();
      projectDir = await mkdtemp(path.join(os.tmpdir(), 'reelforge transition parity '));
      const read = (relative: string): Promise<string> =>
        readFile(path.join(engineDir, relative), 'utf8');
      const hello = { file: 'scenes/hello.js', source: await read('examples/s00_hello.js') };
      const stripes = {
        file: 'scenes/stripes.js',
        source: await read('test/fixtures/s01_stripes.js'),
      };
      const words = JSON.parse(await read('examples/words.json')) as WordsFile;
      manifest = {
        version: 1,
        width: WIDTH,
        height: HEIGHT,
        fps: FPS,
        seed: 2115,
        words,
        shots: [
          { id: 's01', t0: 0, t1: 1, scene: stripes },
          {
            id: 's02',
            t0: 1,
            t1: 2,
            transitionIn: { type: 'glitch', duration: 0.6, style: 'pixel-sort-melt' },
            scene: hello,
          },
          {
            id: 's03',
            t0: 2,
            t1: 3,
            transitionIn: { type: 'glitch', duration: 0.7, style: 'crt-zoom' },
            scene: stripes,
          },
        ],
      };
      const preset: unknown = JSON.parse(await read('src/presets/voxel-pixel-crisp640.json'));
      identity = {
        engineVersion: 'test',
        kitVersion: 'test',
        style: { id: 'voxel-pixel-crisp640', width: WIDTH, height: HEIGHT, preset },
      };
    }, 120_000);

    afterAll(async () => {
      await sources.close();
      await browser.close();
      await rm(projectDir, { recursive: true, force: true });
    });

    it('exports exactly the frames the preview shows', async () => {
      const raw = createRawMedia();
      const exported = await exportVideo({
        projectDir,
        title: 'parity',
        manifest,
        identity,
        media: raw.media,
        createFrameSource: sources.factory,
        workers: 2,
        thumbnailAt: null,
        audio: null,
      });
      if (!exported.ok) throw new Error(exported.error.message);
      const video = await readFile(exported.value.output);
      expect(video.length).toBe(3 * FPS * FRAME_BYTES);
      const page = await browser.open();
      try {
        await page.load(manifest);
        for (const frame of [...TRANSITION_FRAMES].reverse()) {
          const preview = await page.frameAt(frame / FPS);
          const start = frame * FRAME_BYTES;
          const fromExport = video.subarray(start, start + FRAME_BYTES);
          expect(preview.equals(fromExport), `frame ${String(frame)}`).toBe(true);
        }
      } finally {
        await page.close();
      }
    }, 300_000);
  },
);
