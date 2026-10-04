/**
 * Look `flat-2d` (PLAN.md#12.5) in the engine harness (SwiftShader): every template setup passes
 * the determinism lint, seeks deterministically, renders in every style, and matches its
 * full-resolution goldens (`look-flat-2d-*`, Crisp 640, the icon sheet included) with the vibe
 * guard on every frame. The kinetic scene is checked on its spoken cues. Contact sheets:
 * packages/kit/out/contact/look-flat-2d-<style>.png. Perf (full seek path,
 * packages/kit/out/perf/look-flat-2d.json): SwiftShader floor always, 30 fps on the hardware GPU
 * with REELFORGE_KIT_PERF_GPU=1.
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
import { FLAT_SETUPS, flatManifest, flatSource, type FlatSetup } from './look-flat-2d-scenes.js';

const STYLES = ['voxel-pixel-crisp640', 'noir-voxel', 'soft-480'] as const;
/** Golden frames: setup -> times (entrances, morphs and exits caught mid-way and at rest). */
const GOLDENS: readonly (readonly [FlatSetup, readonly number[]])[] = [
  ['stage', [0.8, 3]],
  ['shapes', [1.2, 2.7, 4]],
  ['icons', [0.5, 3]],
  ['sheet', [1]],
  ['steps', [1.6, 4]],
  ['progress', [1, 3.5]],
  ['ring', [3.5]],
  ['versus', [1, 4]],
  ['stat', [3.5]],
  ['kinetic', [1, 2.45, 4]],
  ['lower', [1.6, 3.5, 4.9]],
  ['annotated', [3.5]],
];
const PERF_FRAMES = 30;
/** Preview target of the look on the hardware GPU (REELFORGE_KIT_PERF_GPU=1). */
const MIN_FPS = 30;
/**
 * SwiftShader is CPU-bound and its speed depends on the machine (CI runners ~7 fps): an
 * informational floor that only catches a broken render loop, like the kit perf tests.
 */
const SWIFTSHADER_MIN_FPS = 3;
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

/** A flat board: several palette colours, no single colour flooding the frame. */
function expectPicture(frame: Uint8Array, label: string): void {
  const stats = computeFrameStats(frame);
  expect(stats.uniqueColors, label).toBeGreaterThanOrEqual(4);
  expect(stats.dominantColorShare, label).toBeLessThan(0.9);
}

/** Pixels of `color` (0xrrggbb) inside a rectangle of a 640x360 frame. */
function countColor(
  frame: Uint8Array,
  rect: readonly [number, number, number, number],
  color: number,
): number {
  const [x0, y0, width, height] = rect;
  let count = 0;
  for (let y = y0; y < y0 + height; y += 1) {
    for (let x = x0; x < x0 + width; x += 1) {
      const index = (y * 640 + x) * 4;
      const rgb =
        ((frame[index] ?? 0) << 16) | ((frame[index + 1] ?? 0) << 8) | (frame[index + 2] ?? 0);
      if (rgb === color) count += 1;
    }
  }
  return count;
}

async function measureAll(backend: PerfSample['backend']): Promise<PerfSample[]> {
  const server = await startStaticServer(await buildHarness());
  try {
    const samples: PerfSample[] = [];
    for (const setup of FLAT_SETUPS) {
      samples.push(
        await measure(server, backend, `flat-2d:${setup}`, flatManifest(setup), PERF_FRAMES),
      );
    }
    await record(path.join(KIT_OUT_DIR, 'perf', 'look-flat-2d.json'), samples);
    return samples;
  } finally {
    await server.close();
  }
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

describe('look flat-2d (SwiftShader)', () => {
  it('every setup passes the determinism lint', () => {
    for (const setup of FLAT_SETUPS) {
      expect(lintScene(flatSource(setup), { filename: 'look-flat-2d.js' }), setup).toEqual([]);
    }
  });

  it(
    'matches the goldens (Crisp 640, full resolution) and keeps the vibe',
    async () => {
      const tiles: RgbaImage[] = [];
      await withPage(async (page) => {
        for (const [setup, times] of GOLDENS) {
          const info = await page.load(flatManifest(setup));
          for (const t of times) {
            const data = await page.frameAt(t);
            const frame = { width: info.width, height: info.height, data };
            const label = `${setup}-t${String(t)}`;
            expectPicture(data, label);
            expectVibe(frame, label);
            tiles.push(downscale(frame, 2, 'nearest'));
            await compareWithGolden(`look-flat-2d-${label}`, frame, undefined, {
              goldenDir: KIT_GOLDEN_DIR,
            });
          }
        }
        expect(page.errors).toEqual([]);
      });
      await writeSheet('look-flat-2d-voxel-pixel-crisp640', tiles, 4);
    },
    SUITE_TIMEOUT,
  );

  it(
    'lands the kinetic words on their spoken phrases',
    async () => {
      await withPage(async (page) => {
        await page.load(flatManifest('kinetic'));
        // Crisp 640 cream lettering: the first line (y ~110..190) gains ink on "it" (0.5),
        // the second line (y ~190..260) only on "it#2" (2.3).
        const cream = 0xf4e9d8;
        const firstLine = [32, 100, 576, 90] as const;
        const secondLine = [32, 190, 576, 90] as const;
        expect(countColor(await page.frameAt(0.45), firstLine, cream)).toBe(0);
        expect(countColor(await page.frameAt(0.7), firstLine, cream)).toBeGreaterThan(200);
        expect(countColor(await page.frameAt(2.25), secondLine, cream)).toBe(0);
        expect(countColor(await page.frameAt(2.6), secondLine, cream)).toBeGreaterThan(100);
        expect(page.errors).toEqual([]);
      });
    },
    SUITE_TIMEOUT,
  );

  it(
    'seeks deterministically in both directions',
    async () => {
      await withPage(async (page) => {
        const times = [0.7, 2.2, 4.4];
        for (const setup of FLAT_SETUPS) {
          await page.load(flatManifest(setup));
          const forward: string[] = [];
          for (const t of times) forward.push(await page.hashAt(t));
          const backward: string[] = [];
          for (const t of [...times].reverse()) backward.push(await page.hashAt(t));
          expect(backward.reverse(), setup).toEqual(forward);
          await page.load(flatManifest(setup));
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
        for (const setup of FLAT_SETUPS) {
          const info = await page.load(flatManifest(setup, style));
          const data = await page.frameAt(4);
          const frame = { width: info.width, height: info.height, data };
          expectPicture(data, `${style} ${setup}`);
          expectVibe(frame, `${style} ${setup}`, style);
          tiles.push(frame);
        }
        expect(page.errors).toEqual([]);
      });
      await writeSheet(`look-flat-2d-${style}`, tiles, 4);
    },
    SUITE_TIMEOUT,
  );

  it(
    'SwiftShader: every setup on the full seek path (informational floor)',
    async () => {
      for (const sample of await measureAll('swiftshader')) {
        expect(sample.renderer).toMatch(/SwiftShader/);
        expect(sample.fps, sample.mode).toBeGreaterThanOrEqual(SWIFTSHADER_MIN_FPS);
      }
    },
    SUITE_TIMEOUT,
  );

  it.runIf(GPU_PERF_ENABLED)(
    'hardware GPU: every setup holds 30 fps',
    async () => {
      for (const sample of await measureAll('gpu')) {
        expect(sample.renderer, sample.mode).not.toMatch(/SwiftShader/);
        expect(sample.fps, sample.mode).toBeGreaterThanOrEqual(MIN_FPS);
      }
    },
    SUITE_TIMEOUT,
  );
});
