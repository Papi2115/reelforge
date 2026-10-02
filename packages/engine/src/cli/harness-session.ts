/**
 * Drives the harness host page in Playwright Chromium with SwiftShader (software WebGL), so frame
 * rendering and render tests run without a GPU on Windows and Linux CI. Frames rendered here are
 * SwiftShader frames: compare them only with SwiftShader goldens (ADR-002).
 */
import { createHash } from 'node:crypto';
import { chromium, type Browser, type Page } from 'playwright';
import type { RenderManifest, SceneSource } from '@reelforge/shared';
import type { ReelforgeHarness } from '../harness/protocol.js';
import type { LoadInfo } from '../runtime.js';
import type { CardDiagnostic } from '../text/check-cards.js';
import { buildHarness } from './build-harness.js';
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
    errors,
    close: () => page.close(),
  };
}

export async function launchHarnessBrowser(): Promise<HarnessBrowser> {
  const server: StaticServer = await startStaticServer(await buildHarness());
  let browser: Browser;
  try {
    browser = await chromium.launch({ headless: true, args: SWIFTSHADER_ARGS });
  } catch (error) {
    await server.close();
    throw error;
  }
  return {
    async open(options = {}) {
      const page = await browser.newPage();
      const harnessPage = wrapPage(page);
      const url = new URL('harness.html', server.baseUrl);
      if (options.lint === true) url.searchParams.set('lint', '1');
      await page.goto(url.href, { waitUntil: 'load' });
      return harnessPage;
    },
    async close() {
      await browser.close();
      await server.close();
    },
  };
}
