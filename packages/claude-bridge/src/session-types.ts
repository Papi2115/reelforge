/** Public types of the SessionManager: stages, models per stage, requests, lifecycle events. */
import type { PendingTurn, SessionPurpose } from '@reelforge/shared';
import type { ExtraEnv } from './env.js';
import type { ModelAlias, PermissionMode } from './args.js';
import type { StreamEvent } from './events.js';
import type { LimitGuard } from './limit-guard.js';
import type { StagePermissionOptions, ToolViolation } from './permissions.js';
import type { ClaudeLauncher } from './process.js';
import type { StoreError } from './session-store.js';
import type { FramePathsHook } from './steps.js';
import type { TurnOutcome } from './turn.js';
import type { UsageLedger } from './usage-ledger.js';

export const STAGES = [
  'script',
  'research',
  'storyboard',
  'scene-build',
  'scene-fix',
  'critic',
  'sound-cues',
  'chat',
] as const;
export type Stage = (typeof STAGES)[number];

/** PLAN.md §2.2 defaults; overridable per manager and per turn. */
export const DEFAULT_STAGE_MODELS: Readonly<Record<Stage, ModelAlias>> = {
  script: 'sonnet',
  research: 'sonnet',
  storyboard: 'sonnet',
  'scene-build': 'opus',
  'scene-fix': 'opus',
  critic: 'haiku',
  'sound-cues': 'sonnet',
  chat: 'sonnet',
};

export interface SessionManagerOptions {
  readonly launcher: ClaudeLauncher;
  /** Parent env for children (sanitized on every spawn). Default `process.env`. */
  readonly env?: NodeJS.ProcessEnv;
  /**
   * Allowlisted app vars for the turn's child (EXTRA_ENV_ALLOWLIST: the render service URL and
   * token for the `reelforge` CLI), asked per turn so they follow the open project.
   */
  readonly extraEnv?: (projectDir: string) => ExtraEnv | undefined;
  /** Max concurrently running turns across all sessions. Default 1. */
  readonly concurrency?: number;
  readonly models?: Partial<Record<Stage, ModelAlias>>;
  /** Default 30 min. */
  readonly turnTimeoutMs?: number;
  /** Default 5 min without any stdout line. */
  readonly idleTimeoutMs?: number;
  readonly exitGraceMs?: number;
  readonly framePaths?: FramePathsHook;
  /** Prompt that continues an interrupted turn (default: a short English wrapper). */
  readonly continuationPrompt?: (pending: PendingTurn) => string;
  readonly now?: () => Date;
  /** Account-wide limit handling: no turn starts while paused; concurrency follows the guard. */
  readonly guard?: LimitGuard;
  /** Books every turn into `<project>/.reelforge/usage.json`. */
  readonly usage?: UsageLedger;
  /** Raw streams of failed/crashed turns -> `<project>/.reelforge/debug/`. Default true. */
  readonly debugDumps?: boolean;
  /** Economy mode (PLAN.md §2.2): every stage on Sonnet + a "keep it short" hint. */
  readonly economy?: boolean;
  /**
   * Per-stage tool permissions (PLAN.md#5.7; kit docs dir, bash guard runtime). Request fields
   * override them one by one. `false` = only what the request passes. Default: stage defaults.
   */
  readonly permissions?: StagePermissionOptions | false;
}

export interface TurnRequest {
  /** Project folder: becomes the child's cwd (project CLAUDE.md is picked up from there). */
  readonly projectDir: string;
  readonly stage: Stage;
  readonly prompt: string;
  /** Default `main`. */
  readonly purpose?: SessionPurpose;
  readonly model?: ModelAlias;
  /** Start a fresh session instead of resuming the stored one. */
  readonly newSession?: boolean;
  readonly appendSystemPrompt?: string;
  readonly tools?: readonly string[];
  readonly allowedTools?: readonly string[];
  readonly disallowedTools?: readonly string[];
  readonly permissionMode?: PermissionMode;
  readonly addDirs?: readonly string[];
  readonly timeoutMs?: number;
  readonly idleTimeoutMs?: number;
}

export interface TurnRef {
  readonly turnId: string;
  readonly projectDir: string;
  readonly purpose: SessionPurpose;
  readonly stage: Stage;
}

export type TurnLifecycleBody =
  | { readonly type: 'queued' }
  | {
      readonly type: 'started';
      readonly pid: number | undefined;
      readonly model: ModelAlias;
      readonly resumedSessionId: string | undefined;
    }
  | { readonly type: 'stream'; readonly event: StreamEvent }
  | { readonly type: 'finished'; readonly outcome: TurnOutcome }
  | { readonly type: 'warning'; readonly message: string }
  /** The stored session was gone (`--resume` failed); the turn re-ran in a new session. */
  | { readonly type: 'session-reset'; readonly missingSessionId: string }
  /** Raw stream of a failed turn written here (capture real limit streams as fixtures). */
  | { readonly type: 'debug-dump'; readonly path: string }
  /** Tool calls that broke the stage policy and were NOT blocked by the CLI. */
  | { readonly type: 'policy-violation'; readonly violations: readonly ToolViolation[] };

export type TurnLifecycleEvent = TurnRef & TurnLifecycleBody;

/** Stream of one turn (single consumer) + its outcome. */
export interface TurnHandle extends TurnRef, AsyncIterable<StreamEvent> {
  readonly outcome: Promise<TurnOutcome>;
  cancel(): Promise<void>;
}

export interface InterruptedTurn {
  readonly projectDir: string;
  readonly purpose: SessionPurpose;
  readonly sessionId: string | undefined;
  readonly pending: PendingTurn;
}

export type ResumeError =
  | { readonly kind: 'store'; readonly error: StoreError }
  | { readonly kind: 'nothing-to-resume' }
  | { readonly kind: 'still-running'; readonly turnId: string };
