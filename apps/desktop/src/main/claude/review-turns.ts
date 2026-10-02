/**
 * The Whole-video chips of the chat (PLAN.md#7.6) run the scene stage's review modes instead of a
 * free chat turn: "Review the whole video and fix what looks wrong" -> `fix-what-looks-wrong`,
 * "Make all on-screen text easier to read on a phone" -> `phone-legibility`, "Check every visual
 * lands on its spoken word" -> `sync-check`. The run goes through the StageService queue (one
 * stage at a time, limits, autocommits per fixed shot); the chat shows it as a turn whose step log
 * is the run's live steps plus a progress line, ending with the stage's summary.
 */
import type { ChatChip, ChatStep, ChatTurn } from '../../shared/chat-contract.js';
import type { StageCommandResult, StageRunView } from '../../shared/stages-contract.js';
import type { SceneActionKey } from '../../shared/voiceover-contract.js';
import type { RunObserver, RunOutcome } from '../stages/stage-execution.js';

export const CHIP_REVIEW_MODES: Readonly<Record<ChatChip, Exclude<SceneActionKey, 'build'>>> = {
  'review-video': 'fix-what-looks-wrong',
  'readable-text': 'phone-legibility',
  'visuals-on-words': 'sync-check',
};

/** Queues a review mode of the open project and follows it. */
export type ReviewRunner = (
  mode: Exclude<SceneActionKey, 'build'>,
  observer: RunObserver,
) => Promise<StageCommandResult>;

/** The chat request a chip turn shows. */
export function reviewRequest(
  chip: ChatChip,
  model: ChatTurn['request']['model'],
): ChatTurn['request'] {
  return { text: '', chip, scope: 'video', shotIds: [], selectionLabel: null, model };
}

/** The chat's step log of a running review: its Claude steps, then the progress line. */
export function reviewSteps(view: StageRunView): ChatStep[] {
  const percent = view.percent === null ? '' : ` (${String(Math.round(view.percent))} %)`;
  const progress: ChatStep[] =
    view.label === null
      ? []
      : [{ type: 'text', id: 'review-progress', text: `${view.label}${percent}` }];
  return [...view.steps, ...progress];
}

/** The turn fields after the run ended. */
export function reviewFinish(
  steps: readonly ChatStep[],
  outcome: RunOutcome,
  now: number,
): Pick<ChatTurn, 'status' | 'finishedAt' | 'steps' | 'error'> {
  const kept = steps.filter((step) => step.id !== 'review-progress');
  switch (outcome.status) {
    case 'done': {
      const lines = [outcome.message, ...outcome.warnings.map((warning) => `⚠ ${warning}`)];
      return {
        status: 'done',
        finishedAt: now,
        steps: [...kept, { type: 'text', id: 'review-result', text: lines.join('\n') }],
        error: null,
      };
    }
    case 'cancelled':
      return { status: 'stopped', finishedAt: now, steps: kept, error: null };
    case 'failed':
      return {
        status: 'failed',
        finishedAt: now,
        steps: [...kept, { type: 'error', id: 'review-error', message: outcome.error.message }],
        error: { kind: 'failed', message: outcome.error.message },
      };
  }
}

/** A chat turn the ReviewTurns keep up to date (created in the ClaudeService transcript). */
export interface ReviewTurnHandle {
  readonly turn: () => ChatTurn;
  readonly update: (patch: Partial<ChatTurn>) => void;
  readonly remove: () => void;
}

export interface ReviewTurnsOptions {
  readonly run: ReviewRunner;
  /** Stops the running review (StageService.stop('scenes')). */
  readonly stop: () => boolean;
  readonly now: () => number;
}

/** At most one review turn runs (the stage queue runs one scene run at a time anyway). */
export class ReviewTurns {
  private active: { readonly projectKey: string; readonly id: string } | undefined;

  constructor(private readonly options: ReviewTurnsOptions) {}

  /** Id of the running review turn of `projectKey`, else null. */
  runningId(projectKey: string): string | null {
    return this.active?.projectKey === projectKey ? this.active.id : null;
  }

  stop(projectKey: string): boolean {
    return this.active?.projectKey === projectKey && this.options.stop();
  }

  /** Starts the review of `chip`; the handle's turn is already in the transcript. */
  async start(
    projectKey: string,
    chip: ChatChip,
    handle: ReviewTurnHandle,
  ): Promise<StageCommandResult> {
    const id = handle.turn().id;
    const progress = { finished: false };
    handle.update({ status: 'running', startedAt: this.options.now() });
    const queued = await this.options.run(CHIP_REVIEW_MODES[chip], {
      onView: (view) => {
        handle.update({ steps: reviewSteps(view) });
      },
      onDone: (outcome) => {
        progress.finished = true;
        handle.update(reviewFinish(handle.turn().steps, outcome, this.options.now()));
        if (this.active?.id === id) this.active = undefined;
      },
    });
    if (queued.status === 'error') handle.remove();
    else if (!progress.finished) this.active = { projectKey, id };
    return queued;
  }
}
