/**
 * Cost estimate before generating (PLAN.md#13.14): characters x model multiplier vs the quota
 * left on the account. The multiplier defaults are UNVERIFIED (docs/voice.md) and are replaced by
 * a calibrated value as soon as one real request reported its `character-cost` header.
 */
import { voiceModelSpec } from './models.js';

export interface QuotaSnapshot {
  readonly characterCount: number;
  readonly characterLimit: number;
  readonly nextResetUnix: number | null;
}

/** Multipliers measured per model id (`character-cost` / characters sent). */
export type CostCalibration = Readonly<Record<string, number>>;

export interface CostEstimate {
  readonly characters: number;
  readonly multiplier: number;
  readonly multiplierSource: 'default' | 'calibrated';
  /** Rounded up: what the generation is expected to take from the quota. */
  readonly estimatedCredits: number;
  /** Null when the quota is unknown. */
  readonly remaining: number | null;
  /** estimatedCredits / remaining (0..∞); null when the quota is unknown or 0. */
  readonly shareOfRemaining: number | null;
  readonly exceedsRemaining: boolean;
  /** "about 5,200 characters (12% of your remaining 43,000)". */
  readonly summary: string;
  /** Set when the generation would not fit in the quota left. */
  readonly warning: string | null;
}

/** 12345 -> "12,345" (fixed format, independent of the OS locale). */
export function formatCount(value: number): string {
  const [whole = '0', fraction] = String(Math.round(value * 100) / 100).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fraction === undefined ? grouped : `${grouped}.${fraction}`;
}

function formatShare(share: number): string {
  if (share > 0 && share < 0.01) return '<1%';
  return `${String(Math.round(share * 100))}%`;
}

/** Unix seconds -> `YYYY-MM-DD` (UTC). */
function formatResetDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

/** Calibrated multiplier from one response, or null when the header was missing/useless. */
export function measuredMultiplier(
  characters: number,
  characterCost: number | null,
): number | null {
  if (characterCost === null || characters <= 0) return null;
  return characterCost / characters;
}

/**
 * Folds measured requests into a calibration: the multiplier of a model becomes the ratio of all
 * its reported costs to all its characters (requests without the header are ignored).
 */
export function calibrateCosts(
  samples: readonly {
    readonly modelId: string;
    readonly characters: number;
    readonly characterCost: number | null;
  }[],
): CostCalibration {
  const totals = new Map<string, { characters: number; cost: number }>();
  for (const sample of samples) {
    if (sample.characterCost === null || sample.characters <= 0) continue;
    const total = totals.get(sample.modelId) ?? { characters: 0, cost: 0 };
    total.characters += sample.characters;
    total.cost += sample.characterCost;
    totals.set(sample.modelId, total);
  }
  return Object.fromEntries(
    [...totals].map(([modelId, total]) => [modelId, total.cost / total.characters]),
  );
}

export function estimateCost(input: {
  readonly characters: number;
  readonly modelId: string;
  readonly quota: QuotaSnapshot | null;
  readonly calibration?: CostCalibration;
}): CostEstimate {
  const calibrated = input.calibration?.[input.modelId];
  const multiplier = calibrated ?? voiceModelSpec(input.modelId).costMultiplier;
  const estimatedCredits = Math.ceil(input.characters * multiplier);
  const remaining =
    input.quota === null
      ? null
      : Math.max(0, input.quota.characterLimit - input.quota.characterCount);
  const shareOfRemaining =
    remaining === null || remaining === 0 ? null : estimatedCredits / remaining;
  const exceedsRemaining = remaining !== null && estimatedCredits > remaining;
  const amount = `about ${formatCount(estimatedCredits)} characters`;
  const summary =
    remaining === null
      ? `${amount} (quota unknown)`
      : shareOfRemaining === null
        ? `${amount} (nothing left on the account)`
        : `${amount} (${formatShare(shareOfRemaining)} of your remaining ${formatCount(remaining)})`;
  const reset =
    input.quota?.nextResetUnix === null || input.quota?.nextResetUnix === undefined
      ? ''
      : `; the quota resets on ${formatResetDate(input.quota.nextResetUnix)}`;
  const warning = exceedsRemaining
    ? `This needs ${formatCount(estimatedCredits)} characters but only ${formatCount(remaining)} are left${reset}.`
    : null;
  return {
    characters: input.characters,
    multiplier,
    multiplierSource: calibrated === undefined ? 'default' : 'calibrated',
    estimatedCredits,
    remaining,
    shareOfRemaining,
    exceedsRemaining,
    summary,
    warning,
  };
}
