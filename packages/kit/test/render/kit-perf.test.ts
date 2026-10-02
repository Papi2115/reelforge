/**
 * Voxel performance (PLAN.md#3.1: 100k voxels >= 60 fps preview), measured with the full harness
 * seek path (see support/perf.ts).
 *
 * - SwiftShader (always): informational floor only, CPU rasterization.
 * - Hardware GPU (`REELFORGE_KIT_PERF_GPU=1`, ANGLE D3D11, local only): must reach 60 fps.
 *
 * Results go to packages/kit/out/perf/voxel-stress.json.
 */
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  buildHarness,
  startStaticServer,
  type StaticServer,
} from '../../../engine/src/cli/index.js';
import { GPU_PERF_ENABLED, measure, record, TARGET_FPS } from '../support/perf.js';
import { KIT_OUT_DIR, sceneManifest, STRESS_FILE, stressSource } from '../support/scenes.js';

/** Instanced cubes are ~15x slower on SwiftShader; fewer frames keep the suite short. */
const SWIFTSHADER_INSTANCED_FRAMES = 10;
/** Generous SwiftShader floor (slow CI runners); the 60 fps target applies to the GPU run. */
const SWIFTSHADER_MIN_FPS = 5;
const RESULTS_FILE = path.join(KIT_OUT_DIR, 'perf', 'voxel-stress.json');

let server: StaticServer;

beforeAll(async () => {
  server = await startStaticServer(await buildHarness());
});

afterAll(async () => {
  await server.close();
});

describe('100k-voxel stress scene performance', () => {
  it('SwiftShader: greedy (auto) and instanced (informational)', async () => {
    const samples = [
      await measure(server, 'swiftshader', 'auto', sceneManifest(STRESS_FILE)),
      await measure(
        server,
        'swiftshader',
        'instanced',
        sceneManifest(STRESS_FILE, { source: stressSource('instanced') }),
        SWIFTSHADER_INSTANCED_FRAMES,
      ),
    ];
    await record(RESULTS_FILE, samples);
    for (const sample of samples) expect(sample.renderer).toMatch(/SwiftShader/);
    expect(samples[0]?.fps).toBeGreaterThan(SWIFTSHADER_MIN_FPS);
  });

  it.runIf(GPU_PERF_ENABLED)('hardware GPU: greedy (auto) holds 60 fps', async () => {
    const samples = [
      await measure(server, 'gpu', 'auto', sceneManifest(STRESS_FILE)),
      await measure(
        server,
        'gpu',
        'instanced',
        sceneManifest(STRESS_FILE, { source: stressSource('instanced') }),
      ),
    ];
    await record(RESULTS_FILE, samples);
    const greedy = samples[0];
    expect(greedy?.renderer).not.toMatch(/SwiftShader/);
    expect(greedy?.fps).toBeGreaterThanOrEqual(TARGET_FPS);
  });
});
