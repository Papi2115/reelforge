/**
 * Tension map (PLAN.md#12.22) through the real engine harness (SwiftShader), on
 * examples/k07_ambient.js with ambient variation on: the same 6 shots under a calm and a tense
 * curve (per-shot `tension` + budget `scale` from the shared manifest helpers) render measurably
 * darker backgrounds when tense, stay in the style palette (vibe guard), and neutral tension
 * renders exactly the frames of a film without a tension map. The lit `room` setup covers the
 * host mood grade (engine `mood.ts`): lit content no longer outweighs the darker tones.
 * Contact sheet (calm row, tense row per setup): packages/kit/out/contact/tension.png.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  ambientShotInputs,
  withShotTension,
  type RenderManifest,
  type TensionFile,
} from '../../../shared/src/index.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  encodePng,
  launchHarnessBrowser,
  type HarnessBrowser,
  type HarnessPage,
  type RgbaImage,
} from '../../../engine/src/cli/index.js';
import { composeSheet } from '../support/contact-sheet.js';
import { KIT_OUT_DIR, sceneSource } from '../support/scenes.js';
import { expectVibe } from '../support/vibe.js';

const FILE = 'examples/k07_ambient.js';
const SHOT_LENGTH = 6;
const T = 4.5;
const COUNT = 6;
/** Storyboard positions 30..35 of a longer film (as in kit-ambient.test.ts). */
const FIRST_INDEX = 30;
const ON = { enabled: true, seed: 2115 } as const;
/** Setup -> least mean-luma gap (calm - tense); the lit room is the mood grade's case. */
const MIN_GAP: Readonly<Record<string, number>> = { grid: 0.03, city: 0.015, room: 0.02 };
const SHEET_SHOTS = 3;

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
  it('a tense curve renders darker frames than a calm one, inside the palette', async () => {
    const tiles: RgbaImage[] = [];
    await withPage(async (page) => {
      for (const [setup, gap] of Object.entries(MIN_GAP)) {
        const calm = await frames(page, film(setup, curve(0.15)));
        const tense = await frames(page, film(setup, curve(0.95)));
        tense.forEach((data, k) => {
          expectVibe({ width: 640, height: 360, data }, `${setup} tense shot ${String(k)}`);
        });
        for (const data of [...calm.slice(0, SHEET_SHOTS), ...tense.slice(0, SHEET_SHOTS)]) {
          tiles.push({ width: 640, height: 360, data });
        }
        const calmLuma = average(calm.map(meanLuma));
        const tenseLuma = average(tense.map(meanLuma));
        const measured = `${setup}: calm ${calmLuma.toFixed(4)}, tense ${tenseLuma.toFixed(4)}`;
        expect(tenseLuma, measured).toBeLessThan(calmLuma - gap);
      }
      expect(page.errors).toEqual([]);
    });
    const file = path.join(KIT_OUT_DIR, 'contact', 'tension.png');
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, encodePng(composeSheet(tiles, SHEET_SHOTS)));
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
