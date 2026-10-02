import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  compareWithGolden,
  computeFrameStats,
  launchHarnessBrowser,
  type HarnessBrowser,
  type HarnessPage,
} from '../../../engine/src/cli/index.js';
import { lintScene } from '../../../engine/src/index.js';
import {
  DEMO_FILE,
  KIT_GOLDEN_DIR,
  sceneManifest,
  sceneSource,
  STRESS_FILE,
} from '../support/scenes.js';

let browser: HarnessBrowser;

beforeAll(async () => {
  browser = await launchHarnessBrowser();
});

afterAll(async () => {
  await browser.close();
});

async function withPage<T>(run: (page: HarnessPage) => Promise<T>): Promise<T> {
  const page = await browser.open({ lint: true });
  try {
    return await run(page);
  } finally {
    await page.close();
  }
}

function expectVoxelArt(frame: Uint8Array): void {
  const stats = computeFrameStats(frame);
  expect(stats.uniqueColors).toBeGreaterThanOrEqual(6);
  expect(stats.dominantColorShare).toBeLessThan(0.6);
}

describe('kit example scenes (SwiftShader)', () => {
  it.each([DEMO_FILE, STRESS_FILE])('%s passes the determinism lint', (file) => {
    expect(lintScene(sceneSource(file), { filename: file })).toEqual([]);
  });

  it('renders the voxel demo deterministically and matches its goldens', async () => {
    await withPage(async (page) => {
      await page.load(sceneManifest(DEMO_FILE));
      const times = [0, 2.5, 5];
      const forward = [];
      for (const t of times) forward.push(await page.hashAt(t));
      const backward = [];
      for (const t of [...times].reverse()) backward.push(await page.hashAt(t));
      expect(backward.reverse()).toEqual(forward);
      expect(new Set(forward).size).toBe(times.length);
      for (const t of [0, 2.5]) {
        const data = await page.frameAt(t);
        expectVoxelArt(data);
        await compareWithGolden(
          `kit-voxel-demo-t${String(t)}`,
          { width: 640, height: 360, data },
          undefined,
          { goldenDir: KIT_GOLDEN_DIR },
        );
      }
      expect(page.errors).toEqual([]);
    });
  });

  it('renders the voxel demo in every style preset', async () => {
    await withPage(async (page) => {
      for (const style of ['noir-voxel', 'soft-480']) {
        const info = await page.load(sceneManifest(DEMO_FILE, { style }));
        const data = await page.frameAt(2.5);
        expectVoxelArt(data);
        await compareWithGolden(
          `kit-voxel-demo-${style}-t2.5`,
          { width: info.width, height: info.height, data },
          undefined,
          { goldenDir: KIT_GOLDEN_DIR },
        );
      }
      expect(page.errors).toEqual([]);
    });
  });

  it('renders the 100k-voxel stress scene and matches its golden', async () => {
    await withPage(async (page) => {
      await page.load(sceneManifest(STRESS_FILE));
      const data = await page.frameAt(3);
      expectVoxelArt(data);
      await compareWithGolden('kit-voxel-stress-t3', { width: 640, height: 360, data }, undefined, {
        goldenDir: KIT_GOLDEN_DIR,
      });
      expect(page.errors).toEqual([]);
    });
  });
});
