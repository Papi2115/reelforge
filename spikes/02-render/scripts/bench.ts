/**
 * Playwright Chromium benchmark across GL backends.
 * Usage: node scripts/bench.ts [backendId ...]   (default: all backends)
 * Writes out/bench-<backend>.json, prints a summary and a cross-backend pixel diff of the
 * sample frame (also against out/bench-electron-hidden.json if present).
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { countDifferingPixels } from '../src/frame-stats.ts';
import { BACKENDS, type Backend } from './backends.ts';
import { runBench, SPIKE_INIT, summarize, type BenchReport } from './bench-core.ts';
import { buildSpike } from './build.ts';
import { startFrameServer, type FrameServer } from './frame-server.ts';
import { launchPlaywright } from './playwright-driver.ts';

const spikeRoot = path.resolve(import.meta.dirname, '..');
const outDir = path.join(spikeRoot, 'out');

async function benchBackend(backend: Backend, server: FrameServer): Promise<BenchReport> {
  const session = await launchPlaywright(backend);
  try {
    const report = await runBench(backend.id, session.driver, server.pageUrl, server, {
      ...SPIKE_INIT,
      powerPreference: backend.powerPreference,
    });
    await writeFile(
      path.join(outDir, `bench-${backend.id}.json`),
      JSON.stringify(
        { ...report, pageErrors: session.pageErrors, browserVersion: session.browser.version() },
        null,
        2,
      ),
    );
    console.log(summarize(report));
    if (session.pageErrors.length > 0)
      console.log(`  page errors: ${session.pageErrors.join(' | ')}`);
    return report;
  } finally {
    await session.browser.close();
  }
}

async function readElectronSample(): Promise<
  { label: string; sampleFrameBase64: string } | undefined
> {
  try {
    const json = await readFile(path.join(outDir, 'bench-electron-hidden.json'), 'utf8');
    // Written by electron-main.ts from the same BenchReport type.
    const report = JSON.parse(json) as BenchReport;
    return { label: report.label, sampleFrameBase64: report.sampleFrameBase64 };
  } catch (error: unknown) {
    console.log(`(no electron sample to compare: ${String(error)})`);
    return undefined;
  }
}

function printCrossBackendDiff(
  samples: readonly { label: string; sampleFrameBase64: string }[],
): void {
  for (let i = 0; i < samples.length; i += 1) {
    for (let j = i + 1; j < samples.length; j += 1) {
      const a = samples[i];
      const b = samples[j];
      if (!a || !b) continue;
      const differing = countDifferingPixels(
        Buffer.from(a.sampleFrameBase64, 'base64'),
        Buffer.from(b.sampleFrameBase64, 'base64'),
      );
      const share = ((differing / (640 * 360)) * 100).toFixed(3);
      console.log(
        `cross-backend ${a.label} vs ${b.label}: ${String(differing)} px differ (${share}%)`,
      );
    }
  }
}

async function main(): Promise<void> {
  await buildSpike();
  const requested = process.argv.slice(2);
  const selected =
    requested.length > 0 ? BACKENDS.filter((b) => requested.includes(b.id)) : BACKENDS;
  const server = await startFrameServer(outDir);
  const samples: { label: string; sampleFrameBase64: string }[] = [];
  try {
    for (const backend of selected) samples.push(await benchBackend(backend, server));
  } finally {
    await server.close();
  }
  const electron = await readElectronSample();
  if (electron) samples.push(electron);
  printCrossBackendDiff(samples);
}

await main();
