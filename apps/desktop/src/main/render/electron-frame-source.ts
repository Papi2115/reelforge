/**
 * The app's export FrameSource (docs/export.md): each render worker takes a hidden render window
 * from the pool, loads the whole manifest once (transitions read the previous shot) and renders
 * frames by global time. GPU by default; the GPU string goes to the exporter's `source` event.
 * Aborting the signal closes the windows, so a long scene build does not delay cancellation.
 * A window that dies or stops answering (not a scene error) is replaced by a fresh one and the
 * load / frame is tried again (frames are pure functions of time, so a retry is exact).
 */
import type {
  ExportError,
  FrameSource,
  FrameSourceFactory,
  FrameSourceInfo,
} from '@reelforge/pipeline';
import { err, ok, type Result } from '@reelforge/pipeline';
import type { RenderManifest } from '@reelforge/shared';
import type { LoadInfo } from '@reelforge/engine';
import type { Logger } from '../logger.js';
import { RenderPool, type PooledTarget } from './render-pool.js';
import { isFatalRenderError, type RenderError } from './render-target.js';

/** Fresh windows tried after a window dies or misses a deadline. */
export const WINDOW_RETRIES = 2;

export interface ElectronFrameSourceOptions {
  readonly signal?: AbortSignal | undefined;
  readonly log?: Pick<Logger, 'warn'> | undefined;
  /** Default WINDOW_RETRIES. */
  readonly windowRetries?: number | undefined;
  /** Gets every failure caused by the render window rather than by a scene (after the retries). */
  readonly onWindowFailure?: ((error: ExportError) => void) | undefined;
}

function frameSourceError(
  context: string,
  error: RenderError,
  consoleErrors: string[],
): ExportError {
  const page =
    consoleErrors.length === 0 ? '' : ` (console: ${consoleErrors.slice(0, 5).join(' | ')})`;
  return { kind: 'frame-source', message: `${context}: ${error.message}${page}` };
}

/** The message of a window failure that survived the retries: what died, where, and how often. */
function windowFailureError(context: string, error: RenderError, retries: number): ExportError {
  const what =
    error.kind === 'timeout'
      ? `the render window stopped responding (${error.message})`
      : error.kind === 'crashed'
        ? error.message
        : `the render window went away (${error.message})`;
  const tried = retries === 0 ? '' : `; tried ${String(retries)} fresh window(s)`;
  return { kind: 'frame-source', message: `${context}: ${what}${tried}` };
}

interface Loaded {
  readonly window: PooledTarget;
  readonly info: LoadInfo;
}

export function electronFrameSourceFactory(
  pool: RenderPool,
  options: ElectronFrameSourceOptions = {},
): FrameSourceFactory {
  const { signal, log } = options;
  const retries = options.windowRetries ?? WINDOW_RETRIES;
  return () => {
    let entry: PooledTarget | null = null;
    let info: FrameSourceInfo | null = null;
    let manifest: RenderManifest | null = null;
    /** Windows replaced by this source (all calls together). */
    let replaced = 0;
    const onAbort = (): void => {
      void entry?.target.close();
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    // A function, not a narrowed property: the signal can fire during any await below.
    const aborted = (): boolean => signal?.aborted === true;

    const windowFailure = (context: string, error: RenderError): ExportError => {
      const failure = windowFailureError(context, error, replaced);
      options.onWindowFailure?.(failure);
      return failure;
    };

    /** A window with `video` loaded; dead windows are replaced while retries are left. */
    const ensureWindow = async (video: RenderManifest): Promise<Result<Loaded, ExportError>> => {
      for (;;) {
        if (aborted()) return err({ kind: 'cancelled', message: 'export cancelled' });
        if (entry === null) {
          const acquired = await pool.acquire();
          if (!acquired.ok)
            return err(frameSourceError('cannot open a render window', acquired.error, []));
          entry = acquired.value;
        }
        const loaded = await RenderPool.ensureLoaded(entry, video);
        if (loaded.ok) return ok({ window: entry, info: loaded.value });
        const consoleErrors = entry.target.takeConsoleErrors();
        const context = 'the engine failed to load the video';
        if (!isFatalRenderError(loaded.error)) {
          return err(frameSourceError(context, loaded.error, consoleErrors));
        }
        if (aborted()) return err({ kind: 'cancelled', message: 'export cancelled' });
        if (replaced >= retries) return err(windowFailure(context, loaded.error));
        await replaceWindow(context, loaded.error);
      }
    };

    const replaceWindow = async (context: string, error: RenderError): Promise<void> => {
      replaced += 1;
      log?.warn(
        `${context}: ${error.message}; retrying on a fresh render window (${String(replaced)}/${String(retries)})`,
      );
      const dead = entry;
      entry = null;
      if (dead !== null) await pool.release(dead);
    };

    const source: FrameSource = {
      async open(video): Promise<Result<FrameSourceInfo, ExportError>> {
        if (aborted()) return err({ kind: 'cancelled', message: 'export cancelled' });
        const loaded = await ensureWindow(video);
        if (!loaded.ok) return loaded;
        manifest = video;
        const { width, height, gpu } = loaded.value.info;
        info = { width, height, gpu: gpu.renderer };
        return ok(info);
      },
      async renderFrame(t): Promise<Result<Uint8Array, ExportError>> {
        if (entry === null || info === null || manifest === null) {
          return err({ kind: 'frame-source', message: 'renderFrame() before open()' });
        }
        const context = `rendering t=${t.toFixed(3)} failed`;
        let current = entry;
        for (;;) {
          const frame = await current.target.frame(t);
          if (frame.ok) return frame;
          const consoleErrors = current.target.takeConsoleErrors();
          if (!isFatalRenderError(frame.error)) {
            return err(frameSourceError(context, frame.error, consoleErrors));
          }
          if (aborted()) return err({ kind: 'cancelled', message: 'export cancelled' });
          if (replaced >= retries) return err(windowFailure(context, frame.error));
          await replaceWindow(context, frame.error);
          const reloaded = await ensureWindow(manifest);
          if (!reloaded.ok) return reloaded;
          current = reloaded.value.window;
        }
      },
      async close(): Promise<void> {
        signal?.removeEventListener('abort', onAbort);
        const current = entry;
        entry = null;
        info = null;
        manifest = null;
        if (current !== null) await pool.release(current);
      },
    };
    return source;
  };
}
