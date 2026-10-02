import path from 'node:path';
import { PipelineStateStore } from '@reelforge/claude-bridge';
import { afterEach, describe, expect, it } from 'vitest';
import { createLogger } from '../logger.js';
import { exportStep, projectRelative, runExportStage } from './export-stage.js';
import { TempProjects } from './testing/fixtures.js';

const projects = new TempProjects();
afterEach(() => {
  projects.dispose();
});

describe('export stage', () => {
  it('maps export progress to a step line and a whole-stage percent', () => {
    expect(exportStep({ type: 'source', worker: 0, gpu: null, software: false })).toBeNull();
    expect(
      exportStep({
        type: 'frame',
        shotId: 's03',
        frameInShot: 1,
        shotFrames: 10,
        renderedFrames: 100,
        framesToRender: 100,
        fps: 50,
        etaS: 0,
      }),
    ).toEqual({ label: 'Rendering s03 (100/100 frames · 0 s left)', percent: 90 });
    expect(exportStep({ type: 'mux' })?.percent).toBe(92);
    expect(exportStep({ type: 'done', output: 'x.mp4' })?.percent).toBe(100);
  });

  it('shows outputs inside the project relative to it', () => {
    const dir = path.resolve('project dir');
    expect(projectRelative(dir, path.join(dir, 'out', 'A b.mp4'))).toBe('out/A b.mp4');
    const outside = path.resolve('elsewhere', 'x.mp4');
    expect(projectRelative(dir, outside)).toBe(outside);
  });

  it('persists a failure and a stop (idle) in pipeline.json', async () => {
    const dir = projects.create();
    const store = new PipelineStateStore();
    const log = createLogger(() => undefined);
    const failed = await runExportStage(
      {
        start: () => Promise.resolve({ status: 'failed', kind: 'no-ffmpeg', message: 'no ffmpeg' }),
        cancel: () => undefined,
        store,
        log,
      },
      dir,
      () => undefined,
    );
    expect(failed).toEqual({
      status: 'failed',
      error: { kind: 'no-ffmpeg', message: 'no ffmpeg', issues: [] },
    });
    const read = await store.read(dir);
    expect(read.ok && read.value.stages['export']).toMatchObject({
      status: 'failed',
      message: 'no ffmpeg',
    });
    await runExportStage(
      {
        start: () => Promise.resolve({ status: 'cancelled' }),
        cancel: () => undefined,
        store,
        log,
      },
      dir,
      () => undefined,
    );
    const after = await store.read(dir);
    expect(after.ok && after.value.stages['export']?.status).toBe('idle');
  });
});
