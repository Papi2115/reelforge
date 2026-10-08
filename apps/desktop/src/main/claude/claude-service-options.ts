/** Options of ClaudeService (claude-service.ts) and what the bridge needs to run `claude`. */
import type {
  ClaudeLauncher,
  Clock,
  ExtraEnv,
  Result,
  StagePermissionOptions,
} from '@reelforge/claude-bridge';
import type { CommitResult, ProjectError } from '@reelforge/project';
import type { AppSettings } from '@reelforge/shared';
import type { ChatError, ChatState } from '../../shared/chat-contract.js';
import type { Logger } from '../logger.js';
import type { ReviewTurnsOptions } from './review-turns.js';

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
