/**
 * How the idle line waits: until the earliest deadline (clock timer) or a wake-up (poke, a queue
 * change, the guard resuming, stop). A wake-up that arrives while the line is busy is kept, so
 * the next wait returns at once instead of missing it.
 */
import type { Clock } from '@reelforge/claude-bridge';

export class Waker {
  private wakeUp: (() => void) | undefined;
  private pending = false;

  constructor(private readonly clock: Clock) {}

  sleep(deadlines: readonly (number | undefined)[]): Promise<void> {
    if (this.pending) {
      this.pending = false;
      return Promise.resolve();
    }
    const known = deadlines.filter((value): value is number => value !== undefined);
    return new Promise((resolve) => {
      let cancel: (() => void) | undefined;
      const done = (): void => {
        cancel?.();
        this.wakeUp = undefined;
        resolve();
      };
      this.wakeUp = done;
      if (known.length > 0) {
        cancel = this.clock.setTimer(done, Math.max(0, Math.min(...known) - this.clock.now()));
      }
    });
  }

  wake(): void {
    if (this.wakeUp !== undefined) this.wakeUp();
    else this.pending = true;
  }
}
