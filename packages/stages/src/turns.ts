/**
 * One Claude turn of a stage: model from the settings (Economy = Sonnet + short-turn hint), usage
 * limit handling (stage `paused` in pipeline.json, wait for the account-wide LimitGuard to resume,
 * retry in the same session without losing work), cancellation, the shot-lock guard (changes to
 * locked shots are discarded) and the `claude-turn` autocommit.
 */
import {
  ECONOMY_HINT,
  err,
  MODEL_ALIASES,
  ok,
  toPipelinePause,
  type LimitGuard,
  type ModelAlias,
  type PipelineStateStore,
  type Result,
} from '@reelforge/claude-bridge';
import { permissionStageFor, promptModel } from '@reelforge/prompts';
import { addUsageTotals, emptyUsageTotals, type UsageTotals } from '@reelforge/shared';
import type { ClaudeRunner, ClaudeTurnResult } from './claude.js';
import { guardLockedFiles } from './lock-guard.js';
import type { StageId } from './ids.js';
import type { StageSettings } from './settings.js';
import { stageError, type StageError, type StageEvent, type StageTurn } from './types.js';

export interface TurnDriverOptions {
  readonly projectDir: string;
  readonly stage: StageId;
  readonly claude: ClaudeRunner;
  readonly guard: LimitGuard | undefined;
  readonly store: PipelineStateStore;
  readonly settings: StageSettings;
  readonly signal: AbortSignal;
  readonly emit: (event: StageEvent) => void;
  /** Autocommit after a turn (`claude-turn`); failures are reported as warnings by the caller. */
  readonly commit: (message: string) => Promise<void>;
}

export function continuationPrompt(original: string): string {
  return `The previous attempt at this task was interrupted by a usage limit. Check the current state of the project files, then continue and finish the task:\n\n${original}`;
}

/** The stronger of a resolved model and a turn's floor (MODEL_ALIASES: strongest first). */
export function atLeastModel(model: ModelAlias, floor: ModelAlias | undefined): ModelAlias {
  if (floor === undefined) return model;
  return MODEL_ALIASES.indexOf(floor) < MODEL_ALIASES.indexOf(model) ? floor : model;
}

/** Resolves true on resume, false when the signal aborts first. */
export function waitForResume(guard: LimitGuard, signal: AbortSignal): Promise<boolean> {
  if (!guard.paused) return Promise.resolve(true);
  if (signal.aborted) return Promise.resolve(false);
  return new Promise((resolve) => {
    const finish = (resumed: boolean): void => {
      guard.off('resumed', onResumed);
      signal.removeEventListener('abort', onAbort);
      resolve(resumed);
    };
    const onResumed = (): void => {
      finish(true);
    };
    const onAbort = (): void => {
      finish(false);
    };
    guard.on('resumed', onResumed);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

export class TurnDriver {
  private total: UsageTotals | undefined;

  constructor(private readonly options: TurnDriverOptions) {}

  /** Usage of every turn this driver ran (undefined: none reached Claude). */
  get usage(): UsageTotals | undefined {
    return this.total;
  }

  async run(turn: StageTurn): Promise<Result<ClaudeTurnResult, StageError>> {
    const { claude, guard, signal, settings, stage, projectDir } = this.options;
    const model = atLeastModel(
      promptModel(turn.prompt, { economy: settings.economy, models: settings.models }),
      turn.minModel,
    );
    let prompt = turn.text;
    let newSession = turn.newSession;
    for (;;) {
      if (signal.aborted) return err(stageError('cancelled', 'cancelled'));
      if (guard?.paused === true && !(await this.pauseUntilResumed(guard))) {
        return err(stageError('cancelled', 'cancelled while paused by the usage limit'));
      }
      this.options.emit({
        type: 'step',
        stage,
        label: `Claude: ${turn.label}`,
        percent: undefined,
      });
      const spec = {
        projectDir,
        stage: permissionStageFor(turn.prompt),
        purpose: turn.purpose,
        prompt,
        model,
        newSession,
        ...(turn.detached === true ? { detached: true } : {}),
        ...(settings.economy ? { appendSystemPrompt: ECONOMY_HINT } : {}),
      };
      // Locked shots (PLAN.md#11.4): whatever the turn did to their files is put back.
      const result = await guardLockedFiles(
        projectDir,
        () =>
          claude.run(spec, {
            signal,
            onEvent: (event) => {
              this.options.emit({ type: 'claude', stage, event });
            },
          }),
        (message) => {
          this.options.emit({ type: 'warning', stage, message });
        },
      );
      if (result.usage !== undefined) {
        this.total = addUsageTotals(this.total ?? emptyUsageTotals(), result.usage);
      }
      if (turn.commit !== false && result.status !== 'cancelled' && result.status !== 'blocked') {
        await this.options.commit(`Claude turn: ${turn.label}`);
      }
      switch (result.status) {
        case 'completed':
          return ok(result);
        case 'cancelled':
          return err(stageError('cancelled', 'cancelled'));
        case 'blocked':
          return err(stageError('blocked', `Claude cannot run: ${result.message}`));
        case 'failed':
          return err(stageError('claude', `Claude turn "${turn.label}" failed: ${result.message}`));
        case 'limit':
          if (guard === undefined) {
            return err(stageError('limit', `usage limit reached: ${result.message}`));
          }
          if (!guard.paused) guard.reportLimit(result.limit);
          if (result.sessionId !== undefined && turn.detached !== true) newSession = false;
          prompt = continuationPrompt(turn.text);
      }
    }
  }

  private async pauseUntilResumed(guard: LimitGuard): Promise<boolean> {
    const { store, projectDir, stage, signal } = this.options;
    const pause = guard.pause;
    const message = pause?.message ?? 'usage limit reached';
    if (pause !== undefined) {
      await this.persist(store.setPause(projectDir, toPipelinePause(pause, guard.concurrency)));
    }
    await this.persist(store.setStage(projectDir, stage, 'paused', message));
    this.options.emit({
      type: 'paused',
      stage,
      until: pause?.until === undefined ? undefined : new Date(pause.until).toISOString(),
      message,
    });
    const resumed = await waitForResume(guard, signal);
    if (!resumed) return false;
    await this.persist(store.setPause(projectDir, undefined));
    await this.persist(store.setStage(projectDir, stage, 'running'));
    this.options.emit({ type: 'resumed', stage });
    return true;
  }

  private async persist(
    write: Promise<Result<unknown, { readonly kind: string; readonly message: string }>>,
  ): Promise<void> {
    const written = await write;
    if (!written.ok) {
      this.options.emit({
        type: 'warning',
        stage: this.options.stage,
        message: `pipeline.json ${written.error.kind}: ${written.error.message}`,
      });
    }
  }
}
