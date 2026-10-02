/**
 * Props performance (PLAN.md#3.3): the 20-prop gallery of examples/k04_props.js (animated
 * screens, LEDs, clocks, globe) and the 'city' setup of examples/k06_world.js (hero + 200-person
 * crowd + 6 buildings + 2 driving vehicles) through the full harness seek path (support/perf.ts).
 *
 * - SwiftShader (always): a few frames, informational floor only.
 * - Hardware GPU (`REELFORGE_KIT_PERF_GPU=1`, local only): must reach 60 fps.
 *
 * Results go to packages/kit/out/perf/props.json.
 */
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  buildHarness,
  startStaticServer,
  type StaticServer,
} from '../../../engine/src/cli/index.js';
import { GPU_PERF_ENABLED, measure, record, TARGET_FPS } from '../support/perf.js';
import {
  KIT_OUT_DIR,
  PROPS_FILE,
  propSource,
  sceneManifest,
  WORLD_FILE,
  worldSource,
} from '../support/scenes.js';

const SWIFTSHADER_FRAMES = 10;
const SWIFTSHADER_MIN_FPS = 2;
const RESULTS_FILE = path.join(KIT_OUT_DIR, 'perf', 'props.json');
const GALLERY = sceneManifest(PROPS_FILE, { source: propSource('gallery') });
const CITY = sceneManifest(WORLD_FILE, { source: worldSource('city') });

let server: StaticServer;

beforeAll(async () => {
  server = await startStaticServer(await buildHarness());
});

afterAll(async () => {
  await server.close();
});

const SCENES = [
  ['gallery (20 props)', 'gallery', GALLERY],
  ['city (hero, 200-person crowd, 6 buildings, 2 vehicles)', 'city', CITY],
] as const;

describe.each(SCENES)('props performance: %s', (_label, mode, manifest) => {
  it('SwiftShader (informational)', async () => {
    const sample = await measure(server, 'swiftshader', mode, manifest, SWIFTSHADER_FRAMES);
    await record(RESULTS_FILE, [sample]);
    expect(sample.renderer).toMatch(/SwiftShader/);
    expect(sample.fps).toBeGreaterThan(SWIFTSHADER_MIN_FPS);
  });

  it.runIf(GPU_PERF_ENABLED)('hardware GPU: holds 60 fps', async () => {
    const sample = await measure(server, 'gpu', mode, manifest);
    await record(RESULTS_FILE, [sample]);
    expect(sample.renderer).not.toMatch(/SwiftShader/);
    expect(sample.fps).toBeGreaterThanOrEqual(TARGET_FPS);
  });
});
