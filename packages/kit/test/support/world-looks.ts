/**
 * Render suite of a world look (PLAN.md#13.3, #13.6) in the engine harness (SwiftShader): its
 * template scenes pass the determinism lint, render the same pixels for the same t in any seek
 * order and after a reload, stay in the world's palette (vibe guard) and match their goldens
 * (`look-<look>-<scene>-t<t>`, at the world's resolution). Contact sheet:
 * packages/kit/out/contact/look-<look>.png.
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
import { sceneInkModules } from '../../../engine/src/cli/render-frames-modules.js';
import { lintScene } from '../../../engine/src/index.js';
import { composeSheet } from './contact-sheet.js';
import { downscale } from './image.js';
import {
  KIT_GOLDEN_DIR,
  KIT_OUT_DIR,
  kitFile,
  sceneManifest,
  sceneSource,
  type RenderManifest,
} from './scenes.js';
import { expectVibe } from './vibe.js';

const SUITE_TIMEOUT = 600_000;

/** Scene file, shot length, golden times (shot seconds, as the showcase stills). */
export type WorldScene = readonly [file: string, duration: number, times: readonly number[]];

export interface WorldSuite {
  /** The world's style id. */
  readonly style: string;
  readonly width: number;
  readonly height: number;
  /** Contact-sheet tile downscale factor. */
  readonly tile: number;
  /**
   * Fewest colours a frame may show (default 8): a sepia print job is six inks by design, a
   * pause panel almost empty.
   */
  readonly minColors?: number;
  /** A portrait short's frame (9:16, PLAN.md#13.18); absent = landscape. */
  readonly format?: 'portrait' | undefined;
  /** Manifest frame rate (default 30). */
  readonly fps?: number | undefined;
  /**
   * Load the Grim Ink people and places next to each scene (people/, places/), as
   * `render:frames --scene` does (default false).
   */
  readonly inkModules?: boolean | undefined;
}

function label(file: string): string {
  return path.basename(file, '.js').replace(/^[a-z]\d_/, '');
}

export function describeWorldLook(
  suite: WorldSuite,
  look: string,
  scenes: readonly WorldScene[],
): void {
  const { style, width, height, format, fps } = suite;
  let browser: HarnessBrowser;

  async function manifestOf(file: string, duration: number): Promise<RenderManifest> {
    const kitExtensions = suite.inkModules === true ? await sceneInkModules(kitFile(file)) : [];
    return sceneManifest(file, {
      style,
      duration,
      format,
      fps,
      ...(kitExtensions.length > 0 ? { kitExtensions } : {}),
    });
  }

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

  describe(`look ${look} (SwiftShader, world ${style})`, () => {
    it('every template scene passes the determinism lint', () => {
      for (const [file] of scenes) {
        expect(lintScene(sceneSource(file), { filename: path.basename(file) }), file).toEqual([]);
      }
    });

    it(
      `matches the goldens (${String(width)}x${String(height)}) and stays in the ${style} palette`,
      async () => {
        const tiles: RgbaImage[] = [];
        await withPage(async (page) => {
          for (const [file, duration, times] of scenes) {
            const info = await page.load(await manifestOf(file, duration));
            expect([info.width, info.height]).toEqual([width, height]);
            for (const t of times) {
              const data = await page.frameAt(t);
              const frame = { width: info.width, height: info.height, data };
              const name = `${label(file)}-t${String(t)}`;
              const stats = computeFrameStats(data);
              expect(stats.uniqueColors, name).toBeGreaterThanOrEqual(suite.minColors ?? 8);
              // A page is mostly paper; a blank page would be ~0.98 paper.
              expect(stats.dominantColorShare, name).toBeLessThan(0.96);
              expectVibe(frame, name, style);
              tiles.push(suite.tile === 1 ? frame : downscale(frame, suite.tile, 'nearest'));
              await compareWithGolden(`look-${look}-${name}`, frame, undefined, {
                goldenDir: KIT_GOLDEN_DIR,
              });
            }
          }
          expect(page.errors).toEqual([]);
        });
        const sheet = path.join(KIT_OUT_DIR, 'contact', `look-${look}.png`);
        await mkdir(path.dirname(sheet), { recursive: true });
        await writeFile(sheet, encodePng(composeSheet(tiles, 3)));
      },
      SUITE_TIMEOUT,
    );

    it(
      'renders the same pixels for the same t, in both seek directions and after a reload',
      async () => {
        await withPage(async (page) => {
          for (const [file, duration, times] of scenes) {
            const manifest = await manifestOf(file, duration);
            await page.load(manifest);
            const forward: string[] = [];
            for (const t of times) forward.push(await page.hashAt(t));
            const backward: string[] = [];
            for (const t of [...times].reverse()) backward.push(await page.hashAt(t));
            expect(backward.reverse(), file).toEqual(forward);
            expect(new Set(forward).size, file).toBe(times.length);
            await page.load(manifest);
            expect(await page.hashAt(times[1] ?? 0), `${file} reload`).toBe(forward[1]);
          }
          expect(page.errors).toEqual([]);
        });
      },
      SUITE_TIMEOUT,
    );
  });
}
