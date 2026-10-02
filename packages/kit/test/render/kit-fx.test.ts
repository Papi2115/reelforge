/**
 * Effects and 3D infographics (PLAN.md#3.4) in the engine harness (SwiftShader): every setup of
 * the k05_fx_* examples passes the determinism lint, seeks deterministically in both directions
 * and renders a picture in all three styles; contact sheets go to
 * packages/kit/out/contact/fx-<style>.png (Crisp 640: two times per setup, full-size tiles in
 * out/contact/fx/); eight half-resolution goldens cover one representative frame per effect group.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  compareWithGolden,
  computeFrameStats,
  encodePng,
  launchHarnessBrowser,
  type HarnessBrowser,
  type HarnessPage,
  type RgbaImage,
} from '../../../engine/src/cli/index.js';
import { lintScene } from '../../../engine/src/index.js';
import { composeSheet } from '../support/contact-sheet.js';
import {
  FX_FILES,
  FX_SETUPS,
  fxManifest,
  fxSource,
  type FxFile,
  type FxSetup,
} from '../support/fx-scenes.js';
import { downscale } from '../support/image.js';
import { KIT_GOLDEN_DIR, KIT_OUT_DIR, sceneSource } from '../support/scenes.js';

const DEFAULT_STYLE = 'voxel-pixel-crisp640';
const OTHER_STYLES = ['noir-voxel', 'soft-480'] as const;
const SHEET_TIMES = [1.2, 4] as const;
const GOLDENS: readonly (readonly [FxFile, FxSetup, number])[] = [
  ['examples/k05_fx_objects.js', 'shards', 1.35],
  ['examples/k05_fx_objects.js', 'dissolve', 2],
  ['examples/k05_fx_counter.js', 'counter', 1.2],
  ['examples/k05_fx_counter.js', 'screen', 1.2],
  ['examples/k05_fx_charts.js', 'bars', 4],
  ['examples/k05_fx_charts.js', 'graph', 4],
  ['examples/k05_fx_charts.js', 'timeline', 4],
  ['examples/k05_fx_map.js', 'europe', 4.5],
];
const SUITE_TIMEOUT = 400_000;

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

/** Not blank and not (almost) a single flat colour. */
function expectPicture(frame: Uint8Array, label: string): void {
  const stats = computeFrameStats(frame);
  expect(stats.uniqueColors, label).toBeGreaterThanOrEqual(4);
  expect(stats.dominantColorShare, label).toBeLessThan(0.9);
}

type Tile = RgbaImage & { readonly label: string; readonly name: string };

async function writeSheet(style: string, tiles: readonly Tile[], columns: number): Promise<void> {
  const file = path.join(KIT_OUT_DIR, 'contact', `fx-${style}.png`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, encodePng(composeSheet(tiles, columns)));
  if (style !== DEFAULT_STYLE) return;
  const tileDir = path.join(KIT_OUT_DIR, 'contact', 'fx');
  await mkdir(tileDir, { recursive: true });
  for (const tile of tiles)
    await writeFile(path.join(tileDir, `${tile.name}.png`), encodePng(tile));
}

describe('kit effects (SwiftShader)', () => {
  it('every effect example passes the determinism lint in every setup', () => {
    for (const file of FX_FILES) {
      expect(lintScene(sceneSource(file), { filename: file }), file).toEqual([]);
    }
    for (const [file, setup] of FX_SETUPS) {
      expect(lintScene(fxSource(file, setup), { filename: file }), setup).toEqual([]);
    }
  });

  it(
    'every setup seeks deterministically in both directions',
    async () => {
      await withPage(async (page) => {
        const times = [0.6, 1.5, 4];
        for (const [file, setup] of FX_SETUPS) {
          await page.load(fxManifest(file, setup));
          const forward = [];
          for (const t of times) forward.push(await page.hashAt(t));
          const backward = [];
          for (const t of [...times].reverse()) backward.push(await page.hashAt(t));
          expect(backward.reverse(), setup).toEqual(forward);
          expect(new Set(forward).size, setup).toBe(times.length);
        }
        expect(page.errors).toEqual([]);
      });
    },
    SUITE_TIMEOUT,
  );

  it(
    'matches the effect goldens (Crisp 640, half resolution)',
    async () => {
      await withPage(async (page) => {
        for (const [file, setup, t] of GOLDENS) {
          await page.load(fxManifest(file, setup));
          const data = await page.frameAt(t);
          expectPicture(data, setup);
          const half = downscale({ width: 640, height: 360, data }, 2, 'nearest');
          await compareWithGolden(`kit-fx-${setup}-t${String(t)}`, half, undefined, {
            goldenDir: KIT_GOLDEN_DIR,
          });
        }
        expect(page.errors).toEqual([]);
      });
    },
    SUITE_TIMEOUT,
  );

  it(
    'renders the contact sheet of every effect (Crisp 640)',
    async () => {
      const tiles: Tile[] = [];
      const errors = await withPage(async (page) => {
        for (const [file, setup] of FX_SETUPS) {
          const info = await page.load(fxManifest(file, setup));
          for (const t of SHEET_TIMES) {
            const data = await page.frameAt(t);
            const name = `${setup}-t${String(t)}`;
            tiles.push({ width: info.width, height: info.height, data, label: name, name });
          }
        }
        return [...page.errors];
      });
      // Written before the checks, so a failing sheet can be looked at.
      await writeSheet(DEFAULT_STYLE, tiles, SHEET_TIMES.length * 2);
      expect(errors).toEqual([]);
      for (const tile of tiles) expectPicture(tile.data, tile.label);
    },
    SUITE_TIMEOUT,
  );

  it.each(OTHER_STYLES)(
    'renders every effect in %s',
    async (style) => {
      const tiles: Tile[] = [];
      const errors = await withPage(async (page) => {
        for (const [file, setup] of FX_SETUPS) {
          const info = await page.load(fxManifest(file, setup, style));
          const data = await page.frameAt(4);
          tiles.push({ width: info.width, height: info.height, data, label: setup, name: setup });
        }
        return [...page.errors];
      });
      await writeSheet(style, tiles, 4);
      expect(errors).toEqual([]);
      for (const tile of tiles) expectPicture(tile.data, `${style} ${tile.label}`);
    },
    SUITE_TIMEOUT,
  );
});
