/**
 * The Apollo 11 people modules on a real canvas (PLAN.md#14.9): each
 * `examples/c-cam/apollo/people/<id>.js` is imported in headless Chromium from its source (a blob
 * module, as the engine sandbox does), loaded by the kit (`personFromModule`) and painted as its
 * contact-sheet pages (modules/sheet.ts) into a CPU-backed 1920x1080 2D canvas. Box-downscaled to
 * 640x360 they must match the goldens `ccam-apollo-people-<id>` (six views x stand / akimbo /
 * walk) and `ccam-apollo-people-<id>-faces` (the 14 expressions); every page repaints identically.
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
const IDS = ['commander', 'guidance', 'orbiter', 'director', 'you'] as const;
const PEOPLE = path.resolve(
  import.meta.dirname,
  '..',
  '..',
  'examples',
  'c-cam',
  'apollo',
  'people',
);
const PERSON_URL = `${CCAM_ORIGIN}/src/worlds/c-cam/modules/person.js`;
const PAINT_URL = `${CCAM_ORIGIN}/src/worlds/c-cam/draw/paint.js`;

/** Evaluated as a string (vitest would rewrite a function literal's dynamic `import`). */
function paintExpression(id: string, page: number): string {
  const source = readFileSync(path.join(PEOPLE, `${id}.js`), 'utf8');
  return `(async () => {
  const { personFromModule } = await import(${JSON.stringify(PERSON_URL)});
  const { asPaint2D } = await import(${JSON.stringify(PAINT_URL)});
  const blob = new Blob([${JSON.stringify(source)}], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  const namespace = await import(url);
  URL.revokeObjectURL(url);
  const canvas = document.createElement('canvas');
  canvas.width = ${String(WIDTH)};
  canvas.height = ${String(HEIGHT)};
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  personFromModule(namespace, ${JSON.stringify(`kit-ext/people/${id}.js`)}).sheet(asPaint2D(ctx), ${String(page)});
  const bytes = ctx.getImageData(0, 0, ${String(WIDTH)}, ${String(HEIGHT)}).data;
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
})()`;
}

async function paint(page: Page, id: string, sheetPage: number): Promise<RgbaImage> {
  const base64: unknown = await page.evaluate(paintExpression(id, sheetPage));
  if (typeof base64 !== 'string') throw new TypeError('the page did not return pixel data');
  const data = new Uint8Array(Buffer.from(base64, 'base64'));
  expect(data.length).toBe(WIDTH * HEIGHT * 4);
  return { width: WIDTH, height: HEIGHT, data };
}

describe('Apollo 11 people sheets on a real 2D canvas (Chromium)', () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true, args: SWIFTSHADER_ARGS });
  });

  afterAll(async () => {
    await browser.close();
  });

  it.each(IDS)('%s matches its goldens and repaints identically', async (id) => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await serveKitModules(page);
      await serveZod(page);
      await page.goto(RIG_PAGE_URL);
      for (const [sheetPage, golden] of [
        [0, `ccam-apollo-people-${id}`],
        [1, `ccam-apollo-people-${id}-faces`],
      ] as const) {
        const full = await paint(page, id, sheetPage);
        const again = await paint(page, id, sheetPage);
        expect(Buffer.from(again.data).equals(Buffer.from(full.data)), golden).toBe(true);
        const frame = downscale(full, 3, 'box');
        const stats = computeFrameStats(frame.data);
        expect(stats.uniqueColors, golden).toBeGreaterThan(200);
        expect(stats.dominantColorShare, golden).toBeLessThan(0.9);
        await compareWithGolden(golden, frame, undefined, { goldenDir: KIT_GOLDEN_DIR });
      }
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });
});
