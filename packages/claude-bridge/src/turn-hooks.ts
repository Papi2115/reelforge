/**
 * What happens after every finished turn (before its outcome is delivered): the limit guard sees
 * it first (so nothing new starts once a limit hit), then usage is booked, failed turns are dumped
 * to `.reelforge/debug`, and tool calls are audited against the stage policy.
 */
import { dumpFailedTurn } from './debug-dump.js';
import type { StreamEvent } from './events.js';
import type { LimitGuard } from './limit-guard.js';
import { auditToolUses, type ToolPolicy } from './permissions.js';
import type { TurnLifecycleBody } from './session-types.js';
import type { TurnOutcome } from './turn.js';
import type { UsageLedger } from './usage-ledger.js';

export interface AfterTurnContext {
  readonly projectDir: string;
  readonly turnId: string;
  readonly stage: string;
  readonly model: string;
  readonly outcome: TurnOutcome;
  /** Tool-use / tool-result / permission-denied / result events of the turn. */
  readonly toolEvents: readonly StreamEvent[];
  readonly policy: ToolPolicy | undefined;
  readonly guard: LimitGuard | undefined;
  readonly usage: UsageLedger | undefined;
  readonly debugDumps: boolean;
  readonly now: Date;
  readonly emit: (body: TurnLifecycleBody) => void;
}

const DUMPED_STATUSES = new Set<TurnOutcome['status']>(['failed', 'crashed']);

/** Turns that never reached the CLI/model are not booked. */
function reachedClaude(outcome: TurnOutcome): boolean {
  return outcome.status !== 'spawn-failed' && outcome.view.sessionId !== undefined;
}

/** Events worth keeping for the policy audit (small; text/thinking are dropped). */
export function isAuditEvent(event: StreamEvent): boolean {
  return (
    event.kind === 'tool-use' ||
    event.kind === 'tool-result' ||
    event.kind === 'permission-denied' ||
    event.kind === 'result'
  );
}

export async function afterTurn(context: AfterTurnContext): Promise<void> {
  const { outcome, emit } = context;
  context.guard?.observe(outcome);
  if (context.usage !== undefined && reachedClaude(outcome)) {
    const recorded = await context.usage.record(context.projectDir, {
      stage: context.stage,
      model: context.model,
      outcome,
    });
    if (!recorded.ok) {
      emit({
        type: 'warning',
        message: `usage.json ${recorded.error.kind}: ${recorded.error.message}`,
      });
    }
  }
  if (context.debugDumps && DUMPED_STATUSES.has(outcome.status)) {
    const dumped = await dumpFailedTurn(context.projectDir, context, context.now);
    if (dumped.ok) emit({ type: 'debug-dump', path: dumped.value.stream });
    else emit({ type: 'warning', message: `debug dump failed: ${dumped.error.message}` });
  }
  if (context.policy !== undefined) {
    const violations = auditToolUses(context.policy, context.toolEvents).filter(
      (violation) => !violation.blockedByCli,
    );
    if (violations.length > 0) emit({ type: 'policy-violation', violations });
  }
}
