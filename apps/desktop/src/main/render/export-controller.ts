/**
 * One export at a time for the app: starts `exportProject` for the open project, cancels it, and
 * forwards progress to the renderer. Per-frame events are throttled (at most one every
 * FRAME_PUSH_INTERVAL_MS, plus the last frame) so a long export does not flood IPC.
 */
import type { ExportProgress, ExportWarning } from '@reelforge/pipeline';
import type { AppSettings } from '@reelforge/shared';
import type { ExportOutcome, ExportStartRequest } from '../../shared/export-contract.js';
import type { Logger } from '../logger.js';
import type { ExportProjectOptions } from './export-project.js';

export const FRAME_PUSH_INTERVAL_MS = 100;

export interface ExportControllerOptions {
  readonly currentProject: () => string | undefined;
  readonly settings: () => AppSettings;
  readonly cores: number;
  /** Shared inputs of every export (render windows, engine version); resolved per export. */
  readonly prepare: () => Promise<
    Pick<ExportProjectOptions, 'openTarget' | 'engineVersion'> | { readonly error: string }
  >;
  readonly run: (options: ExportProjectOptions) => Promise<ExportOutcome>;
  readonly push: (event: ExportProgress) => void;
  readonly now: () => number;
  readonly log: Logger;
}

/** Drops `frame` events that come sooner than the interval, except each shot's last frame. */
export function throttleFrames(
  push: (event: ExportProgress) => void,
  now: () => number,
  intervalMs = FRAME_PUSH_INTERVAL_MS,
): (event: ExportProgress) => void {
  let last = Number.NEGATIVE_INFINITY;
  return (event) => {
    if (event.type === 'frame') {
      const lastOfShot = event.frameInShot === event.shotFrames;
      const time = now();
      if (!lastOfShot && time - last < intervalMs) return;
      last = time;
    }
    push(event);
  };
}

export class ExportController {
  private running: AbortController | null = null;
  private warn: ((warning: ExportWarning) => void) | null = null;

  constructor(private readonly options: ExportControllerOptions) {}

  get busy(): boolean {
    return this.running !== null;
  }

  /**
   * `listener` also gets every (throttled) progress event (the Video exported stage); `onWarning`
   * the export's warnings (encoder retry, the switch to the CPU encoder).
   */
  async start(
    request: ExportStartRequest,
    listener?: (event: ExportProgress) => void,
    output?: string,
    onWarning?: (warning: ExportWarning) => void,
  ): Promise<ExportOutcome> {
    if (this.running !== null) return { status: 'busy' };
    const projectDir = this.options.currentProject();
    if (projectDir === undefined) return { status: 'no-project' };
    const controller = new AbortController();
    this.running = controller;
    const warn = (warning: ExportWarning): void => {
      onWarning?.(warning);
    };
    this.warn = warn;
    try {
      const prepared = await this.options.prepare();
      if ('error' in prepared)
        return { status: 'failed', kind: 'renderer', message: prepared.error };
      return await this.options.run({
        projectDir,
        request,
        output,
        settings: this.options.settings(),
        cores: this.options.cores,
        ...prepared,
        signal: controller.signal,
        onProgress: throttleFrames((event) => {
          this.options.push(event);
          listener?.(event);
        }, this.options.now),
        onWarning: warn,
        log: this.options.log,
      });
    } finally {
      this.running = null;
      this.warn = null;
    }
  }

  /**
   * Test hook (RenderTestHooks.exportWarning): hands `warning` to the running export's listener
   * as if the pipeline had sent it; false when no export runs.
   */
  simulateWarning(warning: ExportWarning): boolean {
    if (this.warn === null) return false;
    this.options.log.warn(`simulated export warning (test hook): ${warning.message}`);
    this.warn(warning);
    return true;
  }

  cancel(): boolean {
    if (this.running === null) return false;
    this.options.log.info('export cancelled by the user');
    this.running.abort();
    return true;
  }
}
