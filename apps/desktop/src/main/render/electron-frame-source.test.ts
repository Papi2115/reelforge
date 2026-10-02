import type { RenderManifest } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { electronFrameSourceFactory } from './electron-frame-source.js';
import { RenderPool } from './render-pool.js';
import { FAKE_GPU, fakeFrame, fakeTargets } from './testing/fake-render-target.js';

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

describe('electronFrameSourceFactory', () => {
  it('loads the whole manifest once per window and renders by global time', async () => {
    const targets = fakeTargets();
    const pool = new RenderPool(targets.open);
    const source = electronFrameSourceFactory(pool)(0);
    const video = manifest();
    const opened = await source.open(video, range);
    expect(opened).toEqual({ ok: true, value: { width: 640, height: 360, gpu: FAKE_GPU } });
    await source.open(video, { shotIds: ['s01', 's02'], t0: 2, t1: 4 });
    const frame = await source.renderFrame(2.5);
    expect(frame.ok && frame.value).toEqual(fakeFrame(2.5));
    expect(targets.opened).toHaveLength(1);
    expect(targets.opened[0]?.loads).toHaveLength(1);
    await source.close();
    // The window goes back to the pool with its manifest: the next source reuses both.
    const next = electronFrameSourceFactory(pool)(1);
    await next.open(video, range);
    expect(targets.opened).toHaveLength(1);
    expect(targets.opened[0]?.loads).toHaveLength(1);
    await next.close();
    await pool.close();
    expect(targets.opened[0]?.closed).toBe(1);
  });

  it('gives each concurrent worker its own window', async () => {
    const targets = fakeTargets();
    const pool = new RenderPool(targets.open);
    const factory = electronFrameSourceFactory(pool);
    const [first, second] = [factory(0), factory(1)];
    await Promise.all([first.open(manifest(), range), second.open(manifest(), range)]);
    expect(pool.size).toBe(2);
    await first.close();
    await second.close();
    await pool.close();
    expect(targets.opened.map((target) => target.closed)).toEqual([1, 1]);
  });

  it('reports engine failures with the console errors as frame-source errors', async () => {
    const pool = new RenderPool(fakeTargets().open);
    const source = electronFrameSourceFactory(pool)(0);
    const opened = await source.open(manifest('FAIL_LOAD'), range);
    expect(opened.ok).toBe(false);
    expect(!opened.ok && opened.error).toMatchObject({ kind: 'frame-source' });
    expect(!opened.ok && opened.error.message).toMatch(
      /failed to load the video: \[shot s02\] build\(\) threw: boom \(console: Uncaught TypeError: boom\)/,
    );
    expect((await source.renderFrame(0)).ok).toBe(false);
    await source.close();
    await pool.close();
  });

  it('drops a crashed window instead of reusing it', async () => {
    const targets = fakeTargets();
    const pool = new RenderPool(targets.open);
    const source = electronFrameSourceFactory(pool)(0);
    expect((await source.open(manifest('CRASH'), range)).ok).toBe(false);
    await source.close();
    const next = electronFrameSourceFactory(pool)(0);
    expect((await next.open(manifest(), range)).ok).toBe(true);
    expect(targets.opened).toHaveLength(2);
    await next.close();
    await pool.close();
  });

  it('closes the window when the export is aborted and refuses to open afterwards', async () => {
    const targets = fakeTargets();
    const pool = new RenderPool(targets.open);
    const controller = new AbortController();
    const source = electronFrameSourceFactory(pool, controller.signal)(0);
    await source.open(manifest(), range);
    controller.abort();
    expect(targets.opened[0]?.closed).toBe(1);
    expect((await source.renderFrame(0)).ok).toBe(false);
    const late = electronFrameSourceFactory(pool, controller.signal)(1);
    expect(await late.open(manifest(), range)).toMatchObject({
      ok: false,
      error: { kind: 'cancelled' },
    });
    await source.close();
    await pool.close();
  });

  it('a closed pool opens nothing', async () => {
    const targets = fakeTargets();
    const pool = new RenderPool(targets.open);
    await pool.close();
    expect((await pool.acquire()).ok).toBe(false);
    expect(targets.opened).toHaveLength(0);
  });
});
