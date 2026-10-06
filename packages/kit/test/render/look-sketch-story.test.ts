/**
 * Look `sketch-story` (Sketchbook world, look A, PLAN.md#13.6) in the engine harness
 * (SwiftShader): the three template scenes (packages/kit/examples/sketchbook/a1-a3, ports of the
 * showcase's story pages 2, 4 and 7) pass the determinism lint, render the same pixels for the same
 * t in any seek order, stay in the sketchbook palette (vibe guard) and match their goldens at three
 * times each (`look-sketch-story-<scene>-t<t>`, 960x540). Contact sheet:
 * packages/kit/out/contact/look-sketch-story.png.
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
import { KIT_GOLDEN_DIR, KIT_OUT_DIR, sceneManifest, sceneSource } from '../support/scenes.js';
import { expectVibe } from '../support/vibe.js';

const STYLE = 'sketchbook';
/** Scene file, shot length, golden times (shot seconds, as the showcase stills). */
const SCENES = [
  ['examples/sketchbook/a1_quarter.js', 8.8, [2.4, 6, 8]],
  ['examples/sketchbook/a2_caesar.js', 8.6, [3.3, 5.2, 7.4]],
  ['examples/sketchbook/a3_gregory.js', 9, [3.3, 5.5, 7.6]],
] as const;
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

function label(file: string): string {
  return path.basename(file, '.js').replace(/^a\d_/, '');
}

describe('look sketch-story (SwiftShader, world sketchbook)', () => {
  it('every template scene passes the determinism lint', () => {
    for (const [file] of SCENES) {
      expect(lintScene(sceneSource(file), { filename: path.basename(file) }), file).toEqual([]);
    }
  });

  it(
    'matches the goldens (960x540) and stays in the sketchbook palette',
    async () => {
      const tiles: RgbaImage[] = [];
      await withPage(async (page) => {
        for (const [file, duration, times] of SCENES) {
          const info = await page.load(sceneManifest(file, { style: STYLE, duration }));
          expect([info.width, info.height]).toEqual([960, 540]);
          for (const t of times) {
            const data = await page.frameAt(t);
            const frame = { width: info.width, height: info.height, data };
            const name = `${label(file)}-t${String(t)}`;
            const stats = computeFrameStats(data);
            expect(stats.uniqueColors, name).toBeGreaterThanOrEqual(8);
            // A page is mostly paper; a blank page would be ~0.98 paper.
            expect(stats.dominantColorShare, name).toBeLessThan(0.96);
            expectVibe(frame, name, STYLE);
            tiles.push(downscale(frame, 2, 'nearest'));
            await compareWithGolden(`look-sketch-story-${name}`, frame, undefined, {
              goldenDir: KIT_GOLDEN_DIR,
            });
          }
        }
        expect(page.errors).toEqual([]);
      });
      const sheet = path.join(KIT_OUT_DIR, 'contact', 'look-sketch-story.png');
      await mkdir(path.dirname(sheet), { recursive: true });
      await writeFile(sheet, encodePng(composeSheet(tiles, 3)));
    },
    SUITE_TIMEOUT,
  );

  it(
    'renders the same pixels for the same t, in both seek directions and after a reload',
    async () => {
      await withPage(async (page) => {
        for (const [file, duration, times] of SCENES) {
          const manifest = sceneManifest(file, { style: STYLE, duration });
          await page.load(manifest);
          const forward: string[] = [];
          for (const t of times) forward.push(await page.hashAt(t));
          const backward: string[] = [];
          for (const t of [...times].reverse()) backward.push(await page.hashAt(t));
          expect(backward.reverse(), file).toEqual(forward);
          expect(new Set(forward).size, file).toBe(times.length);
          await page.load(manifest);
          expect(await page.hashAt(times[1]), `${file} reload`).toBe(forward[1]);
        }
        expect(page.errors).toEqual([]);
      });
    },
    SUITE_TIMEOUT,
  );
});
