/**
 * Tension map (PLAN.md#12.22) through the real engine harness (SwiftShader), on
 * examples/k07_ambient.js with ambient variation on: the same 6 shots under a calm and a tense
 * curve (per-shot `tension` + budget `scale` from the shared manifest helpers) render measurably
 * darker backgrounds when tense, stay in the style palette (vibe guard), and neutral tension
 * renders exactly the frames of a film without a tension map.
 */
import {
  ambientShotInputs,
  withShotTension,
  type RenderManifest,
  type TensionFile,
} from '../../../shared/src/index.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  launchHarnessBrowser,
  type HarnessBrowser,
  type HarnessPage,
} from '../../../engine/src/cli/index.js';
import { sceneSource } from '../support/scenes.js';
import { expectVibe } from '../support/vibe.js';

const FILE = 'examples/k07_ambient.js';
const SHOT_LENGTH = 6;
const T = 4.5;
const COUNT = 6;
/** Storyboard positions 30..35 of a longer film (as in kit-ambient.test.ts). */
const FIRST_INDEX = 30;
const ON = { enabled: true, seed: 2115 } as const;

function curve(v: number): TensionFile {
  return {
    version: 1,
    source: 'user',
    points: [
      { t: 0, v },
      { t: COUNT * SHOT_LENGTH, v },
    ],
  };
}

function setupSource(setup: string): string {
  return sceneSource(FILE).replace("const SETUP = 'grid';", `const SETUP = '${setup}';`);
}

/** The film; `tension` undefined = no tension map (2.0 manifest). */
function film(setup: string, tension: TensionFile | undefined): RenderManifest {
  const source = setupSource(setup);
  const shots = Array.from({ length: COUNT }, (_, k) => ({
    id: `s${String(FIRST_INDEX + k + 1)}`,
    t0: k * SHOT_LENGTH,
    t1: (k + 1) * SHOT_LENGTH,
  }));
  const positions = ambientShotInputs(shots.map(() => ({}))).map((input, k) => ({
    ...input,
    index: FIRST_INDEX + k,
    act: 1,
  }));
  const ambient = tension === undefined ? positions : withShotTension(positions, shots, tension);
  return {
    version: 1,
    fps: 30,
    seed: 2115,
    ambientVariation: ON,
    shots: shots.map((shot, k) => ({
      ...shot,
      scene: { file: FILE, source },
      ...(ambient[k] === undefined ? {} : { ambient: ambient[k] }),
    })),
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
  const page = await browser.open({ lint: true });
  try {
    return await run(page);
  } finally {
    await page.close();
  }
}

async function frames(page: HarnessPage, manifest: RenderManifest): Promise<Uint8Array[]> {
  await page.load(manifest);
  const result: Uint8Array[] = [];
  for (let k = 0; k < manifest.shots.length; k += 1) {
    result.push(await page.frameAt(k * SHOT_LENGTH + T));
  }
  return result;
}

/** Mean luma (0..1, the post pass's weights) of a frame. */
function meanLuma(data: Uint8Array): number {
  let sum = 0;
  for (let offset = 0; offset < data.length; offset += 4) {
    sum +=
      0.3 * (data[offset] ?? 0) + 0.59 * (data[offset + 1] ?? 0) + 0.11 * (data[offset + 2] ?? 0);
  }
  return sum / ((data.length / 4) * 255);
}

const average = (values: readonly number[]): number =>
  values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);

describe('tension map (SwiftShader)', () => {
  it('a tense curve renders darker backgrounds than a calm one, inside the palette', async () => {
    await withPage(async (page) => {
      for (const setup of ['grid', 'city']) {
        const calm = await frames(page, film(setup, curve(0.15)));
        const tense = await frames(page, film(setup, curve(0.95)));
        tense.forEach((data, k) => {
          expectVibe({ width: 640, height: 360, data }, `${setup} tense shot ${String(k)}`);
        });
        const calmLuma = average(calm.map(meanLuma));
        const tenseLuma = average(tense.map(meanLuma));
        const measured = `${setup}: calm ${calmLuma.toFixed(4)}, tense ${tenseLuma.toFixed(4)}`;
        expect(tenseLuma, measured).toBeLessThan(calmLuma - 0.005);
      }
      expect(page.errors).toEqual([]);
    });
  });

  it('neutral tension renders exactly the frames of a film without a tension map', async () => {
    await withPage(async (page) => {
      const plain = film('grid', undefined);
      const neutral = film('grid', curve(0.5));
      await page.load(plain);
      const plainHashes: string[] = [];
      for (let k = 0; k < COUNT; k += 1) plainHashes.push(await page.hashAt(k * SHOT_LENGTH + T));
      await page.load(neutral);
      const neutralHashes: string[] = [];
      for (let k = 0; k < COUNT; k += 1) neutralHashes.push(await page.hashAt(k * SHOT_LENGTH + T));
      expect(neutralHashes).toEqual(plainHashes);
      expect(page.errors).toEqual([]);
    });
  });
});
