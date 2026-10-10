/**
 * The Apollo 11 acting on a real canvas (PLAN.md#14.9): the five people modules
 * (`examples/c-cam/apollo/people/<id>.js`) with the film's props (gum bubble, helmet, sweat and
 * checklist, mug and sip, sandwich), every gag at mid-action, and four places with shot options
 * (lm alarm + approach + boulders, control with its foreground, surface lander with flame, the
 * panel wall at another seed), painted by test/support/ccam-acting-scene.ts in headless Chromium.
 * Box-downscaled to 640x360 they must match `ccam-apollo-acting-props`, `ccam-apollo-acting-gags`
 * and `ccam-apollo-place-options`, and repaint identically.
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
const SCENE_URL = `${CCAM_ORIGIN}/test/support/ccam-acting-scene.js`;
const APOLLO = path.resolve(import.meta.dirname, '..', '..', 'examples', 'c-cam', 'apollo');
const PEOPLE = ['commander', 'guidance', 'orbiter', 'director', 'you'];
const PLACES = ['lm', 'control', 'surface', 'panelWall'];

function sources(kind: 'people' | 'places', ids: readonly string[]): Record<string, string> {
  return Object.fromEntries(
    ids.map((id) => [id, readFileSync(path.join(APOLLO, kind, `${id}.js`), 'utf8')]),
  );
}

/** Evaluated as a string (vitest would rewrite a function literal's dynamic `import`). */
function paintExpression(call: string, modules: Record<string, string>): string {
  return `(async () => {
  const scene = await import(${JSON.stringify(SCENE_URL)});
  const namespaces = {};
  for (const [id, source] of Object.entries(${JSON.stringify(modules)})) {
    const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
    namespaces[id] = await import(url);
    URL.revokeObjectURL(url);
  }
  const canvas = document.createElement('canvas');
  canvas.width = ${String(WIDTH)};
  canvas.height = ${String(HEIGHT)};
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ${call};
  const bytes = ctx.getImageData(0, 0, ${String(WIDTH)}, ${String(HEIGHT)}).data;
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
})()`;
}

async function paint(page: Page, call: string, modules: Record<string, string>) {
  const base64: unknown = await page.evaluate(paintExpression(call, modules));
  if (typeof base64 !== 'string') throw new TypeError('the page did not return pixel data');
  const data = new Uint8Array(Buffer.from(base64, 'base64'));
  expect(data.length).toBe(WIDTH * HEIGHT * 4);
  const image: RgbaImage = { width: WIDTH, height: HEIGHT, data };
  return image;
}

const CASES = [
  ['ccam-apollo-acting-props', 'scene.paintActing(ctx, namespaces, 0)', 'people'],
  ['ccam-apollo-acting-gags', 'scene.paintActing(ctx, namespaces, 1)', 'people'],
  ['ccam-apollo-place-options', 'scene.paintPlaceOptions(ctx, namespaces)', 'places'],
] as const;

describe('Apollo 11 props, gags and place options on a real 2D canvas (Chromium)', () => {
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

  it.each(CASES)('%s matches its golden and repaints identically', async (golden, call, kind) => {
    const modules = kind === 'people' ? sources('people', PEOPLE) : sources('places', PLACES);
    const full = await paint(page, call, modules);
    const again = await paint(page, call, modules);
    expect(Buffer.from(again.data).equals(Buffer.from(full.data)), golden).toBe(true);
    const frame = downscale(full, 3, 'box');
    const stats = computeFrameStats(frame.data);
    expect(stats.uniqueColors, golden).toBeGreaterThan(200);
    expect(stats.dominantColorShare, golden).toBeLessThan(0.9);
    await compareWithGolden(golden, frame, undefined, { goldenDir: KIT_GOLDEN_DIR });
    expect(errors).toEqual([]);
  });
});
