/**
 * Look retro-ui (PLAN.md#12.2) in the engine harness (SwiftShader): every setup of
 * examples/look_retro_ui.js passes the determinism lint, seeks deterministically (the same t twice
 * and in both directions gives the same frame) and passes the vibe guard (every pixel a style
 * colour) on every rendered frame, in all three styles. Goldens: one full-resolution frame per
 * template plus the composite (`look-retro-ui-*`). Contact sheet:
 * packages/kit/out/contact/look-retro-ui.png (full-size tiles in out/contact/look-retro-ui/).
 * Performance: the full seek path per setup (SwiftShader informational; the hardware GPU must
 * hold the 30 fps preview budget with REELFORGE_KIT_PERF_GPU=1).
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
import { GPU_PERF_ENABLED, measure, record, type PerfSample } from '../support/perf.js';
import {
  KIT_GOLDEN_DIR,
  KIT_OUT_DIR,
  sceneManifest,
  sceneSource,
  type RenderManifest,
} from '../support/scenes.js';
import { expectVibe } from '../support/vibe.js';

const FILE = 'examples/look_retro_ui.js';
const SETUPS = [
  'window',
  'progress',
  'terminal',
  'browser',
  'newspaper',
  'dossier',
  'crt',
  'composite',
] as const;
type Setup = (typeof SETUPS)[number];
const GOLDENS: readonly (readonly [Setup, number])[] = [
  ['window', 2.45],
  ['terminal', 3.8],
  ['browser', 3.1],
  ['newspaper', 2.2],
  ['dossier', 2.8],
  ['crt', 4.5],
  ['composite', 3.2],
];
const SHEET_TIMES = [0.5, 1.5, 2.5, 4] as const;
const OTHER_STYLES = ['noir-voxel', 'soft-480'] as const;
const PERF_FRAMES = 8;
const SWIFTSHADER_MIN_FPS = 1;
const PREVIEW_FPS = 30;
const SUITE_TIMEOUT = 400_000;

function setupSource(setup: Setup): string {
  const source = sceneSource(FILE);
  const declaration = "const SETUP = 'window';";
  if (!source.includes(declaration)) throw new Error(`${FILE} no longer declares ${declaration}`);
  return source.replace(declaration, `const SETUP = '${setup}';`);
}

function manifest(setup: Setup, style?: string): RenderManifest {
  const options = style === undefined ? {} : { style };
  return sceneManifest(FILE, { ...options, source: setupSource(setup) });
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

describe('look retro-ui (SwiftShader)', () => {
  it('every setup passes the determinism lint', () => {
    for (const setup of SETUPS) {
      expect(lintScene(setupSource(setup), { filename: FILE }), setup).toEqual([]);
    }
  });

  it(
    'renders the same frame for the same t, in any seek order',
    async () => {
      await withPage(async (page) => {
        const times = [0.4, 1.7, 3.1];
        for (const setup of SETUPS) {
          await page.load(manifest(setup));
          const forward: string[] = [];
          for (const t of times) forward.push(await page.hashAt(t));
          expect(await page.hashAt(times[1] ?? 0), setup).toBe(forward[1]);
          const backward: string[] = [];
          for (const t of [...times].reverse()) backward.push(await page.hashAt(t));
          expect(backward.reverse(), setup).toEqual(forward);
          expect(new Set(forward).size, `${setup} animates`).toBeGreaterThan(1);
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
      await writeSheet('look-retro-ui', tiles, SHEET_TIMES.length);
      expect(errors).toEqual([]);
      for (const tile of tiles) {
        expectVibe(tile, tile.name);
        expectPicture(tile.data, tile.name);
      }
    },
    SUITE_TIMEOUT,
  );

  it(
    'matches the goldens (one per template + composite, Crisp 640, full resolution)',
    async () => {
      await withPage(async (page) => {
        for (const [setup, t] of GOLDENS) {
          const info = await page.load(manifest(setup));
          const frame = { width: info.width, height: info.height, data: await page.frameAt(t) };
          expectVibe(frame, `${setup} t=${String(t)}`);
          expectPicture(frame.data, setup);
          await compareWithGolden(`look-retro-ui-${setup}-t${String(t)}`, frame, undefined, {
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
      await writeSheet(`look-retro-ui-${style}`, tiles, 4);
      expect(errors).toEqual([]);
      for (const tile of tiles) expectVibe(tile, `${style} ${tile.name}`, style);
    },
    SUITE_TIMEOUT,
  );
});

describe('look retro-ui performance', () => {
  const resultsFile = path.join(KIT_OUT_DIR, 'perf', 'look-retro-ui.json');

  async function measureAll(backend: PerfSample['backend'], frames?: number) {
    const server = await startStaticServer(await buildHarness());
    try {
      const samples: PerfSample[] = [];
      for (const setup of SETUPS) {
        samples.push(await measure(server, backend, `retro-ui:${setup}`, manifest(setup), frames));
      }
      await record(resultsFile, samples);
      return samples;
    } finally {
      await server.close();
    }
  }

  it(
    'SwiftShader: every setup (informational)',
    async () => {
      for (const sample of await measureAll('swiftshader', PERF_FRAMES)) {
        expect(sample.renderer).toMatch(/SwiftShader/);
        expect(sample.fps, sample.mode).toBeGreaterThan(SWIFTSHADER_MIN_FPS);
      }
    },
    SUITE_TIMEOUT,
  );

  it.runIf(GPU_PERF_ENABLED)(
    'hardware GPU: every setup holds the 30 fps preview budget',
    async () => {
      for (const sample of await measureAll('gpu')) {
        expect(sample.renderer, sample.mode).not.toMatch(/SwiftShader/);
        expect(sample.fps, sample.mode).toBeGreaterThanOrEqual(PREVIEW_FPS);
      }
    },
    SUITE_TIMEOUT,
  );
});
