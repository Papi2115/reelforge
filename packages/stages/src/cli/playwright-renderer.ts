/**
 * Dev/test FrameRenderer: the engine harness in headless Playwright Chromium (SwiftShader, via
 * `@reelforge/engine/cli`), with the same isolated shot manifests the `reelforge` CLI and the
 * app's render service build (`planServiceShot`). Not exported from the package index; the app
 * passes its render service (GPU Electron renderer) behind the same interface.
 * One browser for all renders, a fresh page per render (errors attributed to the right shot).
 */
import { describeUnknown, planServiceShot } from '@reelforge/cli/service';
import { launchHarnessBrowser, type HarnessBrowser } from '@reelforge/engine/cli';
import {
  renderTarget,
  type FrameRenderer,
  type RenderedFrame,
  type ShotRender,
  type ShotRenderRequest,
} from '../scenes/tools.js';

/** Engine errors arrive wrapped by Playwright (`page.evaluate: Error: [shot s01] ...`). */
export function cleanEngineError(error: unknown): string {
  const text = describeUnknown(error);
  const firstBlock = text.split(/\n\s+at |\nCall log:/)[0] ?? text;
  return firstBlock
    .replace(/^page\.evaluate:\s*/, '')
    .replace(/^(Engine)?Error:\s*/, '')
    .trim();
}

export class PlaywrightFrameRenderer implements FrameRenderer {
  private browser: Promise<HarnessBrowser> | undefined;
  /** Renders in progress right now / at most (tests check the scene stage's concurrency). */
  active = 0;
  maxActive = 0;

  async renderShot(request: ShotRenderRequest, signal: AbortSignal): Promise<ShotRender> {
    this.active += 1;
    this.maxActive = Math.max(this.maxActive, this.active);
    try {
      return await this.render(request, signal);
    } finally {
      this.active -= 1;
    }
  }

  async close(): Promise<void> {
    const browser = this.browser;
    this.browser = undefined;
    if (browser !== undefined) await (await browser).close();
  }

  private async render(request: ShotRenderRequest, signal: AbortSignal): Promise<ShotRender> {
    let planned;
    try {
      planned = await planServiceShot(renderTarget(request), request.times);
    } catch (error) {
      return { ok: false, error: describeUnknown(error), errors: [] };
    }
    this.browser ??= launchHarnessBrowser();
    // lint: project props (kit-ext) are checked by the engine like in the app's render windows.
    const page = await (await this.browser).open({ lint: true });
    try {
      let info;
      try {
        info = await page.load(planned.manifest);
      } catch (error) {
        return { ok: false, error: cleanEngineError(error), errors: [...page.errors] };
      }
      const frames: RenderedFrame[] = [];
      let cards;
      // A scene that throws in update() is a scene failure (a fix turn), not a renderer outage.
      let step = '';
      try {
        for (const t of request.times) {
          if (signal.aborted) break;
          step = `rendering t=${t.toFixed(2)}s`;
          const data = await page.frameAt(planned.plan.t0 + t);
          frames.push({ t, image: { width: info.width, height: info.height, data } });
        }
        step = 'checking the text cards';
        cards = request.cards ? await page.checkCards(planned.plan.id) : [];
      } catch (error) {
        return {
          ok: false,
          error: `${step}: ${cleanEngineError(error)}`,
          errors: [...page.errors],
        };
      }
      return {
        ok: true,
        width: info.width,
        height: info.height,
        frames,
        cards,
        anchors: info.anchors.filter((anchor) => anchor.shotId === planned.plan.id),
        cues: info.cues.filter((cue) => cue.shotId === planned.plan.id),
        errors: [...page.errors],
      };
    } finally {
      await page.close();
    }
  }
}
