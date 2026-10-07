import {
  ENCODER_FALLBACK_MESSAGE,
  type ExportProgress,
  type ExportWarning,
} from '@reelforge/pipeline';
import { describe, expect, it } from 'vitest';
import type {
  ExportJobRequest,
  ExportOutcome,
  ExportQueueState,
  ExportStartRequest,
} from '../../shared/export-contract.js';
import { createLogger } from '../logger.js';
import { applyProgress, EMPTY_PROGRESS, failureHint } from './export-progress.js';
import { ExportQueue, startRequestOf } from './export-queue.js';

const REQUEST: ExportJobRequest = {
  preset: '1080p30',
  encoder: 'cpu',
  quality: 'standard',
  workers: 2,
  fileName: 'film.mp4',
  includeChapters: true,
  includeThumbnail: true,
  thumbnailAt: null,
};

const DONE: ExportOutcome = {
  status: 'done',
  output: 'C:/p/out/film.mp4',
  thumbnail: 'C:/p/out/thumb.png',
  renderedShots: ['s02'],
  cachedShots: ['s01', 's03'],
  totalFrames: 300,
  durationS: 10,
  width: 1920,
  height: 1080,
  encoder: 'libx264 (final)',
  gpu: 'ANGLE',
  resumed: false,
  wallMs: 4000,
  warnings: [],
};

interface Started {
  readonly request: ExportStartRequest;
  readonly listener: (event: ExportProgress) => void;
  readonly onWarning: (warning: ExportWarning) => void;
  readonly finish: (outcome: ExportOutcome) => void;
}

function setup() {
  const started: Started[] = [];
  const pushes: ExportQueueState[] = [];
  let cancels = 0;
  const queue = new ExportQueue({
    currentProject: () => 'C:/p',
    start: (request, listener, _output, onWarning) =>
      new Promise((resolve) => {
        started.push({ request, listener, onWarning, finish: resolve });
      }),
    cancel: () => {
      cancels += 1;
      const running = started.at(-1);
      running?.finish({ status: 'cancelled' });
    },
    finish: () => Promise.resolve({ files: ['out/chapters.txt'], warnings: [] }),
    sizeOf: () => Promise.resolve(2_500_000),
    interrupted: () => Promise.resolve(null),
    push: (state) => pushes.push(state),
    now: () => 1000,
    log: createLogger(() => undefined),
  });
  const last = (): ExportQueueState =>
    pushes.at(-1) ?? { projectDir: null, jobs: [], interrupted: null };
  const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
  return { queue, started, last, flush, cancels: () => cancels };
}

describe('export queue', () => {
  it('maps the dialog request to the export request', () => {
    expect(startRequestOf(REQUEST)).toEqual({
      preset: '1080p30',
      encoder: 'cpu',
      quality: 'final',
      workers: 2,
    });
    expect(startRequestOf({ ...REQUEST, quality: 'draft', thumbnailAt: 12.5 })).toMatchObject({
      quality: 'draft',
      thumbnailAt: 12.5,
    });
    expect(startRequestOf({ ...REQUEST, quality: 'high', includeThumbnail: false })).toMatchObject({
      quality: 'high',
      thumbnailAt: null,
    });
  });

  it('runs one job at a time with progress, then the report', async () => {
    const { queue, started, last, flush } = setup();
    const first = queue.enqueue(REQUEST, 'C:/p/out/film.mp4');
    queue.enqueue({ ...REQUEST, preset: '4k' }, 'C:/p/out/film 4k.mp4');
    expect(first).toEqual({ status: 'queued', id: 'export-1' });
    await flush();
    expect(started).toHaveLength(1);
    expect(last().jobs.map((job) => job.status)).toEqual(['queued', 'running']);
    const run = started[0];
    if (run === undefined) throw new Error('not started');
    run.listener({
      type: 'plan',
      shots: 3,
      cachedShots: 2,
      totalFrames: 300,
      framesToRender: 100,
      workers: 2,
      encoder: 'x',
      resumed: false,
    });
    run.listener({ type: 'shot-done', shotId: 's01', cached: true });
    run.listener({ type: 'shot-start', shotId: 's02', frames: 100, worker: 0 });
    run.listener({
      type: 'frame',
      shotId: 's02',
      frameInShot: 50,
      shotFrames: 100,
      renderedFrames: 50,
      framesToRender: 100,
      fps: 25,
      etaS: 2,
    });
    const running = last().jobs[1];
    expect(running?.progress).toMatchObject({
      totalShots: 3,
      etaS: 2,
      fps: 25,
      shots: [
        { id: 's01', state: 'cached' },
        { id: 's02', frames: 100, done: 50, state: 'rendering' },
      ],
    });
    expect(running?.progress.percent).toBeCloseTo(47.5, 5);
    run.finish(DONE);
    await flush();
    await flush();
    const [, done] = last().jobs;
    expect(done).toMatchObject({
      status: 'done',
      report: {
        sizeBytes: 2_500_000,
        avgFps: 25,
        totalShots: 3,
        renderedShots: 1,
        cachedShots: 2,
        extras: ['out/chapters.txt'],
      },
    });
    expect(started).toHaveLength(2);
  });

  it('cancels queued and running jobs and resumes them at the end of the queue', async () => {
    const { queue, started, last, flush, cancels } = setup();
    queue.enqueue(REQUEST, 'a.mp4');
    queue.enqueue(REQUEST, 'b.mp4');
    await flush();
    expect(queue.cancel('export-2')).toBe(true);
    expect(last().jobs[0]?.status).toBe('cancelled');
    expect(queue.cancel('export-1')).toBe(true);
    await flush();
    expect(cancels()).toBe(1);
    expect(last().jobs.map((job) => job.status)).toEqual(['cancelled', 'cancelled']);
    expect(queue.resume('export-1')).toEqual({ status: 'queued', id: 'export-1' });
    await flush();
    expect(started).toHaveLength(2);
    expect(last().jobs[0]).toMatchObject({ id: 'export-1', status: 'running' });
    expect(queue.resume('export-1')).toMatchObject({ status: 'invalid' });
    started[1]?.finish({ status: 'failed', kind: 'no-encoder', message: 'nothing works' });
    await flush();
    expect(last().jobs[0]).toMatchObject({
      status: 'failed',
      error: { kind: 'no-encoder', message: 'nothing works', hint: failureHint('no-encoder') },
    });
  });

  it('shows the switch to the CPU encoder under the status line and in the report', async () => {
    const { queue, started, last, flush } = setup();
    queue.enqueue(REQUEST, 'C:/p/out/film.mp4');
    await flush();
    const run = started[0];
    if (run === undefined) throw new Error('not started');
    run.onWarning({
      type: 'encoder-retry',
      encoder: 'h264_nvenc',
      shotId: 's01',
      detail: 'InitializeEncoder failed: out of memory (10)',
      message: 'GPU encoder failed to open for shot s01; retrying',
    });
    expect(last().jobs[0]?.progress.warning).toBeNull();
    run.onWarning({
      type: 'encoder-fallback',
      from: 'h264_nvenc',
      to: 'libx264',
      detail: 'InitializeEncoder failed: out of memory (10)',
      message: ENCODER_FALLBACK_MESSAGE,
    });
    expect(last().jobs[0]?.progress.warning).toBe(ENCODER_FALLBACK_MESSAGE);
    // The restarted pass announces a new plan: the shot list resets, the warning stays.
    run.listener({
      type: 'plan',
      shots: 3,
      cachedShots: 0,
      totalFrames: 300,
      framesToRender: 300,
      workers: 2,
      encoder: 'libx264 (final)',
      resumed: false,
    });
    expect(last().jobs[0]?.progress).toMatchObject({
      shots: [],
      warning: ENCODER_FALLBACK_MESSAGE,
    });
    run.finish({ ...DONE, warnings: [ENCODER_FALLBACK_MESSAGE] });
    await flush();
    await flush();
    expect(last().jobs[0]?.report?.warnings).toEqual([ENCODER_FALLBACK_MESSAGE]);
    expect(queue.resume('export-1')).toMatchObject({ status: 'invalid' });
  });

  it('lets a caller wait for its job (the sidebar stage)', async () => {
    const { queue, started, flush } = setup();
    const events: string[] = [];
    const run = queue.run(REQUEST, 'a.mp4', (event) => events.push(event.type));
    await flush();
    started[0]?.listener({ type: 'mux' });
    started[0]?.finish(DONE);
    expect(await run.outcome).toEqual(DONE);
    expect(events).toEqual(['mux']);
  });
});

describe('export progress', () => {
  it('shows the step, percent and the shots', () => {
    let progress = applyProgress(EMPTY_PROGRESS, { type: 'mux' });
    expect(progress).toMatchObject({ label: 'Encoding and adding the audio', percent: 92 });
    progress = applyProgress(progress, { type: 'done', output: 'x' });
    expect(progress.percent).toBe(100);
    expect(failureHint('io')).toMatch(/writable/);
    expect(failureHint('something-new')).toMatch(/Resume/);
  });
});
