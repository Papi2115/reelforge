/**
 * Assets as scene elements (PLAN.md#12.11) in the engine harness (SwiftShader): the synthetic
 * test photo embedded in three looks (voxel frame, polaroid, laptop/monitor, billboard; retro-ui
 * newspaper + CRT; diorama billboard and office screen). Every setup passes the lint, seeks
 * deterministically and keeps the style (vibe guard) in all three styles; goldens `asset-*` (one
 * per setup). Contact sheet: packages/kit/out/contact/assets.png. Also: a video without assets
 * renders exactly as before, and an unknown asset id fails the load with the known ids.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testCardManifestAsset } from '../../../engine/src/assets/testing/test-card.js';
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
  KIT_GOLDEN_DIR,
  KIT_OUT_DIR,
  sceneManifest,
  sceneSource,
  type RenderManifest,
} from '../support/scenes.js';
import { expectVibe } from '../support/vibe.js';

const FILE = 'examples/k10_assets.js';
const SETUPS = ['wall', 'laptop', 'billboard', 'retro', 'diorama', 'office'] as const;
type Setup = (typeof SETUPS)[number];
const GOLDENS: readonly (readonly [Setup, number])[] = [
  ['wall', 3.5],
  ['laptop', 2.5],
  ['billboard', 2],
  ['retro', 2.5],
  ['diorama', 1],
  ['office', 1],
];
const SHEET_TIMES = [0.2, 1.2, 3] as const;
const OTHER_STYLES = ['noir-voxel', 'soft-480'] as const;
const SUITE_TIMEOUT = 400_000;

function setupSource(setup: Setup): string {
  const source = sceneSource(FILE);
  const declaration = "const SETUP = 'wall';";
  if (!source.includes(declaration)) throw new Error(`${FILE} no longer declares ${declaration}`);
  return source.replace(declaration, `const SETUP = '${setup}';`);
}

function manifest(setup: Setup, style?: string): RenderManifest {
  const options = style === undefined ? {} : { style };
  return {
    ...sceneManifest(FILE, { ...options, source: setupSource(setup), duration: 5 }),
    assets: [testCardManifestAsset('test-card')],
  };
}

/** Not blank and not (almost) a single flat colour. */
function expectPicture(frame: Uint8Array, label: string): void {
  const stats = computeFrameStats(frame);
  expect(stats.uniqueColors, label).toBeGreaterThanOrEqual(6);
  expect(stats.dominantColorShare, label).toBeLessThan(0.85);
}

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

type Tile = RgbaImage & { readonly name: string };

async function writeSheet(name: string, tiles: readonly Tile[], columns: number): Promise<void> {
  const directory = path.join(KIT_OUT_DIR, 'contact');
  await mkdir(path.join(directory, name), { recursive: true });
  await writeFile(path.join(directory, `${name}.png`), encodePng(composeSheet(tiles, columns)));
  for (const tile of tiles) {
    await writeFile(path.join(directory, name, `${tile.name}.png`), encodePng(tile));
  }
}

describe('assets in scenes (SwiftShader)', () => {
  it('every setup passes the determinism lint', () => {
    for (const setup of SETUPS) {
      expect(lintScene(setupSource(setup), { filename: FILE }), setup).toEqual([]);
    }
  });

  it(
    'renders the same frame for the same t, in any seek order',
    async () => {
      await withPage(async (page) => {
        const times = [0.3, 1.4, 2.6];
        for (const setup of SETUPS) {
          await page.load(manifest(setup));
          const forward: string[] = [];
          for (const t of times) forward.push(await page.hashAt(t));
          const backward: string[] = [];
          for (const t of [...times].reverse()) backward.push(await page.hashAt(t));
          expect(backward.reverse(), setup).toEqual(forward);
        }
        expect(page.errors).toEqual([]);
      });
    },
    SUITE_TIMEOUT,
  );

  it(
    'renders the contact sheet; every frame keeps the style (vibe guard)',
    async () => {
      const tiles: Tile[] = [];
      const errors = await withPage(async (page) => {
        for (const setup of SETUPS) {
          const info = await page.load(manifest(setup));
          for (const t of SHEET_TIMES) {
            const data = await page.frameAt(t);
            tiles.push({
              width: info.width,
              height: info.height,
              data,
              name: `${setup}-t${String(t)}`,
            });
          }
        }
        return [...page.errors];
      });
      await writeSheet('assets', tiles, SHEET_TIMES.length);
      expect(errors).toEqual([]);
      for (const tile of tiles) {
        expectVibe(tile, tile.name);
        expectPicture(tile.data, tile.name);
      }
    },
    SUITE_TIMEOUT,
  );

  it(
    'matches the goldens (one per setup, Crisp 640, full resolution)',
    async () => {
      await withPage(async (page) => {
        for (const [setup, t] of GOLDENS) {
          const info = await page.load(manifest(setup));
          const frame = { width: info.width, height: info.height, data: await page.frameAt(t) };
          expectVibe(frame, `${setup} t=${String(t)}`);
          expectPicture(frame.data, setup);
          await compareWithGolden(`asset-${setup}-t${String(t)}`, frame, undefined, {
            goldenDir: KIT_GOLDEN_DIR,
          });
        }
        expect(page.errors).toEqual([]);
      });
    },
    SUITE_TIMEOUT,
  );

  it.each(OTHER_STYLES)(
    'keeps the %s style in every setup',
    async (style) => {
      const tiles: Tile[] = [];
      const errors = await withPage(async (page) => {
        for (const setup of SETUPS) {
          const info = await page.load(manifest(setup, style));
          const data = await page.frameAt(3);
          tiles.push({ width: info.width, height: info.height, data, name: setup });
        }
        return [...page.errors];
      });
      await writeSheet(`assets-${style}`, tiles, 3);
      expect(errors).toEqual([]);
      for (const tile of tiles) expectVibe(tile, `${style} ${tile.name}`, style);
    },
    SUITE_TIMEOUT,
  );

  it(
    'leaves a video without asset references exactly as before',
    async () => {
      await withPage(async (page) => {
        const plain = sceneManifest('examples/k01_voxel_demo.js');
        await page.load(plain);
        const before = await page.hashAt(1.5);
        await page.load({ ...plain, assets: [testCardManifestAsset('test-card')] });
        expect(await page.hashAt(1.5)).toBe(before);
      });
    },
    SUITE_TIMEOUT,
  );

  it(
    'fails the load of an unknown asset id with the ids the video carries',
    async () => {
      await withPage(async (page) => {
        const source = setupSource('wall').replace(
          "const PHOTO = 'test-card';",
          "const PHOTO = 'nasa-x';",
        );
        const attempt = page.load({
          ...sceneManifest(FILE, { source }),
          assets: [testCardManifestAsset('test-card')],
        });
        await expect(attempt).rejects.toThrow(/no such asset in this video \(known: test-card\)/);
      });
    },
    SUITE_TIMEOUT,
  );
});
