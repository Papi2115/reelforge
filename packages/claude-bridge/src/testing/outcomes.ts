/** Test support: hand-made TurnOutcomes for units that only consume outcomes. Not exported. */
import { initialTurnView, type FinalSummary } from '../steps.js';
import type { TurnOutcome } from '../turn.js';

export function fakeOutcome(fields: Partial<TurnOutcome> = {}): TurnOutcome {
  return {
    status: 'completed',
    sessionId: 'session-1',
    result: undefined,
    view: { ...initialTurnView(), sessionId: fields.sessionId ?? 'session-1' },
    failure: undefined,
    limit: undefined,
    exitCode: 0,
    stderrTail: '',
    message: 'ok',
    rawStream: [],
    ...fields,
  };
}

/** A completed outcome whose `view.final` carries usage numbers. */
export function outcomeWithUsage(
  final: Partial<FinalSummary>,
  fields: Partial<TurnOutcome> = {},
): TurnOutcome {
  const base = fakeOutcome(fields);
  return {
    ...base,
    view: {
      ...base.view,
      final: {
        isError: false,
        text: 'ok',
        numTurns: 1,
        durationMs: 0,
        terminalReason: 'completed',
        costUsd: 0,
        usage: undefined,
        models: {},
        ...final,
      },
    },
  };
}
