/**
 * `line.json` of the production line, kept in memory and on disk: the usage-limit pause (the
 * line's own after a `limit` outcome, or a copy of the guard's so it survives a restart) and the
 * channel served last (round-robin).
 */
import type { Clock } from '@reelforge/claude-bridge';
import { emptyLineState, type LineState as LineFile } from '@reelforge/shared';
import type { QueueStore } from './store.js';
import type { QueueNotification, UsageLimitState } from './types.js';

const RESUMED = 'The usage limit has reset; the line goes on.';

function withoutPause(state: LineFile): LineFile {
  const next = { ...state };
  delete next.limitPause;
  return next;
}

export class LineBook {
  private state: LineFile = emptyLineState();

  constructor(
    private readonly store: QueueStore,
    private readonly clock: Clock,
    private readonly backoffMs: number,
    private readonly notify: (notification: QueueNotification) => void,
  ) {}

  get lastChannelId(): string | undefined {
    return this.state.lastChannelId;
  }

  async load(): Promise<void> {
    const read = await this.store.readLine();
    this.state = read.ok ? read.value : emptyLineState();
    if (!read.ok) this.notify({ kind: 'failed', message: `line.json: ${read.error.message}` });
  }

  async serve(channelId: string): Promise<void> {
    if (this.state.lastChannelId === channelId) return;
    await this.write((line) => ({ ...line, lastChannelId: channelId }));
  }

  /** The line's own pause while it lasts; an expired one is dropped (and announced). */
  async ownPause(now: number): Promise<UsageLimitState | undefined> {
    const own = this.state.limitPause;
    if (own === undefined) return undefined;
    const until =
      own.until === undefined ? Date.parse(own.since) + this.backoffMs : Date.parse(own.until);
    if (until > now) return { until, message: own.message };
    await this.write(withoutPause);
    this.notify({ kind: 'line-resumed', message: RESUMED });
    return undefined;
  }

  /** A `limit` outcome without a guard pause: wait until the reported reset, else a backoff. */
  async pauseUntil(until: number | undefined, message: string): Promise<void> {
    const resume = until ?? this.clock.now() + this.backoffMs;
    const stamp = new Date(resume).toISOString();
    await this.write((line) => ({
      ...line,
      limitPause: { since: new Date(this.clock.now()).toISOString(), until: stamp, message },
    }));
    this.notify({ kind: 'line-paused', message: `Usage limit: the line waits until ${stamp}.` });
  }

  /** The guard paused (persisted so a restart keeps waiting) or resumed. */
  async guardChanged(state: UsageLimitState | undefined): Promise<void> {
    if (state === undefined) {
      await this.write(withoutPause);
      this.notify({ kind: 'line-resumed', message: RESUMED });
      return;
    }
    const until = state.until === undefined ? undefined : new Date(state.until).toISOString();
    await this.write((line) => ({
      ...line,
      limitPause: {
        since: line.limitPause?.since ?? new Date(this.clock.now()).toISOString(),
        ...(until === undefined ? {} : { until }),
        ...(state.message === undefined ? {} : { message: state.message }),
      },
    }));
    this.notify({ kind: 'line-paused', message: state.message ?? 'Claude usage limit reached.' });
  }

  private async write(mutate: (state: LineFile) => LineFile): Promise<void> {
    this.state = mutate(this.state);
    const written = await this.store.updateLine(mutate);
    if (written.ok) this.state = written.value;
    else this.notify({ kind: 'failed', message: `line.json: ${written.error.message}` });
  }
}
