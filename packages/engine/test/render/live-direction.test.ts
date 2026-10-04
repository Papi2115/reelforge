/**
 * Live co-direction in the engine harness (PLAN.md#12.14, SwiftShader): a direction hot-applied
 * to a loaded video renders exactly like a fresh load of the manifest that carries it (preview =
 * export), clearing it restores the plain frames bit for bit, a host arrow timed on the spoken
 * word is drawn on and settles (goldens at two times) inside the palette (vibe guard), and a rate
 * direction leaves anchors and cues where they were.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DirectionOverlay, RenderManifest, ShotDirection } from '@reelforge/shared';
import { compareWithGolden } from '../../src/cli/goldens.js';
import {
  launchHarnessBrowser,
  type HarnessBrowser,
  type HarnessPage,
} from '../../src/cli/harness-session.js';
import { resolveStyle, vibeGuard } from '../../src/index.js';
import { helloManifest } from '../support/manifests.js';

const STYLE_ID = 'voxel-pixel-crisp640';
const STYLE = resolveStyle({ style: STYLE_ID });
/** "Arrow on the word hello", aimed at the top left (as the command parser writes it). */
const ARROW: DirectionOverlay = {
  id: 'arrow-1',
  kind: 'arrow',
  x: 0.28,
  y: 0.3,
  region: 'top-left',
  at: 1,
  until: 3,
  word: { index: 0, text: 'Hello' },
};
const DIRECTION: ShotDirection = { dim: -0.5, zoom: 1.2, overlays: [ARROW] };
const TIMES = [0.5, 1.2, 2.5, 3.8];

function plain(): RenderManifest {
  return helloManifest(2115, STYLE_ID);
}

function directed(direction: ShotDirection): RenderManifest {
  const base = plain();
  return { ...base, shots: base.shots.map((shot) => ({ ...shot, direction })) };
}

let browser: HarnessBrowser;

beforeAll(async () => {
  browser = await launchHarnessBrowser();
});

afterAll(async () => {
  await browser.close();
});

async function withPage<T>(run: (page: HarnessPage) => Promise<T>): Promise<T> {
  const page = await browser.open();
  try {
    return await run(page);
  } finally {
    await page.close();
  }
}

async function hashes(page: HarnessPage): Promise<string[]> {
  const result: string[] = [];
  for (const t of TIMES) result.push(await page.hashAt(t));
  return result;
}

describe('live co-direction (SwiftShader)', () => {
  it('hot apply = fresh load (preview = export); clearing restores the plain frames', async () => {
    const exported = await withPage(async (page) => {
      await page.load(directed(DIRECTION));
      return hashes(page);
    });
    await withPage(async (page) => {
      await page.load(plain());
      const before = await hashes(page);
      await page.setShotDirection('s00', DIRECTION);
      const live = await hashes(page);
      expect(live).toEqual(exported);
      expect(live[2]).not.toBe(before[2]);
      await page.setShotDirection('s00', null);
      expect(await hashes(page)).toEqual(before);
      expect(page.errors).toEqual([]);
    });
  });

  it('draws the arrow on the word inside the palette (goldens at two times)', async () => {
    await withPage(async (page) => {
      await page.load(directed({ overlays: [ARROW] }));
      for (const t of [1.2, 2.5]) {
        const frame = { width: 640, height: 360, data: new Uint8Array(await page.frameAt(t)) };
        expect(vibeGuard(frame, STYLE).issues).toEqual([]);
        await compareWithGolden(`live-direction-arrow-${t.toFixed(1)}`, frame);
      }
      const toned = { width: 640, height: 360, data: new Uint8Array(await page.frameAt(2.5)) };
      await page.setShotDirection('s00', DIRECTION);
      const all = { width: 640, height: 360, data: new Uint8Array(await page.frameAt(2.5)) };
      expect(vibeGuard(all, STYLE).issues).toEqual([]);
      expect(Buffer.from(all.data).equals(Buffer.from(toned.data))).toBe(false);
      expect(page.errors).toEqual([]);
    });
  });

  it('a rate direction keeps anchors and cues and the frames on the hits', async () => {
    const reference = await withPage(async (page) => {
      const info = await page.load(plain());
      return { info, hit: await page.hashAt(1), late: await page.hashAt(3) };
    });
    await withPage(async (page) => {
      const info = await page.load(directed({ rate: 0.6 }));
      expect(info.anchors).toEqual(reference.info.anchors);
      expect(info.cues).toEqual(reference.info.cues);
      // The hello anchor (t = 1) is a window edge: the frame there is the plain one.
      expect(await page.hashAt(1)).toBe(reference.hit);
      expect(await page.hashAt(3)).not.toBe(reference.late);
      expect(page.errors).toEqual([]);
    });
  });
});
