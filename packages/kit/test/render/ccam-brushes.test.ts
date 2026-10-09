/**
 * C-CAM brushes on a real canvas (PLAN.md#14.3): the ported inkLine / blob / tube / scenery
 * brushes paint ccam-brushes-scene.ts into a CPU-backed 2D canvas (`willReadFrequently`) in
 * headless Chromium; the 1920x1080 pixels (read back with getImageData), box-downscaled to 640x360, must match the golden
 * `ccam-brushes-ink` and repaint identically.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import {
  SWIFTSHADER_ARGS,
  compareWithGolden,
  computeFrameStats,
  type RgbaImage,
} from '../../../engine/src/cli/index.js';
import { CCAM_ORIGIN, serveKitModules } from '../support/ccam-module-server.js';
import { downscale } from '../support/image.js';
import { KIT_GOLDEN_DIR } from '../support/scenes.js';

const WIDTH = 1920;
const HEIGHT = 1080;
const SCENE_URL = `${CCAM_ORIGIN}/test/support/ccam-brushes-scene.js`;

/**
 * Evaluated as a string: a function literal here would be rewritten by vitest's module transform
 * (dynamic `import`) before Playwright serializes it into the page.
 */
const PAINT_EXPRESSION = `(async () => {
  const scene = await import(${JSON.stringify(SCENE_URL)});
  const canvas = document.createElement('canvas');
  canvas.width = 1920;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  scene.paintBrushesScene(ctx);
  const bytes = ctx.getImageData(0, 0, 1920, 1080).data;
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
})()`;

/** Paints the scene in the page and reads the 1920x1080 RGBA pixels back. */
async function paint(page: Page): Promise<RgbaImage> {
  const base64: unknown = await page.evaluate(PAINT_EXPRESSION);
  if (typeof base64 !== 'string') throw new TypeError('the page did not return pixel data');
  const data = new Uint8Array(Buffer.from(base64, 'base64'));
  expect(data.length).toBe(WIDTH * HEIGHT * 4);
  return { width: WIDTH, height: HEIGHT, data };
}

describe('C-CAM brushes on a real 2D canvas (Chromium)', () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true, args: SWIFTSHADER_ARGS });
  });

  afterAll(async () => {
    await browser.close();
  });

  it('matches the golden and repaints identically', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await serveKitModules(page);
      await page.goto(`${CCAM_ORIGIN}/`);
      const full = await paint(page);
      const again = await paint(page);
      expect(Buffer.from(again.data).equals(Buffer.from(full.data))).toBe(true);

      const frame = downscale(full, 3, 'box');
      const stats = computeFrameStats(frame.data);
      expect(stats.uniqueColors).toBeGreaterThan(200);
      expect(stats.dominantColorShare).toBeLessThan(0.5);
      await compareWithGolden('ccam-brushes-ink', frame, undefined, {
        goldenDir: KIT_GOLDEN_DIR,
      });
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });
});
