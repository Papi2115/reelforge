import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { findStylePreset } from '../../src/index.js';
import { compareWithGolden } from '../../src/cli/goldens.js';
import { launchHarnessBrowser, type HarnessBrowser } from '../../src/cli/harness-session.js';
import { textManifest } from '../support/manifests.js';

/** Title at rest, lower third mid-wipe, kinetic text mid-reveal (examples/s01_text.js). */
const TEXT_FRAMES = [
  { name: 'title', t: 1.2 },
  { name: 'lower-third', t: 2.9 },
  { name: 'kinetic', t: 3.6 },
];
const TEXT_STYLES = ['voxel-pixel-crisp640', 'soft-480'];

let browser: HarnessBrowser;

beforeAll(async () => {
  browser = await launchHarnessBrowser();
});

afterAll(async () => {
  await browser.close();
});

describe('pixel text in the engine frame', () => {
  it.each(TEXT_STYLES)(
    '%s: title, lower third and kinetic text match their goldens, palette-only',
    async (styleId) => {
      const page = await browser.open();
      try {
        await page.load(textManifest(styleId));
        const size = findStylePreset(styleId)?.resolution ?? { width: 0, height: 0 };
        const swatches = Object.values(findStylePreset(styleId)?.palette ?? {});
        const allowed = new Set(swatches.map((hex) => Number.parseInt(hex.slice(1), 16)));
        for (const { name, t } of TEXT_FRAMES) {
          const data = await page.frameAt(t);
          for (let offset = 0; offset < data.length; offset += 4) {
            const key =
              ((data[offset] ?? 0) << 16) |
              ((data[offset + 1] ?? 0) << 8) |
              (data[offset + 2] ?? 0);
            if (!allowed.has(key))
              throw new Error(`${name}: non-palette colour #${key.toString(16)}`);
          }
          expect(await page.hashAt(t)).toBe(await page.hashAt(t));
          await compareWithGolden(`text-${styleId}-${name}`, { ...size, data });
        }
        expect(page.errors).toEqual([]);
      } finally {
        await page.close();
      }
    },
  );
});
