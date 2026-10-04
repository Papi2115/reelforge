/**
 * Source chip (PLAN.md#12.18, ADR-016) in the engine harness (SwiftShader): examples/
 * s04_source_chip.js shows the chip in three placements (default bottom-right corner with a
 * number; preferred top-left corner with a URL shown as its host; moved to the free top-right
 * corner because a callout and a lower third take the bottom). Each placement is a golden
 * (`source-chip-<placement>`), passes the vibe guard, renders the same twice and is QA-clean.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { RenderManifest } from '@reelforge/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { compareWithGolden } from '../../src/cli/goldens.js';
import { launchHarnessBrowser, type HarnessBrowser } from '../../src/cli/harness-session.js';
import { resolveStyle, vibeGuard } from '../../src/index.js';

const STYLE_ID = 'voxel-pixel-crisp640';
const STYLE = resolveStyle({ style: STYLE_ID });
const WIDTH = 640;
const HEIGHT = 360;
const SCENE_FILE = 'examples/s04_source_chip.js';
const PLACEMENTS = [
  { name: 'default', t: 2.4 },
  { name: 'top-left', t: 5.4 },
  { name: 'avoid', t: 8.4 },
] as const;

const source = readFileSync(path.join(import.meta.dirname, '..', '..', SCENE_FILE), 'utf8');
const manifest: RenderManifest = {
  version: 1,
  style: STYLE_ID,
  fps: 30,
  seed: 2115,
  shots: [{ id: 's04', t0: 0, t1: 9, scene: { file: SCENE_FILE, source } }],
};

let browser: HarnessBrowser;

beforeAll(async () => {
  browser = await launchHarnessBrowser();
});

afterAll(async () => {
  await browser.close();
});

describe('source chip in the engine frame', () => {
  it('matches the goldens in 3 placements, keeps the vibe, deterministic, QA-clean', async () => {
    const page = await browser.open({ lint: true });
    try {
      await page.load(manifest);
      for (const placement of PLACEMENTS) {
        const data = new Uint8Array(await page.frameAt(placement.t));
        const name = `source-chip-${placement.name}`;
        expect(vibeGuard({ width: WIDTH, height: HEIGHT, data }, STYLE).issues, name).toEqual([]);
        expect(await page.hashAt(placement.t)).toBe(await page.hashAt(placement.t));
        await compareWithGolden(name, { width: WIDTH, height: HEIGHT, data });
      }
      const problems = (await page.checkCards('s04')).filter((entry) => entry.severity !== 'info');
      expect(problems).toEqual([]);
      expect(page.errors).toEqual([]);
    } finally {
      await page.close();
    }
  });
});
