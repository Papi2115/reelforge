/** Test support: a LimitGuard clock whose time only moves when the test advances it. */
import type { Clock } from '@reelforge/claude-bridge';

interface PendingTimer {
  readonly id: number;
  readonly at: number;
  readonly callback: () => void;
}

export class ManualClock implements Clock {
  private current: number;
  private timers: PendingTimer[] = [];
  private nextId = 0;

  constructor(startMs: number) {
    this.current = startMs;
  }

  now(): number {
    return this.current;
  }

  setTimer(callback: () => void, delayMs: number): () => void {
    this.nextId += 1;
    const id = this.nextId;
    this.timers.push({ id, at: this.current + Math.max(0, delayMs), callback });
    return () => {
      this.timers = this.timers.filter((timer) => timer.id !== id);
    };
  }

  /** Moves time forward, firing due timers in order. */
  advance(ms: number): void {
    const target = this.current + ms;
    for (;;) {
      const due = this.timers
        .filter((timer) => timer.at <= target)
        .sort((a, b) => a.at - b.at || a.id - b.id)[0];
      if (due === undefined) break;
      this.timers = this.timers.filter((timer) => timer.id !== due.id);
      this.current = Math.max(this.current, due.at);
      due.callback();
    }
    this.current = target;
  }
}
