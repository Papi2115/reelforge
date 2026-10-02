/**
 * How a finished bridge turn shows up in the chat (PLAN.md#6.6): turn status, typed error, usage
 * line and the subject of the autocommit that keeps what the turn changed. Pure.
 */
import {
  EXTRA_ENV_ALLOWLIST,
  usageOfOutcome,
  type ExtraEnv,
  type TurnOutcome,
} from '@reelforge/claude-bridge';
import type { ChatError, ChatTurn, ChatTurnStatus, ChatUsage } from '../../shared/chat-contract.js';

/** A fresh queued turn (also the retry of a turn cut off by a usage limit). */
export function queuedTurn(id: string, queuedAt: number, request: ChatTurn['request']): ChatTurn {
  return {
    id,
    request,
    status: 'queued',
    queuedAt,
    startedAt: null,
    finishedAt: null,
    steps: [],
    usage: null,
    error: null,
    commit: null,
    resumable: false,
    resumeOf: null,
  };
}

/** The process died mid-turn: its session can continue where it stopped (`--resume`). */
export function isResumableOutcome(outcome: TurnOutcome): boolean {
  return (
    outcome.status === 'crashed' ||
    outcome.status === 'timeout' ||
    outcome.status === 'idle-timeout'
  );
}

export function turnStatusOf(outcome: TurnOutcome): Exclude<ChatTurnStatus, 'queued' | 'running'> {
  if (outcome.status === 'completed') return 'done';
  if (outcome.status === 'cancelled') return 'stopped';
  return 'failed';
}

export function turnErrorOf(outcome: TurnOutcome): ChatError | null {
  const message = outcome.message;
  switch (outcome.status) {
    case 'completed':
    case 'cancelled':
      return null;
    case 'failed':
      if (outcome.failure === 'auth') {
        return { kind: 'auth', message: `Claude Code is not logged in: ${message}` };
      }
      if (outcome.failure === 'limit') {
        return { kind: 'limit', message: `usage limit reached: ${message}` };
      }
      return { kind: 'failed', message };
    case 'timeout':
    case 'idle-timeout':
      return { kind: 'timeout', message };
    case 'crashed':
      return { kind: 'crashed', message };
    case 'billing-guard':
      return { kind: 'billing-guard', message };
    case 'spawn-failed':
      return { kind: 'spawn', message };
  }
}

/** Tokens / list-price cost of the turn, when the CLI reported a final result. */
export function turnUsageOf(outcome: TurnOutcome): ChatUsage | null {
  if (outcome.view.final === undefined) return null;
  const usage = usageOfOutcome(outcome);
  return {
    inputTokens: usage.inputTokens + usage.cacheCreationInputTokens,
    outputTokens: usage.outputTokens,
    cacheReadTokens: usage.cacheReadInputTokens,
    costUsd: usage.costUsd,
    durationMs: usage.durationMs,
  };
}

/** `Claude turn: <request>` / `Claude turn (stopped): <request>` / `Claude turn (failed): …`. */
export function commitSubject(status: ChatTurnStatus, title: string): string {
  const label = status === 'done' ? 'Claude turn' : `Claude turn (${status})`;
  return title === '' ? label : `${label}: ${title}`;
}

/**
 * The app vars a chat turn's child may get: only the render service URL/token (the bridge's
 * EXTRA_ENV_ALLOWLIST). Everything else is dropped here and again by the bridge.
 */
export function chatExtraEnv(env: ExtraEnv | undefined): ExtraEnv | undefined {
  if (env === undefined) return undefined;
  const entries: [string, unknown][] = Object.entries(env);
  const allowed: Partial<Record<(typeof EXTRA_ENV_ALLOWLIST)[number], string>> = {};
  for (const name of EXTRA_ENV_ALLOWLIST) {
    const value = entries.find(([key]) => key === name)?.[1];
    if (typeof value === 'string') allowed[name] = value;
  }
  return Object.keys(allowed).length === 0 ? undefined : allowed;
}
