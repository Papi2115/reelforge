/**
 * The default step executor of the production line: the existing StageRunner entry points (the
 * same stages, gating, limits and autocommits as the app), the script approval gate in
 * pipeline.json (the app's mechanism), the channel's voice provider (or "needs voice"), the asset
 * review gate, and the app's export and publish kit as injected functions. A stage already done
 * and not stale is not run again (crash between the stage and the queue write).
 */
import {
  PipelineStateStore,
  err,
  ok,
  type ModelAlias,
  type Result,
} from '@reelforge/claude-bridge';
import { promptModel } from '@reelforge/prompts';
import type { StageState } from '@reelforge/shared';
import { assetsReasons, assetsStep } from '../assets-gate.js';
import type { ClaudeRunner } from '../claude.js';
import { readProjectText } from '../files.js';
import type { StageId } from '../ids.js';
import { FILES } from '../paths.js';
import type { StageRunner } from '../runner.js';
import type { StageError, StageEvent, StageRequest } from '../types.js';
import { writeQueueBrief } from './brief.js';
import type {
  ExecutorStep,
  QueueStepContext,
  QueueStepExecutor,
  QueueStepOutcome,
  VoiceProvider,
} from './types.js';

export interface FilmStepRequest {
  readonly projectDir: string;
  readonly channelId: string;
  readonly signal: AbortSignal;
  /** Progress lines for the UI. */
  progress(label: string, percent?: number): void;
}

export interface FilmStepDone {
  readonly message: string;
  readonly warnings?: readonly string[] | undefined;
}

/** The app's export / publish kit (desktop: render backend, YouTube texts, chapters). */
export type FilmStep = (request: FilmStepRequest) => Promise<Result<FilmStepDone, StageError>>;

export interface StageQueueExecutorOptions {
  /** The StageRunner of a project (the app's: its Claude runner, audio tools, guard, scenes). */
  runnerFor(projectDir: string): StageRunner;
  /** The pipeline.json store shared with the app (approval writes). Default: a new one. */
  readonly pipelineStore?: PipelineStateStore;
  /** For the brief turn; undefined = Claude is not connected. */
  readonly claude?: ClaudeRunner | undefined;
  /** Model of the brief turn. Default: the prompt's (Sonnet). */
  readonly briefModel?: ModelAlias;
  /** The channel's voice generator (13.14); undefined = the film waits for a recording. */
  voiceFor?(channelId: string): VoiceProvider | undefined;
  readonly exportFilm?: FilmStep;
  /** Publish kit (titles, description, chapters, credits); absent = the step is skipped. */
  readonly publishKit?: FilmStep;
  /** The quiet final review after the scene build (the app's setting). Default on. */
  readonly finalReview?: boolean | (() => boolean);
  readonly now?: () => Date;
}

export const APPROVAL_WAITING = 'Approve the script (open the film → Script → Approve script).';
export const VOICE_WAITING =
  'Record or import the voice-over (this channel has no voice generator).';

/** Maps a stage failure: limits and a broken Claude concern the whole line, the rest the film. */
export function stageOutcome(error: StageError): QueueStepOutcome {
  switch (error.kind) {
    case 'limit':
      return { kind: 'limit', message: error.message };
    case 'cancelled':
      return { kind: 'cancelled' };
    case 'blocked':
    case 'missing-tool':
      return { kind: 'blocked', message: error.message };
    default: {
      const issues = error.issues === undefined ? '' : ` (${error.issues.slice(0, 3).join('; ')})`;
      return { kind: 'failed', message: `${error.message}${issues}` };
    }
  }
}

function settled(state: StageState | undefined): boolean {
  return state?.status === 'done' && state.stale !== true;
}

export class StageQueueExecutor implements QueueStepExecutor {
  private readonly store: PipelineStateStore;
  private readonly now: () => Date;

  constructor(private readonly options: StageQueueExecutorOptions) {
    this.now = options.now ?? (() => new Date());
    this.store = options.pipelineStore ?? new PipelineStateStore(this.now);
  }

  run(step: ExecutorStep, ctx: QueueStepContext): Promise<QueueStepOutcome> {
    switch (step) {
      case 'brief':
        return writeQueueBrief({
          projectDir: ctx.projectDir,
          item: ctx.item,
          targetMinutes: ctx.targetMinutes,
          claude: this.options.claude,
          model: this.options.briefModel ?? promptModel('brief'),
          signal: ctx.signal,
        });
      case 'approval':
        return this.approval(ctx);
      case 'voiceover':
        return this.voiceover(ctx);
      case 'assets':
        return this.assets(ctx);
      case 'final-review':
        return this.finalReview(ctx);
      case 'export':
        return this.filmStep(ctx, this.options.exportFilm, 'export');
      case 'publish':
        return this.filmStep(ctx, this.options.publishKit, 'publish');
      case 'script':
      case 'clean':
      case 'words':
      case 'storyboard':
      case 'scenes':
      case 'sound-cues':
      case 'mix':
        return this.stage(ctx, { stage: step }, true);
    }
  }

  /** The app's "Approve script": pipeline.json `stages.script.approvedAt`. */
  async approveScript(projectDir: string): Promise<Result<void, string>> {
    const script = await readProjectText(projectDir, FILES.script);
    if (!script.ok) return err(script.error.message);
    if (script.value === undefined || script.value.trim() === '')
      return err('there is no script yet');
    const stamp = this.now().toISOString();
    const updated = await this.store.update(projectDir, (state) => {
      const current = state.stages['script'];
      const approved: StageState = {
        ...(current ?? { message: 'written by hand' }),
        status: 'done',
        updatedAt: stamp,
        approvedAt: stamp,
      };
      return { ...state, stages: { ...state.stages, script: approved } };
    });
    return updated.ok ? ok(undefined) : err(`approval not saved: ${updated.error.message}`);
  }

  private async approval(ctx: QueueStepContext): Promise<QueueStepOutcome> {
    const state = await this.store.read(ctx.projectDir);
    if (!state.ok) return { kind: 'failed', message: state.error.message };
    const script = state.value.stages['script'];
    if (script?.approvedAt !== undefined) return { kind: 'done', message: 'script approved' };
    if (!ctx.autoApproveScript) return { kind: 'waiting', message: APPROVAL_WAITING };
    const approved = await this.approveScript(ctx.projectDir);
    return approved.ok
      ? { kind: 'done', message: 'script approved automatically (queue setting)' }
      : { kind: 'failed', message: approved.error };
  }

  private async voiceover(ctx: QueueStepContext): Promise<QueueStepOutcome> {
    const runner = this.options.runnerFor(ctx.projectDir);
    const snapshot = await runner.snapshot();
    if (settled(snapshot.stages['voiceover'])) return { kind: 'done', message: 'voice-over is in' };
    const provider = this.options.voiceFor?.(ctx.channelId);
    if (provider === undefined) return { kind: 'waiting', message: VOICE_WAITING };
    const voice = await provider.generate({
      projectDir: ctx.projectDir,
      channelId: ctx.channelId,
      signal: ctx.signal,
    });
    if (!voice.ok) {
      return voice.error.kind === 'cancelled'
        ? { kind: 'cancelled' }
        : { kind: 'failed', message: `voice: ${voice.error.message}` };
    }
    const imported = await this.stage(ctx, { stage: 'voiceover', source: voice.value.file }, false);
    if (imported.kind !== 'done') return imported;
    return {
      ...imported,
      warnings: [...(voice.value.warnings ?? []), ...(imported.warnings ?? [])],
    };
  }

  private async assets(ctx: QueueStepContext): Promise<QueueStepOutcome> {
    const runner = this.options.runnerFor(ctx.projectDir);
    const before = assetsStep(await runner.snapshot());
    if (before === 'off' || before === 'not-needed') {
      return { kind: 'skipped', message: 'no photos or footage needed' };
    }
    if (before === 'done') return { kind: 'done', message: 'assets ready' };
    if (before === 'to-run') {
      const ran = await this.stage(ctx, { stage: 'assets' }, false);
      if (ran.kind !== 'done') return ran;
    }
    const after = await runner.snapshot();
    const reasons = assetsReasons(after);
    if (reasons.length === 0) return { kind: 'done', message: 'assets ready' };
    const step = assetsStep(after);
    if (step === 'review' || step === 'running') {
      return { kind: 'waiting', message: reasons.join(' ') };
    }
    return { kind: 'failed', message: reasons.join(' ') };
  }

  private async finalReview(ctx: QueueStepContext): Promise<QueueStepOutcome> {
    const setting = this.options.finalReview ?? true;
    if (!(typeof setting === 'function' ? setting() : setting)) {
      return { kind: 'skipped', message: 'final review is off' };
    }
    const reviewed = await this.stage(
      ctx,
      { stage: 'scenes', action: 'final-review', trigger: 'auto' },
      false,
    );
    // The quiet review never fails a film: its problems are ⚠ in the film's report.
    if (reviewed.kind !== 'failed') return reviewed;
    return {
      kind: 'done',
      message: 'final review incomplete',
      warnings: [`final review: ${reviewed.message}`],
    };
  }

  private async filmStep(
    ctx: QueueStepContext,
    step: FilmStep | undefined,
    name: 'export' | 'publish',
  ): Promise<QueueStepOutcome> {
    if (step === undefined) {
      return name === 'publish'
        ? { kind: 'skipped', message: 'no publish kit configured' }
        : { kind: 'failed', message: 'export is not connected' };
    }
    const done = await step({
      projectDir: ctx.projectDir,
      channelId: ctx.channelId,
      signal: ctx.signal,
      progress: (label, percent) => {
        ctx.progress(label, percent);
      },
    });
    if (!done.ok) return stageOutcome(done.error);
    return { kind: 'done', message: done.value.message, warnings: done.value.warnings };
  }

  private async stage(
    ctx: QueueStepContext,
    request: StageRequest,
    skipWhenDone: boolean,
  ): Promise<QueueStepOutcome> {
    const runner = this.options.runnerFor(ctx.projectDir);
    const stage: StageId = request.stage;
    if (skipWhenDone && settled((await runner.snapshot()).stages[stage])) {
      return { kind: 'done', message: 'already done' };
    }
    const forward = (event: StageEvent): void => {
      ctx.stageEvent(event);
    };
    runner.on('event', forward);
    try {
      const result = await runner.run(request, { signal: ctx.signal });
      if (!result.ok) return stageOutcome(result.error);
      return { kind: 'done', message: result.value.message, warnings: result.value.warnings };
    } finally {
      runner.off('event', forward);
    }
  }
}
