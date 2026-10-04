/**
 * Character pack (ADR-024) in the engine harness (SwiftShader): every setup of cast-scenes.ts
 * passes the determinism lint and seeks deterministically in both directions; goldens
 * (`character-*`, Crisp 640, vibe guard on every frame): the four mascots in four poses, the
 * seven expressions close up (contact sheet), the ten cast members calm and posed, the mannequin
 * and two role-spec examples (firefighter, chef) next to the engineer; the pack renders in Noir
 * and Soft 480 in palette. Contact sheets: packages/kit/out/contact/character-*.png. Perf
 * (packages/kit/out/perf/characters.json): SwiftShader floor always, 30 fps on the hardware GPU
 * with REELFORGE_KIT_PERF_GPU=1 (four characters walking).
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
import { CAST_FILE, CAST_SETUPS, castManifest, castSource, type CastSetup } from './cast-scenes.js';

/** Full-resolution goldens: setup -> times. */
const GOLDENS: readonly (readonly [CastSetup, readonly number[]])[] = [
  ['mascots', [1.2, 3, 5.5, 9]],
  ['cast', [1.5, 3.2]],
  ['mannequin', [1, 4.5]],
  ['roles', [1.5, 3.4]],
];
/** One frame per expression (cues every 0.5 s). */
const FACE_TIMES = [0.3, 0.8, 1.3, 1.8, 2.3, 2.8, 3.3] as const;
const OTHER_STYLES = ['noir-voxel', 'soft-480'] as const;
const STYLE_SETUPS: readonly CastSetup[] = ['mascots', 'cast', 'roles'];
const PERF_FRAMES = 30;
const MIN_FPS = 30;
/** SwiftShader is CPU-bound and machine-dependent: an informational floor, like the looks. */
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

function expectPicture(frame: Uint8Array, label: string): void {
  const stats = computeFrameStats(frame);
  expect(stats.uniqueColors, label).toBeGreaterThanOrEqual(8);
  expect(stats.dominantColorShare, label).toBeLessThan(0.9);
}

async function writeSheet(name: string, tiles: readonly RgbaImage[], columns: number) {
  const file = path.join(KIT_OUT_DIR, 'contact', `${name}.png`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, encodePng(composeSheet(tiles, columns)));
}

describe('character pack (SwiftShader)', () => {
  it('every setup passes the determinism lint', () => {
    for (const setup of CAST_SETUPS) {
      expect(lintScene(castSource(setup), { filename: CAST_FILE }), setup).toEqual([]);
    }
  });

  it(
    'matches the goldens (Crisp 640, full resolution) and keeps the vibe',
    async () => {
      const tiles: RgbaImage[] = [];
      await withPage(async (page) => {
        for (const [setup, times] of GOLDENS) {
          const info = await page.load(castManifest(setup));
          for (const t of times) {
            const data = await page.frameAt(t);
            const frame = { width: info.width, height: info.height, data };
            const label = `${setup}-t${String(t)}`;
            tiles.push(downscale(frame, 2, 'nearest'));
            expectPicture(data, label);
            expectVibe(frame, label);
            await compareWithGolden(`character-${label}`, frame, undefined, {
              goldenDir: KIT_GOLDEN_DIR,
            });
          }
        }
        expect(page.errors).toEqual([]);
      });
      await writeSheet('character-voxel-pixel-crisp640', tiles, 4);
    },
    SUITE_TIMEOUT,
  );

  it(
    'shows the seven expressions on every mascot (contact sheet golden)',
    async () => {
      const tiles: RgbaImage[] = [];
      await withPage(async (page) => {
        const info = await page.load(castManifest('faces'));
        for (const t of FACE_TIMES) {
          const data = await page.frameAt(t);
          const frame = { width: info.width, height: info.height, data };
          expectVibe(frame, `faces t=${String(t)}`);
          tiles.push(downscale(frame, 2, 'nearest'));
        }
        const hashes = new Set<string>();
        for (const t of FACE_TIMES) hashes.add(await page.hashAt(t));
        expect(hashes.size).toBe(FACE_TIMES.length);
        expect(page.errors).toEqual([]);
      });
      const sheet = composeSheet(tiles, 4);
      await compareWithGolden('character-expressions-sheet', sheet, undefined, {
        goldenDir: KIT_GOLDEN_DIR,
      });
      await writeSheet('character-expressions', tiles, 4);
    },
    SUITE_TIMEOUT,
  );

  it(
    'animates and seeks deterministically in both directions (any order, reload)',
    async () => {
      await withPage(async (page) => {
        const times = [0.4, 2.6, 5.2, 7.9];
        for (const setup of CAST_SETUPS) {
          await page.load(castManifest(setup));
          const forward: string[] = [];
          for (const t of times) forward.push(await page.hashAt(t));
          const backward: string[] = [];
          for (const t of [...times].reverse()) backward.push(await page.hashAt(t));
          expect(backward.reverse(), setup).toEqual(forward);
          expect(new Set(forward).size, setup).toBe(times.length);
          await page.load(castManifest(setup));
          expect(await page.hashAt(times[2] ?? 0), `${setup} reload`).toBe(forward[2]);
        }
        expect(page.errors).toEqual([]);
      });
    },
    SUITE_TIMEOUT,
  );

  it.each(OTHER_STYLES)(
    'renders the pack in %s (in palette)',
    async (style) => {
      const tiles: RgbaImage[] = [];
      await withPage(async (page) => {
        for (const setup of STYLE_SETUPS) {
          const info = await page.load(castManifest(setup, style));
          const data = await page.frameAt(3);
          const frame = { width: info.width, height: info.height, data };
          expectPicture(data, `${style} ${setup}`);
          expectVibe(frame, `${style} ${setup}`, style);
          tiles.push(info.width === 640 ? downscale(frame, 2, 'nearest') : frame);
        }
        expect(page.errors).toEqual([]);
      });
      await writeSheet(`character-${style}`, tiles, 3);
    },
    SUITE_TIMEOUT,
  );
});

describe('character pack performance', () => {
  it(
    'four characters walking: SwiftShader floor and GPU preview budget',
    async () => {
      const server = await startStaticServer(await buildHarness());
      try {
        const results = path.join(KIT_OUT_DIR, 'perf', 'characters.json');
        const samples: PerfSample[] = [
          await measure(server, 'swiftshader', 'cast:walk', castManifest('walk'), PERF_FRAMES),
        ];
        expect(samples[0]?.fps ?? 0).toBeGreaterThan(SWIFTSHADER_MIN_FPS);
        if (GPU_PERF_ENABLED) {
          const gpu = await measure(server, 'gpu', 'cast:walk', castManifest('walk'));
          samples.push(gpu);
          expect(gpu.renderer).not.toMatch(/SwiftShader/);
          expect(gpu.fps).toBeGreaterThanOrEqual(MIN_FPS);
        }
        await record(results, samples);
      } finally {
        await server.close();
      }
    },
    SUITE_TIMEOUT,
  );
});
