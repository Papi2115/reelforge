/**
 * What the render service does per request: plan the shot exactly as the CLI does
 * (`planServiceShot`: the isolated manifest of one shot at its timeline place), render it in a
 * pooled hidden render window and answer with PNG frames, card QA, anchors and cues. Requests
 * are served one at a time (one warm window). A scene that fails to load is a result
 * (`ok: false`), a crashed/hung renderer a 502.
 */
import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  framesDir,
  frameFileName,
  planServiceShot,
  ProjectError,
  RENDER_SERVICE_VERSION,
  UsageError,
  type LoadRequest,
  type LoadResponse,
  type RenderedFrameData,
  type ShotFramesRequest,
  type ShotRenderResponse,
  type ShotTargetRequest,
} from '@reelforge/cli/service';
import type { CardDiagnostic } from '@reelforge/engine';
import { encodePng, type RgbaImage } from '@reelforge/engine/raster';
import { resolveOutputScale, type ExportPresetId } from '@reelforge/pipeline';
import { buildProjectManifest } from '../project-manifest.js';
import { RenderPool, type PooledTarget } from './render-pool.js';
import { isFatalRenderError, type RenderError } from './render-target.js';
import { ServiceError } from './render-service.js';

export interface RenderServiceHandlers {
  load(request: LoadRequest): Promise<LoadResponse>;
  frames(request: ShotFramesRequest): Promise<ShotRenderResponse>;
  cards(request: ShotTargetRequest): Promise<ShotRenderResponse>;
  anchors(request: ShotTargetRequest): Promise<ShotRenderResponse>;
}

/** Neighbour upscale by an integer factor (export presets: crisp pixel blocks). */
export function upscaleNearest(image: RgbaImage, factor: number): RgbaImage {
  if (factor === 1) return image;
  const width = image.width * factor;
  const height = image.height * factor;
  const data = new Uint8Array(width * height * 4);
  const row = new Uint8Array(width * 4);
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const pixel = image.data.subarray((y * image.width + x) * 4, (y * image.width + x + 1) * 4);
      for (let dx = 0; dx < factor; dx += 1) row.set(pixel, (x * factor + dx) * 4);
    }
    for (let dy = 0; dy < factor; dy += 1) data.set(row, (y * factor + dy) * width * 4);
  }
  return { width, height, data };
}

async function writePngAtomic(file: string, png: Buffer): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${String(process.pid)}.tmp`;
  await writeFile(temporary, png);
  await rename(temporary, file);
}

function rendererFailure(error: RenderError): ServiceError {
  return new ServiceError('renderer', 502, `the app's renderer failed: ${error.message}`);
}

/** Maps the CLI's planning errors to service errors (usage -> 400, project -> 422). */
async function planned<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof UsageError) throw new ServiceError('usage', 400, error.message);
    if (error instanceof ProjectError)
      throw new ServiceError('project', 422, error.message, error.fix);
    throw error;
  }
}

interface ShotJob {
  readonly target: ShotTargetRequest;
  readonly at: readonly number[];
  readonly cards: boolean;
  readonly preset?: ExportPresetId | undefined;
  readonly output: 'base64' | 'files';
}

export function createRenderServiceHandlers(pool: RenderPool): RenderServiceHandlers {
  let queue: Promise<unknown> = Promise.resolve();
  /** Serializes renders: one warm window, requests in arrival order. */
  function serialized<T>(work: () => Promise<T>): Promise<T> {
    const next = queue.then(work, work);
    queue = next.catch(() => undefined);
    return next;
  }

  async function withTarget<T>(work: (entry: PooledTarget) => Promise<T>): Promise<T> {
    const acquired = await pool.acquire();
    if (!acquired.ok) throw rendererFailure(acquired.error);
    try {
      return await work(acquired.value);
    } finally {
      await pool.release(acquired.value);
    }
  }

  async function renderShot(job: ShotJob): Promise<ShotRenderResponse> {
    const { plan, manifest } = await planned(() => planServiceShot(job.target, job.at));
    const shot = {
      id: plan.id,
      file: plan.file,
      t0: plan.t0,
      t1: plan.t1,
      standalone: plan.standalone,
    };
    return withTarget(async (entry) => {
      entry.target.takeConsoleErrors();
      const loaded = await RenderPool.ensureLoaded(entry, manifest);
      if (!loaded.ok) {
        if (isFatalRenderError(loaded.error)) throw rendererFailure(loaded.error);
        const errors = entry.target.takeConsoleErrors();
        return {
          version: RENDER_SERVICE_VERSION,
          shot,
          result: { ok: false, error: loaded.error.message, errors },
        };
      }
      const info = loaded.value;
      const factor =
        job.preset === undefined ? 1 : scaleFactor(job.preset, info.width, info.height);
      const frames: RenderedFrameData[] = [];
      const sceneFailure = (error: RenderError, step: string): ShotRenderResponse => {
        // The scene threw while rendering (update(), ctx.text options): the author's problem.
        if (isFatalRenderError(error)) throw rendererFailure(error);
        const errors = entry.target.takeConsoleErrors();
        return {
          version: RENDER_SERVICE_VERSION,
          shot,
          result: { ok: false, error: `${step}: ${error.message}`, errors },
        };
      };
      for (const t of job.at) {
        const rendered = await entry.target.frame(plan.t0 + t);
        if (!rendered.ok) return sceneFailure(rendered.error, `rendering t=${t.toFixed(2)}s`);
        const image = upscaleNearest(
          { width: info.width, height: info.height, data: rendered.value },
          factor,
        );
        const png = encodePng(image);
        if (job.output === 'files') {
          const file = framesDir(job.target.projectDir, plan.id, frameFileName(plan.id, t));
          await writePngAtomic(file, png);
          frames.push({ t, width: image.width, height: image.height, file });
        } else {
          frames.push({ t, width: image.width, height: image.height, png: png.toString('base64') });
        }
      }
      let cards: CardDiagnostic[] = [];
      if (job.cards) {
        const checked = await entry.target.cards(plan.id);
        if (!checked.ok) return sceneFailure(checked.error, 'checking the text cards');
        cards = [...checked.value];
      }
      return {
        version: RENDER_SERVICE_VERSION,
        shot,
        result: {
          ok: true,
          width: info.width,
          height: info.height,
          style: info.style,
          gpu: info.gpu.renderer,
          frames,
          cards: cards.map((card) => ({ ...card, cards: [...card.cards] })),
          anchors: info.anchors.filter((anchor) => anchor.shotId === plan.id),
          cues: info.cues.filter((cue) => cue.shotId === plan.id),
          errors: entry.target.takeConsoleErrors(),
        },
      };
    });
  }

  async function loadProject(request: LoadRequest): Promise<LoadResponse> {
    const built = await buildProjectManifest(request.projectDir);
    if (built.status === 'no-storyboard') {
      throw new ServiceError(
        'project',
        422,
        'storyboard.json is missing',
        'the Storyboard stage has not run yet',
      );
    }
    if (built.status !== 'ready') {
      throw new ServiceError(
        'project',
        422,
        built.reason,
        'run reelforge validate and fix the project files',
      );
    }
    return withTarget(async (entry) => {
      entry.target.takeConsoleErrors();
      const loaded = await RenderPool.ensureLoaded(entry, built.manifest);
      const errors = entry.target.takeConsoleErrors();
      if (!loaded.ok) {
        if (isFatalRenderError(loaded.error)) throw rendererFailure(loaded.error);
        return {
          version: RENDER_SERVICE_VERSION,
          result: { ok: false, error: loaded.error.message, errors },
        };
      }
      const info = loaded.value;
      return {
        version: RENDER_SERVICE_VERSION,
        result: {
          ok: true,
          duration: info.duration,
          style: info.style,
          width: info.width,
          height: info.height,
          fps: info.fps,
          shots: built.manifest.shots.map((shot) => shot.id),
          anchors: [...info.anchors],
          cues: [...info.cues],
          gpu: info.gpu.renderer,
          errors,
        },
      };
    });
  }

  return {
    load: (request) => serialized(() => loadProject(request)),
    frames: (request) =>
      serialized(() =>
        renderShot({
          target: request,
          at: request.at,
          cards: request.cards === true,
          preset: request.preset,
          output: request.output ?? 'base64',
        }),
      ),
    cards: (request) =>
      serialized(() => renderShot({ target: request, at: [], cards: true, output: 'base64' })),
    anchors: (request) =>
      serialized(() => renderShot({ target: request, at: [], cards: false, output: 'base64' })),
  };
}

function scaleFactor(preset: ExportPresetId, width: number, height: number): number {
  const scale = resolveOutputScale(preset, width, height);
  if (!scale.ok) throw new ServiceError('usage', 400, scale.error.message);
  return scale.value.factor;
}
