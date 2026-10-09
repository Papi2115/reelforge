/**
 * Portrait format (PLAN.md#13.18) in the engine harness (SwiftShader): examples/k12_portrait.js
 * renders 360x640 when the manifest says `format: 'portrait'` (exported x3 = 1080x1920), seeks
 * deterministically and matches its golden; the same scene without a format stays 640x360.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  compareWithGolden,
  computeFrameStats,
  launchHarnessBrowser,
  type HarnessBrowser,
} from '../../../engine/src/cli/index.js';
import { lintScene } from '../../../engine/src/index.js';
import { KIT_GOLDEN_DIR, sceneSource, type RenderManifest } from '../support/scenes.js';

const PORTRAIT_FILE = 'examples/k12_portrait.js';

let browser: HarnessBrowser;

beforeAll(async () => {
  browser = await launchHarnessBrowser();
});

afterAll(async () => {
  await browser.close();
});

function manifest(format?: RenderManifest['format']): RenderManifest {
  return {
    version: 1,
    ...(format === undefined ? {} : { format }),
    fps: 30,
    seed: 2115,
    shots: [
      {
        id: 'k12',
        t0: 0,
        t1: 6,
        scene: { file: PORTRAIT_FILE, source: sceneSource(PORTRAIT_FILE) },
      },
    ],
  };
}

describe('portrait format (SwiftShader)', () => {
  it('k12_portrait passes the determinism lint', () => {
    expect(lintScene(sceneSource(PORTRAIT_FILE), { filename: PORTRAIT_FILE })).toEqual([]);
  });

  it('renders 360x640 deterministically and matches its golden', async () => {
    const page = await browser.open({ lint: true });
    try {
      const info = await page.load(manifest('portrait'));
      expect([info.width, info.height]).toEqual([360, 640]);
      const times = [0.2, 2.5, 4.5];
      const forward = [];
      for (const t of times) forward.push(await page.hashAt(t));
      const backward = [];
      for (const t of [...times].reverse()) backward.push(await page.hashAt(t));
      expect(backward.reverse()).toEqual(forward);
      const data = await page.frameAt(4.5);
      const stats = computeFrameStats(data);
      expect(stats.uniqueColors).toBeGreaterThanOrEqual(6);
      expect(stats.dominantColorShare).toBeLessThan(0.6);
      await compareWithGolden('kit-portrait-t4.5', { width: 360, height: 640, data }, undefined, {
        goldenDir: KIT_GOLDEN_DIR,
      });
      expect(page.errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it('keeps the landscape size without a format', async () => {
    const page = await browser.open({ lint: true });
    try {
      const info = await page.load(manifest());
      expect([info.width, info.height]).toEqual([640, 360]);
      expect(page.errors).toEqual([]);
    } finally {
      await page.close();
    }
  });
});
