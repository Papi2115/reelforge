/**
 * Preview performance probe of the engine render tests: the full harness seek path (scene update
 * + moves + render + post pass + readPixels + frame transfer) over given times, on SwiftShader or
 * the hardware GPU (ANGLE D3D11) — the same measurement as packages/kit/test/support/perf.ts.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { RenderManifest } from '@reelforge/shared';
import { chromium } from 'playwright';
import { SWIFTSHADER_ARGS, type StaticServer } from '../../src/cli/index.js';
import type { ReelforgeHarness } from '../../src/index.js';

const GPU_ARGS = ['--use-angle=d3d11'];
/** Hardware GPU runs (local only): `REELFORGE_ENGINE_PERF_GPU=1` or the kit's flag. */
export const GPU_PERF_ENABLED =
  process.env['REELFORGE_ENGINE_PERF_GPU'] === '1' || process.env['REELFORGE_KIT_PERF_GPU'] === '1';
export const ENGINE_OUT_DIR = path.resolve(import.meta.dirname, '..', '..', 'out');

export type PerfBackend = 'swiftshader' | 'gpu';

export interface PerfSample {
  readonly backend: PerfBackend;
  readonly mode: string;
  readonly renderer: string;
  readonly frames: number;
  readonly milliseconds: number;
  readonly fps: number;
}

/** Seeks every time once (after a warm-up seek to the first) and returns the frame rate. */
export async function measureSeeks(
  server: StaticServer,
  backend: PerfBackend,
  mode: string,
  manifest: RenderManifest,
  times: readonly number[],
): Promise<PerfSample> {
  const browser = await chromium.launch({
    headless: true,
    args: backend === 'gpu' ? GPU_ARGS : SWIFTSHADER_ARGS,
  });
  try {
    const page = await browser.newPage();
    await page.goto(new URL('harness.html', server.baseUrl).href, { waitUntil: 'load' });
    const result = await page.evaluate(
      async ({ input, seeks }) => {
        const harness = (window as unknown as { __reelforge: ReelforgeHarness }).__reelforge;
        const info = await harness.load(input);
        // Warm-up: shader compilation (incl. the bokeh variant) is not a frame cost.
        await harness.seek(seeks[0] ?? 0);
        await harness.seek(seeks[seeks.length - 1] ?? 0);
        const started = performance.now();
        for (const t of seeks) await harness.seek(t);
        return { renderer: info.gpu.renderer, milliseconds: performance.now() - started };
      },
      { input: manifest, seeks: times },
    );
    const fps = (times.length * 1000) / result.milliseconds;
    return { backend, mode, frames: times.length, ...result, fps: Math.round(fps * 10) / 10 };
  } finally {
    await browser.close();
  }
}

/** Merges samples into a JSON results file (replacing samples of the same backend and mode). */
export async function recordSamples(file: string, samples: readonly PerfSample[]): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  let previous: PerfSample[] = [];
  try {
    previous = JSON.parse(await readFile(file, 'utf8')) as PerfSample[];
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
  }
  const kept = previous.filter(
    (old) => !samples.some((sample) => sample.backend === old.backend && sample.mode === old.mode),
  );
  await writeFile(file, `${JSON.stringify([...kept, ...samples], null, 2)}\n`);
}
