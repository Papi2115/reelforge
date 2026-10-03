import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { findStylePreset } from '../../src/index.js';
import { compareWithGolden } from '../../src/cli/goldens.js';
import { launchHarnessBrowser, type HarnessBrowser } from '../../src/cli/harness-session.js';
import type { RgbaImage } from '../../src/cli/png.js';
import { annotationsManifest } from '../support/manifests.js';

/**
 * examples/s02_annotations.js, one settled frame per act: arrow + ring + pin; dimension + bracket
 * + badges; title underline + callout + stamp; spotlight + check/cross badges + highlight. One
 * 2x2 contact sheet per style keeps the goldens small.
 */
const ACT_TIMES = [2.5, 5.5, 8.5, 11.5];
const STYLES = ['voxel-pixel-crisp640', 'soft-480'];
const GUTTER = 4;

function sheet(tiles: readonly Buffer[], width: number, height: number): RgbaImage {
  const sheetWidth = 2 * width + 3 * GUTTER;
  const sheetHeight = 2 * height + 3 * GUTTER;
  const data = new Uint8Array(sheetWidth * sheetHeight * 4).fill(255);
  tiles.forEach((tile, index) => {
    const left = GUTTER + (index % 2) * (width + GUTTER);
    const top = GUTTER + Math.floor(index / 2) * (height + GUTTER);
    for (let y = 0; y < height; y += 1) {
      data.set(
        tile.subarray(y * width * 4, (y + 1) * width * 4),
        ((top + y) * sheetWidth + left) * 4,
      );
    }
  });
  return { width: sheetWidth, height: sheetHeight, data };
}

let browser: HarnessBrowser;

beforeAll(async () => {
  browser = await launchHarnessBrowser();
});

afterAll(async () => {
  await browser.close();
});

describe('annotations in the engine frame', () => {
  it.each(STYLES)(
    '%s: every annotation type matches its golden, palette-only, deterministic, QA-clean',
    async (styleId) => {
      const page = await browser.open({ lint: true });
      try {
        await page.load(annotationsManifest(styleId));
        const preset = findStylePreset(styleId);
        const { width, height } = preset?.resolution ?? { width: 0, height: 0 };
        const allowed = new Set(
          Object.values(preset?.palette ?? {}).map((hex) => Number.parseInt(hex.slice(1), 16)),
        );
        const tiles: Buffer[] = [];
        for (const t of ACT_TIMES) {
          const data = await page.frameAt(t);
          for (let offset = 0; offset < data.length; offset += 4) {
            const key =
              ((data[offset] ?? 0) << 16) |
              ((data[offset + 1] ?? 0) << 8) |
              (data[offset + 2] ?? 0);
            if (!allowed.has(key))
              throw new Error(`t=${String(t)}: non-palette #${key.toString(16)}`);
          }
          expect(await page.hashAt(t)).toBe(await page.hashAt(t));
          tiles.push(data);
        }
        await compareWithGolden(`annotations-${styleId}-sheet`, sheet(tiles, width, height));
        const problems = (await page.checkCards('s02')).filter(
          (entry) => entry.severity !== 'info',
        );
        expect(problems).toEqual([]);
        expect(page.errors).toEqual([]);
      } finally {
        await page.close();
      }
    },
  );
});
