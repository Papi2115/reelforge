/**
 * How stages talk to Claude: one turn at a time through `ClaudeRunner`. Production uses
 * `BridgeClaudeRunner` over the app's claude-bridge `SessionManager` (sanitized env, stage
 * permissions, render-service env hook, limit guard, usage ledger are all configured there); tests
 * run the same class against tools/fake-claude. Never an API key, never the SDK (CLAUDE.md §3.1).
 */
import {
  usageOfOutcome,
  type LimitSignal,
  type ModelAlias,
  type SessionManager,
  type Stage,
  type StreamEvent,
  type TurnOutcome,
} from '@reelforge/claude-bridge';
import type { SessionPurpose, UsageTotals } from '@reelforge/shared';

export interface ClaudeTurnSpec {
  /** Becomes the child's cwd (the project's CLAUDE.md is picked up from there). */
  readonly projectDir: string;
  /** Bridge stage: tool permissions + usage bucket. */
  readonly stage: Stage;
  /** Session per project + purpose (`script` side session, `main` for the rest). */
  readonly purpose: SessionPurpose;
  readonly prompt: string;
  readonly model: ModelAlias;
  readonly newSession: boolean;
  readonly appendSystemPrompt?: string | undefined;
}

/**
 * `limit`: usage limit hit (the turn may be retried after the reset). `blocked`: the environment
 * is broken (not logged in, CLI missing, billing guard) — retrying will not help.
 */
export type ClaudeTurnStatus = 'completed' | 'limit' | 'cancelled' | 'blocked' | 'failed';

export interface ClaudeTurnResult {
  readonly status: ClaudeTurnStatus;
  /** Final assistant text. */
  readonly reply: string;
  readonly sessionId: string | undefined;
  readonly message: string;
  readonly usage: UsageTotals | undefined;
  readonly limit: LimitSignal | undefined;
}

export interface ClaudeTurnOptions {
  readonly signal?: AbortSignal | undefined;
  readonly onEvent?: ((event: StreamEvent) => void) | undefined;
}

export interface ClaudeRunner {
  run(spec: ClaudeTurnSpec, options?: ClaudeTurnOptions): Promise<ClaudeTurnResult>;
}

export function turnStatusOf(outcome: TurnOutcome): ClaudeTurnStatus {
  if (outcome.status === 'completed') return 'completed';
  if (outcome.status === 'cancelled') return 'cancelled';
  if (outcome.failure === 'limit') return 'limit';
  if (
    outcome.status === 'billing-guard' ||
    outcome.status === 'spawn-failed' ||
    outcome.failure === 'auth'
  ) {
    return 'blocked';
  }
  return 'failed';
}

export function turnResultOf(outcome: TurnOutcome): ClaudeTurnResult {
  const reached = outcome.view.sessionId !== undefined;
  return {
    status: turnStatusOf(outcome),
    reply: outcome.result?.text ?? '',
    sessionId: outcome.sessionId,
    message: outcome.message,
    usage: reached ? usageOfOutcome(outcome) : undefined,
    limit: outcome.limit,
  };
}

/** ClaudeRunner over a SessionManager; aborting the signal kills the turn's process tree. */
export class BridgeClaudeRunner implements ClaudeRunner {
  constructor(private readonly manager: SessionManager) {}

  async run(spec: ClaudeTurnSpec, options: ClaudeTurnOptions = {}): Promise<ClaudeTurnResult> {
    const handle = this.manager.enqueue({
      projectDir: spec.projectDir,
      stage: spec.stage,
      purpose: spec.purpose,
      prompt: spec.prompt,
      model: spec.model,
      newSession: spec.newSession,
      ...(spec.appendSystemPrompt === undefined
        ? {}
        : { appendSystemPrompt: spec.appendSystemPrompt }),
    });
    const { signal } = options;
    const cancel = (): void => {
      void handle.cancel();
    };
    if (signal?.aborted === true) cancel();
    signal?.addEventListener('abort', cancel, { once: true });
    try {
      for await (const event of handle) options.onEvent?.(event);
      return turnResultOf(await handle.outcome);
    } finally {
      signal?.removeEventListener('abort', cancel);
    }
  }
}
