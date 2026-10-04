/**
 * Look `diorama` (PLAN.md#12.3) in the engine harness (SwiftShader): every diorama setup of the
 * inline scene below at fixed times, as goldens (`look-diorama-<setup>-t<t>`) with the vibe
 * guard on every frame, a contact sheet (packages/kit/out/contact/look-diorama.png), a seek
 * determinism check and the perf probe (SwiftShader informational; GPU >= 30 fps with
 * REELFORGE_KIT_PERF_GPU=1).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  buildHarness,
  compareWithGolden,
  computeFrameStats,
  encodePng,
  launchHarnessBrowser,
  startStaticServer,
  type HarnessBrowser,
  type HarnessPage,
  type RgbaImage,
} from '../../../engine/src/cli/index.js';
import { lintScene } from '../../../engine/src/index.js';
import { composeSheet } from '../support/contact-sheet.js';
import { GPU_PERF_ENABLED, measure, record } from '../support/perf.js';
import { KIT_GOLDEN_DIR, KIT_OUT_DIR, sceneManifest } from '../support/scenes.js';
import { expectVibe } from '../support/vibe.js';

const SCENE_FILE = 'examples/look_diorama.js';
const SETUPS = [
  'office',
  'officeNight',
  'officeAnnotated',
  'serverRoom',
  'serverRoomAlarm',
  'city',
  'cityNight',
  'room',
  'roomNight',
] as const;
type Setup = (typeof SETUPS)[number];
const GOLDEN_TIMES: Readonly<Record<Setup, readonly number[]>> = {
  office: [0, 2.5],
  officeNight: [1],
  officeAnnotated: [3],
  serverRoom: [0, 2],
  serverRoomAlarm: [1],
  city: [0, 3],
  cityNight: [2],
  room: [0, 1.5],
  roomNight: [2],
};
const PREVIEW_MIN_FPS = 30;
const SWIFTSHADER_MIN_FPS = 2;
const SUITE_TIMEOUT = 300_000;

/** Scene under test (scene contract: no imports; update() poses everything from t). */
const SCENE = `
export const meta = { id: 'd12', title: 'Diorama look', treatment: '3d-reconstruction' };

const SETUP = 'office';

const SETUPS = {
  office: { env: 'dioramaOffice', params: { seed: 3 }, camera: {} },
  officeNight: {
    env: 'dioramaOffice',
    params: { seed: 5, time: 'night', accent: 'accent2', density: 1 },
    camera: { offset: [-0.16, 0] },
  },
  officeAnnotated: {
    env: 'dioramaOffice',
    params: { seed: 3, time: 'dusk' },
    camera: { zoom: 1.5, focus: 'desk1' },
    annotate(ctx, diorama) {
      ctx.annotate.callout({
        id: 'screen',
        target: { object: diorama, anchor: 'monitor1' },
        text: 'BUILD #42',
        at: 0.5,
      });
      ctx.annotate.ring({ id: 'cooler', target: { object: diorama, anchor: 'cooler' }, radius: 0.06, at: 1 });
    },
  },
};

SETUPS.serverRoom = { env: 'dioramaServerRoom', params: { seed: 1 }, camera: {} };
SETUPS.serverRoomAlarm = {
  env: 'dioramaServerRoom',
  params: { seed: 2, time: 'night', accent: 'accent3' },
  camera: { offset: [0.16, 0] },
  alarm: (t) => (t > 0.5 ? 1 : 0),
};

SETUPS.city = { env: 'dioramaCity', params: { seed: 4 }, camera: {} };
SETUPS.cityNight = {
  env: 'dioramaCity',
  params: { seed: 9, time: 'night', accent: 'accent2', traffic: 7 },
  camera: { zoom: 1.5, focus: 'landmark' },
};

SETUPS.room = { env: 'dioramaRoom', params: { seed: 2 }, camera: {} };
SETUPS.roomNight = {
  env: 'dioramaRoom',
  params: { seed: 6, time: 'night', accent: 'accent4' },
  camera: { zoom: 1.3, focus: 'rug' },
};

export function build(ctx) {
  const { three, scene, palette, kit } = ctx;
  const setup = SETUPS[SETUP];
  scene.background = new three.Color(palette.sky);
  const diorama = kit.env[setup.env](setup.params);
  scene.add(diorama);
  return { setup, diorama };
}

export function update(t, state, ctx) {
  const screen = [ctx.shot.width, ctx.shot.height];
  if (state.setup.alarm) state.diorama.alarm(state.setup.alarm(t));
  state.diorama.update(t);
  ctx.camera.set(state.diorama.camera({ t, screen, ...state.setup.camera }));
  if (state.setup.annotate) state.setup.annotate(ctx, state.diorama);
}
`;

function sceneFor(setup: Setup): string {
  const declaration = "const SETUP = 'office';";
  if (!SCENE.includes(declaration)) throw new Error(`the scene no longer declares ${declaration}`);
  return SCENE.replace(declaration, `const SETUP = '${setup}';`);
}

function manifest(setup: Setup) {
  return sceneManifest(SCENE_FILE, { source: sceneFor(setup), duration: 8 });
}

/** Not blank, not one flat colour, and a real picture (several palette colours). */
function expectPicture(frame: Uint8Array, label: string): void {
  const stats = computeFrameStats(frame);
  expect(stats.uniqueColors, label).toBeGreaterThanOrEqual(8);
  expect(stats.dominantColorShare, label).toBeLessThan(0.8);
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

describe('look diorama (SwiftShader)', () => {
  it('passes the determinism lint in every setup', () => {
    for (const setup of SETUPS) {
      expect(lintScene(sceneFor(setup), { filename: SCENE_FILE }), setup).toEqual([]);
    }
  });

  it('seeks deterministically in both directions and animates', async () => {
    await withPage(async (page) => {
      await page.load(manifest('office'));
      const times = [0, 1.3, 2.6, 4];
      const forward = [];
      for (const t of times) forward.push(await page.hashAt(t));
      const backward = [];
      for (const t of [...times].reverse()) backward.push(await page.hashAt(t));
      expect(backward.reverse()).toEqual(forward);
      expect(new Set(forward).size).toBe(times.length);
      expect(page.errors).toEqual([]);
    });
  });

  it(
    'matches the goldens, keeps the vibe and writes the contact sheet',
    async () => {
      const tiles: (RgbaImage & { readonly name: string })[] = [];
      const errors = await withPage(async (page) => {
        for (const setup of SETUPS) {
          const info = await page.load(manifest(setup));
          for (const t of GOLDEN_TIMES[setup]) {
            const data = await page.frameAt(t);
            const name = `look-diorama-${setup}-t${String(t)}`;
            tiles.push({ width: info.width, height: info.height, data, name });
          }
        }
        return [...page.errors];
      });
      // Written before the checks, so a failing frame can be looked at.
      const dir = path.join(KIT_OUT_DIR, 'contact', 'look-diorama');
      await mkdir(dir, { recursive: true });
      for (const tile of tiles)
        await writeFile(path.join(dir, `${tile.name}.png`), encodePng(tile));
      await writeFile(
        path.join(KIT_OUT_DIR, 'contact', 'look-diorama.png'),
        encodePng(composeSheet(tiles, 2)),
      );
      expect(errors).toEqual([]);
      for (const tile of tiles) {
        expectPicture(tile.data, tile.name);
        expectVibe(tile, tile.name);
        await compareWithGolden(tile.name, tile, undefined, { goldenDir: KIT_GOLDEN_DIR });
      }
    },
    SUITE_TIMEOUT,
  );
});

/** One setup per diorama (the city is the heaviest: 12 buildings, cars, walkers, smoke). */
const PERF_SETUPS = ['office', 'serverRoom', 'city', 'room'] as const;

describe('look diorama performance', () => {
  it(
    'SwiftShader (informational) and GPU preview budget',
    async () => {
      const server = await startStaticServer(await buildHarness());
      try {
        const results = path.join(KIT_OUT_DIR, 'perf', 'look-diorama.json');
        for (const setup of PERF_SETUPS) {
          const swift = await measure(server, 'swiftshader', setup, manifest(setup), 10);
          await record(results, [swift]);
          expect(swift.renderer).toMatch(/SwiftShader/);
          expect(swift.fps, setup).toBeGreaterThan(SWIFTSHADER_MIN_FPS);
          if (!GPU_PERF_ENABLED) continue;
          const gpu = await measure(server, 'gpu', setup, manifest(setup));
          await record(results, [gpu]);
          expect(gpu.renderer).not.toMatch(/SwiftShader/);
          expect(gpu.fps, setup).toBeGreaterThanOrEqual(PREVIEW_MIN_FPS);
        }
      } finally {
        await server.close();
      }
    },
    SUITE_TIMEOUT,
  );
});
