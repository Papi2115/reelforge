/**
 * The app's export FrameSource (docs/export.md): each render worker takes a hidden render window
 * from the pool, loads the whole manifest once (transitions read the previous shot) and renders
 * frames by global time. GPU by default; the GPU string goes to the exporter's `source` event.
 * Aborting the signal closes the windows, so a long scene build does not delay cancellation.
 */
import type {
  ExportError,
  FrameSource,
  FrameSourceFactory,
  FrameSourceInfo,
} from '@reelforge/pipeline';
import { err, ok, type Result } from '@reelforge/pipeline';
import { RenderPool, type PooledTarget } from './render-pool.js';
import type { RenderError } from './render-target.js';

function frameSourceError(
  context: string,
  error: RenderError,
  consoleErrors: string[],
): ExportError {
  const page =
    consoleErrors.length === 0 ? '' : ` (console: ${consoleErrors.slice(0, 5).join(' | ')})`;
  return { kind: 'frame-source', message: `${context}: ${error.message}${page}` };
}

export function electronFrameSourceFactory(
  pool: RenderPool,
  signal?: AbortSignal,
): FrameSourceFactory {
  return () => {
    let entry: PooledTarget | null = null;
    let info: FrameSourceInfo | null = null;
    const onAbort = (): void => {
      void entry?.target.close();
    };
    signal?.addEventListener('abort', onAbort, { once: true });

    const source: FrameSource = {
      async open(manifest): Promise<Result<FrameSourceInfo, ExportError>> {
        if (signal?.aborted === true)
          return err({ kind: 'cancelled', message: 'export cancelled' });
        if (entry === null) {
          const acquired = await pool.acquire();
          if (!acquired.ok)
            return err(frameSourceError('cannot open a render window', acquired.error, []));
          entry = acquired.value;
        }
        const loaded = await RenderPool.ensureLoaded(entry, manifest);
        if (!loaded.ok) {
          return err(
            frameSourceError(
              'the engine failed to load the video',
              loaded.error,
              entry.target.takeConsoleErrors(),
            ),
          );
        }
        info = {
          width: loaded.value.width,
          height: loaded.value.height,
          gpu: loaded.value.gpu.renderer,
        };
        return ok(info);
      },
      async renderFrame(t): Promise<Result<Uint8Array, ExportError>> {
        if (entry === null || info === null) {
          return err({ kind: 'frame-source', message: 'renderFrame() before open()' });
        }
        const frame = await entry.target.frame(t);
        if (frame.ok) return frame;
        return err(
          frameSourceError(
            `rendering t=${t.toFixed(3)} failed`,
            frame.error,
            entry.target.takeConsoleErrors(),
          ),
        );
      },
      async close(): Promise<void> {
        signal?.removeEventListener('abort', onAbort);
        const current = entry;
        entry = null;
        info = null;
        if (current !== null) await pool.release(current);
      },
    };
    return source;
  };
}
