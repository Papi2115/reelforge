/**
 * Mascot reactions (2.3.7, docs/characters.md) in the engine harness (SwiftShader): the four
 * mascots play surprise, jaw-drop and nod-told-you side by side; goldens `character-reaction-*`
 * (two frames per reaction: the beat and the hold, Crisp 640, vibe guard), seek determinism in
 * both directions and after a reload, and a review sheet of all eight reactions three-quarter to
 * the camera (packages/kit/out/contact/character-reactions-tour.png, vibe guard on every frame).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  compareWithGolden,
  computeFrameStats,
  encodePng,
  launchHarnessBrowser,
  type HarnessBrowser,
  type HarnessPage,
  type RgbaImage,
} from '../../../engine/src/cli/index.js';
import { lintScene } from '../../../engine/src/index.js';
import { REACTIONS } from '../../src/characters/reactions.js';
import { composeSheet } from '../support/contact-sheet.js';
import { downscale } from '../support/image.js';
import { KIT_GOLDEN_DIR, KIT_OUT_DIR } from '../support/scenes.js';
import { expectVibe } from '../support/vibe.js';
import {
  CAST_FILE,
  castManifest,
  castSource,
  GOLDEN_REACTIONS,
  REACTION_SETUPS,
  TOUR_STEP,
} from './cast-scenes.js';

/** Seconds after each cue: the beat (pop, drop, nod) and the hold (O_O, gape, wink). */
const GOLDEN_OFFSETS: Readonly<Record<(typeof GOLDEN_REACTIONS)[number][0], readonly number[]>> = {
  surprise: [0.3, 0.9],
  'jaw-drop': [0.55, 1.3],
  'nod-told-you': [0.4, 1.5],
};
/** Review frames of the tour, seconds after each cue (double-take: aside, then snapped back). */
const TOUR_OFFSETS = [0.35, 1.0] as const;
const TOUR_DURATION = 0.5 + REACTIONS.length * TOUR_STEP + 0.5;
const SUITE_TIMEOUT = 600_000;

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

async function writeSheet(name: string, tiles: readonly RgbaImage[], columns: number) {
  const file = path.join(KIT_OUT_DIR, 'contact', `${name}.png`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, encodePng(composeSheet(tiles, columns)));
}

describe('mascot reactions (SwiftShader)', () => {
  it('the reaction setups pass the determinism lint', () => {
    for (const setup of REACTION_SETUPS) {
      expect(lintScene(castSource(setup), { filename: CAST_FILE }), setup).toEqual([]);
    }
  });

  it(
    'match the goldens (4 mascots x 3 reactions x 2 times) and keep the vibe',
    async () => {
      const tiles: RgbaImage[] = [];
      await withPage(async (page) => {
        const info = await page.load(castManifest('reactions'));
        for (const [name, at] of GOLDEN_REACTIONS) {
          for (const offset of GOLDEN_OFFSETS[name]) {
            const t = Math.round((at + offset) * 100) / 100;
            const data = await page.frameAt(t);
            const frame = { width: info.width, height: info.height, data };
            const label = `${name}-t${String(t)}`;
            const stats = computeFrameStats(data);
            expect(stats.uniqueColors, label).toBeGreaterThanOrEqual(8);
            expect(stats.dominantColorShare, label).toBeLessThan(0.9);
            expectVibe(frame, label);
            tiles.push(downscale(frame, 2, 'nearest'));
            await compareWithGolden(`character-reaction-${label}`, frame, undefined, {
              goldenDir: KIT_GOLDEN_DIR,
            });
          }
        }
        expect(page.errors).toEqual([]);
      });
      await writeSheet('character-reactions', tiles, 2);
    },
    SUITE_TIMEOUT,
  );

  it(
    'seek deterministically in both directions and after a reload',
    async () => {
      await withPage(async (page) => {
        const times = [0.75, 1.3, 3.6, 4.4, 5.9, 7];
        await page.load(castManifest('reactions'));
        const forward: string[] = [];
        for (const t of times) forward.push(await page.hashAt(t));
        const backward: string[] = [];
        for (const t of [...times].reverse()) backward.push(await page.hashAt(t));
        expect(backward.reverse()).toEqual(forward);
        expect(new Set(forward).size).toBe(times.length);
        await page.load(castManifest('reactions'));
        expect(await page.hashAt(times[3] ?? 0)).toBe(forward[3]);
        expect(page.errors).toEqual([]);
      });
    },
    SUITE_TIMEOUT,
  );

  it(
    'plays all eight reactions three-quarter to the camera (review sheet)',
    async () => {
      const rows = new Map<string, RgbaImage[]>();
      await withPage(async (page) => {
        const info = await page.load(castManifest('reaction-tour', undefined, TOUR_DURATION));
        for (const [slot, name] of REACTIONS.entries()) {
          const row: RgbaImage[] = [];
          for (const offset of TOUR_OFFSETS) {
            const t = 0.5 + slot * TOUR_STEP + offset;
            const data = await page.frameAt(t);
            const frame = { width: info.width, height: info.height, data };
            expectVibe(frame, `${name} t=${String(t)}`);
            row.push(frame);
          }
          rows.set(name, row);
        }
        expect(page.errors).toEqual([]);
      });
      // Full resolution, one sheet per reaction: judge them at the size they play.
      for (const [name, row] of rows) await writeSheet(`character-reaction-tour-${name}`, row, 2);
    },
    SUITE_TIMEOUT,
  );
});
