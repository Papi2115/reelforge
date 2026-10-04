/**
 * Per-request timeouts of the dev/CI harness (harness-session.ts): a scene stuck in update() or a
 * wedged Chromium must not hang `reelforge frames`, a stage QA render or a test forever. A request
 * that does not answer in time rejects with HarnessTimeoutError and the session kills the browser
 * (a fresh one is launched for the next page), so the caller can retry once on a clean renderer.
 * Node-side tooling only: scenes never see these timers.
 */
import type { HarnessPage } from './harness-session.js';

/** frame/pick/direction calls of a warm page. */
export const DEFAULT_REQUEST_TIMEOUT_MS = 60_000;
/** load, reloadShot, checkCards and the first frame of a page (scene compile, shader warm-up). */
export const DEFAULT_COLD_REQUEST_TIMEOUT_MS = 180_000;
/** How long a page/browser close may take before it is left to Playwright's exit-time kill. */
export const CLOSE_TIMEOUT_MS = 10_000;

export interface HarnessTimeouts {
  readonly requestTimeoutMs?: number;
  readonly coldRequestTimeoutMs?: number;
}

export interface ResolvedHarnessTimeouts {
  readonly requestTimeoutMs: number;
  readonly coldRequestTimeoutMs: number;
}

export function resolveHarnessTimeouts(timeouts: HarnessTimeouts = {}): ResolvedHarnessTimeouts {
  return {
    requestTimeoutMs: timeouts.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
    coldRequestTimeoutMs: timeouts.coldRequestTimeoutMs ?? DEFAULT_COLD_REQUEST_TIMEOUT_MS,
  };
}

/**
 * `timeout`: this request did not answer in time. `browser-restarted`: the browser was killed
 * because another page's request timed out, so this request was cut off (not the scene's fault).
 */
export type HarnessTimeoutReason = 'timeout' | 'browser-restarted';

export class HarnessTimeoutError extends Error {
  override readonly name = 'HarnessTimeoutError';

  constructor(
    readonly operation: string,
    readonly timeoutMs: number,
    readonly reason: HarnessTimeoutReason = 'timeout',
  ) {
    super(
      reason === 'timeout'
        ? `the frame renderer did not answer (${operation}) within ${String(timeoutMs)} ms`
        : `the frame renderer was restarted during ${operation} (another render timed out)`,
    );
  }
}

export function isHarnessTimeout(error: unknown): error is HarnessTimeoutError {
  return error instanceof HarnessTimeoutError;
}

/**
 * Settles like `work`, or rejects with HarnessTimeoutError after `timeoutMs` (then `onTimeout`
 * runs; a later rejection of `work`, e.g. "target closed" after the kill, is ignored).
 */
export function withTimeout<T>(
  work: Promise<T>,
  timeoutMs: number,
  operation: string,
  onTimeout: (error: HarnessTimeoutError) => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      const error = new HarnessTimeoutError(operation, timeoutMs);
      onTimeout(error);
      reject(error);
    }, timeoutMs);
    work.then(
      (value) => {
        clearTimeout(timer);
        if (!settled) resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        if (!settled) reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

/** Runs a close; true when it finished (without error) within `timeoutMs`. Never rejects. */
export function closeWithin(close: () => Promise<void>, timeoutMs: number): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  const late = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => {
      resolve(false);
    }, timeoutMs);
  });
  const closed = Promise.resolve()
    .then(close)
    .then(
      () => true,
      () => false,
    );
  return Promise.race([closed, late]).finally(() => {
    clearTimeout(timer);
  });
}

export interface PageGuard {
  readonly timeouts: ResolvedHarnessTimeouts;
  /** Called once when a request of this page timed out (the session kills the browser). */
  onTimeout(): void;
  /** True once the browser this page lives in was killed (after any page's timeout). */
  isStale(): boolean;
}

/**
 * The page with a timeout on every request. After a timeout the page is dead: every further call
 * rejects with the same error. Errors of a page whose browser was killed become timeouts too.
 */
export function guardHarnessPage(page: HarnessPage, guard: PageGuard): HarnessPage {
  let dead: HarnessTimeoutError | undefined;
  let warmed = false;
  const run = async <T>(operation: string, cold: boolean, work: () => Promise<T>): Promise<T> => {
    if (dead !== undefined) throw dead;
    const { requestTimeoutMs, coldRequestTimeoutMs } = guard.timeouts;
    const timeoutMs = cold ? coldRequestTimeoutMs : requestTimeoutMs;
    try {
      return await withTimeout(work(), timeoutMs, operation, (error) => {
        dead = error;
        guard.onTimeout();
      });
    } catch (error) {
      if (!isHarnessTimeout(error) && guard.isStale()) {
        throw new HarnessTimeoutError(operation, timeoutMs, 'browser-restarted');
      }
      throw error;
    }
  };
  const frame = async <T>(operation: string, work: () => Promise<T>): Promise<T> => {
    const result = await run(operation, !warmed, work);
    warmed = true;
    return result;
  };
  return {
    load: (manifest) => run('load', true, () => page.load(manifest)),
    frameAt: (t) => frame(`frame t=${t.toFixed(3)}`, () => page.frameAt(t)),
    hashAt: (t) => frame(`frame t=${t.toFixed(3)}`, () => page.hashAt(t)),
    checkCards: (shotId) => run('checkCards', true, () => page.checkCards(shotId)),
    reloadShot: (shotId, scene) => run('reloadShot', true, () => page.reloadShot(shotId, scene)),
    pick: (x, y, t) => run('pick', false, () => page.pick(x, y, t)),
    setShotDirection: (shotId, direction) =>
      run('setShotDirection', false, () => page.setShotDirection(shotId, direction)),
    get errors() {
      return page.errors;
    },
    close: async () => {
      await closeWithin(() => page.close(), CLOSE_TIMEOUT_MS);
    },
  };
}

export type RetriedRender<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: HarnessTimeoutError };

/**
 * Runs `attempt` (which must open a fresh page) and once more when it timed out; other errors
 * propagate. `ok: false` = it timed out twice.
 */
export async function retryOnHarnessTimeout<T>(
  attempt: () => Promise<T>,
): Promise<RetriedRender<T>> {
  try {
    return { ok: true, value: await attempt() };
  } catch (first) {
    if (!isHarnessTimeout(first)) throw first;
  }
  try {
    return { ok: true, value: await attempt() };
  } catch (second) {
    if (!isHarnessTimeout(second)) throw second;
    return { ok: false, error: second };
  }
}
