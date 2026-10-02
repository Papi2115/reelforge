/** Test support: a Clock whose time only moves when the test says so. Not exported from index. */
import type { Clock } from '../clock.js';

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

  /** Pending timer count (to assert that a resume is scheduled). */
  get pending(): number {
    return this.timers.length;
  }

  /** Moves time forward, firing due timers in order (timers they arm fire too if due). */
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
