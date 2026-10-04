/**
 * Environments (PLAN.md#3.2) in the engine harness (SwiftShader): every setup of
 * examples/k03_envs.js at t = 0 and t = 4 in all three style presets, tiled into contact sheets
 * (packages/kit/out/contact/envs-<style>.png, 2 setups per row: t0 | t4 | t0 | t4, in ENV_SETUPS
 * order), plus goldens of three setups in Voxel Pixel Crisp 640 and a seek determinism check.
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
import { expectVibe } from '../support/vibe.js';
import {
  ENV_SETUPS,
  ENVS_FILE,
  envSource,
  KIT_GOLDEN_DIR,
  KIT_OUT_DIR,
  sceneManifest,
  sceneSource,
  type EnvSetup,
} from '../support/scenes.js';

const TIMES = [0, 4] as const;
const STYLES = ['voxel-pixel-crisp640', 'noir-voxel', 'soft-480'] as const;
const GOLDENS: readonly (readonly [EnvSetup, number])[] = [
  ['neonGridViolet', 2],
  ['void', 2],
  ['room', 0],
];
const SHEET_TIMEOUT = 300_000;

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

function manifest(setup: EnvSetup, style?: string) {
  const options = style === undefined ? {} : { style };
  return sceneManifest(ENVS_FILE, { ...options, source: envSource(setup) });
}

/** Not blank and not (almost) a single flat colour; furniture on a flat background is ~75 %. */
function expectPicture(frame: Uint8Array, label: string): void {
  const stats = computeFrameStats(frame);
  expect(stats.uniqueColors, label).toBeGreaterThanOrEqual(4);
  expect(stats.dominantColorShare, label).toBeLessThan(0.88);
}

describe('kit environments (SwiftShader)', () => {
  it('k03_envs passes the determinism lint in every setup', () => {
    expect(lintScene(sceneSource(ENVS_FILE), { filename: ENVS_FILE })).toEqual([]);
    for (const setup of ENV_SETUPS) {
      expect(lintScene(envSource(setup), { filename: ENVS_FILE }), setup).toEqual([]);
    }
  });

  it('animated environments seek deterministically in both directions', async () => {
    await withPage(async (page) => {
      for (const setup of ['neonGridTeal', 'void'] as const) {
        await page.load(manifest(setup));
        const times = [0, 1.5, 4];
        const forward = [];
        for (const t of times) forward.push(await page.hashAt(t));
        const backward = [];
        for (const t of [...times].reverse()) backward.push(await page.hashAt(t));
        expect(backward.reverse(), setup).toEqual(forward);
        expect(new Set(forward).size, setup).toBe(times.length);
      }
      expect(page.errors).toEqual([]);
    });
  });

  it('matches the environment goldens (Crisp 640)', async () => {
    await withPage(async (page) => {
      for (const [setup, t] of GOLDENS) {
        await page.load(manifest(setup));
        const data = await page.frameAt(t);
        expectPicture(data, setup);
        expectVibe({ width: 640, height: 360, data }, setup);
        await compareWithGolden(
          `kit-env-${setup}-t${String(t)}`,
          { width: 640, height: 360, data },
          undefined,
          { goldenDir: KIT_GOLDEN_DIR },
        );
      }
      expect(page.errors).toEqual([]);
    });
  });

  it.each(STYLES)(
    'renders the contact sheet of every environment in %s',
    async (style) => {
      const tiles: (RgbaImage & { readonly label: string; readonly name: string })[] = [];
      const errors = await withPage(async (page) => {
        for (const setup of ENV_SETUPS) {
          const info = await page.load(manifest(setup, style));
          for (const t of TIMES) {
            const data = await page.frameAt(t);
            const label = `${style} ${setup} t=${String(t)}`;
            const name = `${setup}-t${String(t)}`;
            tiles.push({ width: info.width, height: info.height, data, label, name });
          }
        }
        return [...page.errors];
      });
      // Written before the checks, so a failing sheet can be looked at.
      const file = path.join(KIT_OUT_DIR, 'contact', `envs-${style}.png`);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, encodePng(composeSheet(tiles, TIMES.length * 2)));
      const tileDir = path.join(KIT_OUT_DIR, 'contact', style);
      await mkdir(tileDir, { recursive: true });
      for (const tile of tiles) {
        await writeFile(path.join(tileDir, `${tile.name}.png`), encodePng(tile));
      }
      expect(errors).toEqual([]);
      for (const tile of tiles) expectPicture(tile.data, tile.label);
    },
    SHEET_TIMEOUT,
  );
});
