/**
 * Look `paper-cutout` (PLAN.md#12.6) in the engine harness (SwiftShader): every setup passes the
 * determinism lint, seeks deterministically, renders in every style, and matches its goldens
 * (`look-paper-cutout-*`, Crisp 640) with the vibe guard on every frame. The `wobble` pair shows
 * two neighbouring stop-motion frames (8 fps: one image per 1/8 s). Contact sheets:
 * packages/kit/out/contact/look-paper-cutout-<style>.png. Perf (full seek path,
 * packages/kit/out/perf/look-paper-cutout.json): SwiftShader floor always, 30 fps on the
 * hardware GPU with REELFORGE_KIT_PERF_GPU=1.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  buildHarness,
  compareWithGolden,
  computeFrameStats,
  encodePng,
  launchHarnessBrowser,
  startStaticServer,
  type HarnessBrowser,
  type HarnessPage,
  type RgbaImage,
} from '../../../engine/src/cli/index.js';
import { lintScene } from '../../../engine/src/index.js';
import { composeSheet } from '../support/contact-sheet.js';
import { downscale } from '../support/image.js';
import { GPU_PERF_ENABLED, measure, record, type PerfSample } from '../support/perf.js';
import { KIT_GOLDEN_DIR, KIT_OUT_DIR } from '../support/scenes.js';
import { expectVibe } from '../support/vibe.js';
import {
  PAPER_SETUPS,
  paperManifest,
  paperSource,
  type PaperSetup,
} from './look-paper-cutout-scenes.js';

const STYLES = ['voxel-pixel-crisp640', 'noir-voxel', 'soft-480'] as const;
const GOLDENS: readonly (readonly [PaperSetup, readonly number[]])[] = [
  ['dusk', [0.5, 3]],
  ['day', [2]],
  ['night', [2.5]],
  ['city', [1.5]],
  ['room', [1, 3]],
  ['stack', [0.6, 3]],
  ['card', [1.4, 2.5]],
  ['wobble', [2, 2.125]],
  ['parallax', [0.5, 3.5]],
];
const PERF_SETUPS: readonly PaperSetup[] = ['dusk', 'city', 'room', 'stack'];
const PERF_FRAMES = 30;
const MIN_FPS = 30;
/** SwiftShader (CI) is CPU-bound: a floor only. */
const SWIFTSHADER_MIN_FPS = 10;
const SUITE_TIMEOUT = 600_000;

let browser: HarnessBrowser;

beforeAll(async () => {
  browser = await launchHarnessBrowser();
});

afterAll(async () => {
  await browser.close();
});

async function withPage<T>(run: (page: HarnessPage) => Promise<T>): Promise<T> {
  const page = await browser.open({ lint: true });
  try {
    return await run(page);
  } finally {
    await page.close();
  }
}

/** A paper set: many palette colours, no single colour flooding the frame (desks: kraft). */
function expectPicture(frame: Uint8Array, label: string): void {
  const stats = computeFrameStats(frame);
  expect(stats.uniqueColors, label).toBeGreaterThanOrEqual(6);
  expect(stats.dominantColorShare, label).toBeLessThan(0.92);
}

async function writeSheet(
  name: string,
  tiles: readonly RgbaImage[],
  columns: number,
): Promise<void> {
  const file = path.join(KIT_OUT_DIR, 'contact', `${name}.png`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, encodePng(composeSheet(tiles, columns)));
}

describe('look paper-cutout (SwiftShader)', () => {
  it('every setup passes the determinism lint', () => {
    for (const setup of PAPER_SETUPS) {
      expect(lintScene(paperSource(setup), { filename: 'look-paper-cutout.js' }), setup).toEqual(
        [],
      );
    }
  });

  it(
    'matches the goldens (Crisp 640, full resolution) and keeps the vibe',
    async () => {
      const tiles: RgbaImage[] = [];
      await withPage(async (page) => {
        for (const [setup, times] of GOLDENS) {
          const info = await page.load(paperManifest(setup));
          for (const t of times) {
            const data = await page.frameAt(t);
            const frame = { width: info.width, height: info.height, data };
            const label = `${setup}-t${String(t)}`;
            tiles.push(downscale(frame, 2, 'nearest'));
            expectPicture(data, label);
            expectVibe(frame, label);
            await compareWithGolden(`look-paper-cutout-${label}`, frame, undefined, {
              goldenDir: KIT_GOLDEN_DIR,
            });
          }
        }
        expect(page.errors).toEqual([]);
      });
      await writeSheet('look-paper-cutout-voxel-pixel-crisp640', tiles, 4);
    },
    SUITE_TIMEOUT,
  );

  it(
    'moves on the stop-motion clock (8 fps) and seeks deterministically in both directions',
    async () => {
      await withPage(async (page) => {
        await page.load(paperManifest('wobble'));
        expect(await page.hashAt(2.1)).toBe(await page.hashAt(2));
        expect(await page.hashAt(2.125)).not.toBe(await page.hashAt(2));
        const times = [0.7, 2.2, 4.4];
        for (const setup of PAPER_SETUPS) {
          await page.load(paperManifest(setup));
          const forward: string[] = [];
          for (const t of times) forward.push(await page.hashAt(t));
          const backward: string[] = [];
          for (const t of [...times].reverse()) backward.push(await page.hashAt(t));
          expect(backward.reverse(), setup).toEqual(forward);
          expect(new Set(forward).size, setup).toBe(times.length);
          await page.load(paperManifest(setup));
          expect(await page.hashAt(times[1] ?? 0), `${setup} reload`).toBe(forward[1]);
        }
        expect(page.errors).toEqual([]);
      });
    },
    SUITE_TIMEOUT,
  );

  it.each(STYLES.slice(1))(
    'renders every setup in %s (in palette)',
    async (style) => {
      const tiles: RgbaImage[] = [];
      await withPage(async (page) => {
        for (const setup of PAPER_SETUPS) {
          const info = await page.load(paperManifest(setup, style));
          const data = await page.frameAt(2.5);
          const frame = { width: info.width, height: info.height, data };
          expectPicture(data, `${style} ${setup}`);
          expectVibe(frame, `${style} ${setup}`, style);
          tiles.push(info.width === 640 ? downscale(frame, 2, 'nearest') : frame);
        }
        expect(page.errors).toEqual([]);
      });
      await writeSheet(`look-paper-cutout-${style}`, tiles, 3);
    },
    SUITE_TIMEOUT,
  );
});

describe('look paper-cutout performance', () => {
  it(
    'SwiftShader (informational floor) and GPU preview budget',
    async () => {
      const server = await startStaticServer(await buildHarness());
      try {
        const results = path.join(KIT_OUT_DIR, 'perf', 'look-paper-cutout.json');
        for (const setup of PERF_SETUPS) {
          const samples: PerfSample[] = [
            await measure(
              server,
              'swiftshader',
              `paper:${setup}`,
              paperManifest(setup),
              PERF_FRAMES,
            ),
          ];
          expect(samples[0]?.fps ?? 0, setup).toBeGreaterThan(SWIFTSHADER_MIN_FPS);
          if (GPU_PERF_ENABLED) {
            const gpu = await measure(server, 'gpu', `paper:${setup}`, paperManifest(setup));
            samples.push(gpu);
            expect(gpu.renderer).not.toMatch(/SwiftShader/);
            expect(gpu.fps, setup).toBeGreaterThanOrEqual(MIN_FPS);
          }
          await record(results, samples);
        }
      } finally {
        await server.close();
      }
    },
    SUITE_TIMEOUT,
  );
});
