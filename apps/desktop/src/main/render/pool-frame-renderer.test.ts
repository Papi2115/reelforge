import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PoolFrameRenderer, RendererUnavailableError } from './pool-frame-renderer.js';
import { fakeFrame, fakeTargets } from './testing/fake-render-target.js';

const FIXTURE = path.resolve(
  import.meta.dirname,
  '..',
  '..',
  '..',
  '..',
  '..',
  'packages',
  'cli',
  'test',
  'fixtures',
  'project',
);

let base: string;
let projectDir: string;
const signal = new AbortController().signal;

beforeEach(async () => {
  base = await mkdtemp(path.join(tmpdir(), 'rf frames ż '));
  projectDir = path.join(base, 'my project');
  await cp(FIXTURE, projectDir, { recursive: true });
});

afterEach(async () => {
  await rm(base, { recursive: true, force: true });
});

async function sabotage(scene: string, marker: string): Promise<void> {
  const file = path.join(projectDir, 'scenes', scene);
  await writeFile(file, `// ${marker}\n${await readFile(file, 'utf8')}`);
}

describe('PoolFrameRenderer', () => {
  it('renders local shot times of the isolated shot manifest, with cards, anchors and cues', async () => {
    const targets = fakeTargets();
    const renderer = new PoolFrameRenderer(targets.open);
    const result = await renderer.renderShot(
      { projectDir, shotId: 's02', times: [0, 2.5], cards: true },
      signal,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // s02 starts at 2.2 s on the timeline: local times are shifted onto it.
    expect(targets.opened[0]?.frames).toEqual([2.2, 4.7]);
    expect(result.frames.map((frame) => frame.t)).toEqual([0, 2.5]);
    expect(result.frames[0]?.image).toEqual({ width: 640, height: 360, data: fakeFrame(2.2) });
    expect(result.cards).toEqual([]);
    expect(result.anchors.every((anchor) => anchor.shotId === 's02')).toBe(true);
    expect(result.cues.every((cue) => cue.shotId === 's02')).toBe(true);
    await renderer.close();
    expect(targets.opened[0]?.closed).toBe(1);
  });

  it('reuses one warm window for successive renders; parallel renders never share a window', async () => {
    const targets = fakeTargets();
    const renderer = new PoolFrameRenderer(targets.open);
    const request = { projectDir, shotId: 's01', times: [0], cards: false };
    await renderer.renderShot(request, signal);
    await renderer.renderShot(request, signal);
    expect(targets.opened).toHaveLength(1);
    const parallel = await Promise.all([
      renderer.renderShot(request, signal),
      renderer.renderShot(request, signal),
    ]);
    expect(parallel.every((result) => result.ok)).toBe(true);
    expect(targets.opened.length).toBeLessThanOrEqual(2);
    await renderer.trim();
    expect(targets.opened.every((target) => !target.alive)).toBe(true);
  });

  it('a scene that fails to load is a result with the engine error and console errors', async () => {
    await sabotage('s02_calc.js', 'FAIL_LOAD');
    const renderer = new PoolFrameRenderer(fakeTargets().open);
    const result = await renderer.renderShot(
      { projectDir, shotId: 's02', times: [0], cards: false },
      signal,
    );
    expect(result).toEqual({
      ok: false,
      error: '[shot s02] build() threw: boom',
      errors: ['Uncaught TypeError: boom'],
    });
  });

  it('a scene that throws while rendering a frame is a result too (a QA fix, not an outage)', async () => {
    await sabotage('s02_calc.js', 'FAIL_FRAME');
    const targets = fakeTargets();
    const renderer = new PoolFrameRenderer(targets.open);
    const result = await renderer.renderShot(
      { projectDir, shotId: 's02', times: [0, 2.5], cards: true },
      signal,
    );
    expect(result).toEqual({
      ok: false,
      error: 'rendering t=2.50s: [shot s02] update(4.7) threw TypeError: x is undefined',
      errors: ['Uncaught TypeError: x is undefined'],
    });
    // The window is still healthy: the next shot renders in it.
    const next = await renderer.renderShot(
      { projectDir, shotId: 's01', times: [0], cards: false },
      signal,
    );
    expect(next.ok).toBe(true);
    expect(targets.opened).toHaveLength(1);
    await renderer.close();
  });

  it('an unknown shot is a result; a crashed renderer rejects', async () => {
    const renderer = new PoolFrameRenderer(fakeTargets().open);
    const unknown = await renderer.renderShot(
      { projectDir, shotId: 's99', times: [], cards: false },
      signal,
    );
    expect(unknown.ok).toBe(false);
    await sabotage('s01_title.js', 'CRASH');
    await expect(
      renderer.renderShot({ projectDir, shotId: 's01', times: [0], cards: false }, signal),
    ).rejects.toBeInstanceOf(RendererUnavailableError);
  });

  it('retries a timed-out render once in a fresh window', async () => {
    await sabotage('s01_title.js', 'TIMEOUT');
    const targets = fakeTargets(1);
    const renderer = new PoolFrameRenderer(targets.open);
    const result = await renderer.renderShot(
      { projectDir, shotId: 's01', times: [0], cards: false },
      signal,
    );
    expect(result.ok).toBe(true);
    expect(targets.opened).toHaveLength(2);
    expect(targets.opened[0]?.alive).toBe(false);
    await renderer.close();
  });

  it('a render that times out twice is a timedOut result, not an outage', async () => {
    await sabotage('s01_title.js', 'TIMEOUT');
    const targets = fakeTargets(2);
    const renderer = new PoolFrameRenderer(targets.open);
    const result = await renderer.renderShot(
      { projectDir, shotId: 's01', times: [0], cards: false },
      signal,
    );
    expect(result).toEqual({
      ok: false,
      timedOut: true,
      error: 'load took longer than 120000 ms (retried once in a fresh render window)',
      errors: [],
    });
    expect(targets.opened).toHaveLength(2);
    await renderer.close();
  });

  it('stops rendering frames once aborted', async () => {
    const targets = fakeTargets();
    const renderer = new PoolFrameRenderer(targets.open);
    const controller = new AbortController();
    controller.abort();
    const result = await renderer.renderShot(
      { projectDir, shotId: 's01', times: [0, 1], cards: false },
      controller.signal,
    );
    expect(result.ok && result.frames).toEqual([]);
  });
});
