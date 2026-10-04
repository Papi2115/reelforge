/**
 * Drives the harness host page in Playwright Chromium with SwiftShader (software WebGL), so frame
 * rendering and render tests run without a GPU on Windows and Linux CI. Frames rendered here are
 * SwiftShader frames: compare them only with SwiftShader goldens (ADR-002).
 */
import { createHash } from 'node:crypto';
import { chromium, type Browser, type Page } from 'playwright';
import type { RenderManifest, SceneSource, ShotDirection } from '@reelforge/shared';
import type { PickInfo, ReelforgeHarness } from '../harness/protocol.js';
import type { LoadInfo } from '../runtime.js';
import type { CardDiagnostic } from '../text/check-cards.js';
import { buildHarness } from './build-harness.js';
import {
  CLOSE_TIMEOUT_MS,
  closeWithin,
  guardHarnessPage,
  resolveHarnessTimeouts,
  type HarnessTimeouts,
} from './harness-timeouts.js';
import { startStaticServer, type StaticServer } from './static-server.js';

/** Verified by the WebGL renderer string asserted in the tests ("SwiftShader"). */
export const SWIFTSHADER_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];

export interface HarnessPage {
  load(manifest: RenderManifest): Promise<LoadInfo>;
  /** seek(t) then frame(): RGBA8 bytes as seen by the host page. */
  frameAt(t: number): Promise<Buffer>;
  hashAt(t: number): Promise<string>;
  /** Text-card QA of a loaded shot (overlaps, safe area), sampled every frame. */
  checkCards(shotId: string): Promise<readonly CardDiagnostic[]>;
  /** Hot reload of one shot of the loaded video (PLAN.md#6.4). */
  reloadShot(shotId: string, scene: SceneSource): Promise<LoadInfo>;
  /** Object at normalized frame point (x, y) at global time t (PLAN.md#6.6); null = background. */
  pick(x: number, y: number, t: number): Promise<PickInfo | null>;
  /** Live co-direction of one shot (PLAN.md#12.14); null clears it. */
  setShotDirection(shotId: string, direction: ShotDirection | null): Promise<void>;
  /** Console errors and uncaught page errors (host page and engine frame). */
  readonly errors: readonly string[];
  close(): Promise<void>;
}

export interface OpenPageOptions {
  /** Reject scenes failing the determinism lint in load() (harness `lintScenes` option). */
  readonly lint?: boolean;
}

export interface HarnessBrowser {
  /** Opens a fresh host page (new iframe, new WebGL context, new module instances). */
  open(options?: OpenPageOptions): Promise<HarnessPage>;
  close(): Promise<void>;
}

type HarnessWindow = Window & { __reelforge: ReelforgeHarness };

export function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function wrapPage(page: Page): HarnessPage {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  const frameAt = async (t: number): Promise<Buffer> => {
    const base64 = await page.evaluate(async (time) => {
      const harness = (window as unknown as HarnessWindow).__reelforge;
      await harness.seek(time);
      const bytes = harness.frame();
      let binary = '';
      for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
      }
      return btoa(binary);
    }, t);
    return Buffer.from(base64, 'base64');
  };
  return {
    load: (manifest) =>
      page.evaluate(
        (input) => (window as unknown as HarnessWindow).__reelforge.load(input),
        manifest,
      ),
    frameAt,
    hashAt: async (t) => sha256(await frameAt(t)),
    checkCards: (shotId) =>
      page.evaluate(
        (id) => (window as unknown as HarnessWindow).__reelforge.checkCards(id),
        shotId,
      ),
    reloadShot: (shotId, scene) =>
      page.evaluate(
        (input) =>
          (window as unknown as HarnessWindow).__reelforge.reloadShot(input.shotId, input.scene),
        { shotId, scene },
      ),
    pick: (x, y, t) =>
      page.evaluate(
        (input) => (window as unknown as HarnessWindow).__reelforge.pick(input.x, input.y, input.t),
        { x, y, t },
      ),
    setShotDirection: (shotId, direction) =>
      page.evaluate(
        (input) =>
          (window as unknown as HarnessWindow).__reelforge.setShotDirection(
            input.shotId,
            input.direction,
          ),
        { shotId, direction },
      ),
    errors,
    close: () => page.close(),
  };
}

export interface HarnessBrowserOptions {
  /** Per-request timeouts (harness-timeouts.ts defaults: 60 s warm, 180 s cold). */
  readonly timeouts?: HarnessTimeouts;
}

function launchChromium(): Promise<Browser> {
  return chromium.launch({ headless: true, args: SWIFTSHADER_ARGS });
}

/**
 * One Chromium for every page. When a page's request times out the browser is killed at once
 * (browser.close(), bounded) and the next open() launches a fresh one; pages of the killed browser
 * reject with HarnessTimeoutError (`browser-restarted`). On process exit Playwright itself kills
 * every browser it launched (on Windows `taskkill /T /F`, playwright-core processLauncher).
 */
export async function launchHarnessBrowser(
  options: HarnessBrowserOptions = {},
): Promise<HarnessBrowser> {
  const timeouts = resolveHarnessTimeouts(options.timeouts);
  const server: StaticServer = await startStaticServer(await buildHarness());
  let current: Promise<Browser>;
  try {
    const first = await launchChromium();
    current = Promise.resolve(first);
  } catch (error) {
    await server.close();
    throw error;
  }
  let generation = 0;
  const recycle = (killed: number): void => {
    if (killed !== generation) return;
    generation += 1;
    const old = current;
    current = old
      .then((browser) => closeWithin(() => browser.close(), CLOSE_TIMEOUT_MS))
      .then(launchChromium, launchChromium);
  };
  return {
    async open(pageOptions = {}) {
      const browser = await current;
      const born = generation;
      const page = await browser.newPage();
      const harnessPage = guardHarnessPage(wrapPage(page), {
        timeouts,
        onTimeout: () => {
          recycle(born);
        },
        isStale: () => born !== generation,
      });
      const url = new URL('harness.html', server.baseUrl);
      if (pageOptions.lint === true) url.searchParams.set('lint', '1');
      await page.goto(url.href, { waitUntil: 'load' });
      return harnessPage;
    },
    async close() {
      await closeWithin(async () => (await current).close(), CLOSE_TIMEOUT_MS);
      await server.close();
    },
  };
}
