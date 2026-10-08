/**
 * The live line of the running step (what the Production line dialog shows under a film): fed by
 * the runner's step, stage and progress events, keyed `<channelId>/<itemId>`, cleared when the
 * step ends. `worked` hears of every step that did something (not a closed gate, not a cancel).
 * Also the debounce of the app's own decisions that may open a waiting film's gate.
 */
import type { QueueRunner } from '@reelforge/stages';
import type { LiveProgress } from '../../shared/queue-contract.js';
import { liveKey, stageLive } from './queue-views.js';

export interface LiveListeners {
  readonly changed: () => void;
  readonly worked: () => void;
}

export function bindLive(
  runner: QueueRunner,
  live: Map<string, LiveProgress>,
  listeners: LiveListeners,
): void {
  runner.on('line', listeners.changed);
  runner.on('step', (event) => {
    const key = liveKey(event.channelId, event.itemId);
    if (event.phase === 'started') {
      live.set(key, { label: 'Starting', percent: null });
    } else {
      live.delete(key);
      const kind = event.outcome?.kind;
      if (kind !== undefined && kind !== 'waiting' && kind !== 'cancelled') listeners.worked();
    }
    listeners.changed();
  });
  runner.on('stage', ({ channelId, itemId, event }) => {
    const next = stageLive(event);
    if (next === null) return;
    live.set(liveKey(channelId, itemId), next);
    listeners.changed();
  });
  runner.on('progress', ({ channelId, itemId, label, percent }) => {
    live.set(liveKey(channelId, itemId), { label, percent: percent ?? null });
    listeners.changed();
  });
}

/**
 * Decisions made in the app (an approval, an import, a saved key) come in bursts: they are
 * collected for `delayMs`, then `check` gets the touched project keys, or `any` when a change
 * could concern every film.
 */
export class OutsideChanges {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private readonly keys = new Set<string>();
  private any = false;

  constructor(
    private readonly delayMs: number,
    private readonly check: (keys: ReadonlySet<string> | 'any') => Promise<void>,
  ) {}

  /** `key`: a project key; undefined = anything may have changed. */
  note(key: string | undefined): void {
    if (key === undefined) this.any = true;
    else this.keys.add(key);
    if (this.timer !== undefined) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      const keys = this.any ? 'any' : new Set(this.keys);
      this.any = false;
      this.keys.clear();
      void this.check(keys);
    }, this.delayMs);
  }

  dispose(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
  }
}
