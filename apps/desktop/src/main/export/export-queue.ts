/**
 * The export queue of the dialog (PLAN.md#9.1): jobs run one at a time on the app's export
 * (ExportController), with per-shot progress and ETA, cancel (queued: dropped; running: the export
 * is aborted, finished shots stay cached), resume (the same job queued again: cached segments are
 * reused, the pipeline continues an interrupted job), a final report and actionable failures.
 * After a successful export `finish` writes the extras (chapters, metadata). Electron-free; the
 * state is pushed to the renderer after every change (frame updates are throttled upstream).
 */
import type { ExportProgress, ExportWarning } from '@reelforge/pipeline';
import type {
  ExportEnqueueResult,
  ExportJob,
  ExportJobRequest,
  ExportOutcome,
  ExportQueueState,
  ExportStartRequest,
} from '../../shared/export-contract.js';
import type { Logger } from '../logger.js';
import {
  applyProgress,
  applyWarning,
  EMPTY_PROGRESS,
  exportReport,
  failureHint,
} from './export-progress.js';

const QUALITY_TO_PIPELINE: Readonly<
  Record<ExportJobRequest['quality'], 'draft' | 'final' | 'high'>
> = {
  draft: 'draft',
  standard: 'final',
  high: 'high',
};

/** The export request of a dialog job (`thumbnailAt` null + thumbnail on = the default frame). */
export function startRequestOf(request: ExportJobRequest): ExportStartRequest {
  return {
    preset: request.preset,
    encoder: request.encoder,
    quality: QUALITY_TO_PIPELINE[request.quality],
    workers: Math.min(request.workers, 32),
    ...(request.includeThumbnail
      ? request.thumbnailAt === null
        ? {}
        : { thumbnailAt: request.thumbnailAt }
      : { thumbnailAt: null }),
  };
}

export interface ExportExtras {
  readonly files: readonly string[];
  readonly warnings: readonly string[];
}

/** The app's export (ExportController.start): progress events, the output, warnings. */
export type ExportStart = (
  request: ExportStartRequest,
  listener: (event: ExportProgress) => void,
  output: string,
  onWarning: (warning: ExportWarning) => void,
) => Promise<ExportOutcome>;

export interface ExportQueueOptions {
  readonly currentProject: () => string | undefined;
  /** Starts the app's export (ExportController.start). */
  readonly start: ExportStart;
  readonly cancel: () => void;
  /** Extras after a successful export (chapters.txt, metadata). */
  readonly finish: (dir: string, job: ExportJob, outcome: ExportOutcome) => Promise<ExportExtras>;
  readonly sizeOf: (file: string) => Promise<number>;
  readonly interrupted: (dir: string) => Promise<ExportQueueState['interrupted']>;
  readonly push: (state: ExportQueueState) => void;
  readonly now: () => number;
  readonly log: Logger;
}

interface QueuedJob {
  readonly dir: string;
  job: ExportJob;
  /** A caller waiting for the end (the sidebar's Video exported stage). */
  readonly waiter?: {
    readonly listener: (event: ExportProgress) => void;
    readonly resolve: (outcome: ExportOutcome) => void;
  };
}

const FINISHED = new Set<ExportJob['status']>(['done', 'failed', 'cancelled', 'interrupted']);

export class ExportQueue {
  private readonly jobs: QueuedJob[] = [];
  private running: QueuedJob | undefined;
  private nextId = 0;
  private interrupted:
    { readonly dir: string; readonly info: ExportQueueState['interrupted'] } | undefined;

  constructor(private readonly options: ExportQueueOptions) {}

  get busy(): boolean {
    return this.running !== undefined;
  }

  /** The current project's jobs, newest first. */
  async state(): Promise<ExportQueueState> {
    const dir = this.options.currentProject();
    if (dir === undefined) return { projectDir: null, jobs: [], interrupted: null };
    if (this.interrupted?.dir !== dir) {
      this.interrupted = { dir, info: this.busy ? null : await this.options.interrupted(dir) };
    }
    return this.snapshot(dir);
  }

  /**
   * Queues a job and resolves with its outcome (the sidebar's Video exported stage), so the stage
   * and the dialog never run two exports at once.
   */
  run(
    request: ExportJobRequest,
    output: string,
    listener: (event: ExportProgress) => void,
  ): { readonly id: string | null; readonly outcome: Promise<ExportOutcome> } {
    let resolve: (outcome: ExportOutcome) => void = () => undefined;
    const outcome = new Promise<ExportOutcome>((done) => {
      resolve = done;
    });
    const queued = this.enqueue(request, output, { listener, resolve });
    if (queued.status !== 'queued')
      return { id: null, outcome: Promise.resolve({ status: 'no-project' }) };
    return { id: queued.id, outcome };
  }

  enqueue(
    request: ExportJobRequest,
    output: string,
    waiter?: QueuedJob['waiter'],
  ): ExportEnqueueResult {
    const dir = this.options.currentProject();
    if (dir === undefined) return { status: 'invalid', message: 'No project is open.' };
    this.nextId += 1;
    const job: ExportJob = {
      id: `export-${String(this.nextId)}`,
      request,
      output,
      status: 'queued',
      createdAt: this.options.now(),
      startedAt: null,
      finishedAt: null,
      progress: EMPTY_PROGRESS,
      report: null,
      error: null,
    };
    this.jobs.push(waiter === undefined ? { dir, job } : { dir, job, waiter });
    this.options.log.info(`queued ${job.id}: ${request.preset} ${request.encoder} → ${output}`);
    this.changed();
    void this.pump();
    return { status: 'queued', id: job.id };
  }

  /** Drops a queued job or aborts the running one (its finished shots stay cached). */
  cancel(id: string): boolean {
    const entry = this.jobs.find((candidate) => candidate.job.id === id);
    if (entry === undefined) return false;
    if (entry === this.running) {
      this.options.cancel();
      return true;
    }
    if (entry.job.status !== 'queued') return false;
    entry.job = { ...entry.job, status: 'cancelled', finishedAt: this.options.now() };
    entry.waiter?.resolve({ status: 'cancelled' });
    this.changed();
    return true;
  }

  /** Queues a cancelled / failed / interrupted job again. */
  resume(id: string): ExportEnqueueResult {
    const entry = this.jobs.find((candidate) => candidate.job.id === id);
    if (entry === undefined) return { status: 'invalid', message: 'No such export.' };
    if (!FINISHED.has(entry.job.status) || entry.job.status === 'done') {
      return { status: 'invalid', message: 'Only a stopped or failed export can be resumed.' };
    }
    const job: ExportJob = {
      ...entry.job,
      status: 'queued',
      startedAt: null,
      finishedAt: null,
      progress: EMPTY_PROGRESS,
      error: null,
    };
    // Back to the end of the queue; whoever waited for the first attempt got its outcome.
    this.jobs.splice(this.jobs.indexOf(entry), 1);
    this.jobs.push({ dir: entry.dir, job });
    this.changed();
    void this.pump();
    return { status: 'queued', id };
  }

  /** The job the open project's export folder button refers to. */
  job(id: string): ExportJob | undefined {
    return this.jobs.find((candidate) => candidate.job.id === id)?.job;
  }

  /** App quit: queued jobs are dropped, the running one is aborted. */
  dispose(): void {
    for (const entry of this.jobs) {
      if (entry.job.status !== 'queued') continue;
      entry.job = { ...entry.job, status: 'cancelled' };
      entry.waiter?.resolve({ status: 'cancelled' });
    }
    if (this.running !== undefined) this.options.cancel();
  }

  private snapshot(dir: string): ExportQueueState {
    const jobs = this.jobs
      .filter((entry) => entry.dir === dir)
      .map((entry) => entry.job)
      .reverse();
    const interrupted = this.interrupted?.dir === dir && !this.busy ? this.interrupted.info : null;
    return { projectDir: dir, jobs, interrupted };
  }

  private changed(): void {
    const dir = this.options.currentProject();
    this.options.push(
      dir === undefined ? { projectDir: null, jobs: [], interrupted: null } : this.snapshot(dir),
    );
  }

  private update(entry: QueuedJob, patch: Partial<ExportJob>): void {
    entry.job = { ...entry.job, ...patch };
    this.changed();
  }

  private async pump(): Promise<void> {
    if (this.running !== undefined) return;
    const entry = this.jobs.find((candidate) => candidate.job.status === 'queued');
    if (entry === undefined) return;
    this.running = entry;
    // The interrupted export of this project is the one this job continues (or replaces).
    if (this.interrupted?.dir === entry.dir) this.interrupted = { dir: entry.dir, info: null };
    this.update(entry, { status: 'running', startedAt: this.options.now() });
    try {
      await this.execute(entry);
    } finally {
      this.running = undefined;
      this.changed();
      void this.pump();
    }
  }

  private async execute(entry: QueuedJob): Promise<void> {
    const outcome = await this.outcomeOf(entry);
    entry.waiter?.resolve(outcome);
  }

  private async outcomeOf(entry: QueuedJob): Promise<ExportOutcome> {
    if (this.options.currentProject() !== entry.dir) {
      const message = 'The project of this export is not open any more.';
      this.fail(entry, 'no-project', message);
      return { status: 'failed', kind: 'no-project', message };
    }
    const outcome = await this.options
      .start(
        startRequestOf(entry.job.request),
        (event) => {
          this.update(entry, { progress: applyProgress(entry.job.progress, event) });
          entry.waiter?.listener(event);
        },
        entry.job.output,
        (warning) => {
          this.update(entry, { progress: applyWarning(entry.job.progress, warning) });
        },
      )
      .catch((error: unknown): ExportOutcome => ({
        status: 'failed',
        kind: 'internal',
        message: error instanceof Error ? error.message : String(error),
      }));
    switch (outcome.status) {
      case 'done': {
        const extras = await this.options.finish(entry.dir, entry.job, outcome);
        const size = await this.options.sizeOf(outcome.output).catch(() => 0);
        this.update(entry, {
          status: 'done',
          finishedAt: this.options.now(),
          progress: { ...entry.job.progress, percent: 100, label: 'Done', etaS: null },
          report: exportReport(outcome, entry.job.progress, size, extras),
        });
        this.options.log.info(`${entry.job.id} done: ${outcome.output}`);
        return outcome;
      }
      case 'cancelled':
        this.update(entry, {
          status: 'cancelled',
          finishedAt: this.options.now(),
          progress: { ...entry.job.progress, label: 'Cancelled', etaS: null },
        });
        return outcome;
      case 'busy':
        this.fail(entry, 'busy', 'Another export is running.');
        return outcome;
      case 'no-project':
        this.fail(entry, 'no-project', 'No project is open.');
        return outcome;
      case 'failed':
        this.fail(entry, outcome.kind, outcome.message);
        return outcome;
    }
  }

  private fail(entry: QueuedJob, kind: string, message: string): void {
    this.options.log.warn(`${entry.job.id} failed (${kind}): ${message}`);
    this.update(entry, {
      status: 'failed',
      finishedAt: this.options.now(),
      progress: { ...entry.job.progress, label: 'Failed', etaS: null },
      error: { kind, message, hint: failureHint(kind) },
    });
  }
}
