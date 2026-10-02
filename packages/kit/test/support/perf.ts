/**
 * Render-performance probe shared by the kit perf tests: runs the full harness seek path
 * (scene update + render + palette/dither pass + readPixels + frame transfer) inside the page,
 * i.e. an upper bound of the preview frame time, on SwiftShader or the hardware GPU.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { SWIFTSHADER_ARGS, type StaticServer } from '../../../engine/src/cli/index.js';
import type { ReelforgeHarness } from '../../../engine/src/index.js';
import type { RenderManifest } from './scenes.js';

/** Hardware GPU on Windows (ANGLE D3D11); the GPU tests run with REELFORGE_KIT_PERF_GPU=1. */
const GPU_ARGS = ['--use-angle=d3d11'];
export const GPU_PERF_ENABLED = process.env['REELFORGE_KIT_PERF_GPU'] === '1';
export const DEFAULT_PERF_FRAMES = 90;
/** The 60 fps preview target (checked on the GPU). */
export const TARGET_FPS = 60;

export type PerfBackend = 'swiftshader' | 'gpu';

export interface PerfSample {
  readonly backend: PerfBackend;
  /** What was measured (renderer mode, environment setup, ...). */
  readonly mode: string;
  readonly renderer: string;
  readonly frames: number;
  readonly milliseconds: number;
  readonly fps: number;
}

export async function measure(
  server: StaticServer,
  backend: PerfBackend,
  mode: string,
  manifest: RenderManifest,
  frames = DEFAULT_PERF_FRAMES,
): Promise<PerfSample> {
  const browser = await chromium.launch({
    headless: true,
    args: backend === 'gpu' ? GPU_ARGS : SWIFTSHADER_ARGS,
  });
  try {
    const page = await browser.newPage();
    await page.goto(new URL('harness.html', server.baseUrl).href, { waitUntil: 'load' });
    const result = await page.evaluate(
      async ({ input, frames }) => {
        const harness = (window as unknown as { __reelforge: ReelforgeHarness }).__reelforge;
        const info = await harness.load(input);
        // Warm-up: shader compilation and the first geometry upload are not frame costs.
        await harness.seek(0);
        await harness.seek(0.5);
        const started = performance.now();
        for (let index = 0; index < frames; index += 1) await harness.seek(1 + index / 30);
        return { renderer: info.gpu.renderer, milliseconds: performance.now() - started };
      },
      { input: manifest, frames },
    );
    const fps = (frames * 1000) / result.milliseconds;
    return { backend, mode, frames, ...result, fps: Math.round(fps * 10) / 10 };
  } finally {
    await browser.close();
  }
}

/** Merges samples into a JSON results file (replacing samples of the same backend and mode). */
export async function record(file: string, samples: readonly PerfSample[]): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  let previous: PerfSample[] = [];
  try {
    previous = JSON.parse(await readFile(file, 'utf8')) as PerfSample[];
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
  }
  const replaced = previous.filter(
    (old) => !samples.some((sample) => sample.backend === old.backend && sample.mode === old.mode),
  );
  await writeFile(file, `${JSON.stringify([...replaced, ...samples], null, 2)}\n`);
}
