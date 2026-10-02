/**
 * Usage ledger (PLAN.md#5.4): `<project>/.reelforge/usage.json` with totals per stage and model
 * (turns, failures, limit hits, tokens, list-price cost, API duration). Soft budget: crossing a
 * threshold emits a `budget` warning once (persisted); nothing is ever stopped because of it.
 */
import { EventEmitter } from 'node:events';
import path from 'node:path';
import {
  USAGE_FILE_VERSION,
  addUsageTotals,
  emptyUsageTotals,
  usageFileSchema,
  type BudgetWarningRecord,
  type UsageFile,
  type UsageTotals,
} from '@reelforge/shared';
import { JsonFileStore, type JsonFileError } from './json-file.js';
import { err, ok, type Result } from './result.js';
import type { TurnOutcome } from './turn.js';

export const USAGE_FILE = path.join('.reelforge', 'usage.json');
export const DEFAULT_BUDGET_WARN_PERCENTS: readonly number[] = [50, 80, 100];

export function usageFilePath(projectDir: string): string {
  return path.join(projectDir, USAGE_FILE);
}

/** Per-project soft budget in list-price USD (the CLI's `total_cost_usd` meter). */
export interface UsageBudget {
  readonly costUsd: number;
  /** Default 50, 80, 100. */
  readonly warnAtPercents?: readonly number[];
}

export interface BudgetWarning extends BudgetWarningRecord {
  readonly projectDir: string;
}

export interface UsageLedgerOptions {
  readonly budgetFor?: (projectDir: string) => UsageBudget | undefined;
  readonly now?: () => Date;
}

export interface UsageEntry {
  readonly stage: string;
  readonly model: string;
  readonly outcome: TurnOutcome;
}

export interface RecordedUsage {
  readonly file: UsageFile;
  readonly warnings: readonly BudgetWarning[];
}

/** What one turn adds. Tokens: per-model `modelUsage` sum (subagents included), else `usage`. */
export function usageOfOutcome(outcome: TurnOutcome): UsageTotals {
  const final = outcome.view.final;
  const models = Object.values(final?.models ?? {});
  const tokens = models.length > 0 ? models : final?.usage === undefined ? [] : [final.usage];
  const sum = (pick: (usage: (typeof tokens)[number]) => number): number =>
    tokens.reduce((total, usage) => total + pick(usage), 0);
  return {
    turns: 1,
    failedTurns: outcome.status === 'completed' ? 0 : 1,
    limitHits: outcome.failure === 'limit' ? 1 : 0,
    inputTokens: sum((usage) => usage.inputTokens),
    outputTokens: sum((usage) => usage.outputTokens),
    cacheReadInputTokens: sum((usage) => usage.cacheReadInputTokens),
    cacheCreationInputTokens: sum((usage) => usage.cacheCreationInputTokens),
    costUsd: final?.costUsd ?? 0,
    durationMs: final?.durationMs ?? 0,
  };
}

export class UsageLedger extends EventEmitter<{ budget: [BudgetWarning] }> {
  private readonly store: JsonFileStore<UsageFile>;
  private readonly now: () => Date;

  constructor(private readonly options: UsageLedgerOptions = {}) {
    super();
    this.now = options.now ?? (() => new Date());
    this.store = new JsonFileStore(usageFileSchema, () => this.emptyFile());
  }

  read(projectDir: string): Promise<Result<UsageFile, JsonFileError>> {
    return this.store.read(usageFilePath(projectDir));
  }

  /** Adds one turn; returns the new file and the budget thresholds crossed by it. */
  async record(
    projectDir: string,
    entry: UsageEntry,
  ): Promise<Result<RecordedUsage, JsonFileError>> {
    const delta = usageOfOutcome(entry.outcome);
    const budget = this.options.budgetFor?.(projectDir);
    let crossed: BudgetWarningRecord[] = [];
    const updated = await this.store.update(usageFilePath(projectDir), (current) => {
      const stage = current.stages[entry.stage] ?? {};
      const totals = addUsageTotals(current.totals, delta);
      crossed = this.crossedThresholds(current, totals, budget);
      return {
        version: USAGE_FILE_VERSION,
        updatedAt: this.now().toISOString(),
        totals,
        stages: {
          ...current.stages,
          [entry.stage]: {
            ...stage,
            [entry.model]: addUsageTotals(stage[entry.model] ?? emptyUsageTotals(), delta),
          },
        },
        budgetWarnings: [...current.budgetWarnings, ...crossed],
      };
    });
    if (!updated.ok) return err(updated.error);
    const warnings = crossed.map((warning) => ({ ...warning, projectDir }));
    for (const warning of warnings) this.emit('budget', warning);
    return ok({ file: updated.value, warnings });
  }

  private crossedThresholds(
    current: UsageFile,
    totals: UsageTotals,
    budget: UsageBudget | undefined,
  ): BudgetWarningRecord[] {
    if (budget === undefined || budget.costUsd <= 0) return [];
    const warned = new Set(current.budgetWarnings.map((warning) => warning.percent));
    const used = (totals.costUsd / budget.costUsd) * 100;
    return [...(budget.warnAtPercents ?? DEFAULT_BUDGET_WARN_PERCENTS)]
      .filter((percent) => Number.isInteger(percent) && percent > 0)
      .filter((percent) => used >= percent && !warned.has(percent))
      .sort((a, b) => a - b)
      .map((percent) => ({
        percent,
        costUsd: totals.costUsd,
        budgetUsd: budget.costUsd,
        at: this.now().toISOString(),
      }));
  }

  private emptyFile(): UsageFile {
    return {
      version: USAGE_FILE_VERSION,
      updatedAt: this.now().toISOString(),
      totals: emptyUsageTotals(),
      stages: {},
      budgetWarnings: [],
    };
  }
}
