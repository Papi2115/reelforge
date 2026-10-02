/**
 * Style presets (PLAN.md#3.5): the same composite scene (examples/k09_styles.js) at the same t in
 * every preset. Checks that every output pixel is a colour of the preset's palette, writes a 3-up
 * comparison sheet to look at (packages/kit/out/contact/styles.png, every tile upscaled to
 * 1920x1080 like the export, plus native tiles in out/contact/styles/) and compares a small 3-up
 * golden (tiles resized to 320x180 by nearest sampling).
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
  type RgbaImage,
} from '../../../engine/src/cli/index.js';
import { findStylePreset, lintScene, STYLE_PRESET_IDS } from '../../../engine/src/index.js';
import { composeSheet } from '../support/contact-sheet.js';
import { foreignColors, resizeNearest } from '../support/image.js';
import { KIT_GOLDEN_DIR, KIT_OUT_DIR, sceneManifest, sceneSource } from '../support/scenes.js';

const STYLES_FILE = 'examples/k09_styles.js';
const T = 2;
const EXPORT_SIZE = { width: 1920, height: 1080 };
const GOLDEN_TILE = { width: 320, height: 180 };
const SHEET_TIMEOUT = 180_000;

let browser: HarnessBrowser;

beforeAll(async () => {
  browser = await launchHarnessBrowser();
});

afterAll(async () => {
  await browser.close();
});

async function renderStyle(style: string): Promise<RgbaImage> {
  const page = await browser.open({ lint: true });
  try {
    const info = await page.load(sceneManifest(STYLES_FILE, { style }));
    const data = await page.frameAt(T);
    expect(page.errors, style).toEqual([]);
    return { width: info.width, height: info.height, data };
  } finally {
    await page.close();
  }
}

describe('style presets: one scene in every style (SwiftShader)', () => {
  it('k09_styles passes the determinism lint', () => {
    expect(lintScene(sceneSource(STYLES_FILE), { filename: STYLES_FILE })).toEqual([]);
  });

  it(
    'renders palette-only frames in every preset and matches the 3-up golden',
    async () => {
      const frames: RgbaImage[] = [];
      for (const style of STYLE_PRESET_IDS) frames.push(await renderStyle(style));
      // Written before the checks, so a failing comparison can be looked at.
      const tileDir = path.join(KIT_OUT_DIR, 'contact', 'styles');
      await mkdir(tileDir, { recursive: true });
      for (const [index, frame] of frames.entries()) {
        const name = STYLE_PRESET_IDS[index] ?? String(index);
        await writeFile(path.join(tileDir, `${name}.png`), encodePng(frame));
      }
      const exportTiles = frames.map((frame) =>
        resizeNearest(frame, EXPORT_SIZE.width, EXPORT_SIZE.height),
      );
      await writeFile(
        path.join(KIT_OUT_DIR, 'contact', 'styles.png'),
        encodePng(composeSheet(exportTiles, exportTiles.length, 16)),
      );

      frames.forEach((frame, index) => {
        const style = STYLE_PRESET_IDS[index] ?? '';
        const preset = findStylePreset(style);
        expect(preset, style).toBeDefined();
        expect([frame.width, frame.height], style).toEqual([
          preset?.resolution.width,
          preset?.resolution.height,
        ]);
        expect(foreignColors(frame, Object.values(preset?.palette ?? {})), style).toEqual([]);
        const stats = computeFrameStats(frame.data);
        expect(stats.uniqueColors, style).toBeGreaterThanOrEqual(10);
        expect(stats.dominantColorShare, style).toBeLessThan(0.6);
      });
      const goldenTiles = frames.map((frame) =>
        resizeNearest(frame, GOLDEN_TILE.width, GOLDEN_TILE.height),
      );
      await compareWithGolden(
        'kit-styles-3up',
        composeSheet(goldenTiles, goldenTiles.length),
        undefined,
        {
          goldenDir: KIT_GOLDEN_DIR,
        },
      );
    },
    SHEET_TIMEOUT,
  );
});
