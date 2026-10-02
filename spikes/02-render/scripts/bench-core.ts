/**
 * Driver-agnostic benchmark (Playwright page or Electron webContents): time to first frame,
 * seek+readPixels throughput, determinism (re-seek and page reload), loopback transfer cost.
 */
import type { BenchResult, InitOptions, InitResult, StreamResult } from '../src/harness-types.ts';
import { computeFrameStats, type FrameStats } from '../src/frame-stats.ts';
import type { FrameTransport } from './frame-server.ts';

export interface PageDriver {
  load(url: string): Promise<void>;
  evaluate(expression: string): Promise<unknown>;
}

export interface BenchReport {
  readonly label: string;
  readonly init: InitResult;
  /** Wall clock from navigation start to first frame read back (ms). */
  readonly timeToFirstFrameMs: number;
  readonly renderRead: BenchResult;
  /** seek + readPixels + transfer to Node (no-op handler), via the transport's sink. */
  readonly frameTransfer: StreamResult;
  readonly determinism: {
    readonly times: readonly number[];
    readonly firstPass: readonly string[];
    readonly reseekPass: readonly string[];
    readonly reloadPass: readonly string[];
    readonly reseekIdentical: boolean;
    readonly reloadIdentical: boolean;
  };
  readonly sampleFrameStats: FrameStats;
  /** RGBA of the frame at SAMPLE_TIME, base64 (for cross-backend diffing). */
  readonly sampleFrameBase64: string;
}

export const SPIKE_INIT: InitOptions = {
  width: 640,
  height: 360,
  seed: 1337,
  powerPreference: 'high-performance',
};
export const DETERMINISM_TIMES: readonly number[] = [0, 1.234, 2.5, 5, 7.77, 9.9667];
export const SAMPLE_TIME = 2.5;
const FPS = 30;

const call = (method: string, argument: unknown): string =>
  `window.__spike.${method}(${JSON.stringify(argument)})`;

async function loadAndInit(
  driver: PageDriver,
  url: string,
  options: InitOptions,
): Promise<{ init: InitResult; wallMs: number }> {
  const start = performance.now();
  await driver.load(url);
  // Trusted in-repo harness: shapes are defined in src/harness-types.ts.
  const init = (await driver.evaluate(call('init', options))) as InitResult;
  return { init, wallMs: performance.now() - start };
}

async function hashTimes(driver: PageDriver, times: readonly number[]): Promise<string[]> {
  const hashes: string[] = [];
  for (const t of times) hashes.push((await driver.evaluate(call('hashAt', t))) as string);
  return hashes;
}

const sameList = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

export async function runBench(
  label: string,
  driver: PageDriver,
  pageUrl: string,
  transport: FrameTransport,
  initOptions: InitOptions = SPIKE_INIT,
): Promise<BenchReport> {
  const first = await loadAndInit(driver, pageUrl, initOptions);
  const firstPass = await hashTimes(driver, DETERMINISM_TIMES);
  const reseekPass = (await hashTimes(driver, [...DETERMINISM_TIMES].reverse())).reverse();
  const renderRead = (await driver.evaluate(
    call('bench', { frames: 300, warmupFrames: 30, fps: FPS }),
  )) as BenchResult;

  transport.setFrameHandler(undefined);
  const frameTransfer = (await driver.evaluate(
    call('stream', { sink: transport.sink, frames: 300, fps: FPS }),
  )) as StreamResult;

  const sampleFrameBase64 = (await driver.evaluate(call('frameBase64', SAMPLE_TIME))) as string;
  const sampleFrameStats = computeFrameStats(Buffer.from(sampleFrameBase64, 'base64'), 4);

  await loadAndInit(driver, pageUrl, initOptions);
  const reloadPass = await hashTimes(driver, DETERMINISM_TIMES);

  return {
    label,
    init: first.init,
    timeToFirstFrameMs: first.wallMs,
    renderRead,
    frameTransfer,
    determinism: {
      times: DETERMINISM_TIMES,
      firstPass,
      reseekPass,
      reloadPass,
      reseekIdentical: sameList(firstPass, reseekPass),
      reloadIdentical: sameList(firstPass, reloadPass),
    },
    sampleFrameStats,
    sampleFrameBase64,
  };
}

export function summarize(report: BenchReport): string {
  const { renderRead, frameTransfer, determinism, init } = report;
  return [
    `[${report.label}] GPU: ${init.gpu.renderer}`,
    `  first frame: ${report.timeToFirstFrameMs.toFixed(0)} ms wall (setup ${init.setupMs.toFixed(0)} ms, first seek+read ${init.firstFrameMs.toFixed(0)} ms)`,
    `  seek+readPixels: ${renderRead.fps.toFixed(1)} fps (p50 ${renderRead.msPerFrameP50.toFixed(2)} ms, p95 ${renderRead.msPerFrameP95.toFixed(2)} ms)`,
    `  + transfer to Node: ${frameTransfer.fps.toFixed(1)} fps`,
    `  determinism: reseek=${String(determinism.reseekIdentical)} reload=${String(determinism.reloadIdentical)}`,
    `  sample frame: ${String(report.sampleFrameStats.uniqueColors)} colors, dominant ${(report.sampleFrameStats.dominantColorShare * 100).toFixed(1)}%`,
  ].join('\n');
}
