/**
 * The pop-up toolkit (`page.popup`, PLAN.md#13.6 follow-up) in the engine harness (SwiftShader,
 * 960x540): four different mechanisms bound to the pull (examples c4-c7: a gauge filling with a
 * counter and a piece springing up, a door opening onto what it hid, a strip sliding behind a
 * window with a scale pointer, a gear turning a counter driven by a callback). Each passes the
 * determinism lint, renders the same pixels in any seek order, and is a golden before and after
 * its pull (`sketch-popup-<name>-t<t>`); contact strip packages/kit/out/contact/sketch-popups.png.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  compareWithGolden,
  encodePng,
  launchHarnessBrowser,
  type HarnessBrowser,
  type RgbaImage,
} from '../../../engine/src/cli/index.js';
import { lintScene } from '../../../engine/src/index.js';
import { composeSheet } from '../support/contact-sheet.js';
import { downscale } from '../support/image.js';
import { KIT_GOLDEN_DIR, KIT_OUT_DIR, sceneManifest, sceneSource } from '../support/scenes.js';
import { expectVibe } from '../support/vibe.js';

const DURATION = 8;
/** Scene file, a frame before its pull, one after. */
const POPUPS = [
  ['examples/sketchbook/c4_popup_gauge.js', 3.8, 6.8],
  ['examples/sketchbook/c5_popup_flap.js', 3.2, 6],
  ['examples/sketchbook/c6_popup_window.js', 3, 6.8],
  ['examples/sketchbook/c7_popup_wheel.js', 2.8, 6.4],
] as const;

const label = (file: string): string => path.basename(file, '.js').replace(/^c\d_popup_/, '');

describe('sketchbook pop-up mechanisms (SwiftShader)', () => {
  let browser: HarnessBrowser;

  beforeAll(async () => {
    browser = await launchHarnessBrowser();
  });

  afterAll(async () => {
    await browser.close();
  });

  it('every pop-up example passes the determinism lint', () => {
    for (const [file] of POPUPS) {
      expect(lintScene(sceneSource(file), { filename: path.basename(file) }), file).toEqual([]);
    }
  });

  it('moves what the pull is bound to: goldens before and after, same pixels in any seek order', async () => {
    const page = await browser.open({ lint: true });
    try {
      const tiles: RgbaImage[] = [];
      for (const [file, before, after] of POPUPS) {
        const info = await page.load(
          sceneManifest(file, { style: 'sketchbook', duration: DURATION }),
        );
        const hashes = [await page.hashAt(before), await page.hashAt(after)];
        expect(hashes[0], file).not.toBe(hashes[1]);
        expect([await page.hashAt(after), await page.hashAt(before)], file).toEqual(
          [...hashes].reverse(),
        );
        for (const t of [before, after]) {
          const frame = { width: info.width, height: info.height, data: await page.frameAt(t) };
          expectVibe(frame, `${label(file)}-t${String(t)}`, 'sketchbook');
          tiles.push(downscale(frame, 2, 'nearest'));
          await compareWithGolden(`sketch-popup-${label(file)}-t${String(t)}`, frame, undefined, {
            goldenDir: KIT_GOLDEN_DIR,
          });
        }
      }
      const strip = path.join(KIT_OUT_DIR, 'contact', 'sketch-popups.png');
      await mkdir(path.dirname(strip), { recursive: true });
      await writeFile(strip, encodePng(composeSheet(tiles, 2)));
      expect(page.errors).toEqual([]);
    } finally {
      await page.close();
    }
  }, 600_000);
});
