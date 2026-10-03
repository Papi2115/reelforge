/**
 * Watches the open project folder and reports changed files in batches (PLAN.md#6.3), so the
 * layout refreshes after a pipeline step, a Claude turn or an edit in another editor. Uses
 * `fs.watch` (recursive: native on Windows and macOS, Node >= 20 on Linux) instead of a watcher
 * dependency. Electron-free: the watch function and timers are injectable for tests.
 */
import { watch } from 'node:fs';
import { MAX_CHANGED_PATHS, type ProjectChangedEvent } from '../shared/snapshot-contract.js';
import { describeError, type Logger } from './logger.js';

export interface WatchHandle {
  close(): void;
}

/** Calls `onChange` with a path relative to `dir` (any separator), or null when unknown. */
export type WatchFunction = (
  dir: string,
  onChange: (relative: string | null) => void,
  onError: (error: unknown) => void,
) => WatchHandle;

export interface Timers {
  set(callback: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

export const DEFAULT_BATCH_MS = 150;

const systemTimers: Timers = {
  set: (callback, ms) => setTimeout(callback, ms),
  clear: (handle) => {
    clearTimeout(handle as ReturnType<typeof setTimeout>);
  },
};

export const nodeWatch: WatchFunction = (dir, onChange, onError) => {
  const watcher = watch(dir, { recursive: true, persistent: false }, (_type, filename) => {
    onChange(filename);
  });
  watcher.on('error', onError);
  return watcher;
};

/** Forward slashes, no leading `./`. */
export function normalizeChangedPath(relative: string): string {
  return relative.replace(/\\/g, '/').replace(/^(\.\/)+/, '');
}

/**
 * Git internals, in-flight atomic writes, QA frame dumps, caches and variant work files never
 * matter to the layout.
 */
export function isIgnoredChange(relative: string): boolean {
  const lower = relative.toLowerCase();
  return (
    lower === '.git' ||
    lower.startsWith('.git/') ||
    lower.startsWith('.reelforge/frames/') ||
    lower.startsWith('.reelforge/cache/') ||
    // Work files of shot variants in progress (PLAN.md#11.3); the stored ones are reported.
    lower.startsWith('.variants/') ||
    lower.endsWith('.tmp')
  );
}

export interface ProjectWatcherOptions {
  readonly dir: string;
  readonly onChange: (event: ProjectChangedEvent) => void;
  readonly log: Logger;
  readonly batchMs?: number;
  readonly watchFunction?: WatchFunction;
  readonly timers?: Timers;
}

/**
 * Starts watching. The first change of a batch schedules one `onChange` after `batchMs`; changes
 * until then join the batch (a steady stream of writes cannot starve the event).
 */
export function watchProject(options: ProjectWatcherOptions): WatchHandle {
  const { dir, log } = options;
  const timers = options.timers ?? systemTimers;
  const batchMs = options.batchMs ?? DEFAULT_BATCH_MS;
  const paths = new Set<string>();
  let truncated = false;
  let pending: unknown;
  let closed = false;

  const flush = (): void => {
    pending = undefined;
    if (closed) return;
    const event: ProjectChangedEvent = { dir, paths: [...paths].sort(), truncated };
    paths.clear();
    truncated = false;
    options.onChange(event);
  };

  const record = (relative: string | null): void => {
    if (closed) return;
    if (relative === null) {
      truncated = true;
    } else {
      const normalized = normalizeChangedPath(relative);
      if (isIgnoredChange(normalized)) return;
      if (paths.size < MAX_CHANGED_PATHS) paths.add(normalized);
      else if (!paths.has(normalized)) truncated = true;
    }
    pending ??= timers.set(flush, batchMs);
  };

  let handle: WatchHandle | undefined;
  const close = (): void => {
    if (closed) return;
    closed = true;
    if (pending !== undefined) timers.clear(pending);
    pending = undefined;
    handle?.close();
  };

  try {
    handle = (options.watchFunction ?? nodeWatch)(dir, record, (error) => {
      // E.g. the folder was deleted or renamed (EPERM on Windows): stop instead of crashing.
      log.warn(`watching ${dir} stopped: ${describeError(error)}`);
      close();
    });
  } catch (error) {
    log.warn(`cannot watch ${dir}: ${describeError(error)}`);
    closed = true;
  }
  return { close };
}

/** Keeps exactly one watcher on the currently open project folder. */
export class ProjectWatchFollower {
  private dir: string | undefined;
  private handle: WatchHandle | undefined;

  constructor(private readonly start: (dir: string) => WatchHandle) {}

  follow(dir: string | undefined): void {
    if (dir === this.dir) return;
    this.handle?.close();
    this.handle = undefined;
    this.dir = dir;
    if (dir !== undefined) this.handle = this.start(dir);
  }

  close(): void {
    this.follow(undefined);
  }
}
