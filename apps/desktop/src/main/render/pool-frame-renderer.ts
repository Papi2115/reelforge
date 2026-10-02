/**
 * The stages' FrameRenderer (PLAN.md#7.4) on the app's render windows: the shot is planned exactly
 * as the `reelforge` CLI and the render service plan it (`planServiceShot`: the isolated manifest
 * of one shot at its timeline place), then rendered in a pooled hidden render window — the same
 * engine as preview and export (CLAUDE.md §3.3). A scene that does not load or throws while
 * rendering is a result (`ok: false`); a crashed/unavailable renderer rejects. Concurrent requests take separate windows
 * (the pool opens one per request in flight, up to the scene stage's concurrency).
 */
import { describeUnknown, planServiceShot } from '@reelforge/cli/service';
import type { CardDiagnostic } from '@reelforge/engine';
import {
  renderTarget,
  type FrameRenderer,
  type RenderedFrame,
  type ShotRender,
  type ShotRenderRequest,
} from '@reelforge/stages';
import { RenderPool, type PooledTarget } from './render-pool.js';
import { isFatalRenderError, type OpenRenderTarget, type RenderError } from './render-target.js';

export class RendererUnavailableError extends Error {
  constructor(readonly renderError: RenderError) {
    super(`the app's renderer failed: ${renderError.message}`);
    this.name = 'RendererUnavailableError';
  }
}

/**
 * An engine error while rendering (the scene threw in update(), bad ctx.text options) fails the
 * shot like a load error, so QA asks for a fix; anything else means the renderer is gone.
 */
function sceneFailure(entry: PooledTarget, error: RenderError, step: string): ShotRender {
  if (isFatalRenderError(error)) throw new RendererUnavailableError(error);
  return {
    ok: false,
    error: `${step}: ${error.message}`,
    errors: entry.target.takeConsoleErrors(),
  };
}

export class PoolFrameRenderer implements FrameRenderer {
  private pool: RenderPool;

  constructor(private readonly open: OpenRenderTarget) {
    this.pool = new RenderPool(open);
  }

  async renderShot(request: ShotRenderRequest, signal: AbortSignal): Promise<ShotRender> {
    let planned;
    try {
      planned = await planServiceShot(renderTarget(request), request.times);
    } catch (error) {
      return { ok: false, error: describeUnknown(error), errors: [] };
    }
    const acquired = await this.pool.acquire();
    if (!acquired.ok) throw new RendererUnavailableError(acquired.error);
    try {
      return await this.render(acquired.value, planned, request, signal);
    } finally {
      await this.pool.release(acquired.value);
    }
  }

  /** Closes the idle windows (frees GPU memory after a scene run); the renderer stays usable. */
  trim(): Promise<void> {
    return this.pool.trim();
  }

  async close(): Promise<void> {
    const pool = this.pool;
    this.pool = new RenderPool(this.open);
    await pool.close();
  }

  private async render(
    entry: PooledTarget,
    planned: Awaited<ReturnType<typeof planServiceShot>>,
    request: ShotRenderRequest,
    signal: AbortSignal,
  ): Promise<ShotRender> {
    const { plan, manifest } = planned;
    entry.target.takeConsoleErrors();
    const loaded = await RenderPool.ensureLoaded(entry, manifest);
    if (!loaded.ok) {
      if (isFatalRenderError(loaded.error)) throw new RendererUnavailableError(loaded.error);
      return { ok: false, error: loaded.error.message, errors: entry.target.takeConsoleErrors() };
    }
    const info = loaded.value;
    const frames: RenderedFrame[] = [];
    for (const t of request.times) {
      if (signal.aborted) break;
      const rendered = await entry.target.frame(plan.t0 + t);
      if (!rendered.ok) return sceneFailure(entry, rendered.error, `rendering t=${t.toFixed(2)}s`);
      frames.push({ t, image: { width: info.width, height: info.height, data: rendered.value } });
    }
    let cards: readonly CardDiagnostic[] = [];
    if (request.cards) {
      const checked = await entry.target.cards(plan.id);
      if (!checked.ok) return sceneFailure(entry, checked.error, 'checking the text cards');
      cards = checked.value;
    }
    return {
      ok: true,
      width: info.width,
      height: info.height,
      frames,
      cards,
      anchors: info.anchors.filter((anchor) => anchor.shotId === plan.id),
      cues: info.cues.filter((cue) => cue.shotId === plan.id),
      errors: entry.target.takeConsoleErrors(),
    };
  }
}
