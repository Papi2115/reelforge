/**
 * StageService (PLAN.md#6.8): runs pipeline stages for the open project on a `StageRunner` with
 * the app's real dependencies (built by `createRunner`), one stage at a time per project (others
 * wait in a FIFO queue; a multi-stage Run such as "Sound design mixed" is one group that stops at
 * the first failure), Stop (kills the stage's processes), the script acceptance gate, and the
 * state pushed to the sidebar: stage infos from pipeline.json + files, the running stage's live
 * steps and the account-wide usage-limit pause (the chat's LimitGuard). On the first open of a
 * project in this app session, stages left `running`/`paused` by a crash become `interrupted`.
 * Electron-free: the runner factory and the push come in through the options.
 */
import path from 'node:path';
import type { LimitGuard, PipelineStateStore } from '@reelforge/claude-bridge';
import {
  canRun,
  isStageId,
  readProjectSnapshot,
  STAGE_TITLES,
  type PipelineStage,
  type StageEvent,
  type StageRequest,
  type StageRunner,
} from '@reelforge/stages';
import type {
  StageCommandResult,
  StageErrorInfo,
  StageInfo,
  StagesState,
} from '../../shared/stages-contract.js';
import { describeError, type Logger } from '../logger.js';
import { hasExportedVideo } from './stage-artifacts.js';
import { StageRun } from './stage-run.js';
import {
  approvalReasons,
  buildStageInfos,
  errorInfo,
  recoverInterrupted,
  runRequestFor,
} from './stage-state.js';

export interface StageServiceOptions {
  /** A runner for a project folder (claude, audio tools, settings, guard, store, autocommit). */
  readonly createRunner: (projectDir: string) => StageRunner;
  /** Shared with the runners (per-file serialized writes of pipeline.json). */
  readonly store: PipelineStateStore;
  /** The app's account-wide guard (the chat shows the same pause). */
  readonly guard: LimitGuard;
  readonly push: (state: StagesState) => void;
  readonly log: Logger;
  /** Epoch ms. */
  readonly now?: () => number;
  readonly pushDelayMs?: number;
}

interface QueuedRun {
  readonly request: StageRequest;
  readonly group: number;
}

interface ProjectPipeline {
  readonly dir: string;
  readonly runner: StageRunner;
  readonly queue: QueuedRun[];
  active: { readonly run: StageRun; readonly group: number } | undefined;
  readonly errors: Map<PipelineStage, StageErrorInfo>;
  readonly warnings: Map<PipelineStage, readonly string[]>;
  idle: Promise<void>;
}

/** Events after which the project files / pipeline.json are read again. */
const REFRESH_EVENTS = new Set<StageEvent['type']>([
  'started',
  'paused',
  'resumed',
  'done',
  'failed',
]);

export function projectKey(dir: string): string {
  const resolved = path.resolve(dir);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function result(status: StageCommandResult['status'], message: string | null): StageCommandResult {
  return { status, message };
}

export class StageService {
  private current: string | undefined;
  private readonly pipelines = new Map<string, ProjectPipeline>();
  private readonly recovered = new Set<string>();
  private infos: { readonly key: string; readonly stages: StageInfo[] } | undefined;
  /** Reads of the project run one after another, so the last one always wins. */
  private computing: Promise<void> = Promise.resolve();
  private pushTimer: ReturnType<typeof setTimeout> | undefined;
  private recompute = false;
  private nextGroup = 0;
  private disposed = false;

  constructor(private readonly options: StageServiceOptions) {
    const changed = (): void => {
      this.schedule(false);
    };
    options.guard.on('paused', changed);
    options.guard.on('resumed', changed);
  }

  /** A stage runs or waits in some project (quitting must stop it first). */
  get busy(): boolean {
    return [...this.pipelines.values()].some((pipeline) => pipeline.active !== undefined);
  }

  /** Follows the open project (undefined after close): crash recovery, then a fresh state. */
  async follow(dir: string | undefined): Promise<void> {
    this.current = dir;
    this.infos = undefined;
    if (dir !== undefined) await this.recover(dir);
    this.refresh();
  }

  /** Re-reads the open project (files changed, a document was saved) and pushes the state. */
  refresh(): void {
    this.schedule(true);
  }

  async state(): Promise<StagesState> {
    await this.computeInfos();
    return this.currentState();
  }

  /** Is `stage` running (or queued) in `dir`? */
  isBusyWith(dir: string, stage: PipelineStage): boolean {
    const pipeline = this.pipelines.get(projectKey(dir));
    if (pipeline === undefined) return false;
    return (
      pipeline.active?.run.stage === stage ||
      pipeline.queue.some((queued) => queued.request.stage === stage)
    );
  }

  /** Queues Run/Redo of `stages` (in order, one group) in the open project. */
  async run(stages: readonly PipelineStage[]): Promise<StageCommandResult> {
    const requests: StageRequest[] = [];
    for (const stage of stages) {
      const request = runRequestFor(stage);
      if (request === undefined) {
        return result('error', `${STAGE_TITLES[stage]} cannot be started from here yet.`);
      }
      requests.push(request);
    }
    return this.enqueue(requests);
  }

  /** Queues requests (e.g. a voice-over import) as one group. */
  async enqueue(requests: readonly StageRequest[]): Promise<StageCommandResult> {
    const dir = this.current;
    const first = requests[0];
    if (dir === undefined) return result('error', 'No project is open.');
    if (first === undefined || this.disposed) return result('error', 'Nothing to run.');
    const pipeline = this.pipeline(dir);
    for (const request of requests) {
      if (this.isBusyWith(dir, request.stage)) {
        return result('error', `${STAGE_TITLES[request.stage]} is already running or queued.`);
      }
    }
    if (pipeline.active === undefined && pipeline.queue.length === 0) {
      const reasons = await this.gate(dir, first.stage);
      if (reasons.length > 0) return result('error', reasons.join(' '));
    }
    this.nextGroup += 1;
    for (const request of requests) pipeline.queue.push({ request, group: this.nextGroup });
    this.options.log.info(`queued ${requests.map((request) => request.stage).join(' + ')}`);
    this.schedule(false);
    this.pump(pipeline);
    return result('queued', null);
  }

  /** Stops the running stage (and the rest of its group) or drops a queued one. */
  stop(stage: PipelineStage): boolean {
    const dir = this.current;
    const pipeline = dir === undefined ? undefined : this.pipelines.get(projectKey(dir));
    if (pipeline === undefined) return false;
    const active = pipeline.active;
    if (active?.run.stage === stage) {
      this.dropGroup(pipeline, active.group);
      this.options.log.info(`stopping ${stage}`);
      pipeline.runner.cancel();
      this.schedule(false);
      return true;
    }
    const queued = pipeline.queue.find((item) => item.request.stage === stage);
    if (queued === undefined) return false;
    this.dropGroup(pipeline, queued.group);
    this.schedule(true);
    return true;
  }

  /** Resolves once no stage runs or waits (tests, quitting). */
  async whenIdle(): Promise<void> {
    for (;;) {
      const busy = [...this.pipelines.values()].filter((pipeline) => pipeline.active);
      if (busy.length === 0) return;
      await Promise.all(busy.map((pipeline) => pipeline.idle));
    }
  }

  /** App quit: drops the queues and cancels the running stages. */
  async dispose(): Promise<void> {
    this.disposed = true;
    for (const pipeline of this.pipelines.values()) {
      pipeline.queue.length = 0;
      pipeline.runner.cancel();
    }
    await this.whenIdle();
    if (this.pushTimer !== undefined) clearTimeout(this.pushTimer);
  }

  private now(): number {
    return this.options.now?.() ?? Date.now();
  }

  private pipeline(dir: string): ProjectPipeline {
    const key = projectKey(dir);
    const existing = this.pipelines.get(key);
    if (existing !== undefined) return existing;
    const runner = this.options.createRunner(dir);
    const pipeline: ProjectPipeline = {
      dir,
      runner,
      queue: [],
      active: undefined,
      errors: new Map(),
      warnings: new Map(),
      idle: Promise.resolve(),
    };
    runner.on('event', (event) => {
      this.onEvent(pipeline, event);
    });
    this.pipelines.set(key, pipeline);
    return pipeline;
  }

  /** Gating of the runner + the script approval, for a stage about to start. */
  private async gate(dir: string, stage: PipelineStage): Promise<string[]> {
    const snapshot = await readProjectSnapshot(dir, this.options.store);
    const readiness = isStageId(stage) ? canRun(stage, snapshot).reasons : [];
    return [...readiness, ...approvalReasons(stage, snapshot)];
  }

  private dropGroup(pipeline: ProjectPipeline, group: number): void {
    const kept = pipeline.queue.filter((item) => item.group !== group);
    pipeline.queue.splice(0, pipeline.queue.length, ...kept);
  }

  private pump(pipeline: ProjectPipeline): void {
    if (this.disposed || pipeline.active !== undefined) return;
    const next = pipeline.queue.shift();
    if (next === undefined) return;
    const run = new StageRun(next.request.stage, pipeline.dir, this.now());
    pipeline.active = { run, group: next.group };
    pipeline.errors.delete(next.request.stage);
    pipeline.idle = this.execute(pipeline, next, run)
      .catch((error: unknown) => {
        this.options.log.error(`${next.request.stage} crashed: ${describeError(error)}`);
      })
      .finally(() => {
        pipeline.active = undefined;
        this.refreshFor(pipeline);
        this.pump(pipeline);
      });
  }

  private async execute(pipeline: ProjectPipeline, next: QueuedRun, run: StageRun): Promise<void> {
    const stage = next.request.stage;
    const approval = approvalReasons(
      stage,
      await readProjectSnapshot(pipeline.dir, this.options.store),
    );
    if (approval.length > 0) {
      pipeline.errors.set(stage, { kind: 'not-ready', message: approval.join(' '), issues: [] });
      this.dropGroup(pipeline, next.group);
      return;
    }
    this.options.log.info(`running ${stage} in ${pipeline.dir}`);
    const outcome = await pipeline.runner.run(next.request);
    pipeline.warnings.set(stage, [...run.warnings]);
    if (outcome.ok) {
      this.options.log.info(`${stage}: ${outcome.value.message}`);
      return;
    }
    this.dropGroup(pipeline, next.group);
    this.options.log.warn(`${stage} ${outcome.error.kind}: ${outcome.error.message}`);
    if (outcome.error.kind !== 'cancelled') pipeline.errors.set(stage, errorInfo(outcome.error));
  }

  private onEvent(pipeline: ProjectPipeline, event: StageEvent): void {
    const active = pipeline.active;
    const changed = active?.run.stage === event.stage && active.run.apply(event);
    if (REFRESH_EVENTS.has(event.type)) this.refreshFor(pipeline);
    else if (changed && this.isCurrent(pipeline)) this.schedule(false);
  }

  private isCurrent(pipeline: ProjectPipeline): boolean {
    return this.current !== undefined && projectKey(this.current) === projectKey(pipeline.dir);
  }

  private refreshFor(pipeline: ProjectPipeline): void {
    if (this.isCurrent(pipeline)) this.schedule(true);
  }

  /** First open of `dir` in this session: stages a crash left running become interrupted. */
  private async recover(dir: string): Promise<void> {
    const key = projectKey(dir);
    if (this.recovered.has(key) || this.pipelines.get(key)?.active !== undefined) return;
    this.recovered.add(key);
    const read = await this.options.store.read(dir);
    if (!read.ok) {
      this.options.log.warn(`pipeline.json of ${dir}: ${read.error.message}`);
      return;
    }
    const stamp = new Date(this.now()).toISOString();
    if (recoverInterrupted(read.value, stamp).recovered.length === 0) return;
    let recovered: string[] = [];
    const updated = await this.options.store.update(dir, (state) => {
      const next = recoverInterrupted(state, stamp);
      recovered = next.recovered;
      return next.state;
    });
    if (!updated.ok) this.options.log.warn(`pipeline.json not recovered: ${updated.error.message}`);
    else this.options.log.info(`interrupted stage(s) after a restart: ${recovered.join(', ')}`);
  }

  private computeInfos(): Promise<void> {
    const next = this.computing.then(() => this.readInfos());
    this.computing = next.catch(() => undefined);
    return next;
  }

  private async readInfos(): Promise<void> {
    const dir = this.current;
    if (dir === undefined) {
      this.infos = undefined;
      return;
    }
    const key = projectKey(dir);
    const [snapshot, hasVideo] = await Promise.all([
      readProjectSnapshot(dir, this.options.store),
      hasExportedVideo(dir),
    ]);
    if (this.current === undefined || projectKey(this.current) !== key) return;
    const pipeline = this.pipelines.get(key);
    this.infos = {
      key,
      stages: buildStageInfos({
        snapshot,
        hasVideo,
        errors: pipeline?.errors ?? new Map(),
        warnings: pipeline?.warnings ?? new Map(),
      }),
    };
  }

  private currentState(): StagesState {
    const dir = this.current;
    const key = dir === undefined ? undefined : projectKey(dir);
    const pipeline = key === undefined ? undefined : this.pipelines.get(key);
    const pause = this.options.guard.pause;
    return {
      projectDir: dir ?? null,
      stages: this.infos !== undefined && this.infos.key === key ? this.infos.stages : [],
      running: pipeline?.active?.run.snapshot() ?? null,
      queue: pipeline?.queue.map((item) => item.request.stage) ?? [],
      pause:
        pause === undefined
          ? null
          : { reason: pause.reason, until: pause.until ?? null, message: pause.message ?? null },
    };
  }

  /** Coalesced pushes; `recompute` re-reads the project files first. */
  private schedule(recompute: boolean): void {
    if (this.disposed) return;
    this.recompute ||= recompute;
    if (this.pushTimer !== undefined) return;
    this.pushTimer = setTimeout(() => {
      this.pushTimer = undefined;
      void this.flush();
    }, this.options.pushDelayMs ?? 50);
  }

  private async flush(): Promise<void> {
    const recompute = this.recompute || this.infos === undefined;
    this.recompute = false;
    if (recompute) {
      try {
        await this.computeInfos();
      } catch (error) {
        this.options.log.warn(`pipeline state not read: ${describeError(error)}`);
      }
    }
    if (!this.disposed) this.options.push(this.currentState());
  }
}
