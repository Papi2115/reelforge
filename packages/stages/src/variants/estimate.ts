/**
 * Cost transparency before generating variants (PLAN.md#11.3): "≈ 3 Opus turns, about 2–4 min",
 * from the project's usage ledger averages (scene-build and critic turns), with defaults before
 * the first scene was built. Low end: every variant passes QA at once; high end: one fix each.
 */
import type { UsageFile, UsageTotals } from '@reelforge/shared';

/** Assumed turn lengths without history (seconds). */
export const DEFAULT_BUILD_TURN_S = 150;
export const DEFAULT_CRITIC_TURN_S = 20;

export interface VariantEstimate {
  /** Scene-build turns (one per variant, without fixes). */
  readonly turns: number;
  /** Model alias of those turns (`opus`, `sonnet`). */
  readonly model: string;
  readonly minMinutes: number;
  readonly maxMinutes: number;
  /** Average build turn the estimate used (s) and whether it came from the ledger. */
  readonly buildTurnS: number;
  readonly fromHistory: boolean;
  readonly text: string;
}

function averageSeconds(totals: readonly UsageTotals[]): number | undefined {
  const turns = totals.reduce((sum, entry) => sum + entry.turns - entry.failedTurns, 0);
  const ms = totals.reduce((sum, entry) => sum + entry.durationMs, 0);
  return turns > 0 && ms > 0 ? ms / turns / 1000 : undefined;
}

/** Average completed turn of a bridge stage (that model first, else any model). */
export function averageTurnSeconds(
  usage: UsageFile | undefined,
  stage: string,
  model?: string,
): number | undefined {
  const byModel = usage?.stages[stage];
  if (byModel === undefined) return undefined;
  const exact = model === undefined ? undefined : byModel[model];
  return (
    (exact === undefined ? undefined : averageSeconds([exact])) ??
    averageSeconds(Object.values(byModel))
  );
}

function modelName(model: string): string {
  return model === '' ? model : `${model.charAt(0).toUpperCase()}${model.slice(1)}`;
}

export interface EstimateInput {
  readonly count: number;
  /** Variants built at once (scene concurrency capped by the LimitGuard). */
  readonly concurrency: number;
  readonly model: string;
  readonly usage: UsageFile | undefined;
}

export function estimateVariants(input: EstimateInput): VariantEstimate {
  const count = Math.max(1, Math.floor(input.count));
  const history = averageTurnSeconds(input.usage, 'scene-build', input.model);
  const build = history ?? DEFAULT_BUILD_TURN_S;
  const critic = averageTurnSeconds(input.usage, 'critic') ?? DEFAULT_CRITIC_TURN_S;
  const waves = Math.ceil(count / Math.max(1, Math.floor(input.concurrency)));
  const minMinutes = Math.max(1, Math.round((waves * (build + critic)) / 60));
  const maxMinutes = Math.max(minMinutes + 1, Math.ceil((waves * 2 * (build + critic)) / 60));
  const turns = `${String(count)} ${modelName(input.model)} ${count === 1 ? 'turn' : 'turns'}`;
  return {
    turns: count,
    model: input.model,
    minMinutes,
    maxMinutes,
    buildTurnS: Math.round(build),
    fromHistory: history !== undefined,
    text: `≈ ${turns}, about ${String(minMinutes)}–${String(maxMinutes)} min`,
  };
}
