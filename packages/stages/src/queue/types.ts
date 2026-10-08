/**
 * Contracts of the production line (PLAN.md#13.9, ADR-034): what the QueueRunner needs injected
 * (project factory, step executor, clock, usage-limit signal, notifications) and what it emits.
 * Everything Electron-free; the desktop app wires IPC and UI on top.
 */
import type { Result } from '@reelforge/claude-bridge';
import type { ProductionQueue, QueueItem, QueueStep } from '@reelforge/shared';
import type { StageEvent } from '../types.js';

/** How one step ended. */
export type QueueStepOutcome =
  | {
      readonly kind: 'done';
      readonly message?: string | undefined;
      readonly warnings?: readonly string[] | undefined;
    }
  /** The step does not apply to this film (e.g. no asset research, no publish kit). */
  | { readonly kind: 'skipped'; readonly message: string }
  /** Blocked on the user (script approval, voice-over, asset review): "Needs you". */
  | { readonly kind: 'waiting'; readonly message: string }
  /** Claude usage limit: the whole line pauses until `until` (epoch ms; unknown = backoff). */
  | { readonly kind: 'limit'; readonly message: string; readonly until?: number | undefined }
  /** Claude cannot run at all (not logged in, CLI missing, billing guard): the line stops. */
  | { readonly kind: 'blocked'; readonly message: string }
  | { readonly kind: 'failed'; readonly message: string }
  /** Aborted (app closing, line stopped, item removed): the step runs again later. */
  | { readonly kind: 'cancelled' };

export type QueueStepOutcomeKind = QueueStepOutcome['kind'];

/** Steps the executor runs (the runner makes the project itself through the factory). */
export type ExecutorStep = Exclude<QueueStep, 'project'>;

export interface QueueStepContext {
  readonly channelId: string;
  /** The item as it was when the step started. */
  readonly item: QueueItem;
  readonly projectDir: string;
  readonly autoApproveScript: boolean;
  /** The item's target length, else the queue's default. */
  readonly targetMinutes: number;
  readonly signal: AbortSignal;
  /** Progress of the underlying pipeline stage (forwarded to the UI). */
  stageEvent(event: StageEvent): void;
  /** Progress of a step that is not a pipeline stage (brief, voice, export, publish kit). */
  progress(label: string, percent?: number): void;
}

/**
 * Runs one step of one film. Contract: a closed gate (`approval`, `voiceover` without a voice
 * provider, `assets` waiting for review) answers `waiting` quickly and without side effects — the
 * runner re-asks waiting items whenever something may have changed.
 */
export interface QueueStepExecutor {
  run(step: ExecutorStep, ctx: QueueStepContext): Promise<QueueStepOutcome>;
  /** Records the user's approval of the script (same pipeline.json gate the app uses). */
  approveScript(projectDir: string): Promise<Result<void, string>>;
}

export interface QueueProjectRequest {
  readonly channelId: string;
  readonly item: QueueItem;
  readonly targetMinutes: number;
  readonly signal: AbortSignal;
}

export interface QueueProjectFactory {
  /** Creates the film's project (or finds the one an interrupted run already made). */
  create(request: QueueProjectRequest): Promise<Result<{ readonly projectPath: string }, string>>;
}

export interface VoiceRequest {
  readonly projectDir: string;
  readonly channelId: string;
  readonly signal: AbortSignal;
}

export interface GeneratedVoice {
  /** Absolute audio file (wav, mp3, m4a, ogg, flac) the Voiceover stage imports. */
  readonly file: string;
  readonly warnings?: readonly string[] | undefined;
}

export interface VoiceError {
  readonly kind: 'cancelled' | 'failed';
  readonly message: string;
}

/** A channel's voice generator (13.14, implemented in a later packet). */
export interface VoiceProvider {
  generate(project: VoiceRequest): Promise<Result<GeneratedVoice, VoiceError>>;
}

export interface UsageLimitState {
  /** Epoch ms of the automatic resume; undefined = unknown / manual. */
  readonly until: number | undefined;
  readonly message: string | undefined;
}

/** The account-wide usage-limit state (adapter over the bridge's LimitGuard: `limitSignalFromGuard`). */
export interface UsageLimitSignal {
  /** Undefined = Claude may run. */
  current(): UsageLimitState | undefined;
  /** Called on every pause/resume; returns the unsubscribe function. */
  subscribe(listener: (state: UsageLimitState | undefined) => void): () => void;
}

export type QueueNotificationKind =
  | 'needs-approval'
  | 'needs-voice'
  | 'needs-review'
  | 'failed'
  | 'done'
  | 'line-paused'
  | 'line-resumed'
  | 'line-blocked'
  | 'line-idle';

export interface QueueNotification {
  readonly kind: QueueNotificationKind;
  readonly message: string;
  readonly channelId?: string | undefined;
  readonly itemId?: string | undefined;
  readonly topic?: string | undefined;
}

/** Desktop notifications / tray / log (the runner calls it on transitions only). */
export interface QueueNotifier {
  notify(notification: QueueNotification): void;
}

/** `idle`: stop when nothing can progress; `time`: start no step after `at` (epoch ms). */
export type RunUntil = { readonly kind: 'idle' } | { readonly kind: 'time'; readonly at: number };

/** Local wall-clock window ("HH:MM", may cross midnight) in which no step starts. */
export interface QuietHours {
  readonly start: string;
  readonly end: string;
}

export type LineActivity = 'running' | 'waiting' | 'limit' | 'quiet' | 'stopped';

export interface LineStatus {
  readonly state: LineActivity;
  /** Epoch ms the line waits for (limit reset, end of quiet hours, next poll). */
  readonly until?: number | undefined;
  readonly message?: string | undefined;
  /** The step running now. */
  readonly current?:
    { readonly channelId: string; readonly itemId: string; readonly step: QueueStep } | undefined;
}

/** Why a run of the line ended. */
export type LineEnd = 'idle' | 'time' | 'stopped' | 'blocked';

export interface StepEvent {
  readonly channelId: string;
  readonly itemId: string;
  readonly step: QueueStep;
  readonly phase: 'started' | 'finished';
  readonly outcome?: QueueStepOutcome | undefined;
}

export interface QueueRunnerEvents {
  /** A queue file changed (by the line or by the user). */
  queue: [ProductionQueue];
  step: [StepEvent];
  /** Pipeline stage progress of the running step. */
  stage: [{ readonly channelId: string; readonly itemId: string; readonly event: StageEvent }];
  /** Progress line of a step that is not a pipeline stage. */
  progress: [
    {
      readonly channelId: string;
      readonly itemId: string;
      readonly step: QueueStep;
      readonly label: string;
      readonly percent: number | undefined;
    },
  ];
  line: [LineStatus];
}
