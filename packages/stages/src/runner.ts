/**
 * StageRunner (PLAN.md §3, #7.1-7.4, #8.1, #8.3): runs one stage at a time on a project. Gating
 * (`canRun`), progress events, stage status in `.reelforge/pipeline.json`, cancellation (AbortSignal
 * -> kill tree), usage-limit pause + automatic resume through the LimitGuard, invalidation of
 * downstream stages, and an autocommit after every stage and every Claude turn. Re-running a
 * finished stage ("Redo") overwrites its outputs.
 */
import { EventEmitter } from 'node:events';
import {
  PipelineStateStore,
  err,
  fromPipelinePause,
  ok,
  type LimitGuard,
  type Result,
} from '@reelforge/claude-bridge';
import type { AssetRuntime } from '@reelforge/cli/assets';
import { autocommit, type AutocommitKind, type GitOptions } from '@reelforge/project';
import type { StageRunStatus, StageState } from '@reelforge/shared';
import type { AudioTools } from './audio-tools.js';
import type { ClaudeRunner } from './claude.js';
import { canRun, type Readiness } from './gating.js';
import { STAGE_IDS, STAGE_TITLES, type StageId } from './ids.js';
import { invalidateDownstream, stagesToInvalidate } from './invalidate.js';
import { DEFAULT_STAGE_SETTINGS, type StageSettings } from './settings.js';
import type { SceneTools } from './scenes/tools.js';
import { isReviewRun, statusAfter } from './run-status.js';
import { readProjectSnapshot, type ProjectSnapshot } from './snapshot.js';
import { BUILT_IN_STAGES, type StageRegistry } from './stages/registry.js';
import type { TasteLearner } from './taste/signals.js';
import { TurnDriver } from './turns.js';
import {
  stageError,
  type SceneSfxProvider,
  type StageContext,
  type StageError,
  type StageEvent,
  type StageRequest,
  type StageSuccess,
  type StageSummary,
} from './types.js';

export interface StageRunnerOptions {
  readonly projectDir: string;
  /** Needed by script, storyboard and sound-cues (sound cues fall back to the default cues). */
  readonly claude?: ClaudeRunner | undefined;
  /** Needed by voiceover (duration), clean, words and mix. */
  readonly audio?: AudioTools | undefined;
  /** A value or a getter (read at the start of every run). Default `DEFAULT_STAGE_SETTINGS`. */
  readonly settings?: StageSettings | (() => StageSettings);
  /** The app's (account-wide) guard: pauses on usage limits and resumes automatically. */
  readonly guard?: LimitGuard | undefined;
  readonly sceneSfx?: SceneSfxProvider | undefined;
  /** Asset sources/transport of the Assets stage (default: the real ones; tests: a local server). */
  readonly assets?: AssetRuntime | undefined;
  /** Taste learning (PLAN.md#12.13): the app's local profile; absent = off. */
  readonly taste?: TasteLearner | undefined;
  /** Needed by Scenes built: frame renderer (+ kit names, missing-prop handler). */
  readonly scenes?: SceneTools | undefined;
  readonly store?: PipelineStateStore;
  /** Autocommit after stages and Claude turns. Default true. */
  readonly autocommit?: boolean;
  readonly git?: GitOptions;
  readonly now?: () => Date;
  /** Stage implementations (default: the built-in ones). */
  readonly stages?: StageRegistry;
}

export interface RunOptions {
  readonly signal?: AbortSignal | undefined;
}

export class StageRunner extends EventEmitter<{ event: [StageEvent] }> {
  readonly projectDir: string;
  private readonly store: PipelineStateStore;
  private readonly now: () => Date;
  private readonly stages: StageRegistry;
  private active: { readonly stage: StageId; readonly controller: AbortController } | undefined;
  private recovered = false;

  constructor(private readonly options: StageRunnerOptions) {
    super();
    this.projectDir = options.projectDir;
    this.now = options.now ?? (() => new Date());
    this.store = options.store ?? new PipelineStateStore(this.now);
    this.stages = options.stages ?? BUILT_IN_STAGES;
  }

  /** Which stage is running, if any. */
  get running(): StageId | undefined {
    return this.active?.stage;
  }

  snapshot(): Promise<ProjectSnapshot> {
    return readProjectSnapshot(this.projectDir, this.store);
  }

  /** Readiness of every stage (for the pipeline list in the UI). */
  async readiness(): Promise<Readonly<Record<StageId, Readiness>>> {
    await this.recoverInterrupted();
    const snapshot = await this.snapshot();
    return Object.fromEntries(STAGE_IDS.map((id) => [id, canRun(id, snapshot)])) as Record<
      StageId,
      Readiness
    >;
  }

  /** Cancels the running stage (kills its Claude/ffmpeg/whisper processes). */
  cancel(): void {
    this.active?.controller.abort();
  }

  async run(
    request: StageRequest,
    options: RunOptions = {},
  ): Promise<Result<StageSuccess, StageError>> {
    const stage = request.stage;
    if (this.active !== undefined) {
      return this.fail(
        stage,
        stageError('busy', `${STAGE_TITLES[this.active.stage]} is running`),
        false,
      );
    }
    const controller = new AbortController();
    this.active = { stage, controller };
    try {
      return await this.runActive(request, controller, options.signal);
    } finally {
      this.active = undefined;
    }
  }

  private async runActive(
    request: StageRequest,
    controller: AbortController,
    outer: AbortSignal | undefined,
  ): Promise<Result<StageSuccess, StageError>> {
    const stage = request.stage;
    await this.recoverInterrupted();
    const snapshot = await this.snapshot();
    const readiness = canRun(stage, snapshot);
    if (!readiness.ready) {
      return this.fail(
        stage,
        stageError('not-ready', readiness.reasons.join(' '), readiness.reasons),
        false,
      );
    }
    await this.restorePause(stage, snapshot);
    const signal =
      outer === undefined ? controller.signal : AbortSignal.any([outer, controller.signal]);
    const settings = this.settings();
    await this.writeStage(stage, 'running');
    this.emitEvent({ type: 'started', stage });
    const driver =
      this.options.claude === undefined ? undefined : this.driver(stage, settings, signal);
    const ctx: StageContext = {
      projectDir: this.projectDir,
      settings,
      snapshot,
      signal,
      audio: this.options.audio,
      sceneSfx: this.options.sceneSfx,
      hasClaude: driver !== undefined,
      now: this.now,
      step: (label, percent) => {
        this.emitEvent({ type: 'step', stage, label, percent });
      },
      warn: (message) => {
        this.emitEvent({ type: 'warning', stage, message });
      },
      claude: (turn) =>
        driver === undefined
          ? Promise.resolve(err(stageError('missing-tool', 'Claude is not connected')))
          : driver.run(turn),
      assets: this.options.assets,
      taste: this.options.taste,
      scenes: this.options.scenes,
      store: this.store,
      claudeConcurrency: () => this.options.guard?.concurrency ?? Number.POSITIVE_INFINITY,
      commit: async (message, paths) => {
        await this.commit(stage, message, 'pipeline-step', paths);
      },
      shot: (shotId, state, status) => {
        this.emitEvent({ type: 'shot', stage, shotId, state, status });
      },
    };
    // A review of built scenes that stops or fails leaves "Scenes built" as it was.
    const keep = isReviewRun(request) ? snapshot.stages[stage] : undefined;
    const result = await this.execute(ctx, request);
    if (!result.ok) return this.fail(stage, result.error, true, keep);
    if (signal.aborted) {
      return this.fail(stage, stageError('cancelled', 'cancelled'), true, keep);
    }
    return ok(await this.finish(stage, result.value, driver, keep));
  }

  private async execute(
    ctx: StageContext,
    request: StageRequest,
  ): Promise<Result<StageSummary, StageError>> {
    try {
      return await this.dispatch(ctx, request);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return err(stageError('io', `unexpected error: ${message}`));
    }
  }

  /** Narrows the request to its stage's definition. */
  private dispatch(
    ctx: StageContext,
    request: StageRequest,
  ): Promise<Result<StageSummary, StageError>> {
    switch (request.stage) {
      case 'script':
        return this.stages.script.run(ctx, request);
      case 'voiceover':
        return this.stages.voiceover.run(ctx, request);
      case 'clean':
        return this.stages.clean.run(ctx, request);
      case 'words':
        return this.stages.words.run(ctx, request);
      case 'storyboard':
        return this.stages.storyboard.run(ctx, request);
      case 'assets':
        return this.stages.assets.run(ctx, request);
      case 'scenes':
        return this.stages.scenes.run(ctx, request);
      case 'sound-cues':
        return this.stages['sound-cues'].run(ctx, request);
      case 'mix':
        return this.stages.mix.run(ctx, request);
    }
  }

  private async finish(
    stage: StageId,
    summary: StageSummary,
    driver: TurnDriver | undefined,
    keep: StageState | undefined,
  ): Promise<StageSuccess> {
    if (summary.keepStatus !== true) await this.writeStage(stage, 'done', summary.message);
    else if (keep !== undefined) await this.restoreStage(stage, keep);
    else await this.writeStage(stage, 'idle');
    let invalidated: StageSuccess['invalidated'] = [];
    if (summary.changed) {
      invalidated = stagesToInvalidate(stage, await this.snapshot());
      if (invalidated.length > 0) {
        const written = await invalidateDownstream(
          this.store,
          this.projectDir,
          invalidated,
          `${STAGE_TITLES[stage].toLowerCase()} changed`,
          this.now,
        );
        if (!written.ok) this.warnStore(stage, written.error.message);
      }
    }
    for (const message of summary.warnings) this.emitEvent({ type: 'warning', stage, message });
    const commit = await this.commit(
      stage,
      summary.commitMessage ?? `${STAGE_TITLES[stage]}: ${summary.message}`,
      'pipeline-step',
    );
    const success: StageSuccess = {
      ...summary,
      stage,
      usage: driver?.usage,
      invalidated,
      commit,
    };
    this.emitEvent({ type: 'done', stage, result: success });
    return success;
  }

  private async fail(
    stage: StageId,
    error: StageError,
    persist: boolean,
    keep?: StageState,
  ): Promise<Result<never, StageError>> {
    if (persist && keep?.status === 'done') await this.restoreStage(stage, keep);
    else if (persist) await this.writeStage(stage, statusAfter(error), error.message);
    this.emitEvent({ type: 'failed', stage, error });
    return err(error);
  }

  private driver(
    stage: StageId,
    settings: StageSettings,
    signal: AbortSignal,
  ): TurnDriver | undefined {
    const claude = this.options.claude;
    if (claude === undefined) return undefined;
    return new TurnDriver({
      projectDir: this.projectDir,
      stage,
      claude,
      guard: this.options.guard,
      store: this.store,
      settings,
      signal,
      emit: (event) => {
        this.emitEvent(event);
      },
      commit: async (message) => {
        await this.commit(stage, message, 'claude-turn');
      },
    });
  }

  private settings(): StageSettings {
    const configured = this.options.settings;
    if (configured === undefined) return DEFAULT_STAGE_SETTINGS;
    return typeof configured === 'function' ? configured() : configured;
  }

  /** A pause persisted before a restart is re-applied to the guard (or dropped if expired). */
  private async restorePause(stage: StageId, snapshot: ProjectSnapshot): Promise<void> {
    const guard = this.options.guard;
    const stored = snapshot.pause;
    if (guard === undefined || stored === undefined || guard.paused) return;
    const resumed: string[] = [];
    const onResumed = (event: { readonly cause: string }): void => {
      resumed.push(event.cause);
    };
    guard.once('resumed', onResumed);
    guard.restore(fromPipelinePause(stored), stored.concurrency);
    guard.off('resumed', onResumed);
    if (resumed.length === 0) return;
    // Expired while the app was closed: resumed right away, so the stored pause goes too.
    const cleared = await this.store.setPause(this.projectDir, undefined);
    if (!cleared.ok) this.warnStore(stage, cleared.error.message);
  }

  /** After an app crash nothing is in flight: `running` stages become `failed`. */
  private async recoverInterrupted(): Promise<void> {
    if (this.recovered) return;
    this.recovered = true;
    const updated = await this.store.update(this.projectDir, (state) => {
      const stages = { ...state.stages };
      for (const id of STAGE_IDS) {
        const current = stages[id];
        if (current?.status !== 'running') continue;
        stages[id] = {
          ...current,
          status: 'failed',
          message: 'interrupted (the app closed while it was running)',
          updatedAt: this.now().toISOString(),
        };
      }
      return { ...state, stages };
    });
    if (!updated.ok) this.warnStore(this.active?.stage ?? 'script', updated.error.message);
  }

  private async writeStage(
    stage: StageId,
    status: StageRunStatus,
    message?: string,
  ): Promise<void> {
    const written = await this.store.setStage(this.projectDir, stage, status, message);
    if (!written.ok) this.warnStore(stage, written.error.message);
  }

  private async restoreStage(stage: StageId, previous: StageState): Promise<void> {
    const written = await this.store.update(this.projectDir, (state) => ({
      ...state,
      stages: { ...state.stages, [stage]: { ...previous, updatedAt: this.now().toISOString() } },
    }));
    if (!written.ok) this.warnStore(stage, written.error.message);
  }

  private warnStore(stage: StageId, message: string): void {
    this.emitEvent({ type: 'warning', stage, message: `pipeline.json: ${message}` });
  }

  /** Autocommit; failures (no git, locked index) become warnings, never stage failures. */
  private async commit(
    stage: StageId,
    message: string,
    kind: AutocommitKind,
    paths?: readonly string[],
  ): Promise<string | undefined> {
    if (this.options.autocommit === false) return undefined;
    const committed = await autocommit(this.projectDir, message, {
      kind,
      step: stage,
      ...(this.options.git === undefined ? {} : { git: this.options.git }),
      ...(paths === undefined ? {} : { paths }),
    });
    if (!committed.ok) {
      this.emitEvent({
        type: 'warning',
        stage,
        message: `autocommit failed (${committed.error.kind}): ${committed.error.message}`,
      });
      return undefined;
    }
    if (committed.value.status !== 'committed') return undefined;
    this.emitEvent({ type: 'committed', stage, hash: committed.value.hash });
    return committed.value.hash;
  }

  private emitEvent(event: StageEvent): void {
    this.emit('event', event);
  }
}
