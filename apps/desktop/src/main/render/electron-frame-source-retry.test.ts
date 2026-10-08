import type { ExportError } from '@reelforge/pipeline';
import type { RenderManifest } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { electronFrameSourceFactory } from './electron-frame-source.js';
import { RenderPool } from './render-pool.js';
import { fakeFrame, fakeTargets } from './testing/fake-render-target.js';

function manifest(source = 'export function build() {}'): RenderManifest {
  return {
    version: 1,
    fps: 30,
    seed: 1,
    shots: [
      { id: 's01', t0: 0, t1: 2, scene: { file: 'scenes/a.js', source } },
      { id: 's02', t0: 2, t1: 4, scene: { file: 'scenes/b.js', source } },
    ],
  };
}

const range = { shotIds: ['s01'], t0: 0, t1: 2 };

function recorder(): {
  warnings: string[];
  failures: ExportError[];
  log: { warn: (message: string) => void };
  onWindowFailure: (error: ExportError) => void;
} {
  const warnings: string[] = [];
  const failures: ExportError[] = [];
  return {
    warnings,
    failures,
    log: { warn: (message) => warnings.push(message) },
    onWindowFailure: (error) => failures.push(error),
  };
}

describe('electronFrameSourceFactory window recovery', () => {
  it('replaces a window that misses a frame deadline once and renders the same frame', async () => {
    const targets = fakeTargets(0, 1);
    const pool = new RenderPool(targets.open);
    const events = recorder();
    const source = electronFrameSourceFactory(pool, events)(0);
    const video = manifest();
    expect((await source.open(video, range)).ok).toBe(true);
    const frame = await source.renderFrame(47.467);
    expect(frame.ok && frame.value).toEqual(fakeFrame(47.467));
    expect(targets.opened).toHaveLength(2);
    expect(targets.opened[0]?.closed).toBe(1);
    expect(targets.opened[1]?.loads).toEqual([video]);
    expect(events.warnings).toEqual([
      'rendering t=47.467 failed: frame took longer than 30000 ms; retrying on a fresh render window (1/2)',
    ]);
    expect(events.failures).toEqual([]);
    // Later frames stay on the fresh window.
    expect((await source.renderFrame(47.5)).ok).toBe(true);
    expect(targets.opened).toHaveLength(2);
    await source.close();
    await pool.close();
  });

  it('gives up after two fresh windows with the real reason, not "window closed"', async () => {
    const targets = fakeTargets(0, 10);
    const pool = new RenderPool(targets.open);
    const events = recorder();
    const source = electronFrameSourceFactory(pool, events)(0);
    expect((await source.open(manifest(), range)).ok).toBe(true);
    const frame = await source.renderFrame(32.3);
    const message =
      'rendering t=32.300 failed: the render window stopped responding (frame took longer than 30000 ms); tried 2 fresh window(s)';
    expect(frame).toEqual({ ok: false, error: { kind: 'frame-source', message } });
    expect(events.failures).toEqual([{ kind: 'frame-source', message }]);
    expect(targets.opened).toHaveLength(3);
    expect(events.warnings).toHaveLength(2);
    await source.close();
    await pool.close();
    expect(targets.opened.every((target) => target.closed === 1)).toBe(true);
  });

  it('never retries a scene error', async () => {
    const targets = fakeTargets();
    const pool = new RenderPool(targets.open);
    const events = recorder();
    const source = electronFrameSourceFactory(pool, events)(0);
    await source.open(manifest('FAIL_FRAME'), range);
    const frame = await source.renderFrame(3.5);
    expect(!frame.ok && frame.error.message).toMatch(/update\(3\.5\) threw/);
    expect(targets.opened).toHaveLength(1);
    expect(events.failures).toEqual([]);
    await source.close();
    await pool.close();
  });

  it('retries a load whose renderer crashed, then reports the crash', async () => {
    const targets = fakeTargets();
    const pool = new RenderPool(targets.open);
    const events = recorder();
    const source = electronFrameSourceFactory(pool, events)(0);
    const opened = await source.open(manifest('CRASH'), range);
    expect(opened).toEqual({
      ok: false,
      error: {
        kind: 'frame-source',
        message:
          'the engine failed to load the video: renderer process gone: crashed; tried 2 fresh window(s)',
      },
    });
    expect(targets.opened).toHaveLength(3);
    expect(events.failures).toHaveLength(1);
    await source.close();
    await pool.close();
  });

  it('does not retry once the export is cancelled', async () => {
    const targets = fakeTargets(0, 10);
    const pool = new RenderPool(targets.open);
    const controller = new AbortController();
    const source = electronFrameSourceFactory(pool, { signal: controller.signal })(0);
    await source.open(manifest(), range);
    controller.abort();
    expect(await source.renderFrame(1)).toMatchObject({ ok: false, error: { kind: 'cancelled' } });
    expect(targets.opened).toHaveLength(1);
    await source.close();
    await pool.close();
  });
});
