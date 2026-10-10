/**
 * Grim Ink people / places on a real canvas (PLAN.md#14.8): the sample person
 * (`examples/c-cam/people/nightBaker.js`) and place (`examples/c-cam/places/bakeryBackRoom.js`)
 * are imported in headless Chromium from their sources (blob modules, as the engine sandbox does),
 * loaded by the kit (`personFromModule` / `placeFromModule`) and painted as their contact-sheet
 * pages into a CPU-backed 2D canvas (ccam-modules-scene.ts). The 1920x1080 pixels, box-downscaled
 * to 640x360, must match the goldens `ccam-person-sheet-p0` (6 views x 3 poses), `-p1` (14 faces)
 * and `ccam-place-sheet-p0` (wide); the other place framings must not be blank, and every page
 * repaints identically.
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
const SCENE_URL = `${CCAM_ORIGIN}/test/support/ccam-modules-scene.js`;
const EXAMPLES = path.resolve(import.meta.dirname, '..', '..', 'examples', 'c-cam');
const SOURCES = {
  people: readFileSync(path.join(EXAMPLES, 'people', 'nightBaker.js'), 'utf8'),
  places: readFileSync(path.join(EXAMPLES, 'places', 'bakeryBackRoom.js'), 'utf8'),
} as const;

/** Evaluated as a string (vitest would rewrite a function literal's dynamic `import`). */
function paintExpression(kind: 'people' | 'places', page: number): string {
  return `(async () => {
  const scene = await import(${JSON.stringify(SCENE_URL)});
  const blob = new Blob([${JSON.stringify(SOURCES[kind])}], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  const namespace = await import(url);
  URL.revokeObjectURL(url);
  const canvas = document.createElement('canvas');
  canvas.width = ${String(WIDTH)};
  canvas.height = ${String(HEIGHT)};
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  scene.paintModuleSheet(ctx, ${JSON.stringify(kind)}, namespace, ${String(page)});
  const bytes = ctx.getImageData(0, 0, ${String(WIDTH)}, ${String(HEIGHT)}).data;
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
})()`;
}

async function paint(page: Page, kind: 'people' | 'places', sheetPage: number): Promise<RgbaImage> {
  const base64: unknown = await page.evaluate(paintExpression(kind, sheetPage));
  if (typeof base64 !== 'string') throw new TypeError('the page did not return pixel data');
  const data = new Uint8Array(Buffer.from(base64, 'base64'));
  expect(data.length).toBe(WIDTH * HEIGHT * 4);
  return { width: WIDTH, height: HEIGHT, data };
}

const PAGES: readonly { kind: 'people' | 'places'; page: number; golden?: string }[] = [
  { kind: 'people', page: 0, golden: 'ccam-person-sheet-p0' },
  { kind: 'people', page: 1, golden: 'ccam-person-sheet-p1' },
  { kind: 'places', page: 0, golden: 'ccam-place-sheet-p0' },
  { kind: 'places', page: 1 },
  { kind: 'places', page: 2 },
];

describe('Grim Ink people / places sheets on a real 2D canvas (Chromium)', () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true, args: SWIFTSHADER_ARGS });
  });

  afterAll(async () => {
    await browser.close();
  });

  it('matches the goldens, is never blank and repaints identically', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await serveKitModules(page);
      await serveZod(page);
      await page.goto(RIG_PAGE_URL);
      for (const entry of PAGES) {
        const full = await paint(page, entry.kind, entry.page);
        const again = await paint(page, entry.kind, entry.page);
        const label = `${entry.kind} page ${String(entry.page)}`;
        expect(Buffer.from(again.data).equals(Buffer.from(full.data)), label).toBe(true);
        const frame = downscale(full, 3, 'box');
        const stats = computeFrameStats(frame.data);
        expect(stats.uniqueColors, label).toBeGreaterThan(200);
        expect(stats.dominantColorShare, label).toBeLessThan(0.9);
        if (entry.golden !== undefined) {
          await compareWithGolden(entry.golden, frame, undefined, { goldenDir: KIT_GOLDEN_DIR });
        }
      }
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });
});
