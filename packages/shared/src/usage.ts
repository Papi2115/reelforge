/**
 * `<project>/.reelforge/usage.json`: usage ledger per stage and model (PLAN.md#5.4). Token counts
 * and durations come from the CLI's `result` event; `costUsd` is the CLI's list-price estimate
 * (a relative meter on a subscription, not a bill). Written atomically by claude-bridge.
 */
import { z } from 'zod';

export const USAGE_FILE_VERSION = 1;

export const usageTotalsSchema = z.object({
  turns: z.int().nonnegative(),
  failedTurns: z.int().nonnegative(),
  limitHits: z.int().nonnegative(),
  inputTokens: z.int().nonnegative(),
  outputTokens: z.int().nonnegative(),
  cacheReadInputTokens: z.int().nonnegative(),
  cacheCreationInputTokens: z.int().nonnegative(),
  costUsd: z.number().nonnegative(),
  durationMs: z.number().nonnegative(),
});
export type UsageTotals = z.infer<typeof usageTotalsSchema>;

/** A soft-budget threshold that was crossed (each percent is reported once). */
export const budgetWarningRecordSchema = z.object({
  percent: z.int().positive(),
  costUsd: z.number().nonnegative(),
  budgetUsd: z.number().positive(),
  at: z.iso.datetime(),
});
export type BudgetWarningRecord = z.infer<typeof budgetWarningRecordSchema>;

export const usageFileSchema = z.object({
  version: z.literal(USAGE_FILE_VERSION),
  updatedAt: z.iso.datetime(),
  totals: usageTotalsSchema,
  /** stage -> model alias -> totals. */
  stages: z.record(z.string(), z.record(z.string(), usageTotalsSchema)),
  budgetWarnings: z.array(budgetWarningRecordSchema),
});
export type UsageFile = z.infer<typeof usageFileSchema>;

export function emptyUsageTotals(): UsageTotals {
  return {
    turns: 0,
    failedTurns: 0,
    limitHits: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadInputTokens: 0,
    cacheCreationInputTokens: 0,
    costUsd: 0,
    durationMs: 0,
  };
}

export function addUsageTotals(a: UsageTotals, b: UsageTotals): UsageTotals {
  return {
    turns: a.turns + b.turns,
    failedTurns: a.failedTurns + b.failedTurns,
    limitHits: a.limitHits + b.limitHits,
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadInputTokens: a.cacheReadInputTokens + b.cacheReadInputTokens,
    cacheCreationInputTokens: a.cacheCreationInputTokens + b.cacheCreationInputTokens,
    costUsd: a.costUsd + b.costUsd,
    durationMs: a.durationMs + b.durationMs,
  };
}
