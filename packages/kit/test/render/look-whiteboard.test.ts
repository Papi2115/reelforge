/**
 * Look `whiteboard` (PLAN.md#12.7) in the engine harness (SwiftShader): every template setup
 * passes the determinism lint, seeks deterministically, renders in every style, and matches its
 * full-resolution goldens (`look-whiteboard-*`, Crisp 640) with the vibe guard on every frame.
 * The sketch scene is checked at three times (a half-drawn stroke sequence) and its strokes start
 * on their spoken phrases. Contact sheets: packages/kit/out/contact/look-whiteboard-<style>.png.
 * Perf (full seek path, packages/kit/out/perf/look-whiteboard.json): SwiftShader floor always,
 * 30 fps on the hardware GPU with REELFORGE_KIT_PERF_GPU=1.
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
  SKETCH_CUES,
  WHITEBOARD_SETUPS,
  whiteboardManifest,
  whiteboardSource,
  type WhiteboardSetup,
} from './look-whiteboard-scenes.js';

const STYLES = ['voxel-pixel-crisp640', 'noir-voxel', 'soft-480'] as const;
/** Golden frames: setup -> times (the sketch half drawn at three points of its narration). */
const GOLDENS: readonly (readonly [WhiteboardSetup, readonly number[]])[] = [
  ['sketch', [1.5, 3.1, 8.5]],
  ['doodles', [8.5]],
  ['text', [2.1, 8.5]],
  ['flow', [8.5]],
  ['timeline', [2.5, 8.5]],
  ['equation', [8.5]],
  ['counter', [2.3, 8.5]],
  ['board', [8.5]],
  ['erase', [2.7, 8.5]],
  ['hybrid', [4]],
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

/** A whiteboard: board, frame and ink colours; the board may cover most of the frame. */
function expectPicture(frame: Uint8Array, label: string): void {
  const stats = computeFrameStats(frame);
  expect(stats.uniqueColors, label).toBeGreaterThanOrEqual(4);
  expect(stats.dominantColorShare, label).toBeLessThan(0.97);
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
    for (const setup of WHITEBOARD_SETUPS) {
      const manifest = whiteboardManifest(setup);
      samples.push(await measure(server, backend, `whiteboard:${setup}`, manifest, PERF_FRAMES));
    }
    await record(path.join(KIT_OUT_DIR, 'perf', 'look-whiteboard.json'), samples);
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

describe('look whiteboard (SwiftShader)', () => {
  it('every setup passes the determinism lint', () => {
    for (const setup of WHITEBOARD_SETUPS) {
      expect(lintScene(whiteboardSource(setup), { filename: 'look-whiteboard.js' }), setup).toEqual(
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
          const info = await page.load(whiteboardManifest(setup));
          for (const t of times) {
            const data = await page.frameAt(t);
            const frame = { width: info.width, height: info.height, data };
            const label = `${setup}-t${String(t)}`;
            expectPicture(data, label);
            expectVibe(frame, label);
            tiles.push(downscale(frame, 2, 'nearest'));
            await compareWithGolden(`look-whiteboard-${label}`, frame, undefined, {
              goldenDir: KIT_GOLDEN_DIR,
            });
          }
        }
        expect(page.errors).toEqual([]);
      });
      await writeSheet('look-whiteboard-voxel-pixel-crisp640', tiles, 4);
    },
    SUITE_TIMEOUT,
  );

  it(
    'starts the sketch strokes on their spoken phrases',
    async () => {
      await withPage(async (page) => {
        await page.load(whiteboardManifest('sketch'));
        // Crisp 640 inks: the bulb (black) left, the arrow (burntOrange) middle, the gear (teal)
        // right; each region gains its ink once its phrase is spoken.
        const regions = [
          [125, 95, 130, 120, 0x05060f],
          [265, 140, 110, 40, 0xc75a24],
          [390, 100, 120, 120, 0x1f6f8b],
        ] as const;
        for (const [index, spoken] of SKETCH_CUES.entries()) {
          const region = regions[index];
          if (!region) throw new Error('no region');
          const [x, y, width, height, ink] = region;
          // The hand passing over a region may dither a few pixels into an ink colour; its black
          // outline arrives with it (0.45 s before the first stroke).
          const lead = ink === 0x05060f ? 0.5 : 0.05;
          const before = countColor(await page.frameAt(spoken - lead), [x, y, width, height], ink);
          const after = countColor(await page.frameAt(spoken + 0.6), [x, y, width, height], ink);
          expect(after, `stroke ${String(index)} after`).toBeGreaterThan(60);
          expect(before, `stroke ${String(index)} before`).toBeLessThan(Math.max(10, after * 0.1));
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
        const times = [0.7, 1.9, 3.1];
        for (const setup of WHITEBOARD_SETUPS) {
          await page.load(whiteboardManifest(setup));
          const forward: string[] = [];
          for (const t of times) forward.push(await page.hashAt(t));
          const backward: string[] = [];
          for (const t of [...times].reverse()) backward.push(await page.hashAt(t));
          expect(backward.reverse(), setup).toEqual(forward);
          expect(new Set(forward).size, setup).toBe(times.length);
          await page.load(whiteboardManifest(setup));
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
        for (const setup of WHITEBOARD_SETUPS) {
          const info = await page.load(whiteboardManifest(setup, style));
          const data = await page.frameAt(4);
          const frame = { width: info.width, height: info.height, data };
          expectPicture(data, `${style} ${setup}`);
          expectVibe(frame, `${style} ${setup}`, style);
          tiles.push(frame);
        }
        expect(page.errors).toEqual([]);
      });
      await writeSheet(`look-whiteboard-${style}`, tiles, 4);
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
