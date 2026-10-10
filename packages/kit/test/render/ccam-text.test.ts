/**
 * Grim Ink text on a real canvas (PLAN.md#14.18): the title card that opens a film (CC0 fallback
 * lettering, the same on every machine: golden `ccam-title-card`, before and after it lands), a
 * person holding a prop through `held` / `arms` on its contact sheet (golden `ccam-held-sheet`:
 * the prop shows), and the prototype caption with the system font, skipped where the page has no
 * Arial Black (CI Linux, cloud): bone letters with an ink outline in the caption band.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import {
  SWIFTSHADER_ARGS,
  compareWithGolden,
  computeFrameStats,
  type RgbaImage,
} from '../../../engine/src/cli/index.js';
import { CCAM_ORIGIN, serveKitModules } from '../support/ccam-module-server.js';
import { RIG_PAGE_URL, serveZod } from '../support/ccam-zod-route.js';
import { downscale } from '../support/image.js';
import { KIT_GOLDEN_DIR } from '../support/scenes.js';

const WIDTH = 1920;
const HEIGHT = 1080;
const SCENE_URL = `${CCAM_ORIGIN}/test/support/ccam-text-scene.js`;
const BAKER = readFileSync(
  path.resolve(import.meta.dirname, '..', '..', 'examples', 'c-cam', 'people', 'nightBaker.js'),
  'utf8',
);

/** Evaluated as a string (vitest would rewrite a function literal's dynamic `import`). */
function paintExpression(call: string): string {
  return `(async () => {
  const scene = await import(${JSON.stringify(SCENE_URL)});
  const blob = new Blob([${JSON.stringify(BAKER)}], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  const namespace = await import(url);
  URL.revokeObjectURL(url);
  const canvas = document.createElement('canvas');
  canvas.width = ${String(WIDTH)};
  canvas.height = ${String(HEIGHT)};
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const painted = ${call};
  if (typeof painted === 'boolean') return painted ? 'yes' : 'no';
  const bytes = ctx.getImageData(0, 0, ${String(WIDTH)}, ${String(HEIGHT)}).data;
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
})()`;
}

async function paint(page: Page, call: string): Promise<RgbaImage> {
  const base64: unknown = await page.evaluate(paintExpression(call));
  if (typeof base64 !== 'string') throw new TypeError('the page did not return pixel data');
  const data = new Uint8Array(Buffer.from(base64, 'base64'));
  expect(data.length).toBe(WIDTH * HEIGHT * 4);
  return { width: WIDTH, height: HEIGHT, data };
}

/** Pixels of the caption band (bottom 18 %) close to a colour. */
function bandShare(image: RgbaImage, colour: readonly [number, number, number]): number {
  const top = Math.floor(HEIGHT * 0.82);
  let hits = 0;
  for (let y = top; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const o = (y * WIDTH + x) * 4;
      const d =
        Math.abs((image.data[o] ?? 0) - colour[0]) +
        Math.abs((image.data[o + 1] ?? 0) - colour[1]) +
        Math.abs((image.data[o + 2] ?? 0) - colour[2]);
      if (d < 12) hits += 1;
    }
  }
  return hits / ((HEIGHT - top) * WIDTH);
}

describe('Grim Ink text on a real 2D canvas (Chromium)', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true, args: SWIFTSHADER_ARGS });
    page = await browser.newPage();
    await serveKitModules(page);
    await serveZod(page);
    await page.goto(RIG_PAGE_URL);
  });

  afterAll(async () => {
    await browser.close();
  });

  it('paints the opening title card and lands it (golden)', async () => {
    const landed = await paint(page, 'scene.paintTitleCard(ctx, namespace, 3)');
    const again = await paint(page, 'scene.paintTitleCard(ctx, namespace, 3)');
    expect(Buffer.from(again.data).equals(Buffer.from(landed.data))).toBe(true);
    const early = await paint(page, 'scene.paintTitleCard(ctx, namespace, 0.1)');
    expect(Buffer.from(early.data).equals(Buffer.from(landed.data))).toBe(false);
    const frame = downscale(landed, 3, 'box');
    expect(computeFrameStats(frame.data).uniqueColors).toBeGreaterThan(200);
    await compareWithGolden('ccam-title-card', frame, undefined, { goldenDir: KIT_GOLDEN_DIR });
  });

  it('shows a held prop on the person sheet (golden)', async () => {
    const sheet = await paint(page, 'scene.paintHeldSheet(ctx, namespace)');
    const frame = downscale(sheet, 3, 'box');
    await compareWithGolden('ccam-held-sheet', frame, undefined, { goldenDir: KIT_GOLDEN_DIR });
  });

  it('letters the caption with the system font where the page has it', async (context) => {
    const hasFont: unknown = await page.evaluate(paintExpression('scene.hasCaptionFont(ctx)'));
    if (hasFont !== 'yes') {
      context.skip();
      return;
    }
    const captioned = await paint(page, 'scene.paintSystemCaption(ctx, namespace)');
    // bone fill and its ink outline in the caption band
    expect(bandShare(captioned, [0xe2, 0xd8, 0xb8])).toBeGreaterThan(0.01);
    expect(bandShare(captioned, [0x16, 0x12, 0x0e])).toBeGreaterThan(0.01);
  });
});
