/**
 * Bounded closing of a hidden render window. A graceful `close()` waits for the page's unload
 * handlers, so a renderer stuck in a frame never lets the window close and whoever waits for
 * `closed` (the render pool) hangs. Here: a hung renderer is killed first
 * (`webContents.forcefullyCrashRenderer()`), then `close()`; when `closed` does not come within
 * a short grace, the renderer is killed and the window `destroy()`ed (which guarantees `closed`),
 * and after a last bound the window is given up on. The graceful path stays first because a
 * window destroyed outright made the next window fail in the render spike (ADR-002).
 */
import { describeError, type Logger } from '../logger.js';

/** The parts of a BrowserWindow the closing needs (fake windows in tests). */
export interface ClosableWindow {
  isDestroyed(): boolean;
  close(): void;
  destroy(): void;
  once(event: 'closed', listener: () => void): unknown;
  readonly webContents: {
    isDestroyed(): boolean;
    forcefullyCrashRenderer(): void;
  };
}

export interface CloseOptions {
  /** The renderer missed a deadline: kill it before closing. */
  readonly hung: boolean;
  readonly log: Pick<Logger, 'warn'>;
  /** Wait for `closed` after `close()` (ms); default 2 s. */
  readonly graceMs?: number;
  /** Wait for `closed` after `destroy()` (ms); default 1 s. */
  readonly forceMs?: number;
}

/** How the window went: closed gracefully, destroyed, or given up on (never reported closed). */
export type CloseOutcome = 'closed' | 'destroyed' | 'abandoned';

const DEFAULT_GRACE_MS = 2_000;
const DEFAULT_FORCE_MS = 1_000;

/** Resolves true when `event` comes first, false after `ms`. */
function within(event: Promise<void>, ms: number): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => {
      resolve(false);
    }, ms);
  });
  return Promise.race([event.then(() => true), timeout]).finally(() => {
    clearTimeout(timer);
  });
}

function crashRenderer(window: ClosableWindow, log: CloseOptions['log']): void {
  try {
    if (!window.webContents.isDestroyed()) window.webContents.forcefullyCrashRenderer();
  } catch (error) {
    log.warn(`render window: cannot kill the renderer: ${describeError(error)}`);
  }
}

export async function closeRenderWindow(
  window: ClosableWindow,
  options: CloseOptions,
): Promise<CloseOutcome> {
  if (window.isDestroyed()) return 'closed';
  const { log } = options;
  const closed = new Promise<void>((resolve) => {
    window.once('closed', () => {
      resolve();
    });
  });
  if (options.hung) crashRenderer(window, log);
  window.close();
  const graceMs = options.graceMs ?? DEFAULT_GRACE_MS;
  if (await within(closed, graceMs)) return 'closed';
  log.warn(`render window did not close within ${String(graceMs)} ms: destroying it`);
  if (!options.hung) crashRenderer(window, log);
  if (!window.isDestroyed()) window.destroy();
  const forceMs = options.forceMs ?? DEFAULT_FORCE_MS;
  if (await within(closed, forceMs)) return 'destroyed';
  log.warn(`render window: no 'closed' ${String(forceMs)} ms after destroy(); giving up on it`);
  return 'abandoned';
}
