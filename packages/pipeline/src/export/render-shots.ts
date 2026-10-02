/**
 * Shot-parallel rendering: N workers, each owning one FrameSource, pull shots from a queue and
 * encode each into its own segment (`<key>.partial-<n>.mp4` -> renamed to `<key>.mp4` only after
 * the encoder exits cleanly, so a killed export never leaves a half segment in the cache).
 */
import { rename, rm } from 'node:fs/promises';
import path from 'node:path';
import type { RenderManifest } from '@reelforge/shared';
import { describeUnknown, type ExportError } from './errors.js';
import type { FrameSource, FrameSourceFactory, FrameSourceInfo } from './frame-source.js';
import type { ExportMedia } from './media.js';
import type { OutputScale } from './presets.js';
import { frameTime, type PlannedShot } from './shot-plan.js';
import { err, ok, type Result } from '../result.js';

export interface ShotJob {
  readonly planned: PlannedShot;
  readonly key: string;
  /** Final segment path in the cache. */
  readonly segment: string;
}

export interface ShotRenderEvents {
  onSourceOpened?(worker: number, info: FrameSourceInfo): void;
  onShotStart?(job: ShotJob, worker: number): void;
  onFrame?(job: ShotJob, frameInShot: number): void;
  /** Called after the segment is in place; awaited (state persistence). */
  onShotDone?(job: ShotJob, worker: number): Promise<Result<void, ExportError>>;
}

export interface RenderShotsOptions {
  readonly manifest: RenderManifest;
  readonly jobs: readonly ShotJob[];
  readonly workers: number;
  readonly scale: OutputScale;
  readonly media: ExportMedia;
  readonly createFrameSource: FrameSourceFactory;
  readonly signal: AbortSignal;
  readonly events: ShotRenderEvents;
}

const cancelled = (): ExportError => ({ kind: 'cancelled', message: 'export cancelled' });

async function openSource(
  source: FrameSource,
  options: RenderShotsOptions,
  job: ShotJob,
): Promise<Result<FrameSourceInfo, ExportError>> {
  const { shot } = job.planned;
  const shotIds = job.planned.incoming === null ? [shot.id] : [job.planned.incoming.id, shot.id];
  const opened = await source.open(options.manifest, { shotIds, t0: shot.t0, t1: shot.t1 });
  if (!opened.ok) return opened;
  const { renderWidth, renderHeight } = options.scale;
  if (opened.value.width !== renderWidth || opened.value.height !== renderHeight) {
    return err({
      kind: 'frame-source',
      message: `frame source renders ${String(opened.value.width)}x${String(opened.value.height)}, expected ${String(renderWidth)}x${String(renderHeight)} (style size)`,
      shotId: shot.id,
    });
  }
  return opened;
}

async function encodeFrames(
  source: FrameSource,
  options: RenderShotsOptions,
  job: ShotJob,
  partial: string,
): Promise<Result<void, ExportError>> {
  const { planned } = job;
  const { scale, manifest, signal } = options;
  const frameBytes = scale.renderWidth * scale.renderHeight * 4;
  const writer = options.media.openSegment(
    { file: partial, scale, fps: manifest.fps, frames: planned.endFrame - planned.startFrame },
    signal,
  );
  for (let frame = planned.startFrame; frame < planned.endFrame; frame += 1) {
    if (signal.aborted) {
      await writer.abort();
      return err(cancelled());
    }
    const t = frameTime(frame, manifest.fps);
    const rendered = await source.renderFrame(t);
    if (!rendered.ok) {
      await writer.abort();
      return rendered;
    }
    if (rendered.value.length !== frameBytes) {
      await writer.abort();
      return err({
        kind: 'frame-source',
        message: `frame at t=${t.toFixed(3)} has ${String(rendered.value.length)} bytes, expected ${String(frameBytes)}`,
        shotId: planned.shot.id,
      });
    }
    const written = await writer.write(rendered.value);
    if (!written.ok) {
      await writer.abort();
      return written;
    }
    options.events.onFrame?.(job, frame - planned.startFrame + 1);
  }
  return writer.finish();
}

async function renderShot(
  source: FrameSource,
  options: RenderShotsOptions,
  job: ShotJob,
  worker: number,
): Promise<Result<void, ExportError>> {
  const opened = await openSource(source, options, job);
  if (!opened.ok) return opened;
  options.events.onSourceOpened?.(worker, opened.value);
  options.events.onShotStart?.(job, worker);
  const partial = path.join(
    path.dirname(job.segment),
    `${job.key}.partial-${String(worker)}${options.media.segmentExtension}`,
  );
  const encoded = await encodeFrames(source, options, job, partial);
  if (!encoded.ok) {
    await rm(partial, { force: true });
    return encoded;
  }
  try {
    await rename(partial, job.segment);
  } catch (error) {
    await rm(partial, { force: true });
    return err({
      kind: 'io',
      message: `cannot move the segment into the cache: ${describeUnknown(error)}`,
      path: job.segment,
    });
  }
  return options.events.onShotDone?.(job, worker) ?? ok(undefined);
}

/**
 * Renders every job; the first failure cancels the remaining work. Jobs are taken longest first
 * so the parallel tail stays short.
 */
export async function renderShots(options: RenderShotsOptions): Promise<Result<void, ExportError>> {
  const queue = [...options.jobs].sort(
    (a, b) =>
      b.planned.endFrame - b.planned.startFrame - (a.planned.endFrame - a.planned.startFrame) ||
      a.planned.index - b.planned.index,
  );
  const internal = new AbortController();
  const onOuterAbort = (): void => {
    internal.abort();
  };
  options.signal.addEventListener('abort', onOuterAbort, { once: true });
  if (options.signal.aborted) internal.abort();
  const inner: RenderShotsOptions = { ...options, signal: internal.signal };
  const failure: { first: ExportError | null } = { first: null };
  const fail = (error: ExportError): void => {
    failure.first ??= error;
    internal.abort();
  };

  const runWorker = async (worker: number): Promise<void> => {
    let source: FrameSource | undefined;
    try {
      source = options.createFrameSource(worker);
      for (let job = queue.shift(); job !== undefined; job = queue.shift()) {
        if (internal.signal.aborted) break;
        const result = await renderShot(source, inner, job, worker);
        if (!result.ok) {
          fail(result.error);
          break;
        }
      }
    } catch (error) {
      // FrameSource implementations should return Results; a throw is still contained here.
      fail({ kind: 'frame-source', message: `render worker failed: ${describeUnknown(error)}` });
    } finally {
      await source?.close();
    }
  };

  const count = Math.max(1, Math.min(options.workers, options.jobs.length));
  await Promise.all(Array.from({ length: count }, (_, worker) => runWorker(worker)));
  options.signal.removeEventListener('abort', onOuterAbort);
  if (options.signal.aborted) return err(cancelled());
  return failure.first === null ? ok(undefined) : err(failure.first);
}
