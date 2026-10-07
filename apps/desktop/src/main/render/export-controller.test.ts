import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { EXPORT_PRESET_IDS, type ExportProgress, type ExportWarning } from '@reelforge/pipeline';
import { defaultAppSettings } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { EXPORT_PRESETS, exportProgressSchema } from '../../shared/export-contract.js';
import { createLogger } from '../logger.js';
import { ExportController, throttleFrames } from './export-controller.js';
import type { ExportProjectOptions } from './export-project.js';
import { simulatedFallbackWarning } from './export-warnings.js';
import { engineBundleVersion, renderIdentity } from './render-identity.js';
import { fakeTargets } from './testing/fake-render-target.js';

const frame = (frameInShot: number, shotFrames = 10): ExportProgress => ({
  type: 'frame',
  shotId: 's01',
  frameInShot,
  shotFrames,
  renderedFrames: frameInShot,
  framesToRender: shotFrames,
  fps: 100,
  etaS: null,
});

describe('throttleFrames', () => {
  it('passes one frame event per interval, every shot end and every other event', () => {
    const pushed: ExportProgress[] = [];
    let now = 0;
    const push = throttleFrames(
      (event) => pushed.push(event),
      () => now,
      100,
    );
    push({ type: 'mux' });
    for (let index = 1; index <= 10; index += 1) {
      now = index * 30;
      push(frame(index));
    }
    expect(
      pushed.map((event) => (event.type === 'frame' ? event.frameInShot : event.type)),
    ).toEqual(['mux', 1, 5, 9, 10]);
  });
});

function controller(overrides: Partial<ConstructorParameters<typeof ExportController>[0]> = {}): {
  controller: ExportController;
  runs: ExportProjectOptions[];
} {
  const runs: ExportProjectOptions[] = [];
  const created = new ExportController({
    currentProject: () => 'C:\\videos\\my project',
    settings: defaultAppSettings,
    cores: 8,
    prepare: () => Promise.resolve({ openTarget: fakeTargets().open, engineVersion: 'engine-x' }),
    run: (options) => {
      runs.push(options);
      return new Promise((resolve) => {
        options.signal.addEventListener('abort', () => {
          resolve({ status: 'cancelled' });
        });
      });
    },
    push: () => undefined,
    now: () => 0,
    log: createLogger(() => undefined),
    ...overrides,
  });
  return { controller: created, runs };
}

describe('ExportController', () => {
  it('runs one export at a time and cancels it', async () => {
    const { controller: exports, runs } = controller();
    const running = exports.start({ preset: '4k', encoder: 'cpu' });
    await Promise.resolve();
    await Promise.resolve();
    expect(exports.busy).toBe(true);
    expect(await exports.start({})).toEqual({ status: 'busy' });
    expect(exports.cancel()).toBe(true);
    expect(await running).toEqual({ status: 'cancelled' });
    expect(runs[0]).toMatchObject({
      projectDir: 'C:\\videos\\my project',
      request: { preset: '4k', encoder: 'cpu' },
      engineVersion: 'engine-x',
      cores: 8,
    });
    expect(exports.busy).toBe(false);
    expect(exports.cancel()).toBe(false);
  });

  it('forwards the export warnings and lets the test hook simulate one', async () => {
    const { controller: exports, runs } = controller();
    const fallback = simulatedFallbackWarning();
    expect(exports.simulateWarning(fallback)).toBe(false);
    const warnings: ExportWarning[] = [];
    const running = exports.start({}, undefined, undefined, (warning) => warnings.push(warning));
    await Promise.resolve();
    await Promise.resolve();
    const retry: ExportWarning = {
      type: 'encoder-retry',
      encoder: 'h264_nvenc',
      shotId: 's01',
      detail: 'InitializeEncoder failed',
      message: 'GPU encoder failed to open for shot s01; retrying',
    };
    runs[0]?.onWarning?.(retry);
    expect(exports.simulateWarning(fallback)).toBe(true);
    expect(warnings).toEqual([retry, fallback]);
    exports.cancel();
    await running;
    expect(exports.simulateWarning(fallback)).toBe(false);
  });

  it('needs an open project and a prepared renderer', async () => {
    expect(await controller({ currentProject: () => undefined }).controller.start({})).toEqual({
      status: 'no-project',
    });
    const broken = controller({ prepare: () => Promise.resolve({ error: 'bundle missing' }) });
    expect(await broken.controller.start({})).toEqual({
      status: 'failed',
      kind: 'renderer',
      message: 'bundle missing',
    });
  });
});

describe('render identity', () => {
  it('hashes the engine frame bundle (first root that has it)', async () => {
    const base = await mkdtemp(path.join(tmpdir(), 'rf identity '));
    const built = path.join(base, 'renderer');
    const dev = path.join(base, 'public');
    await mkdir(path.join(dev, 'engine'), { recursive: true });
    await writeFile(path.join(dev, 'engine', 'engine-frame.js'), 'console.log(1)');
    const version = await engineBundleVersion([built, dev]);
    expect(version).toEqual({
      ok: true,
      value: expect.stringMatching(/^engine-[0-9a-f]{16}$/) as unknown,
    });
    await writeFile(path.join(dev, 'engine', 'engine-frame.js'), 'console.log(2)');
    expect(await engineBundleVersion([built, dev])).not.toEqual(version);
    expect((await engineBundleVersion([built])).ok).toBe(false);
    await rm(base, { recursive: true, force: true });
  });

  it('uses the style preset size and the kit version', () => {
    const identity = renderIdentity(undefined, 'engine-x');
    expect(identity.ok && identity.value).toMatchObject({
      engineVersion: 'engine-x',
      style: { id: 'voxel-pixel-crisp640', width: 640, height: 360 },
    });
    expect(renderIdentity('soft-480', 'e').ok && renderIdentity('soft-480', 'e')).toMatchObject({
      value: { style: { width: 480, height: 270 } },
    });
    expect(renderIdentity('nope', 'e').ok).toBe(false);
  });
});

describe('export contract', () => {
  it('lists the pipeline presets and accepts every pipeline progress event', () => {
    expect([...EXPORT_PRESETS]).toEqual([...EXPORT_PRESET_IDS]);
    const events: ExportProgress[] = [
      {
        type: 'plan',
        shots: 2,
        cachedShots: 0,
        totalFrames: 300,
        framesToRender: 300,
        workers: 2,
        encoder: 'libx264 (final)',
        resumed: false,
      },
      { type: 'source', worker: 0, gpu: null, software: false },
      { type: 'shot-start', shotId: 's01', frames: 66, worker: 0 },
      frame(1),
      { type: 'shot-done', shotId: 's01', cached: false },
      { type: 'mux' },
      { type: 'thumbnail' },
      { type: 'done', output: 'C:\\out\\x.mp4' },
    ];
    for (const event of events) expect(exportProgressSchema.parse(event)).toEqual(event);
  });
});
