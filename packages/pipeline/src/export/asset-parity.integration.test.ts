/**
 * Preview = export for asset pictures (CLAUDE.md §3.3, PLAN.md#12.11): a shot embedding the test
 * photo (laptop with a scan-in, monitor with scanlines and flicker; kit example k10_assets.js) is
 * exported through `exportVideo` (real engine in Playwright Chromium, SwiftShader, raw-frame
 * media) and its frames must equal the preview harness frames byte for byte. Skipped when
 * Playwright's Chromium is missing.
 */
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { decodePng, launchHarnessBrowser, type HarnessBrowser } from '@reelforge/engine/cli';
import type { ManifestAsset, RenderManifest } from '@reelforge/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { RenderIdentity } from './cache-key.js';
import { describeUnknown } from './errors.js';
import { exportVideo } from './export-video.js';
import { createRawMedia } from './testing/fakes.js';
import { createPlaywrightFrameSources } from './testing/playwright-frame-source.js';

const packagesDir = path.resolve(import.meta.dirname, '..', '..', '..');
const WIDTH = 640;
const HEIGHT = 360;
const FPS = 30;
const FRAME_BYTES = WIDTH * HEIGHT * 4;
const FRAMES = [0, 14, 29, 44];

const unavailable = await launchHarnessBrowser().then(
  async (browser) => {
    await browser.close();
    return null;
  },
  (error: unknown) => describeUnknown(error).split('\n')[0] ?? 'unknown error',
);

/** The test card fixture as a manifest asset (what the pipeline ships for a 320x240 PNG). */
async function testCardAsset(): Promise<ManifestAsset> {
  const bytes = await readFile(path.join(packagesDir, 'engine/test/fixtures/asset-test-card.png'));
  const image = decodePng(bytes);
  const rgb = new Uint8Array(image.width * image.height * 3);
  for (let pixel = 0; pixel < image.width * image.height; pixel += 1) {
    rgb.set(image.data.subarray(pixel * 4, pixel * 4 + 3), pixel * 3);
  }
  return {
    ref: 'test-card',
    id: 'test-card',
    file: '.reelforge/assets/test-card.png',
    mime: 'image/png',
    sha256: createHash('sha256').update(bytes).digest('hex'),
    width: image.width,
    height: image.height,
    rgb: Buffer.from(rgb).toString('base64'),
  };
}

describe.skipIf(unavailable !== null)(
  unavailable === null
    ? 'asset pictures: export = preview'
    : `asset pictures: export = preview (SKIPPED: ${unavailable})`,
  () => {
    const sources = createPlaywrightFrameSources();
    let browser: HarnessBrowser;
    let projectDir = '';
    let manifest: RenderManifest;
    let identity: RenderIdentity;

    beforeAll(async () => {
      browser = await launchHarnessBrowser();
      projectDir = await mkdtemp(path.join(os.tmpdir(), 'reelforge asset parity '));
      const example = await readFile(path.join(packagesDir, 'kit/examples/k10_assets.js'), 'utf8');
      manifest = {
        version: 1,
        width: WIDTH,
        height: HEIGHT,
        fps: FPS,
        seed: 2115,
        assets: [await testCardAsset()],
        shots: [
          {
            id: 's01',
            t0: 0,
            t1: 1.5,
            scene: {
              file: 'scenes/laptop.js',
              source: example.replace("const SETUP = 'wall';", "const SETUP = 'laptop';"),
            },
          },
        ],
      };
      const preset: unknown = JSON.parse(
        await readFile(
          path.join(packagesDir, 'engine/src/presets/voxel-pixel-crisp640.json'),
          'utf8',
        ),
      );
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
        title: 'asset parity',
        manifest,
        identity,
        media: raw.media,
        createFrameSource: sources.factory,
        workers: 1,
        thumbnailAt: null,
        audio: null,
      });
      if (!exported.ok) throw new Error(exported.error.message);
      const video = await readFile(exported.value.output);
      expect(video.length).toBe(45 * FRAME_BYTES);
      const page = await browser.open();
      try {
        await page.load(manifest);
        for (const frame of [...FRAMES].reverse()) {
          const preview = await page.frameAt(frame / FPS);
          const fromExport = video.subarray(frame * FRAME_BYTES, (frame + 1) * FRAME_BYTES);
          expect(preview.equals(fromExport), `frame ${String(frame)}`).toBe(true);
        }
      } finally {
        await page.close();
      }
    }, 300_000);
  },
);
