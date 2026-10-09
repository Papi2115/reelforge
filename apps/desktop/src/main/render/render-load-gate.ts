/**
 * Render windows run their sandboxed engine frames in one shared renderer process (Chromium puts
 * same-site subframes of every window into one process), so while one window loads a video (all
 * scenes linted and built: ~10 s for a 22-shot Comic project) every other window's frame waits.
 * Six export workers loading at once starved the first frames past their 30 s deadline (main.log,
 * 2026-10-08). The gate runs loads one at a time (a load's deadline starts when it really runs) and
 * lets frame deadlines know a load ran meanwhile, so the wait is not mistaken for a hung scene.
 */
export class RenderLoadGate {
  private tail: Promise<unknown> = Promise.resolve();
  private active = 0;
  private lastLoadEnd = Number.NEGATIVE_INFINITY;

  constructor(private readonly clock: () => number = () => performance.now()) {}

  now(): number {
    return this.clock();
  }

  /** Runs `load` after every earlier load has settled. */
  run<T>(load: () => Promise<T>): Promise<T> {
    const turn = this.tail.then(async () => {
      this.active += 1;
      try {
        return await load();
      } finally {
        this.active -= 1;
        this.lastLoadEnd = this.clock();
      }
    });
    this.tail = turn.catch(() => undefined);
    return turn;
  }

  /** True when a load runs now or ended after `since` (this gate's clock). */
  loadedSince(since: number): boolean {
    return this.active > 0 || this.lastLoadEnd > since;
  }
}

export interface CallDeadlineOptions {
  readonly timeoutMs: number;
  /** Without a gate the deadline is a plain timeout. */
  readonly gate?: RenderLoadGate | undefined;
  /** Upper bound of the whole wait, extensions included. */
  readonly maxWaitMs: number;
  readonly onExpire: () => void;
}

/**
 * Starts a call deadline: after `timeoutMs` the call expires, unless a load ran in the shared
 * renderer meanwhile; then the deadline starts again (at most `maxWaitMs` in total). A frame stuck
 * on its own still expires `timeoutMs` after the last load. Returns the cancel function.
 */
export function startCallDeadline(options: CallDeadlineOptions): () => void {
  const { gate, timeoutMs } = options;
  const started = gate?.now() ?? 0;
  let since = started;
  let timer: NodeJS.Timeout | undefined;
  const check = (): void => {
    const now = gate?.now() ?? 0;
    if (gate !== undefined && gate.loadedSince(since) && now - started < options.maxWaitMs) {
      since = now;
      timer = setTimeout(check, Math.min(timeoutMs, options.maxWaitMs - (now - started)));
      return;
    }
    options.onExpire();
  };
  timer = setTimeout(check, timeoutMs);
  return () => {
    clearTimeout(timer);
  };
}
