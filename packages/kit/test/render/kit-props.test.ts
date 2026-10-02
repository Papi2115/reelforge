/**
 * Props (PLAN.md#3.3) in the engine harness (SwiftShader): a turntable test per prop of
 * examples/k04_props.js (0/90/180/270 degrees at t = 0..3: not blank, four different views, same
 * hashes when seeking back), contact sheets (packages/kit/out/contact/props-<style>.png; Crisp
 * 640: one row per prop, the four angles; other styles: one tile per prop at t = 0), and one
 * small golden: a 3x2 sheet of six props at half resolution.
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
import { composeSheet } from '../support/contact-sheet.js';
import { downscale } from '../support/image.js';
import {
  KIT_GOLDEN_DIR,
  KIT_OUT_DIR,
  PROP_SETUPS,
  PROPS_FILE,
  propSource,
  sceneManifest,
  type PropSetup,
} from '../support/scenes.js';

const ANGLES = [0, 1, 2, 3] as const;
const GOLDEN_PROPS: readonly PropSetup[] = [
  'calculator',
  'laptop',
  'server',
  'clock',
  'globe',
  'mapTable',
];
const OTHER_STYLES = ['noir-voxel', 'soft-480'] as const;
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

function manifest(setup: PropSetup, style?: string) {
  const options = style === undefined ? {} : { style };
  return sceneManifest(PROPS_FILE, { ...options, source: propSource(setup) });
}

/** A prop on a flat background (backs of devices are plain): 3+ colours, the background under 95 % of the frame. */
function propProblem(frame: Uint8Array, label: string): string[] {
  const stats = computeFrameStats(frame);
  const problems: string[] = [];
  if (stats.uniqueColors < 3) problems.push(`${label}: ${String(stats.uniqueColors)} colours`);
  if (stats.dominantColorShare >= 0.95) problems.push(`${label}: almost blank`);
  return problems;
}

async function writeSheet(
  name: string,
  tiles: readonly RgbaImage[],
  columns: number,
): Promise<void> {
  const file = path.join(KIT_OUT_DIR, 'contact', `${name}.png`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, encodePng(composeSheet(tiles, columns)));
}

describe('kit props (SwiftShader)', () => {
  it('k04_props passes the determinism lint for every prop and the gallery', () => {
    for (const setup of [...PROP_SETUPS, 'gallery'] as const) {
      expect(lintScene(propSource(setup), { filename: PROPS_FILE }), setup).toEqual([]);
    }
  });

  it(
    'turns every prop on the turntable deterministically (contact sheet, Crisp 640)',
    async () => {
      const tiles: RgbaImage[] = [];
      const failures: string[] = [];
      const errors = await withPage(async (page) => {
        for (const setup of PROP_SETUPS) {
          const info = await page.load(manifest(setup));
          const forward: string[] = [];
          for (const t of ANGLES) {
            const data = await page.frameAt(t);
            tiles.push(downscale({ width: info.width, height: info.height, data }, 2, 'nearest'));
            failures.push(...propProblem(data, `${setup} t=${String(t)}`));
            forward.push(await page.hashAt(t));
          }
          const backward: string[] = [];
          for (const t of [...ANGLES].reverse()) backward.push(await page.hashAt(t));
          if (backward.reverse().join() !== forward.join())
            failures.push(`${setup}: seek mismatch`);
          if (new Set(forward).size !== ANGLES.length) failures.push(`${setup}: views repeat`);
        }
        return [...page.errors];
      });
      await writeSheet('props-voxel-pixel-crisp640', tiles, ANGLES.length * 2);
      expect(errors).toEqual([]);
      expect(failures).toEqual([]);
    },
    SUITE_TIMEOUT,
  );

  it(
    'matches the props golden sheet (six props, half resolution)',
    async () => {
      const tiles: RgbaImage[] = [];
      await withPage(async (page) => {
        for (const setup of GOLDEN_PROPS) {
          const info = await page.load(manifest(setup));
          const data = await page.frameAt(0.5);
          tiles.push(downscale({ width: info.width, height: info.height, data }, 2, 'nearest'));
        }
        expect(page.errors).toEqual([]);
      });
      await compareWithGolden('kit-props-sheet', composeSheet(tiles, 3), undefined, {
        goldenDir: KIT_GOLDEN_DIR,
      });
    },
    SUITE_TIMEOUT,
  );

  it.each(OTHER_STYLES)(
    'renders every prop in %s',
    async (style) => {
      const tiles: RgbaImage[] = [];
      const failures: string[] = [];
      const errors = await withPage(async (page) => {
        for (const setup of PROP_SETUPS) {
          const info = await page.load(manifest(setup, style));
          const data = await page.frameAt(0);
          failures.push(...propProblem(data, `${style} ${setup}`));
          tiles.push({ width: info.width, height: info.height, data });
        }
        return [...page.errors];
      });
      await writeSheet(`props-${style}`, tiles, 6);
      expect(errors).toEqual([]);
      expect(failures).toEqual([]);
    },
    SUITE_TIMEOUT,
  );
});
