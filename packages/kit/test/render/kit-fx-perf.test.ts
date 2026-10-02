/**
 * Effect performance (PLAN.md#3.4): every setup of the k05_fx_* examples through the full
 * harness seek path (see support/perf.ts).
 *
 * - SwiftShader (always): a few frames per setup, informational floor only.
 * - Hardware GPU (`REELFORGE_KIT_PERF_GPU=1`, local only): each effect must reach 60 fps.
 *
 * Results go to packages/kit/out/perf/effects.json.
 */
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  buildHarness,
  startStaticServer,
  type StaticServer,
} from '../../../engine/src/cli/index.js';
import { FX_SETUPS, fxManifest } from '../support/fx-scenes.js';
import { GPU_PERF_ENABLED, measure, record, TARGET_FPS, type PerfSample } from '../support/perf.js';
import { KIT_OUT_DIR } from '../support/scenes.js';

const SWIFTSHADER_FRAMES = 8;
const SWIFTSHADER_MIN_FPS = 1;
const RESULTS_FILE = path.join(KIT_OUT_DIR, 'perf', 'effects.json');
const SUITE_TIMEOUT = 400_000;

let server: StaticServer;

beforeAll(async () => {
  server = await startStaticServer(await buildHarness());
});

afterAll(async () => {
  await server.close();
});

async function measureAll(backend: PerfSample['backend'], frames?: number): Promise<PerfSample[]> {
  const samples: PerfSample[] = [];
  for (const [file, setup] of FX_SETUPS) {
    samples.push(await measure(server, backend, `fx:${setup}`, fxManifest(file, setup), frames));
  }
  await record(RESULTS_FILE, samples);
  return samples;
}

describe('effect performance', () => {
  it(
    'SwiftShader: every effect (informational)',
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
    'hardware GPU: every effect holds 60 fps',
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
