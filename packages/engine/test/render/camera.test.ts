/**
 * Cinematic camera moves (PLAN.md#12.28, ADR-013) in the engine harness (SwiftShader):
 * examples/s03_camera.js plays rack focus, dolly zoom, orbit and parallax in 3 s acts. Each move
 * has goldens at its start and end (`camera-<move>-start|end`), every frame passes the vibe guard
 * (the dither bokeh stays on the palette), frames are pure functions of t, and a focus whose
 * circle of confusion is 0 everywhere renders byte-identically to no focus at all.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { countDifferingPixels } from '../../src/cli/frame-stats.js';
import { compareWithGolden } from '../../src/cli/goldens.js';
import {
  launchHarnessBrowser,
  type HarnessBrowser,
  type HarnessPage,
} from '../../src/cli/harness-session.js';
import { resolveStyle, vibeGuard } from '../../src/index.js';
import {
  CAMERA_ACT_LENGTH,
  CAMERA_ACTS,
  CAMERA_SCENE,
  cameraManifest,
} from '../support/manifests.js';

const WIDTH = 640;
const HEIGHT = 360;
const STYLE = resolveStyle({ style: 'voxel-pixel-crisp640' });
/** Sample times inside each act: just after the move starts and near its end. */
const PHASES = { start: 0.5, end: 2.8 } as const;
const RACK_FOCUS_CALL =
  'ctx.camera.rackFocus({ from: state.laptop, to: state.hero, t0: 0.8, t1: 2.2 });';

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

function sceneWith(replacement: string): string {
  const source = CAMERA_SCENE.source;
  expect(source).toContain(RACK_FOCUS_CALL);
  return source.replace(RACK_FOCUS_CALL, replacement);
}

async function frameOf(source: string | undefined, t: number): Promise<Uint8Array> {
  return withPage(async (page) => {
    await page.load(cameraManifest(source));
    const frame = new Uint8Array(await page.frameAt(t));
    expect(page.errors).toEqual([]);
    return frame;
  });
}

describe('camera moves (SwiftShader)', () => {
  it('renders every move at its start and end as the goldens, in the palette', async () => {
    await withPage(async (page) => {
      await page.load(cameraManifest());
      for (const [index, move] of CAMERA_ACTS.entries()) {
        for (const [phase, offset] of Object.entries(PHASES)) {
          const t = index * CAMERA_ACT_LENGTH + offset;
          const data = new Uint8Array(await page.frameAt(t));
          const name = `camera-${move}-${phase}`;
          expect(vibeGuard({ width: WIDTH, height: HEIGHT, data }, STYLE).issues, name).toEqual([]);
          await compareWithGolden(name, { width: WIDTH, height: HEIGHT, data });
        }
      }
      expect(page.errors).toEqual([]);
    });
  });

  it('renders the same frame for the same t whatever was seeked before', async () => {
    const times = [0.5, 1.5, 4.2, 7, 10.4];
    await withPage(async (page) => {
      await page.load(cameraManifest());
      const forward = [];
      for (const t of times) forward.push(await page.hashAt(t));
      await page.hashAt(11.9);
      const backward = [];
      for (const t of [...times].reverse()) backward.push(await page.hashAt(t));
      expect(backward.reverse()).toEqual(forward);
      expect(new Set(forward).size).toBe(times.length);
    });
  });

  it('is byte-identical to no focus where the circle of confusion is 0', async () => {
    const t = PHASES.start;
    const sharp = await frameOf(sceneWith('// no focus'), t);
    const zeroCoc = await frameOf(
      sceneWith(
        'ctx.camera.rackFocus({ from: state.laptop, to: state.hero, t0: 0.8, t1: 2.2, bokeh: 0.0001 });',
      ),
      t,
    );
    expect(Buffer.from(zeroCoc).equals(Buffer.from(sharp))).toBe(true);
    // The real rack focus blurs a large part of the frame (the background behind the laptop).
    const focused = await frameOf(undefined, t);
    const changed = countDifferingPixels(focused, sharp);
    expect(changed / (WIDTH * HEIGHT)).toBeGreaterThan(0.05);
  });
});
