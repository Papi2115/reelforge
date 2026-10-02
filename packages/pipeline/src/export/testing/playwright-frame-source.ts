/**
 * Test/dev FrameSource: the engine harness in headless Playwright Chromium (SwiftShader, via
 * `@reelforge/engine/cli`). Not exported from the package index and not used by the app, which
 * renders in a hidden Electron window (phase 6) behind the same FrameSource interface.
 * One browser is shared by all workers; each worker gets its own page (own WebGL context).
 */
import type { RenderManifest } from '@reelforge/shared';
import { launchHarnessBrowser, type HarnessBrowser, type HarnessPage } from '@reelforge/engine/cli';
import { describeUnknown, type ExportError } from '../errors.js';
import type { FrameSource, FrameSourceFactory, FrameSourceInfo } from '../frame-source.js';
import { err, ok, type Result } from '../../result.js';

export interface PlaywrightFrameSources {
  readonly factory: FrameSourceFactory;
  /** Closes the shared browser (call after the export). */
  close(): Promise<void>;
}

interface LoadedPage {
  readonly page: HarnessPage;
  readonly manifest: RenderManifest;
  readonly info: FrameSourceInfo;
}

function failure(message: string, page?: HarnessPage): ExportError {
  const pageErrors =
    page === undefined || page.errors.length === 0 ? '' : ` (page: ${page.errors.join(' | ')})`;
  return { kind: 'frame-source', message: `${message}${pageErrors}` };
}

export function createPlaywrightFrameSources(): PlaywrightFrameSources {
  let browser: Promise<HarnessBrowser> | null = null;
  const getBrowser = (): Promise<HarnessBrowser> => {
    browser ??= launchHarnessBrowser();
    return browser;
  };

  const factory: FrameSourceFactory = () => {
    let loaded: LoadedPage | null = null;

    const closePage = async (): Promise<void> => {
      const current = loaded;
      loaded = null;
      if (current !== null) await current.page.close();
    };

    const source: FrameSource = {
      async open(manifest): Promise<Result<FrameSourceInfo, ExportError>> {
        if (loaded?.manifest === manifest) return ok(loaded.info);
        await closePage();
        let page: HarnessPage | undefined;
        try {
          page = await (await getBrowser()).open();
          const info = await page.load(manifest);
          loaded = {
            page,
            manifest,
            info: { width: info.width, height: info.height, gpu: info.gpu.renderer },
          };
          return ok(loaded.info);
        } catch (error) {
          const result = err(
            failure(`engine harness failed to load: ${describeUnknown(error)}`, page),
          );
          await page?.close();
          return result;
        }
      },
      async renderFrame(t): Promise<Result<Uint8Array, ExportError>> {
        if (loaded === null) return err(failure('renderFrame() before open()'));
        try {
          const bytes = await loaded.page.frameAt(t);
          return ok(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength));
        } catch (error) {
          return err(
            failure(`rendering t=${t.toFixed(3)} failed: ${describeUnknown(error)}`, loaded.page),
          );
        }
      },
      close: closePage,
    };
    return source;
  };

  return {
    factory,
    async close() {
      const pending = browser;
      browser = null;
      if (pending === null) return;
      // A browser that failed to launch has nothing to close; its error was reported by open().
      const launched = await pending.catch(() => null);
      await launched?.close();
    },
  };
}
