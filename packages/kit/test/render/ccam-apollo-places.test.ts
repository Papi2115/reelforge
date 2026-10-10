/**
 * The Apollo 11 places on a real canvas (PLAN.md#14.9): each of the eight place modules ported
 * from the C-CAM concept film 3 (`examples/c-cam/apollo/places/<id>.js`) is imported in headless
 * Chromium from its source (a blob module, as the engine sandbox does), loaded by the kit
 * (`placeFromModule`) and painted at its three sheet framings (wide, medium on the light, close on
 * the first anchor) into a CPU-backed 1920x1080 canvas (ccam-modules-scene.ts). The three frames,
 * box-downscaled to 640x360 and stacked, must match the golden `ccam-apollo-place-<id>`; every
 * framing must not be blank and must repaint identically.
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
const FRAMINGS = 3;
const SCENE_URL = `${CCAM_ORIGIN}/test/support/ccam-modules-scene.js`;
const DIR = path.resolve(import.meta.dirname, '..', '..', 'examples', 'c-cam', 'apollo', 'places');
const IDS = ['title', 'pad', 'lm', 'windowPov', 'panelWall', 'control', 'cm', 'surface'] as const;

/** Evaluated as a string (vitest would rewrite a function literal's dynamic `import`). */
function paintExpression(source: string, framing: number): string {
  return `(async () => {
  const scene = await import(${JSON.stringify(SCENE_URL)});
  const blob = new Blob([${JSON.stringify(source)}], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  const namespace = await import(url);
  URL.revokeObjectURL(url);
  const canvas = document.createElement('canvas');
  canvas.width = ${String(WIDTH)};
  canvas.height = ${String(HEIGHT)};
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  scene.paintModuleSheet(ctx, 'places', namespace, ${String(framing)});
  const bytes = ctx.getImageData(0, 0, ${String(WIDTH)}, ${String(HEIGHT)}).data;
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
})()`;
}

async function paint(page: Page, source: string, framing: number): Promise<RgbaImage> {
  const base64: unknown = await page.evaluate(paintExpression(source, framing));
  if (typeof base64 !== 'string') throw new TypeError('the page did not return pixel data');
  const data = new Uint8Array(Buffer.from(base64, 'base64'));
  expect(data.length).toBe(WIDTH * HEIGHT * 4);
  return { width: WIDTH, height: HEIGHT, data };
}

/** Stacks equally wide frames top to bottom. */
function stack(frames: readonly RgbaImage[]): RgbaImage {
  const width = frames[0]?.width ?? 0;
  const height = frames.reduce((sum, frame) => sum + frame.height, 0);
  const data = new Uint8Array(width * height * 4);
  let offset = 0;
  for (const frame of frames) {
    data.set(frame.data, offset);
    offset += frame.data.length;
  }
  return { width, height, data };
}

describe('Apollo 11 places on a real 2D canvas (Chromium)', () => {
  let browser: Browser;
  let page: Page;
  const errors: string[] = [];

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true, args: SWIFTSHADER_ARGS });
    page = await browser.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    await serveKitModules(page);
    await serveZod(page);
    await page.goto(RIG_PAGE_URL);
  });

  afterAll(async () => {
    await page.close();
    await browser.close();
  });

  it.each(IDS)('%s matches its golden at three framings', async (id) => {
    const source = readFileSync(path.join(DIR, `${id}.js`), 'utf8');
    const frames: RgbaImage[] = [];
    for (let framing = 0; framing < FRAMINGS; framing += 1) {
      const full = await paint(page, source, framing);
      const again = await paint(page, source, framing);
      const label = `${id} framing ${String(framing)}`;
      expect(Buffer.from(again.data).equals(Buffer.from(full.data)), label).toBe(true);
      const frame = downscale(full, 3, 'box');
      const stats = computeFrameStats(frame.data);
      // The surface's medium framing is the sun alone in a black sky corner: few colours.
      expect(stats.uniqueColors, label).toBeGreaterThan(100);
      expect(stats.dominantColorShare, label).toBeLessThan(0.9);
      frames.push(frame);
    }
    await compareWithGolden(`ccam-apollo-place-${id}`, stack(frames), undefined, {
      goldenDir: KIT_GOLDEN_DIR,
    });
    expect(errors).toEqual([]);
  });
});
