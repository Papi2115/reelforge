/**
 * Look `blueprint` (PLAN.md#12.4) in the engine harness (SwiftShader): every template setup
 * passes the determinism lint, seeks deterministically, renders in every style, and matches its
 * full-resolution goldens (`look-blueprint-*`, Crisp 640) with the vibe guard on every frame.
 * The CSV scene is checked at three times: its bars appear on the spoken phrases of its `say`
 * column. Contact sheets: packages/kit/out/contact/look-blueprint-<style>.png. Perf (full seek
 * path, packages/kit/out/perf/look-blueprint.json): SwiftShader floor always, 30 fps on the
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
  BLUEPRINT_SETUPS,
  blueprintManifest,
  blueprintSource,
  CSV_REVEALS,
  type BlueprintSetup,
} from './look-blueprint-scenes.js';

const STYLES = ['voxel-pixel-crisp640', 'noir-voxel', 'soft-480'] as const;
/** Golden frames: setup -> times (the CSV scene at three points of its narration). */
const GOLDENS: readonly (readonly [BlueprintSetup, readonly number[]])[] = [
  ['csv', [1.5, 2.9, 5]],
  ['area', [4]],
  ['hbar', [4]],
  ['counter', [1.4, 4]],
  ['graph', [4]],
  ['timeline', [2, 4.6]],
  ['map', [3.5]],
  ['europe', [3]],
  ['schematic', [5]],
  ['sheet', [4]],
  ['hybrid', [2]],
];
const PERF_FRAMES = 30;
/** Preview target of the look on the hardware GPU (REELFORGE_KIT_PERF_GPU=1). */
const MIN_FPS = 30;
/** SwiftShader (CI) is CPU-bound like the voxel effects (~20-35 fps): a floor only. */
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

/** A blueprint board: many palette colours, no single colour flooding the frame. */
function expectPicture(frame: Uint8Array, label: string): void {
  const stats = computeFrameStats(frame);
  expect(stats.uniqueColors, label).toBeGreaterThanOrEqual(4);
  expect(stats.dominantColorShare, label).toBeLessThan(0.9);
}

/** Pixels of `color` inside a rectangle of a 640x360 frame. */
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
    for (const setup of BLUEPRINT_SETUPS) {
      const manifest = blueprintManifest(setup);
      samples.push(await measure(server, backend, `blueprint:${setup}`, manifest, PERF_FRAMES));
    }
    await record(path.join(KIT_OUT_DIR, 'perf', 'look-blueprint.json'), samples);
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

describe('look blueprint (SwiftShader)', () => {
  it('every setup passes the determinism lint', () => {
    for (const setup of BLUEPRINT_SETUPS) {
      expect(lintScene(blueprintSource(setup), { filename: 'look-blueprint.js' }), setup).toEqual(
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
          const info = await page.load(blueprintManifest(setup));
          for (const t of times) {
            const data = await page.frameAt(t);
            const frame = { width: info.width, height: info.height, data };
            const label = `${setup}-t${String(t)}`;
            expectPicture(data, label);
            expectVibe(frame, label);
            tiles.push(downscale(frame, 2, 'nearest'));
            await compareWithGolden(`look-blueprint-${label}`, frame, undefined, {
              goldenDir: KIT_GOLDEN_DIR,
            });
          }
        }
        expect(page.errors).toEqual([]);
      });
      await writeSheet('look-blueprint-voxel-pixel-crisp640', tiles, 4);
    },
    SUITE_TIMEOUT,
  );

  it(
    'reveals the CSV bars on their spoken phrases',
    async () => {
      await withPage(async (page) => {
        await page.load(blueprintManifest('csv'));
        // Crisp 640 brightTeal: the bars (centres ~105 + 114.5 i px, plot y 70..315); each bar's
        // column gains teal pixels once its phrase is spoken.
        const teal = 0x2ec4b6;
        const columns = CSV_REVEALS.map(
          (_, index) => [Math.round(75 + index * 114.5), 70, 60, 245] as const,
        );
        for (const [index, spoken] of CSV_REVEALS.entries()) {
          const before = await page.frameAt(spoken - 0.05);
          const after = await page.frameAt(spoken + 0.4);
          const column = columns[index] ?? columns[0];
          if (!column) throw new Error('no column');
          expect(countColor(before, column, teal), `bar ${String(index)} before`).toBeLessThan(10);
          expect(countColor(after, column, teal), `bar ${String(index)} after`).toBeGreaterThan(
            200,
          );
        }
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
        for (const setup of BLUEPRINT_SETUPS) {
          await page.load(blueprintManifest(setup));
          const forward: string[] = [];
          for (const t of times) forward.push(await page.hashAt(t));
          const backward: string[] = [];
          for (const t of [...times].reverse()) backward.push(await page.hashAt(t));
          expect(backward.reverse(), setup).toEqual(forward);
          expect(new Set(forward).size, setup).toBe(times.length);
          await page.load(blueprintManifest(setup));
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
        for (const setup of BLUEPRINT_SETUPS) {
          const info = await page.load(blueprintManifest(setup, style));
          const data = await page.frameAt(4);
          const frame = { width: info.width, height: info.height, data };
          expectPicture(data, `${style} ${setup}`);
          expectVibe(frame, `${style} ${setup}`, style);
          tiles.push(frame);
        }
        expect(page.errors).toEqual([]);
      });
      await writeSheet(`look-blueprint-${style}`, tiles, 4);
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
