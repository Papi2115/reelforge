/**
 * Per-turn usage of resumed sessions. The CLI's `total_cost_usd` and `modelUsage` add up the
 * whole session across `--resume` (only the top-level `usage` is per turn; seen in the first real
 * run, PLAN.md#10.4, and in the recorded `resume-2-recall` fixture), so a resumed turn would book
 * every earlier turn again. The session manager keeps the last reported totals per session
 * (`usageSnapshot` in sessions.json) and hands consumers an outcome with only this turn's share.
 */
import type { UsageSnapshot } from '@reelforge/shared';
import type { ModelUsage } from './events.js';
import type { TurnOutcome } from './turn.js';

function sessionOf(outcome: TurnOutcome): string | undefined {
  return outcome.sessionId ?? outcome.view.sessionId;
}

/**
 * The session totals the CLI reported with this outcome (undefined without a result). A report
 * below `previous` of the same session (an error result reports 0) keeps `previous`.
 */
export function usageSnapshotOf(
  outcome: TurnOutcome,
  previous: UsageSnapshot | undefined,
): UsageSnapshot | undefined {
  const final = outcome.view.final;
  const sessionId = sessionOf(outcome);
  if (final === undefined || sessionId === undefined) return previous;
  if (previous?.sessionId === sessionId && final.costUsd < previous.costUsd) return previous;
  const models: UsageSnapshot['models'] = {};
  for (const [name, usage] of Object.entries(final.models)) {
    models[name] = {
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cacheCreationInputTokens: usage.cacheCreationInputTokens,
      cacheReadInputTokens: usage.cacheReadInputTokens,
      costUsd: usage.costUsd,
    };
  }
  return { sessionId, costUsd: final.costUsd, models };
}

const less = (value: number, earlier: number): number => Math.max(0, value - earlier);

/** `outcome` with the session totals of `baseline` (the same session's earlier turns) taken out. */
export function withoutEarlierTurns(
  outcome: TurnOutcome,
  baseline: UsageSnapshot | undefined,
): TurnOutcome {
  const final = outcome.view.final;
  if (baseline === undefined || final === undefined || baseline.sessionId !== sessionOf(outcome)) {
    return outcome;
  }
  const models: Record<string, ModelUsage> = {};
  for (const [name, usage] of Object.entries(final.models)) {
    const before = baseline.models[name];
    models[name] =
      before === undefined
        ? usage
        : {
            ...usage,
            inputTokens: less(usage.inputTokens, before.inputTokens),
            outputTokens: less(usage.outputTokens, before.outputTokens),
            cacheCreationInputTokens: less(
              usage.cacheCreationInputTokens,
              before.cacheCreationInputTokens,
            ),
            cacheReadInputTokens: less(usage.cacheReadInputTokens, before.cacheReadInputTokens),
            costUsd: less(usage.costUsd, before.costUsd),
          };
  }
  const costUsd = less(final.costUsd, baseline.costUsd);
  return { ...outcome, view: { ...outcome.view, final: { ...final, costUsd, models } } };
}
