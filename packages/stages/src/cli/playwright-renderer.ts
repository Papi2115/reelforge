/**
 * Dev/test FrameRenderer: the engine harness in headless Playwright Chromium (SwiftShader, via
 * `@reelforge/engine/cli`), with the same isolated shot manifests the `reelforge` CLI and the
 * app's render service build (`planServiceShot`). Not exported from the package index; the app
 * passes its render service (GPU Electron renderer) behind the same interface.
 * One browser for all renders, a fresh page per render (errors attributed to the right shot).
 * Every harness request has a timeout; a render that times out is retried once on a fresh
 * browser, then reported as `timedOut` (QA warns instead of hanging, PLAN real-run v2.3). A host
 * page whose harness did not start is retried on fresh pages, then reported the same way.
 */
import { describeUnknown, planServiceShot } from '@reelforge/cli/service';
import {
  isHarnessTimeout,
  launchHarnessBrowser,
  retryOnHarnessTimeout,
  type HarnessBrowser,
  type HarnessBrowserOptions,
} from '@reelforge/engine/cli';
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

type PlannedShot = Awaited<ReturnType<typeof planServiceShot>>;

/** V8's error when the host page has no `window.__reelforge` (its harness script did not run). */
const HARNESS_MISSING = /Cannot read properties of (?:undefined|null) \(reading 'load'\)/;

/** Fresh pages tried for a render whose harness page did not start. */
export const HARNESS_START_ATTEMPTS = 3;
const HARNESS_START_DELAY_MS = 250;

/**
 * The host page loaded without `window.__reelforge` (real test film 3: "TypeError … reading
 * 'load'" in a QA round that the fix turn could not reproduce). Likely cause: outside the app,
 * every `reelforge frames` of a parallel scene turn launches its own harness browser and rebuilds
 * the shared harness files with plain writes (engine `buildHarness`), so a page opened meanwhile
 * can get a truncated script. Not the scene's fault: never sent to a fix turn.
 */
class HarnessNotStartedError extends Error {
  constructor(
    readonly detail: string,
    readonly pageErrors: readonly string[],
  ) {
    super(`the render harness page did not start: ${detail}`);
    this.name = 'HarnessNotStartedError';
  }
}

function harnessNotStarted(error: HarnessNotStartedError, attempts: number): ShotRender {
  return {
    ok: false,
    timedOut: true,
    notStarted: true,
    error: `the render harness page did not start (${error.detail}) on ${String(attempts)} fresh pages: a renderer problem (its files were probably being rebuilt by another render process), not a scene error`,
    errors: [...error.pageErrors],
  };
}

export interface PlaywrightFrameRendererOptions extends HarnessBrowserOptions {
  /** Test seam: how the harness browser is launched (default: launchHarnessBrowser). */
  readonly launch?: (options: HarnessBrowserOptions) => Promise<HarnessBrowser>;
}

export class PlaywrightFrameRenderer implements FrameRenderer {
  private browser: Promise<HarnessBrowser> | undefined;
  /** Renders in progress right now / at most (tests check the scene stage's concurrency). */
  active = 0;
  maxActive = 0;

  /** `harnessStartDelayMs`: wait before a fresh page when the harness page did not start. */
  constructor(
    private readonly options: PlaywrightFrameRendererOptions = {},
    private readonly harnessStartDelayMs = HARNESS_START_DELAY_MS,
  ) {}

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
    let planned: PlannedShot;
    try {
      planned = await planServiceShot(renderTarget(request), request.times);
    } catch (error) {
      return { ok: false, error: describeUnknown(error), errors: [] };
    }
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.renderRetryingTimeouts(planned, request, signal);
      } catch (error) {
        if (!(error instanceof HarnessNotStartedError)) throw error;
        if (attempt >= HARNESS_START_ATTEMPTS || signal.aborted) {
          return harnessNotStarted(error, attempt);
        }
        await new Promise((resolve) => setTimeout(resolve, this.harnessStartDelayMs));
      }
    }
  }

  private async renderRetryingTimeouts(
    planned: PlannedShot,
    request: ShotRenderRequest,
    signal: AbortSignal,
  ): Promise<ShotRender> {
    const retried = await retryOnHarnessTimeout(() => this.renderOnce(planned, request, signal));
    if (retried.ok) return retried.value;
    return {
      ok: false,
      timedOut: true,
      error: `${retried.error.message} (retried once on a fresh renderer)`,
      errors: [],
    };
  }

  /** One attempt on a fresh page; a harness timeout rejects (HarnessTimeoutError). */
  private async renderOnce(
    planned: PlannedShot,
    request: ShotRenderRequest,
    signal: AbortSignal,
  ): Promise<ShotRender> {
    const { launch = launchHarnessBrowser, ...harnessOptions } = this.options;
    this.browser ??= launch(harnessOptions);
    // lint: project props (kit-ext) are checked by the engine like in the app's render windows.
    const page = await (await this.browser).open({ lint: true });
    try {
      let info;
      try {
        info = await page.load(planned.manifest);
      } catch (error) {
        if (isHarnessTimeout(error)) throw error;
        const message = cleanEngineError(error);
        if (HARNESS_MISSING.test(message)) throw new HarnessNotStartedError(message, page.errors);
        return { ok: false, error: message, errors: [...page.errors] };
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
        if (isHarnessTimeout(error)) throw error;
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
