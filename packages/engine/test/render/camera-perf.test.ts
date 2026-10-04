/**
 * Preview performance of the camera moves (PLAN.md#12.28: preview >= 30 fps with each move) on
 * the voxel room of examples/s03_camera.js (kit room, character, desk, laptop, two server racks,
 * globe, floating debris), through the full harness seek path (support/perf.ts), one act per move.
 *
 * - SwiftShader (always): a few frames per move, informational floor only (CPU rasterization).
 * - Hardware GPU (`REELFORGE_ENGINE_PERF_GPU=1` or `REELFORGE_KIT_PERF_GPU=1`, local only):
 *   every move must reach 30 fps.
 *
 * Results go to packages/engine/out/perf/camera-moves.json.
 */
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildHarness, startStaticServer, type StaticServer } from '../../src/cli/index.js';
import { CAMERA_ACT_LENGTH, CAMERA_ACTS, cameraManifest } from '../support/manifests.js';
import {
  ENGINE_OUT_DIR,
  GPU_PERF_ENABLED,
  measureSeeks,
  recordSamples,
  type PerfBackend,
  type PerfSample,
} from '../support/perf.js';

const TARGET_FPS = 30;
const SWIFTSHADER_FRAMES = 10;
const SWIFTSHADER_MIN_FPS = 2;
const GPU_FRAMES = 75;
const RESULTS_FILE = path.join(ENGINE_OUT_DIR, 'perf', 'camera-moves.json');
const SUITE_TIMEOUT = 300_000;

let server: StaticServer;

beforeAll(async () => {
  server = await startStaticServer(await buildHarness());
});

afterAll(async () => {
  await server.close();
});

/** `frames` seek times at 30 fps inside the move of act `index` (its first 2.5 s). */
function actTimes(index: number, frames: number): number[] {
  const start = index * CAMERA_ACT_LENGTH + 0.25;
  return Array.from({ length: frames }, (_, frame) => start + (frame / frames) * 2.5);
}

async function measureMoves(backend: PerfBackend, frames: number): Promise<PerfSample[]> {
  const samples: PerfSample[] = [];
  for (const [index, move] of CAMERA_ACTS.entries()) {
    samples.push(
      await measureSeeks(server, backend, move, cameraManifest(), actTimes(index, frames)),
    );
  }
  await recordSamples(RESULTS_FILE, samples);
  return samples;
}

describe('camera move performance', () => {
  it(
    'SwiftShader: every move (informational floor)',
    async () => {
      for (const sample of await measureMoves('swiftshader', SWIFTSHADER_FRAMES)) {
        expect(sample.renderer).toMatch(/SwiftShader/);
        expect(sample.fps, sample.mode).toBeGreaterThan(SWIFTSHADER_MIN_FPS);
      }
    },
    SUITE_TIMEOUT,
  );

  it.runIf(GPU_PERF_ENABLED)(
    'hardware GPU: every move holds 30 fps',
    async () => {
      for (const sample of await measureMoves('gpu', GPU_FRAMES)) {
        expect(sample.renderer, sample.mode).not.toMatch(/SwiftShader/);
        expect(sample.fps, sample.mode).toBeGreaterThanOrEqual(TARGET_FPS);
      }
    },
    SUITE_TIMEOUT,
  );
});
