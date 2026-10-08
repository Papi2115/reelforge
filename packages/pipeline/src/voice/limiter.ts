/**
 * In-flight request limit per ElevenLabs plan (docs/spikes/elevenlabs-api.md §1: Free 2,
 * Starter 3, Creator 5, Pro 10, Scale/Business 15). Unknown tiers get the safe minimum.
 */

export const DEFAULT_CONCURRENCY = 2;

const TIER_CONCURRENCY: readonly (readonly [prefix: string, limit: number])[] = [
  ['free', 2],
  ['trial', 2],
  ['starter', 3],
  ['creator', 5],
  ['pro', 10],
  ['scale', 15],
  ['growing_business', 15],
  ['business', 15],
  ['enterprise', 15],
];

/** Concurrency of a subscription tier (`scale_2024_08_10` matches `scale`). */
export function concurrencyForTier(tier: string): number {
  const lower = tier.toLowerCase();
  const match = TIER_CONCURRENCY.find(
    ([prefix]) => lower === prefix || lower.startsWith(`${prefix}_`),
  );
  return match?.[1] ?? DEFAULT_CONCURRENCY;
}

/** FIFO counting semaphore: at most `max` tasks run at once. */
export class ConcurrencyLimiter {
  #max: number;
  #active = 0;
  readonly #waiting: (() => void)[] = [];

  constructor(max: number = DEFAULT_CONCURRENCY) {
    this.#max = ConcurrencyLimiter.#checked(max);
  }

  static #checked(max: number): number {
    if (!Number.isInteger(max) || max < 1) {
      throw new RangeError(`concurrency must be a positive integer, got ${String(max)}`);
    }
    return max;
  }

  get max(): number {
    return this.#max;
  }

  get active(): number {
    return this.#active;
  }

  /** Changes the limit (e.g. after reading the tier); waiting tasks start if room appeared. */
  setMax(max: number): void {
    this.#max = ConcurrencyLimiter.#checked(max);
    this.#drain();
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    await this.#acquire();
    try {
      return await task();
    } finally {
      this.#active -= 1;
      this.#drain();
    }
  }

  #acquire(): Promise<void> {
    if (this.#active < this.#max) {
      this.#active += 1;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.#waiting.push(() => {
        this.#active += 1;
        resolve();
      });
    });
  }

  #drain(): void {
    while (this.#active < this.#max) {
      const next = this.#waiting.shift();
      if (next === undefined) return;
      next();
    }
  }
}
