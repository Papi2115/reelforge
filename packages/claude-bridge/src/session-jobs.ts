/**
 * The queue entries of SessionManager (session-manager.ts) and small helpers around them: the
 * final statuses, the default continuation prompt of an interrupted turn, a cancelled outcome.
 */
import type { PendingTurn, SessionRecord } from '@reelforge/shared';
import type { ModelAlias } from './args.js';
import type { AsyncChannel } from './channel.js';
import type { StreamEvent } from './events.js';
import { STAGES, type Stage, type TurnRef, type TurnRequest } from './session-types.js';
import { initialTurnView } from './steps.js';
import type { RunningTurn, TurnOutcome } from './turn.js';

export interface Job extends TurnRef {
  readonly request: TurnRequest;
  readonly key: string;
  readonly model: ModelAlias;
  readonly channel: AsyncChannel<StreamEvent>;
  readonly settle: (outcome: TurnOutcome) => void;
  readonly done: Promise<void>;
  readonly release: () => void;
  running: RunningTurn | undefined;
  cancelled: boolean;
  /** Outcome delivered (the process may still be exiting). */
  finished: boolean;
}

/** Statuses after which nothing is left to resume. */
export const FINAL_STATUSES = new Set<TurnOutcome['status']>([
  'completed',
  'cancelled',
  'billing-guard',
]);

export function isStage(value: string): value is Stage {
  return (STAGES as readonly string[]).includes(value);
}

export function defaultContinuation(pending: PendingTurn): string {
  return `The previous turn was interrupted (${pending.reason ?? 'unknown reason'}). Check the current state of the project files, then continue and finish the original task:\n\n${pending.prompt}`;
}

export function cancelledOutcome(): TurnOutcome {
  return {
    status: 'cancelled',
    sessionId: undefined,
    result: undefined,
    view: initialTurnView(),
    failure: undefined,
    limit: undefined,
    exitCode: null,
    stderrTail: '',
    message: 'turn cancelled before it started',
    rawStream: [],
  };
}

/** Read through a call: `cancel()` flips the flag while `run()` awaits (no stale narrowing). */
export function isCancelled(job: Job): boolean {
  return job.cancelled;
}

export function withoutSessionId(record: SessionRecord | undefined): SessionRecord | undefined {
  if (record === undefined) return undefined;
  const copy = { ...record };
  delete copy.sessionId;
  return copy;
}
