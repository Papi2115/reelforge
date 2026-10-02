/**
 * World props (PLAN.md#3.3, batch B) in the engine harness (SwiftShader): every setup of
 * examples/k06_world.js (character clips, outfits, street vehicles, the 200-person city) passes
 * the determinism lint, moves over time, seeks deterministically in both directions and renders
 * in all three styles (contact sheets packages/kit/out/contact/world-<style>.png); one small
 * golden: four setups at half resolution.
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
import { downscale } from '../support/image.js';
import {
  KIT_GOLDEN_DIR,
  KIT_OUT_DIR,
  sceneManifest,
  WORLD_FILE,
  WORLD_SETUPS,
  worldSource,
  type WorldSetup,
} from '../support/scenes.js';

const TIMES = [0, 1.5, 3] as const;
const GOLDEN_SETUPS: readonly WorldSetup[] = ['poses', 'seated', 'variants', 'city'];
const GOLDEN_TIME = 1.5;
const OTHER_STYLES = ['noir-voxel', 'soft-480'] as const;
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

function manifest(setup: WorldSetup, style?: string) {
  const options = style === undefined ? {} : { style };
  return sceneManifest(WORLD_FILE, { ...options, source: worldSource(setup) });
}

function pictureProblems(frame: Uint8Array, label: string): string[] {
  const stats = computeFrameStats(frame);
  const problems: string[] = [];
  if (stats.uniqueColors < 4) problems.push(`${label}: ${String(stats.uniqueColors)} colours`);
  if (stats.dominantColorShare >= 0.9) problems.push(`${label}: almost blank`);
  return problems;
}

async function writeSheet(name: string, tiles: readonly RgbaImage[], columns: number) {
  const file = path.join(KIT_OUT_DIR, 'contact', `${name}.png`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, encodePng(composeSheet(tiles, columns)));
}

describe('kit world props (SwiftShader)', () => {
  it('k06_world passes the determinism lint for every setup', () => {
    for (const setup of WORLD_SETUPS) {
      expect(lintScene(worldSource(setup), { filename: WORLD_FILE }), setup).toEqual([]);
    }
  });

  it(
    'animates every setup and seeks deterministically (contact sheet, Crisp 640)',
    async () => {
      const tiles: RgbaImage[] = [];
      const failures: string[] = [];
      const errors = await withPage(async (page) => {
        for (const setup of WORLD_SETUPS) {
          const info = await page.load(manifest(setup));
          const forward: string[] = [];
          for (const t of TIMES) {
            const data = await page.frameAt(t);
            tiles.push(downscale({ width: info.width, height: info.height, data }, 2, 'nearest'));
            failures.push(...pictureProblems(data, `${setup} t=${String(t)}`));
            forward.push(await page.hashAt(t));
          }
          const backward: string[] = [];
          for (const t of [...TIMES].reverse()) backward.push(await page.hashAt(t));
          if (backward.reverse().join() !== forward.join())
            failures.push(`${setup}: seek mismatch`);
          if (new Set(forward).size !== TIMES.length) failures.push(`${setup}: frozen`);
        }
        return [...page.errors];
      });
      await writeSheet('world-voxel-pixel-crisp640', tiles, TIMES.length);
      expect(errors).toEqual([]);
      expect(failures).toEqual([]);
    },
    SUITE_TIMEOUT,
  );

  it(
    'matches the world golden sheet (four setups, half resolution)',
    async () => {
      const tiles: RgbaImage[] = [];
      await withPage(async (page) => {
        for (const setup of GOLDEN_SETUPS) {
          const info = await page.load(manifest(setup));
          const data = await page.frameAt(GOLDEN_TIME);
          tiles.push(downscale({ width: info.width, height: info.height, data }, 2, 'nearest'));
        }
        expect(page.errors).toEqual([]);
      });
      await compareWithGolden('kit-world-sheet', composeSheet(tiles, 2), undefined, {
        goldenDir: KIT_GOLDEN_DIR,
      });
    },
    SUITE_TIMEOUT,
  );

  it.each(OTHER_STYLES)(
    'renders every setup in %s',
    async (style) => {
      const tiles: RgbaImage[] = [];
      const failures: string[] = [];
      const errors = await withPage(async (page) => {
        for (const setup of WORLD_SETUPS) {
          const info = await page.load(manifest(setup, style));
          const data = await page.frameAt(GOLDEN_TIME);
          failures.push(...pictureProblems(data, `${style} ${setup}`));
          tiles.push({ width: info.width, height: info.height, data });
        }
        return [...page.errors];
      });
      await writeSheet(`world-${style}`, tiles, 3);
      expect(errors).toEqual([]);
      expect(failures).toEqual([]);
    },
    SUITE_TIMEOUT,
  );
});
