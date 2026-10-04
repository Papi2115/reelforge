/**
 * Reveal moments in the engine harness (PLAN.md#12.27, SwiftShader): a slow-motion window renders
 * every frame as the plain shot at its remapped scene time (so frames outside the window, the
 * anchors and the cues are exactly as without it), the sequence is a pure function of t in any
 * seek order, and a palette-shift flash keeps every pixel a style colour (golden at its peak).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { compareWithGolden } from '../../src/cli/goldens.js';
import {
  launchHarnessBrowser,
  type HarnessBrowser,
  type HarnessPage,
} from '../../src/cli/harness-session.js';
import { remapTime, type RenderManifest } from '@reelforge/shared';
import { resolveStyle, vibeGuard } from '../../src/index.js';
import { helloManifest } from '../support/manifests.js';

const STYLE_ID = 'voxel-pixel-crisp640';
const STYLE = resolveStyle({ style: STYLE_ID });
const WINDOW = { from: 1.6, to: 3.6, rate: 0.4 };
const SHIFT = { from: 4, to: 4.6 };
/** Frames across the slow motion (30 fps grid) and around it. */
const SEQUENCE = [1.5, 1.6, 1.8, 2.1, 2.4, 2.8, 3.2, 3.5, 3.6, 3.8];

function plain(): RenderManifest {
  return helloManifest(2115, STYLE_ID);
}

function withMoments(): RenderManifest {
  const base = plain();
  return {
    ...base,
    shots: base.shots.map((shot) => ({ ...shot, timeRemap: [WINDOW], paletteShift: [SHIFT] })),
  };
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

describe('reveal moments (SwiftShader)', () => {
  it('slow motion = the plain shot at the remapped time; anchors and cues unchanged', async () => {
    const reference = await withPage(async (page) => {
      const info = await page.load(plain());
      const hashes = new Map<number, string>();
      for (const t of SEQUENCE) {
        hashes.set(t, await page.hashAt(t));
        const scene = remapTime([WINDOW], t);
        hashes.set(scene, await page.hashAt(scene));
      }
      return { info, hashes };
    });
    await withPage(async (page) => {
      const info = await page.load(withMoments());
      expect(info.anchors).toEqual(reference.info.anchors);
      expect(info.cues).toEqual(reference.info.cues);
      const forward: string[] = [];
      for (const t of SEQUENCE) {
        const hash = await page.hashAt(t);
        forward.push(hash);
        expect(hash, `t=${String(t)}`).toBe(reference.hashes.get(remapTime([WINDOW], t)));
      }
      // Outside the window the frame is the plain one, bit for bit.
      expect(forward[0]).toBe(reference.hashes.get(1.5));
      expect(forward.at(-1)).toBe(reference.hashes.get(3.8));
      // Inside it the picture lags (slow motion): not the plain frame of the same t.
      expect(forward[3]).not.toBe(reference.hashes.get(2.1));
      const backward: string[] = [];
      for (const t of [...SEQUENCE].reverse()) backward.push(await page.hashAt(t));
      expect(backward.reverse()).toEqual(forward);
      expect(page.errors).toEqual([]);
    });
  });

  it('palette shift flashes inside the palette, only inside its window', async () => {
    const before = await withPage(async (page) => {
      await page.load(plain());
      return {
        peak: new Uint8Array(await page.frameAt(4.3)),
        after: await page.hashAt(4.7),
      };
    });
    await withPage(async (page) => {
      await page.load(withMoments());
      const peak = new Uint8Array(await page.frameAt(4.3));
      const frame = { width: 640, height: 360, data: peak };
      expect(vibeGuard(frame, STYLE).issues).toEqual([]);
      expect(Buffer.from(peak).equals(Buffer.from(before.peak))).toBe(false);
      expect(await page.hashAt(4.7)).toBe(before.after);
      await compareWithGolden('moments-palette-shift-peak', frame);
      expect(page.errors).toEqual([]);
    });
  });
});
