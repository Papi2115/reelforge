/**
 * The Grim Ink vocabulary on a real canvas (PLAN.md#14.20): `env.ink.props` (three sheets:
 * building pieces / furniture / light, goods / paper / table things, gear / vehicles / structure),
 * `instruments`, `crowd`, `acting` (two sheets of two-body gags mid-action, with the example night
 * baker and the Apollo guidance engineer as stand-in people) and `fx`, painted by
 * test/support/ccam-vocab-scene.ts in headless Chromium. Box-downscaled to 640x360 they must match
 * `ccam-vocab-<sheet>` and repaint identically.
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
const SCENE_URL = `${CCAM_ORIGIN}/test/support/ccam-vocab-scene.js`;
const EXAMPLES = path.resolve(import.meta.dirname, '..', '..', 'examples', 'c-cam');
const PEOPLE = {
  nightBaker: path.join(EXAMPLES, 'people', 'nightBaker.js'),
  guidance: path.join(EXAMPLES, 'apollo', 'people', 'guidance.js'),
};

const MODULES: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(PEOPLE).map(([id, file]) => [id, readFileSync(file, 'utf8')]),
);

/** Evaluated as a string (vitest would rewrite a function literal's dynamic `import`). */
function paintExpression(sheet: string): string {
  return `(async () => {
  const scene = await import(${JSON.stringify(SCENE_URL)});
  const namespaces = {};
  for (const [id, source] of Object.entries(${JSON.stringify(MODULES)})) {
    const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
    namespaces[id] = await import(url);
    URL.revokeObjectURL(url);
  }
  const canvas = document.createElement('canvas');
  canvas.width = ${String(WIDTH)};
  canvas.height = ${String(HEIGHT)};
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  scene.paintVocab(ctx, ${JSON.stringify(sheet)}, namespaces);
  const bytes = ctx.getImageData(0, 0, ${String(WIDTH)}, ${String(HEIGHT)}).data;
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
})()`;
}

async function paint(page: Page, sheet: string): Promise<RgbaImage> {
  const base64: unknown = await page.evaluate(paintExpression(sheet));
  if (typeof base64 !== 'string') throw new TypeError('the page did not return pixel data');
  const data = new Uint8Array(Buffer.from(base64, 'base64'));
  expect(data.length).toBe(WIDTH * HEIGHT * 4);
  return { width: WIDTH, height: HEIGHT, data };
}

const SHEETS = ['props', 'goods', 'gear', 'instruments', 'crowd', 'acting-0', 'acting-1', 'fx'];

describe('Grim Ink vocabulary sheets on a real 2D canvas (Chromium)', () => {
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

  it.each(SHEETS)('ccam-vocab-%s matches its golden and repaints identically', async (sheet) => {
    const full = await paint(page, sheet);
    const again = await paint(page, sheet);
    expect(Buffer.from(again.data).equals(Buffer.from(full.data)), sheet).toBe(true);
    const frame = downscale(full, 3, 'box');
    const stats = computeFrameStats(frame.data);
    expect(stats.uniqueColors, sheet).toBeGreaterThan(200);
    expect(stats.dominantColorShare, sheet).toBeLessThan(0.9);
    await compareWithGolden(`ccam-vocab-${sheet}`, frame, undefined, {
      goldenDir: KIT_GOLDEN_DIR,
    });
    expect(errors).toEqual([]);
  });
});
