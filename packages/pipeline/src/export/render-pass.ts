/**
 * One render pass of an export with one ExportMedia: segment cache keys (the media's output key is
 * part of them), resume state, the `plan` event and the shot-parallel render of the segments not
 * in the cache. `exportVideo` runs a second pass with the CPU media when a hardware encoder cannot
 * open (encoder-fallback.ts), so one video never mixes segments of two encoders.
 */
import path from 'node:path';
import { segmentCacheKey, sha256Hex, stableStringify } from './cache-key.js';
import {
  DEFAULT_ENCODER_RETRY_DELAY_MS,
  DEFAULT_ENCODER_STAGGER_MS,
  openFailureDetail,
} from './encoder-fallback.js';
import type { ExportError } from './errors.js';
import type { ExportProgress, ExportVideoOptions, ExportWarning } from './export-types.js';
import { isSoftwareRenderer } from './frame-source.js';
import type { ExportMedia } from './media.js';
import type { ExportPresetId, OutputScale } from './presets.js';
import { renderShots, type ShotJob } from './render-shots.js';
import type { ShotPlan } from './shot-plan.js';
import { ExportStateWriter, fileExists, readExportState, type ExportPaths } from './state.js';
import { err, ok, type Result } from '../result.js';

export interface RenderPassContext {
  readonly options: ExportVideoOptions;
  readonly plan: ShotPlan;
  readonly scale: OutputScale;
  readonly presetId: ExportPresetId;
  readonly paths: ExportPaths;
  readonly output: string;
  /** Requested workers (capped to the shots to render). */
  readonly workers: number;
  readonly signal: AbortSignal;
  readonly emit: (event: ExportProgress) => void;
  readonly warn: (warning: ExportWarning) => void;
  readonly now: () => number;
}

export interface RenderPass {
  /** Every shot in playback order, with its segment for this media. */
  readonly jobs: readonly ShotJob[];
  readonly toRender: readonly ShotJob[];
  readonly cached: readonly ShotJob[];
  readonly resumed: boolean;
  readonly gpu: string | null;
  readonly state: ExportStateWriter;
}

interface ShotEntry {
  readonly id: string;
  readonly key: string;
  readonly frames: number;
}

const shotEntry = (job: ShotJob): ShotEntry => ({
  id: job.planned.shot.id,
  key: job.key,
  frames: job.planned.endFrame - job.planned.startFrame,
});

function shotJobs(context: RenderPassContext, media: ExportMedia): ShotJob[] {
  const { options, plan, presetId, scale, paths } = context;
  const outputKey = stableStringify({
    media: media.outputKey,
    preset: presetId,
    factor: scale.factor,
  });
  return plan.shots.map((planned) => {
    const key = segmentCacheKey({
      manifest: options.manifest,
      planned,
      identity: options.identity,
      outputKey,
      resolveAnchor: options.resolveAnchor,
    });
    return {
      planned,
      key,
      segment: path.join(paths.segmentsDir, `${key}${media.segmentExtension}`),
    };
  });
}

export async function runRenderPass(
  context: RenderPassContext,
  media: ExportMedia,
): Promise<Result<RenderPass, ExportError>> {
  const { options, paths, output, signal, emit, now } = context;
  const jobs = shotJobs(context, media);
  const jobKey = sha256Hex(stableStringify({ keys: jobs.map((job) => job.key), output }));
  const previous = await readExportState(paths.stateFile);
  const resumed =
    previous.ok &&
    previous.value !== null &&
    previous.value.jobKey === jobKey &&
    previous.value.status === 'running';

  const cachedFlags = await Promise.all(jobs.map((job) => fileExists(job.segment)));
  const toRender = jobs.filter((_, index) => cachedFlags[index] !== true);
  const cached = jobs.filter((_, index) => cachedFlags[index] === true);
  const state = new ExportStateWriter(paths.stateFile, {
    version: 1,
    jobKey,
    status: 'running',
    output,
    preset: context.presetId,
    encoder: media.encoderLabel,
    totalShots: jobs.length,
    finished: cached.map(shotEntry),
  });
  const initialWrite = await state.write();
  if (!initialWrite.ok)
    return err({ kind: 'io', message: initialWrite.error.message, path: paths.stateFile });

  const framesToRender = toRender.reduce(
    (sum, job) => sum + job.planned.endFrame - job.planned.startFrame,
    0,
  );
  const workers = Math.max(1, Math.min(context.workers, toRender.length));
  emit({
    type: 'plan',
    shots: jobs.length,
    cachedShots: cached.length,
    totalFrames: context.plan.totalFrames,
    framesToRender,
    workers,
    encoder: media.encoderLabel,
    resumed,
  });
  for (const job of cached) emit({ type: 'shot-done', shotId: job.planned.shot.id, cached: true });

  let renderedFrames = 0;
  let gpu: string | null = null;
  const announced = new Set<number>();
  const renderStarted = now();
  const hardware = media.fallback !== undefined;
  const rendered = await renderShots({
    manifest: options.manifest,
    jobs: toRender,
    workers,
    scale: context.scale,
    media,
    createFrameSource: options.createFrameSource,
    signal,
    openRetryDelayMs: hardware
      ? (options.encoderRetryDelayMs ?? DEFAULT_ENCODER_RETRY_DELAY_MS)
      : undefined,
    staggerMs: hardware ? (options.encoderStaggerMs ?? DEFAULT_ENCODER_STAGGER_MS) : 0,
    events: {
      onSourceOpened(worker, info) {
        if (announced.has(worker)) return;
        announced.add(worker);
        gpu ??= info.gpu;
        emit({ type: 'source', worker, gpu: info.gpu, software: isSoftwareRenderer(info.gpu) });
      },
      onShotStart(job, worker) {
        const frames = job.planned.endFrame - job.planned.startFrame;
        emit({ type: 'shot-start', shotId: job.planned.shot.id, frames, worker });
      },
      onFrame(job, frameInShot) {
        renderedFrames += 1;
        const elapsedS = (now() - renderStarted) / 1000;
        const fps = elapsedS > 0 ? renderedFrames / elapsedS : 0;
        emit({
          type: 'frame',
          shotId: job.planned.shot.id,
          frameInShot,
          shotFrames: job.planned.endFrame - job.planned.startFrame,
          renderedFrames,
          framesToRender,
          fps,
          etaS: fps > 0 ? (framesToRender - renderedFrames) / fps : null,
        });
      },
      onEncoderRetry(job, _worker, error, discardedFrames) {
        renderedFrames -= discardedFrames;
        context.warn({
          type: 'encoder-retry',
          encoder: media.encoderLabel,
          shotId: job.planned.shot.id,
          detail: openFailureDetail(error),
          message: `GPU encoder failed to open for shot ${job.planned.shot.id}; retrying`,
        });
      },
      async onShotDone(job) {
        const saved = await state.markFinished(shotEntry(job));
        if (!saved.ok)
          return err({ kind: 'io', message: saved.error.message, path: paths.stateFile });
        emit({ type: 'shot-done', shotId: job.planned.shot.id, cached: false });
        return ok(undefined);
      },
    },
  });
  if (!rendered.ok) return rendered;
  return ok({ jobs, toRender, cached, resumed, gpu, state });
}
