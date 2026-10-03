/**
 * Ambient variation (PLAN.md#12.8) in the engine harness (SwiftShader), on examples/k07_ambient.js:
 *
 * - off (no field, disabled, scale 0) renders every shot exactly as authored;
 * - on, a stretch of 12 neighbouring shots of an 8-minute film (one scene reused for every shot)
 *   never repeats a frame between neighbours, passes the vibe guard and stays a subtle shift of
 *   the authored frame (colour-histogram distance);
 * - the same manifest renders the same hashes in a fresh page and in any seek order;
 * - goldens `ambient-*` of six samples, and contact sheets per style (authored frame first, then
 *   four shots of the film) in packages/kit/out/contact/ambient-<style>.png.
 * The 80-shot parameter sequence itself is unit-tested in packages/engine/src/ambient.test.ts.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  compareWithGolden,
  encodePng,
  launchHarnessBrowser,
  type HarnessBrowser,
  type HarnessPage,
  type RgbaImage,
} from '../../../engine/src/cli/index.js';
import { lintScene } from '../../../engine/src/index.js';
import { composeSheet } from '../support/contact-sheet.js';
import {
  KIT_GOLDEN_DIR,
  KIT_OUT_DIR,
  sceneSource,
  type RenderManifest,
} from '../support/scenes.js';
import { expectVibe } from '../support/vibe.js';

const FILE = 'examples/k07_ambient.js';
const SETUPS = ['grid', 'night', 'void', 'city', 'room'] as const;
type Setup = (typeof SETUPS)[number];
const SHOT_LENGTH = 6;
/** Local sample time: past the middle, so the camera drift shows too. */
const T = 4.5;
const ROLLS = ['A', 'A', 'B', 'A', 'C'] as const;
/** Storyboard positions of the 12 neighbouring shots (minutes 3-4.2 of an 80-shot film). */
const FILM_INDICES = Array.from({ length: 12 }, (_, k) => 30 + k);
/**
 * Upper bound of the mean-colour distance between a varied and the authored frame (about 15/255
 * of luma; measured 0.0006-0.044 on the Crisp 640 grid film).
 */
const MAX_SHIFT = 0.06;
const GOLDENS: readonly (readonly [Setup, number])[] = [
  ['grid', 30],
  ['grid', 31],
  ['night', 12],
  ['void', 50],
  ['city', 64],
  ['room', 7],
];
const SHEET_INDICES = [30, 31, 47, 66];
const STYLES = ['voxel-pixel-crisp640', 'noir-voxel', 'soft-480'] as const;
const STYLE_TIMEOUT = 300_000;

interface AmbientOptions {
  readonly ambient?: RenderManifest['ambientVariation'];
  readonly style?: string;
}

function setupSource(setup: Setup): string {
  const source = sceneSource(FILE);
  const declaration = "const SETUP = 'grid';";
  if (!source.includes(declaration)) throw new Error(`${FILE} no longer declares ${declaration}`);
  return source.replace(declaration, `const SETUP = '${setup}';`);
}

/** One shot per storyboard index, all with the same scene: a stretch of a longer film. */
function film(
  setup: Setup,
  indices: readonly number[],
  options: AmbientOptions = {},
): RenderManifest {
  const source = setupSource(setup);
  return {
    version: 1,
    ...(options.style === undefined ? {} : { style: options.style }),
    fps: 30,
    seed: 2115,
    ...(options.ambient === undefined ? {} : { ambientVariation: options.ambient }),
    shots: indices.map((index, k) => ({
      id: `s${String(index + 1).padStart(2, '0')}`,
      t0: k * SHOT_LENGTH,
      t1: (k + 1) * SHOT_LENGTH,
      scene: { file: FILE, source },
      ambient: { index, act: Math.floor(index / 16), roll: ROLLS[index % ROLLS.length] ?? 'A' },
    })),
  };
}

const ON = { enabled: true, seed: 2115 } as const;

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

async function hashes(page: HarnessPage, manifest: RenderManifest, order = 1): Promise<string[]> {
  await page.load(manifest);
  const times = manifest.shots.map((_, k) => k * SHOT_LENGTH + T);
  const sampled: string[] = [];
  for (const t of order > 0 ? times : [...times].reverse()) sampled.push(await page.hashAt(t));
  return order > 0 ? sampled : sampled.reverse();
}

async function frames(page: HarnessPage, manifest: RenderManifest): Promise<Uint8Array[]> {
  const info = await page.load(manifest);
  const result: Uint8Array[] = [];
  for (let k = 0; k < manifest.shots.length; k += 1) {
    result.push(await page.frameAt(k * SHOT_LENGTH + T));
  }
  expect(info.width * info.height * 4).toBe(result[0]?.length);
  return result;
}

/** Mean colour of a frame (0..1 per channel). */
function meanColor(data: Uint8Array): [number, number, number] {
  let [red, green, blue] = [0, 0, 0];
  for (let offset = 0; offset < data.length; offset += 4) {
    red += data[offset] ?? 0;
    green += data[offset + 1] ?? 0;
    blue += data[offset + 2] ?? 0;
  }
  const pixels = (data.length / 4) * 255;
  return [red / pixels, green / pixels, blue / pixels];
}

/**
 * How far a varied frame drifts from the authored one: luma-weighted distance of their mean
 * colours (the palette metric of the post pass), 0 = same overall colour.
 */
function colorShift(first: Uint8Array, second: Uint8Array): number {
  const [a, b] = [meanColor(first), meanColor(second)];
  const weights = [0.3, 0.59, 0.11];
  return Math.sqrt(
    weights.reduce(
      (sum, weight, channel) => sum + weight * ((a[channel] ?? 0) - (b[channel] ?? 0)) ** 2,
      0,
    ),
  );
}

describe('ambient variation (SwiftShader)', () => {
  it('k07_ambient passes the determinism lint in every setup', () => {
    for (const setup of SETUPS) {
      expect(lintScene(setupSource(setup), { filename: FILE }), setup).toEqual([]);
    }
  });

  it('renders every shot as authored when the switch is off', async () => {
    await withPage(async (page) => {
      const authored = await hashes(page, film('grid', FILM_INDICES));
      // The test scene has nothing seeded: without variation all 12 shots are the same frame.
      expect(new Set(authored).size).toBe(1);
      expect(
        await hashes(page, film('grid', FILM_INDICES, { ambient: { ...ON, enabled: false } })),
      ).toEqual(authored);
      expect(
        await hashes(page, film('grid', FILM_INDICES, { ambient: { ...ON, scale: 0 } })),
      ).toEqual(authored);
      expect(page.errors).toEqual([]);
    });
  });

  it('varies neighbouring shots subtly, inside the style palette, deterministically', async () => {
    const shifts: number[] = [];
    await withPage(async (page) => {
      const [authored] = await frames(page, film('grid', [FILM_INDICES[0] ?? 0]));
      if (!authored) throw new Error('no authored frame');
      const manifest = film('grid', FILM_INDICES, { ambient: ON });
      const varied = await frames(page, manifest);
      const sampled = await hashes(page, manifest);
      sampled.forEach((hash, k) => {
        if (k > 0) expect(hash, `shots ${String(k)}/${String(k + 1)}`).not.toBe(sampled[k - 1]);
      });
      varied.forEach((data, k) => {
        expectVibe({ width: 640, height: 360, data }, `film shot ${String(k)}`);
        shifts.push(colorShift(authored, data));
      });
      expect(await hashes(page, manifest, -1)).toEqual(sampled);
      expect(page.errors).toEqual([]);
      const fresh = await withPage((other) => hashes(other, manifest));
      expect(fresh).toEqual(sampled);
    });
    for (const shift of shifts) {
      expect(shift).toBeGreaterThan(0);
    }
    expect(Math.max(...shifts)).toBeLessThan(MAX_SHIFT);
  });

  it('matches the ambient goldens (Crisp 640)', async () => {
    await withPage(async (page) => {
      for (const [setup, index] of GOLDENS) {
        const [data] = await frames(page, film(setup, [index], { ambient: ON }));
        if (!data) throw new Error('no frame');
        expectVibe({ width: 640, height: 360, data }, `${setup} ${String(index)}`);
        await compareWithGolden(
          `ambient-${setup}-i${String(index)}`,
          { width: 640, height: 360, data },
          undefined,
          { goldenDir: KIT_GOLDEN_DIR },
        );
      }
      expect(page.errors).toEqual([]);
    });
  });

  it.each(STYLES)(
    'renders the contact sheet of every setup in %s',
    async (style) => {
      const tiles: (RgbaImage & { readonly name: string })[] = [];
      await withPage(async (page) => {
        for (const setup of SETUPS) {
          const info = await page.load(film(setup, [0], { style }));
          const size = { width: info.width, height: info.height };
          tiles.push({ ...size, data: await page.frameAt(T), name: `${setup}-authored` });
          const varied = await frames(page, film(setup, SHEET_INDICES, { style, ambient: ON }));
          varied.forEach((data, k) => {
            tiles.push({ ...size, data, name: `${setup}-i${String(SHEET_INDICES[k])}` });
            expectVibe({ ...size, data }, `${style} ${setup} ${String(k)}`, style);
          });
        }
        expect(page.errors).toEqual([]);
      });
      const file = path.join(KIT_OUT_DIR, 'contact', `ambient-${style}.png`);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, encodePng(composeSheet(tiles, SHEET_INDICES.length + 1)));
    },
    STYLE_TIMEOUT,
  );
});
