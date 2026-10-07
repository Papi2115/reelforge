/**
 * StageService (PLAN.md#6.8): runs pipeline stages for the open project on a `StageRunner` with
 * the app's real dependencies (built by `createRunner`) — and "Video exported" on the app's render
 * backend (export-stage.ts) — one stage at a time per project (others wait in a FIFO queue; a
 * multi-stage Run such as "Sound design mixed" is one group that stops at the first failure),
 * Stop (kills the stage's processes), the script acceptance gate, and the state pushed to the
 * sidebar: stage infos from pipeline.json + files, the running stage's live steps and the
 * account-wide usage-limit pause (the chat's LimitGuard). On the first open of a project in this
 * app session, stages left `running`/`paused` by a crash become `interrupted`. A caller can watch
 * one queued run (the chat's review chips). Electron-free: the runner factory, the export and the
 * push come in through the options.
 */
import path from 'node:path';
import type { LimitGuard, PipelineStateStore } from '@reelforge/claude-bridge';
import {
  readProjectSnapshot,
  STAGE_TITLES,
  type PipelineStage,
  type StageEvent,
  type StageRunner,
} from '@reelforge/stages';
import type {
  StageCommandResult,
  StageErrorInfo,
  StageInfo,
  StagesState,
} from '../../shared/stages-contract.js';
import { describeError, type Logger } from '../logger.js';
import { CoalescedPush } from './coalesced-push.js';
import { hasExportedVideo } from './stage-artifacts.js';
import {
  executeQueued,
  runScope,
  type ExportRun,
  type RunObserver,
  type RunOutcome,
} from './stage-execution.js';
import { StageRun } from './stage-run.js';
import {
  assetsFollowUp,
  buildStageInfos,
  followUpReview,
  gateReasons,
  recoverPipeline,
  runRequestFor,
  type AppStageRequest,
} from './stage-state.js';

export type { RunObserver, RunOutcome } from './stage-execution.js';

export interface StageServiceOptions {
  /** A runner for a project folder (claude, audio tools, settings, guard, store, autocommit). */
  readonly createRunner: (projectDir: string) => StageRunner;
  /** "Video exported": the app's export with a progress listener, and its cancel. */
  readonly exportRun?: ExportRun;
  /** Shared with the runners (per-file serialized writes of pipeline.json). */
  readonly store: PipelineStateStore;
  /** The app's account-wide guard (the chat shows the same pause). */
  readonly guard: LimitGuard;
  readonly push: (state: StagesState) => void;
  readonly log: Logger;
  /** Settings → "Run final review after building scenes" (default off here, on in the app). */
  readonly finalReview?: () => boolean;
  /** Epoch ms. */
  readonly now?: () => number;
  readonly pushDelayMs?: number;
}

interface QueuedRun {
  readonly request: AppStageRequest;
  readonly group: number;
  readonly observer?: RunObserver | undefined;
}

interface ProjectPipeline {
  readonly dir: string;
  readonly runner: StageRunner;
  readonly queue: QueuedRun[];
  active: { readonly run: StageRun; readonly item: QueuedRun } | undefined;
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
  private readonly pushes: CoalescedPush;
  private nextGroup = 0;
  private disposed = false;

  constructor(private readonly options: StageServiceOptions) {
    this.pushes = new CoalescedPush(options.pushDelayMs ?? 50, (recompute) =>
      this.flush(recompute),
    );
    const changed = (): void => {
      this.pushes.schedule(false);
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
    this.pushes.schedule(true);
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

  /** Shots whose scene file a running scene build in `dir` is writing (kept out of chat commits). */
  shotsInProgress(dir: string): string[] {
    return this.pipelines.get(projectKey(dir))?.active?.run.shotsInProgress() ?? [];
  }

  /** Queues Run/Redo of `stages` (in order, one group) in the open project. */
  async run(stages: readonly PipelineStage[]): Promise<StageCommandResult> {
    const requests: AppStageRequest[] = [];
    for (const stage of stages) {
      const request = runRequestFor(stage);
      if (request === undefined) {
        return result('error', `${STAGE_TITLES[stage]} cannot be started from here.`);
      }
      requests.push(request);
    }
    return this.enqueue(requests);
  }

  /** Queues requests (e.g. a voice-over import) as one group; `observer` follows the first. */
  async enqueue(
    requests: readonly AppStageRequest[],
    observer?: RunObserver,
  ): Promise<StageCommandResult> {
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
      const reasons = gateReasons(first.stage, await this.snapshot(dir));
      if (reasons.length > 0) return result('error', reasons.join(' '));
    }
    this.nextGroup += 1;
    const group = this.nextGroup;
    requests.forEach((request, index) => {
      pipeline.queue.push({ request, group, observer: index === 0 ? observer : undefined });
    });
    this.options.log.info(`queued ${requests.map((request) => request.stage).join(' + ')}`);
    this.pushes.schedule(false);
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
      this.dropGroup(pipeline, active.item.group);
      this.options.log.info(`stopping ${stage}`);
      if (stage === 'export') this.options.exportRun?.cancel();
      else pipeline.runner.cancel();
      this.pushes.schedule(false);
      return true;
    }
    const queued = pipeline.queue.find((item) => item.request.stage === stage);
    if (queued === undefined) return false;
    this.dropGroup(pipeline, queued.group);
    this.pushes.schedule(true);
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
      for (const item of pipeline.queue.splice(0)) item.observer?.onDone({ status: 'cancelled' });
      if (pipeline.active?.run.stage === 'export') this.options.exportRun?.cancel();
      pipeline.runner.cancel();
    }
    await this.whenIdle();
    this.pushes.dispose();
  }

  private now(): number {
    return this.options.now?.() ?? Date.now();
  }

  private snapshot(dir: string): ReturnType<typeof readProjectSnapshot> {
    return readProjectSnapshot(dir, this.options.store);
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

  private dropGroup(pipeline: ProjectPipeline, group: number): void {
    const kept = pipeline.queue.filter((item) => item.group !== group);
    for (const item of pipeline.queue) {
      if (item.group === group) item.observer?.onDone({ status: 'cancelled' });
    }
    pipeline.queue.splice(0, pipeline.queue.length, ...kept);
  }

  private pump(pipeline: ProjectPipeline): void {
    if (this.disposed || pipeline.active !== undefined) return;
    const next = pipeline.queue.shift();
    if (next === undefined) return;
    const stage = next.request.stage;
    const run = new StageRun(stage, pipeline.dir, this.now(), runScope(next.request));
    pipeline.active = { run, item: next };
    pipeline.errors.delete(stage);
    pipeline.idle = this.execute(pipeline, next, run)
      .then((outcome) => {
        next.observer?.onDone(outcome);
      })
      .catch((error: unknown) => {
        this.options.log.error(`${stage} crashed: ${describeError(error)}`);
        next.observer?.onDone({
          status: 'failed',
          error: { kind: 'internal', message: describeError(error), issues: [] },
        });
      })
      .finally(() => {
        pipeline.active = undefined;
        this.refreshFor(pipeline);
        this.pump(pipeline);
      });
  }

  private async execute(
    pipeline: ProjectPipeline,
    next: QueuedRun,
    run: StageRun,
  ): Promise<RunOutcome> {
    const stage = next.request.stage;
    const outcome = await executeQueued({
      dir: pipeline.dir,
      runner: pipeline.runner,
      request: next.request,
      run,
      exportRun: this.options.exportRun,
      store: this.options.store,
      log: this.options.log,
      onChange: () => {
        this.changed(pipeline);
      },
    });
    pipeline.warnings.set(stage, [...run.warnings]);
    if (outcome.status === 'done') {
      this.options.log.info(`${stage}: ${outcome.message}`);
      const review = followUpReview(next.request, this.options.finalReview?.() === true);
      // Runs next, before the rest of the group (its fixes change what sound cues read).
      if (review !== undefined) pipeline.queue.unshift({ request: review, group: next.group });
      await this.followAssets(pipeline, next);
      return outcome;
    }
    this.dropGroup(pipeline, next.group);
    if (outcome.status === 'failed') {
      this.options.log.warn(`${stage} ${outcome.error.kind}: ${outcome.error.message}`);
      pipeline.errors.set(stage, outcome.error);
    }
    return outcome;
  }

  /** Storyboard → Assets right away; Assets waiting for review stops its group (PLAN.md#12.10). */
  private async followAssets(pipeline: ProjectPipeline, done: QueuedRun): Promise<void> {
    const stage = done.request.stage;
    if (stage !== 'storyboard' && stage !== 'assets') return;
    // Proposing the tension curve (PLAN.md#12.22) leaves the storyboard as it was.
    if (done.request.stage === 'storyboard' && (done.request.action ?? 'build') !== 'build') return;
    const next = assetsFollowUp(stage, await this.snapshot(pipeline.dir));
    if (next === 'queue-assets') {
      pipeline.queue.unshift({ request: { stage: 'assets' }, group: done.group });
    } else if (next === 'stop-group') {
      this.dropGroup(pipeline, done.group);
    }
  }

  private onEvent(pipeline: ProjectPipeline, event: StageEvent): void {
    const active = pipeline.active;
    const changed = active?.run.stage === event.stage && active.run.apply(event);
    if (REFRESH_EVENTS.has(event.type)) this.refreshFor(pipeline);
    if (changed) this.changed(pipeline);
  }

  /** The active run's view changed: push it (and hand it to its observer). */
  private changed(pipeline: ProjectPipeline): void {
    const active = pipeline.active;
    if (active?.item.observer !== undefined) active.item.observer.onView(active.run.snapshot());
    if (this.isCurrent(pipeline)) this.pushes.schedule(false);
  }

  private isCurrent(pipeline: ProjectPipeline): boolean {
    return this.current !== undefined && projectKey(this.current) === projectKey(pipeline.dir);
  }

  private refreshFor(pipeline: ProjectPipeline): void {
    if (this.isCurrent(pipeline)) this.pushes.schedule(true);
  }

  /** First open of `dir` in this session: stages a crash left running become interrupted. */
  private async recover(dir: string): Promise<void> {
    const key = projectKey(dir);
    if (this.recovered.has(key) || this.pipelines.get(key)?.active !== undefined) return;
    this.recovered.add(key);
    await recoverPipeline(
      this.options.store,
      dir,
      new Date(this.now()).toISOString(),
      this.options.log,
    );
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
    const [snapshot, hasVideo] = await Promise.all([this.snapshot(dir), hasExportedVideo(dir)]);
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

  /** `recompute` re-reads the project files first. */
  private async flush(recompute: boolean): Promise<void> {
    if (recompute || this.infos === undefined) {
      try {
        await this.computeInfos();
      } catch (error) {
        this.options.log.warn(`pipeline state not read: ${describeError(error)}`);
      }
    }
    if (!this.disposed) this.options.push(this.currentState());
  }
}
