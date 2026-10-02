/**
 * Environment performance (PLAN.md#3.2): every setup of examples/k03_envs.js through the full
 * harness seek path (see support/perf.ts).
 *
 * - SwiftShader (always): a few frames per setup, informational floor only.
 * - Hardware GPU (`REELFORGE_KIT_PERF_GPU=1`, local only): each environment must reach 60 fps.
 *
 * Results go to packages/kit/out/perf/environments.json.
 */
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  buildHarness,
  startStaticServer,
  type StaticServer,
} from '../../../engine/src/cli/index.js';
import { GPU_PERF_ENABLED, measure, record, TARGET_FPS, type PerfSample } from '../support/perf.js';
import { ENV_SETUPS, ENVS_FILE, envSource, KIT_OUT_DIR, sceneManifest } from '../support/scenes.js';

const SWIFTSHADER_FRAMES = 10;
const SWIFTSHADER_MIN_FPS = 2;
const RESULTS_FILE = path.join(KIT_OUT_DIR, 'perf', 'environments.json');
const SUITE_TIMEOUT = 300_000;

let server: StaticServer;

beforeAll(async () => {
  server = await startStaticServer(await buildHarness());
});

afterAll(async () => {
  await server.close();
});

async function measureAll(backend: PerfSample['backend'], frames?: number): Promise<PerfSample[]> {
  const samples: PerfSample[] = [];
  for (const setup of ENV_SETUPS) {
    const manifest = sceneManifest(ENVS_FILE, { source: envSource(setup) });
    samples.push(await measure(server, backend, setup, manifest, frames));
  }
  await record(RESULTS_FILE, samples);
  return samples;
}

describe('environment performance', () => {
  it(
    'SwiftShader: every environment (informational)',
    async () => {
      const samples = await measureAll('swiftshader', SWIFTSHADER_FRAMES);
      for (const sample of samples) {
        expect(sample.renderer).toMatch(/SwiftShader/);
        expect(sample.fps, sample.mode).toBeGreaterThan(SWIFTSHADER_MIN_FPS);
      }
    },
    SUITE_TIMEOUT,
  );

  it.runIf(GPU_PERF_ENABLED)(
    'hardware GPU: every environment holds 60 fps',
    async () => {
      const samples = await measureAll('gpu');
      for (const sample of samples) {
        expect(sample.renderer, sample.mode).not.toMatch(/SwiftShader/);
        expect(sample.fps, sample.mode).toBeGreaterThanOrEqual(TARGET_FPS);
      }
    },
    SUITE_TIMEOUT,
  );
});
