/**
 * ClaudeService (PLAN.md#6.6): the app's one SessionManager (+ the account-wide LimitGuard and the
 * usage ledger) and the chat on top of it. Chat messages wait in a FIFO queue and run one at a
 * time in the open project's `main` session (stage `chat`, model from Settings, "Think harder" =
 * boost model). Stop kills the turn's process tree; whatever it changed stays and is committed
 * like every finished turn (`kind: claude-turn`). A usage limit pauses the queue until the reset
 * time (or "Try now") and re-queues the interrupted message. Locked shots (PLAN.md#11.4) cannot be
 * the target of a message, and a turn's changes to them are discarded before the commit.
 * Electron-free: the CLI launcher, env and commits come in through the options; state goes out
 * through `push`.
 */
import { randomUUID } from 'node:crypto';
import {
  initialTurnView,
  LimitGuard,
  ok,
  reduceTurn,
  SessionManager,
  UsageLedger,
  type ClaudeLauncher,
  type Clock,
  type ExtraEnv,
  type ModelAlias,
  type Result,
  type StagePermissionOptions,
  type TurnHandle,
  type TurnOutcome,
} from '@reelforge/claude-bridge';
import type { CommitResult, ProjectError } from '@reelforge/project';
import type { AppSettings } from '@reelforge/shared';
import {
  CHIP_LABELS,
  type ChatChip,
  type ChatError,
  type ChatSendRequest,
  type ChatSendResult,
  type ChatState,
  type ChatTurn,
} from '../../shared/chat-contract.js';
import type { Logger } from '../logger.js';
import { chatTurnModel, usageBudgetFor } from '../settings-consumers.js';
import { chatLocks, lockedShotsNote, lockSteps, startChatLockGuard } from './chat-locks.js';
import { buildChatPrompt, findSourceHint, requestTitle, selectionLabel } from './chat-prompt.js';
import { startChatTurn } from './chat-resume.js';
import { toChatSteps } from './chat-steps.js';
import { ChatTranscripts, projectKey } from './chat-transcripts.js';
import { ReviewTurns, reviewRequest, type ReviewTurnsOptions } from './review-turns.js';
import { createSessionManager } from './session-setup.js';
import {
  commitSubject,
  isResumableOutcome,
  queuedTurn,
  turnErrorOf,
  turnStatusOf,
  turnUsageOf,
} from './turn-outcome.js';

/** What the bridge needs to run `claude` in this app (resolved on the first message). */
export interface ClaudeSetup {
  readonly launcher: ClaudeLauncher;
  /** Parent env of the claude children (sanitized by the bridge on every spawn). */
  readonly env: NodeJS.ProcessEnv;
  readonly permissions: StagePermissionOptions;
}

export interface ClaudeServiceOptions {
  readonly setup: () => Promise<Result<ClaudeSetup, ChatError>>;
  readonly settings: () => AppSettings;
  readonly currentProject: () => string | undefined;
  /** The render service env for a project (REELFORGE_RENDER_URL/TOKEN), passed as `extraEnv`. */
  readonly renderEnv: (projectDir: string) => ExtraEnv | undefined;
  /** Autocommit of a project (`kind: claude-turn`). */
  readonly commit: (
    projectDir: string,
    message: string,
  ) => Promise<Result<CommitResult, ProjectError>>;
  readonly push: (state: ChatState) => void;
  readonly log: Logger;
  /** Limit-guard clock (tests drive a manual one). */
  readonly clock?: Clock;
  /** Epoch ms for the transcript. */
  readonly now?: () => number;
  readonly pushDelayMs?: number;
  readonly exitGraceMs?: number;
  /** Claude turns at once (chat + pipeline stages; scene building runs 2). Default 2. */
  readonly maxConcurrency?: number;
  /** Whole-video chips run the scene stage's review modes (PLAN.md#7.6); else a chat turn. */
  readonly review?: Pick<ReviewTurnsOptions, 'run' | 'stop'>;
}

/** Scene building runs two shots at once (PLAN.md#7.4); the chat runs one turn at a time. */
export const DEFAULT_CLAUDE_CONCURRENCY = 2;

interface TurnRecord {
  turn: ChatTurn;
  readonly projectDir: string;
  readonly prompt: string;
  readonly model: ModelAlias;
  readonly title: string;
  /** Id of the interrupted turn this record resumes (runs via `resumeInterrupted`). */
  readonly resumeOf?: string;
}

interface Current {
  readonly record: TurnRecord;
  handle: TurnHandle | undefined;
  stopRequested: boolean;
}

export { MAX_TRANSCRIPT_TURNS } from './chat-transcripts.js';

export class ClaudeService {
  readonly guard: LimitGuard;
  readonly usage: UsageLedger;
  private manager: SessionManager | undefined;
  private setupRun: Promise<Result<SessionManager, ChatError>> | undefined;
  private readonly queue: TurnRecord[] = [];
  private readonly transcripts = new ChatTranscripts<TurnRecord>();
  private current: Current | undefined;
  private notice: ChatError | null = null;
  private pushTimer: ReturnType<typeof setTimeout> | undefined;
  private idle: Promise<void> = Promise.resolve();
  private disposed = false;
  private readonly reviews: ReviewTurns | undefined;

  constructor(private readonly options: ClaudeServiceOptions) {
    this.reviews =
      options.review === undefined
        ? undefined
        : new ReviewTurns({ ...options.review, now: () => this.now() });
    this.guard = new LimitGuard({
      maxConcurrency: this.concurrency,
      ...(options.clock === undefined ? {} : { clock: options.clock }),
    });
    this.usage = new UsageLedger({ budgetFor: usageBudgetFor(options.settings) });
    this.guard.on('paused', (pause) => {
      options.log.warn(
        `usage limit pause until ${pause.until === undefined ? 'manual resume' : new Date(pause.until).toISOString()}`,
      );
      this.changed();
    });
    this.guard.on('resumed', ({ cause }) => {
      options.log.info(`usage limit pause ended (${cause})`);
      this.changed();
      this.pump();
    });
  }

  /** A chat turn is running (quitting must kill it first). */
  get busy(): boolean {
    return this.current !== undefined;
  }

  private get concurrency(): number {
    return Math.max(1, this.options.maxConcurrency ?? DEFAULT_CLAUDE_CONCURRENCY);
  }

  /** The app's SessionManager once Claude is set up (stage orchestration shares it). */
  get sessions(): SessionManager | undefined {
    return this.manager;
  }

  /** The app's SessionManager, set up on first use (the pipeline stages run their turns on it). */
  sessionManager(): Promise<Result<SessionManager, ChatError>> {
    return this.ensureManager();
  }

  state(): ChatState {
    const dir = this.options.currentProject();
    const key = dir === undefined ? undefined : projectKey(dir);
    const mine = (record: TurnRecord): boolean => projectKey(record.projectDir) === key;
    const current = this.current;
    const pause = this.guard.pause;
    return {
      projectDir: dir ?? null,
      turns: key === undefined ? [] : this.transcripts.of(key).map((record) => record.turn),
      queue: this.queue.filter(mine).map((record) => record.turn),
      running:
        current !== undefined && mine(current.record)
          ? current.record.turn.id
          : key === undefined
            ? null
            : (this.reviews?.runningId(key) ?? null),
      pause:
        pause === undefined
          ? null
          : { reason: pause.reason, until: pause.until ?? null, message: pause.message ?? null },
      notice: this.notice,
    };
  }

  /** Queues a message for the open project; it starts when nothing else runs. */
  async send(request: ChatSendRequest): Promise<ChatSendResult> {
    const dir = this.options.currentProject();
    if (dir === undefined) {
      return { status: 'error', error: { kind: 'no-project', message: 'no project is open' } };
    }
    if (request.chip !== null && this.reviews !== undefined) {
      return this.sendReview(dir, request.chip, this.reviews);
    }
    const scope = request.chip === null ? request.scope : 'video';
    const selection = scope === 'selection' ? request.selection : null;
    if (scope === 'selection' && selection === null) {
      const message = 'nothing is selected: click an object in the preview first';
      return { status: 'error', error: { kind: 'invalid-request', message } };
    }
    const locks = await chatLocks(dir, scope, request.shotIds, selection);
    if (locks.refusal !== null) {
      return { status: 'error', error: { kind: 'invalid-request', message: locks.refusal } };
    }
    const hint = selection === null ? undefined : await findSourceHint(dir, selection);
    const built = buildChatPrompt({
      request: { ...request, scope, selection },
      hint,
      lockedNote: lockedShotsNote(locks.locked),
    });
    if (!built.ok) {
      return { status: 'error', error: { kind: 'invalid-request', message: built.message } };
    }
    const model = chatTurnModel(this.options.settings(), request.boost);
    const record: TurnRecord = {
      projectDir: dir,
      prompt: built.prompt,
      model,
      title: requestTitle(request),
      turn: queuedTurn(randomUUID(), this.now(), {
        text: request.text,
        chip: request.chip,
        scope,
        shotIds: scope === 'video' ? [] : [...request.shotIds],
        selectionLabel: selection === null ? null : selectionLabel(selection),
        model,
      }),
    };
    this.queue.push(record);
    this.options.log.info(`queued chat turn ${record.turn.id} (${model}, ${scope})`);
    this.changed();
    this.pump();
    return { status: 'queued', turnId: record.turn.id };
  }

  /** Removes a queued message of the open project. */
  remove(turnId: string): boolean {
    const dir = this.options.currentProject();
    const index = this.queue.findIndex(
      (record) =>
        record.turn.id === turnId &&
        dir !== undefined &&
        projectKey(record.projectDir) === projectKey(dir),
    );
    if (index === -1) return false;
    this.queue.splice(index, 1);
    this.changed();
    return true;
  }

  /** Stops the running turn of the open project; queued messages run afterwards. */
  async stop(): Promise<boolean> {
    const current = this.current;
    const dir = this.options.currentProject();
    if (current === undefined && dir !== undefined) {
      return this.reviews?.stop(projectKey(dir)) ?? false;
    }
    if (current === undefined || dir === undefined) return false;
    if (projectKey(current.record.projectDir) !== projectKey(dir)) return false;
    current.stopRequested = true;
    this.options.log.info(`stopping chat turn ${current.record.turn.id}`);
    await current.handle?.cancel();
    return true;
  }

  /** "Try now" during a usage-limit pause. */
  resume(): void {
    this.guard.resume();
  }

  /** Resume of a turn whose claude process died: queued first, continues its session. */
  resumeTurn(turnId: string): ChatSendResult {
    const dir = this.options.currentProject();
    const key = dir === undefined ? undefined : projectKey(dir);
    const original =
      key === undefined
        ? undefined
        : this.transcripts.of(key).find((record) => record.turn.id === turnId);
    if (original === undefined || !original.turn.resumable) {
      const message = 'That turn cannot be resumed (only the last interrupted turn can).';
      return { status: 'error', error: { kind: 'invalid-request', message } };
    }
    this.update(original, { resumable: false });
    const turn = queuedTurn(randomUUID(), this.now(), original.turn.request);
    this.queue.unshift({ ...original, resumeOf: turnId, turn: { ...turn, resumeOf: turnId } });
    this.options.log.info(`queued resume of chat turn ${turnId}`);
    this.changed();
    this.pump();
    return { status: 'queued', turnId: turn.id };
  }

  /**
   * App quit: drops the queue, kills the running turn (its partial work is still committed) and
   * stops the limit timer.
   */
  async dispose(): Promise<void> {
    this.disposed = true;
    this.queue.length = 0;
    this.guard.dispose();
    await this.manager?.cancelAll();
    await this.manager?.whenIdle();
    await this.idle;
    if (this.pushTimer !== undefined) clearTimeout(this.pushTimer);
  }

  /** A chip: the review mode runs as a scene stage run, shown as a turn of this chat. */
  private async sendReview(
    dir: string,
    chip: ChatChip,
    reviews: ReviewTurns,
  ): Promise<ChatSendResult> {
    const model = chatTurnModel(this.options.settings(), false);
    const record: TurnRecord = {
      projectDir: dir,
      prompt: '',
      model,
      title: CHIP_LABELS[chip],
      turn: queuedTurn(randomUUID(), this.now(), reviewRequest(chip, model)),
    };
    this.transcripts.add(record);
    const started = await reviews.start(projectKey(dir), chip, {
      turn: () => record.turn,
      update: (patch) => {
        this.update(record, patch);
      },
      remove: () => {
        this.transcripts.remove(record);
        this.changed();
      },
    });
    if (started.status === 'error') {
      return {
        status: 'error',
        error: { kind: 'invalid-request', message: started.message ?? 'The review cannot start.' },
      };
    }
    return { status: 'queued', turnId: record.turn.id };
  }

  private now(): number {
    return this.options.now?.() ?? Date.now();
  }

  private pump(): void {
    if (this.disposed || this.current !== undefined || this.guard.paused) return;
    const record = this.queue.shift();
    if (record === undefined) return;
    const current: Current = { record, handle: undefined, stopRequested: false };
    this.current = current;
    this.idle = this.run(current)
      .catch((error: unknown) => {
        this.options.log.error(`chat turn ${record.turn.id} crashed: ${String(error)}`);
      })
      .finally(() => {
        this.current = undefined;
        this.changed();
        this.pump();
      });
  }

  private update(record: TurnRecord, patch: Partial<ChatTurn>): void {
    record.turn = { ...record.turn, ...patch };
    this.changed();
  }

  private async run(current: Current): Promise<void> {
    const { record } = current;
    this.transcripts.add(record);
    this.update(record, { status: 'running', startedAt: this.now() });
    const manager = await this.ensureManager();
    if (!manager.ok) {
      this.notice = manager.error;
      this.update(record, { status: 'failed', finishedAt: this.now(), error: manager.error });
      return;
    }
    this.notice = null;
    // A new turn in the session replaces the interrupted one the bridge could resume.
    for (const other of this.transcripts.of(projectKey(record.projectDir))) {
      if (other !== record && other.turn.resumable) this.update(other, { resumable: false });
    }
    const locks = await startChatLockGuard(record.projectDir);
    const started = await startChatTurn(manager.value, record, this.options.settings().economy);
    if ('error' in started) {
      this.update(record, { status: 'failed', finishedAt: this.now(), error: started.error });
      return;
    }
    const handle = started.handle;
    current.handle = handle;
    if (current.stopRequested) await handle.cancel();
    let view = initialTurnView();
    for await (const event of handle) {
      view = reduceTurn(view, event);
      this.update(record, { steps: toChatSteps(view, record.projectDir) });
    }
    const outcome = await handle.outcome;
    await this.finish(record, outcome, await locks.finish());
  }

  /** `lockNotes`: changes to locked shots that were discarded (shown as the turn's last steps). */
  private async finish(
    record: TurnRecord,
    outcome: TurnOutcome,
    lockNotes: readonly string[],
  ): Promise<void> {
    const status = turnStatusOf(outcome);
    const error = turnErrorOf(outcome);
    for (const note of lockNotes) this.options.log.warn(`chat turn ${record.turn.id}: ${note}`);
    this.update(record, {
      status,
      finishedAt: this.now(),
      steps: [...toChatSteps(outcome.view, record.projectDir), ...lockSteps(lockNotes)],
      usage: turnUsageOf(outcome),
      error,
      resumable: isResumableOutcome(outcome),
    });
    this.options.log.info(`chat turn ${record.turn.id}: ${outcome.status} (${outcome.message})`);
    const subject = commitSubject(status, record.title);
    const committed = await this.options.commit(record.projectDir, subject);
    if (!committed.ok) {
      this.options.log.warn(`autocommit after chat turn failed: ${committed.error.message}`);
      this.update(record, {
        error: error ?? { kind: 'commit', message: `could not save: ${committed.error.message}` },
      });
    } else if (committed.value.status === 'committed') {
      this.update(record, { commit: { hash: committed.value.hash, subject } });
    }
    if (outcome.failure === 'limit') this.requeue(record);
  }

  /** A turn cut off by the usage limit runs again (first in line) once the pause ends. */
  private requeue(record: TurnRecord): void {
    const turn = queuedTurn(randomUUID(), this.now(), record.turn.request);
    this.queue.unshift({ ...record, turn });
    this.changed();
  }

  private ensureManager(): Promise<Result<SessionManager, ChatError>> {
    if (this.manager !== undefined) return Promise.resolve(ok(this.manager));
    this.setupRun ??= this.options.setup().then((setup) => {
      const created = setup.ok
        ? createSessionManager(setup.value, {
            guard: this.guard,
            usage: this.usage,
            concurrency: this.concurrency,
            renderEnv: this.options.renderEnv,
            exitGraceMs: this.options.exitGraceMs,
          })
        : setup;
      if (created.ok) this.manager = created.value;
      else this.setupRun = undefined;
      return created;
    });
    return this.setupRun;
  }

  /** Coalesced pushes: a stream of events becomes at most one push per `pushDelayMs`. */
  private changed(): void {
    if (this.pushTimer !== undefined || this.disposed) return;
    this.pushTimer = setTimeout(() => {
      this.pushTimer = undefined;
      this.options.push(this.state());
    }, this.options.pushDelayMs ?? 50);
  }
}
