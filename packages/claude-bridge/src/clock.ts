/** Injectable time source + timers (the limit guard waits hours; tests drive a manual clock). */

export interface Clock {
  /** Epoch milliseconds. */
  now(): number;
  /** Calls `callback` after `delayMs`; returns a cancel function. */
  setTimer(callback: () => void, delayMs: number): () => void;
}

export const systemClock: Clock = {
  now: () => Date.now(),
  setTimer: (callback, delayMs) => {
    const timer = setTimeout(callback, delayMs);
    return () => {
      clearTimeout(timer);
    };
  },
};

/** Node timers overflow above 2^31-1 ms (~24.8 days): long waits are re-armed in chunks. */
export const MAX_TIMER_MS = 2_147_483_647;
