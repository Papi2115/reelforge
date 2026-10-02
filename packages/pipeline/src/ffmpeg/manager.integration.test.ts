/** Integration tests against the real ffmpeg on this machine; skipped when none is found. */
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { filterPathValue } from './filtergraph.js';
import { FfmpegManager } from './manager.js';
import type { FfmpegProgress } from './progress.js';
import { runProcess } from './process.js';

const created = await FfmpegManager.create();
const manager = created.ok ? created.value : null;
const suiteTitle =
  manager === null
    ? 'FfmpegManager integration (SKIPPED: ffmpeg not found; set REELFORGE_FFMPEG or add it to PATH)'
    : 'FfmpegManager integration';

describe.skipIf(manager === null)(suiteTitle, () => {
  const ffmpeg = manager as FfmpegManager;
  let workDir = '';

  beforeAll(async () => {
    workDir = await mkdtemp(path.join(os.tmpdir(), 'reelforge ffmpeg żółć '));
  });

  afterAll(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  it('probes version, licence and the audio filters the pipeline needs', () => {
    expect(ffmpeg.info.version).not.toBe('');
    expect(['LGPL', 'GPL', 'nonfree']).toContain(ffmpeg.info.license);
    expect(ffmpeg.info.capabilities.filters).toMatchObject({
      highpass: true,
      afftdn: true,
      loudnorm: true,
      alimiter: true,
    });
    expect(ffmpeg.requireFilters(['highpass', 'afftdn']).ok).toBe(true);
    expect(ffmpeg.requireFilters(['no_such_filter'])).toMatchObject({
      ok: false,
      error: { kind: 'missing-capability', missing: ['no_such_filter'] },
    });
  });

  it('reports progress up to completion', async () => {
    const seen: FfmpegProgress[] = [];
    const result = await ffmpeg.run(['-f', 'lavfi', '-i', 'sine=f=440:d=5', '-f', 'null', '-'], {
      durationS: 5,
      onProgress: (progress) => seen.push(progress),
    });
    expect(result.ok).toBe(true);
    expect(seen.at(-1)).toMatchObject({ done: true, ratio: 1 });
    expect(seen.at(-1)?.outTimeS).toBeCloseTo(5, 1);
  });

  it('returns a typed exit-code error instead of throwing', async () => {
    const result = await ffmpeg.run([
      '-i',
      path.join(workDir, 'missing file.wav'),
      '-f',
      'null',
      '-',
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('exit-code');
      expect(result.error.kind === 'exit-code' && result.error.stderrTail).toMatch(/No such file/i);
    }
  });

  it('cancels a running job by killing the process tree', async () => {
    const controller = new AbortController();
    const startedAt = Date.now();
    const result = await ffmpeg.run(
      ['-re', '-f', 'lavfi', '-i', 'sine=f=440:d=120', '-f', 'null', '-'],
      {
        signal: controller.signal,
        onProgress: () => {
          controller.abort();
        },
      },
    );
    expect(result).toMatchObject({ ok: false, error: { kind: 'cancelled' } });
    expect(Date.now() - startedAt).toBeLessThan(15_000);
  }, 30_000);

  it('returns cancelled immediately for an already-aborted signal', async () => {
    const result = await ffmpeg.run(['-version'], { signal: AbortSignal.abort() });
    expect(result).toMatchObject({ ok: false, error: { kind: 'cancelled' } });
  });

  it('enforces timeouts', async () => {
    const result = await ffmpeg.run(['-re', '-f', 'lavfi', '-i', 'sine=d=60', '-f', 'null', '-'], {
      timeoutMs: 500,
    });
    expect(result).toMatchObject({ ok: false, error: { kind: 'timeout', timeoutMs: 500 } });
  }, 30_000);

  it('reads a file whose path has spaces, Polish letters and graph specials via amovie', async () => {
    const tricky = path.join(workDir, "głos it's [v1], take; 2.wav");
    const write = await ffmpeg.run(['-f', 'lavfi', '-i', 'sine=d=1', '-y', tricky]);
    expect(write.ok).toBe(true);
    const read = await ffmpeg.run([
      '-f',
      'lavfi',
      '-i',
      `amovie=${filterPathValue(tricky)}`,
      '-f',
      'null',
      '-',
    ]);
    expect(read.ok, read.ok ? '' : read.error.message).toBe(true);
  });

  it('reports spawn failures for a missing binary', async () => {
    const result = await runProcess(path.join(workDir, 'no-ffmpeg.exe'), ['-version']);
    expect(result).toMatchObject({ ok: false, error: { kind: 'spawn-failed' } });
  });
});
