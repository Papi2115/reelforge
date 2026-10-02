/**
 * "Video exported" for the open project, in the app: the preview's manifest (project.json +
 * storyboard + scenes + words, project-manifest.ts) -> `exportVideo` with frames from hidden
 * render windows (electron-frame-source.ts), ffmpeg + encoder from the settings. Failures are
 * returned as an ExportOutcome, never thrown.
 */
import { createExactAnchorResolver } from '@reelforge/engine';
import {
  createFfmpegMedia,
  detectEncoder,
  exportVideo,
  FfmpegManager,
  type ExportProgress,
  type FfmpegError,
  type Result,
} from '@reelforge/pipeline';
import { projectFileSchema, type AppSettings } from '@reelforge/shared';
import type { ExportOutcome, ExportStartRequest } from '../../shared/export-contract.js';
import { SNAPSHOT_FILES } from '../../shared/snapshot-contract.js';
import { describeError, type Logger } from '../logger.js';
import { readProjectJson } from '../project-files.js';
import { buildProjectManifest } from '../project-manifest.js';
import { exportSettings, ffmpegLocateOptions } from '../settings-consumers.js';
import { electronFrameSourceFactory } from './electron-frame-source.js';
import { renderIdentity } from './render-identity.js';
import { RenderPool } from './render-pool.js';
import type { OpenRenderTarget } from './render-target.js';

export interface ExportProjectOptions {
  readonly projectDir: string;
  readonly request: ExportStartRequest;
  readonly settings: AppSettings;
  readonly cores: number;
  readonly openTarget: OpenRenderTarget;
  /** Engine bundle hash (render-identity.ts). */
  readonly engineVersion: string;
  readonly signal: AbortSignal;
  readonly onProgress: (event: ExportProgress) => void;
  readonly log: Logger;
  /** Test seam; default `FfmpegManager.create` with the settings' ffmpeg path. */
  readonly createFfmpeg?: () => Promise<Result<FfmpegManager, FfmpegError>>;
}

function failed(kind: string, message: string): ExportOutcome {
  return { status: 'failed', kind, message };
}

/** Settings with this export's encoder override applied. */
function effectiveSettings(settings: AppSettings, request: ExportStartRequest): AppSettings {
  if (request.encoder === undefined) return settings;
  return { ...settings, performance: { ...settings.performance, encoder: request.encoder } };
}

export async function exportProject(options: ExportProjectOptions): Promise<ExportOutcome> {
  const { projectDir, request, log } = options;
  const built = await buildProjectManifest(projectDir);
  if (built.status === 'no-storyboard') {
    return failed('invalid-input', 'the project has no storyboard yet');
  }
  if (built.status !== 'ready') return failed('invalid-input', built.reason);
  const manifest = built.manifest;
  const project = await readProjectJson(projectDir, SNAPSHOT_FILES.project, projectFileSchema);
  if (project.status !== 'ok') return failed('invalid-input', 'project.json cannot be read');
  const identity = renderIdentity(manifest.style, options.engineVersion);
  if (!identity.ok) return failed('invalid-input', identity.error);

  const settings = effectiveSettings(options.settings, request);
  const ffmpeg = await (
    options.createFfmpeg ?? (() => FfmpegManager.create(ffmpegLocateOptions(settings)))
  )();
  if (!ffmpeg.ok) return failed('no-ffmpeg', ffmpeg.error.message);
  const performance = exportSettings(settings, options.cores);
  const encoder = await detectEncoder(ffmpeg.value, {
    prefer: performance.encoder,
    quality: request.quality ?? 'final',
    signal: options.signal,
  });
  if (!encoder.ok) return failed(encoder.error.kind, encoder.error.message);
  for (const probe of encoder.value.probes) {
    if (!probe.ok) log.warn(`encoder ${probe.encoder} unavailable: ${probe.detail}`);
  }
  log.info(
    `export ${projectDir}: ${encoder.value.encoder} (${request.quality ?? 'final'}), ${String(request.workers ?? performance.workers)} worker(s), preset ${request.preset ?? '1080p30'}`,
  );

  const pool = new RenderPool(options.openTarget);
  try {
    const result = await exportVideo({
      projectDir,
      title: project.data.title,
      manifest,
      identity: identity.value,
      media: createFfmpegMedia(ffmpeg.value, encoder.value),
      createFrameSource: electronFrameSourceFactory(pool, options.signal),
      workers: request.workers ?? performance.workers,
      ...(request.preset === undefined ? {} : { preset: request.preset }),
      ...(manifest.words === undefined
        ? {}
        : { resolveAnchor: createExactAnchorResolver(manifest.words.words) }),
      signal: options.signal,
      onProgress: (event) => {
        if (event.type === 'source') {
          const level = event.software ? 'warn' : 'info';
          log.log(
            level,
            `render worker ${String(event.worker)}: GPU ${event.gpu ?? 'unknown'}${event.software ? ' (software rendering: 5-15x slower; check the GPU driver/settings)' : ''}`,
          );
        }
        options.onProgress(event);
      },
    });
    if (!result.ok) {
      if (result.error.kind === 'cancelled') return { status: 'cancelled' };
      log.warn(`export failed: ${result.error.kind}: ${result.error.message}`);
      return failed(result.error.kind, result.error.message);
    }
    const value = result.value;
    log.info(
      `exported ${value.output} (${String(value.totalFrames)} frames, ${String(Math.round(value.wallMs))} ms)`,
    );
    return {
      status: 'done',
      output: value.output,
      thumbnail: value.thumbnail,
      renderedShots: [...value.renderedShots],
      cachedShots: [...value.cachedShots],
      totalFrames: value.totalFrames,
      durationS: value.durationS,
      width: value.width,
      height: value.height,
      encoder: value.encoder,
      gpu: value.gpu,
      resumed: value.resumed,
      wallMs: value.wallMs,
    };
  } catch (error) {
    log.error(`export crashed: ${describeError(error)}`);
    return failed('internal', describeError(error));
  } finally {
    await pool.close();
  }
}
