/**
 * Health of the player's master audio (PLAN.md#11.1): turns the `<audio>` element's `error`,
 * `waiting` / `stalled` (without progress for STALL_TIMEOUT_MS) and `ended` events into calls the
 * Player acts on (one reload, then a visible warning), instead of the preview silently going on
 * on the system clock. DOM-free: the element and the timers are injected.
 */
import type { PlayerEnvironment } from './player.js';

export type MediaEvent = 'loadedmetadata' | 'error' | 'waiting' | 'stalled' | 'playing' | 'ended';

/** The parts of HTMLMediaElement the watch reads. */
export interface WatchedMedia {
  readonly currentTime: number;
  readonly paused: boolean;
  readonly error: { readonly message: string } | null;
  addEventListener(type: MediaEvent, listener: () => void): void;
  removeEventListener(type: MediaEvent, listener: () => void): void;
}

/** A waiting/stalled audio whose time did not move for this long counts as failed. */
export const STALL_TIMEOUT_MS = 6000;

export interface MediaWatchHandlers {
  /** The audio cannot play: `reason` is for the user. */
  failed(reason: string): void;
  /** The audio reached its end at `t` seconds. */
  ended(t: number): void;
}

export class MediaWatch {
  private stallTimer: number | undefined;
  private readonly onError = (): void => {
    this.clearStall();
    const message = this.media.error?.message ?? '';
    this.handlers.failed(message === '' ? 'the audio file cannot be played' : message);
  };
  private readonly onStarving = (): void => {
    if (this.stallTimer !== undefined || this.media.paused) return;
    const since = this.media.currentTime;
    this.stallTimer = this.env.setTimer(() => {
      this.stallTimer = undefined;
      if (this.media.paused || this.media.currentTime !== since) return;
      this.handlers.failed(`no audio data for ${String(STALL_TIMEOUT_MS / 1000)} s`);
    }, STALL_TIMEOUT_MS);
  };
  private readonly onPlaying = (): void => {
    this.clearStall();
  };
  private readonly onEnded = (): void => {
    this.clearStall();
    this.handlers.ended(this.media.currentTime);
  };

  constructor(
    private readonly media: WatchedMedia,
    private readonly env: Pick<PlayerEnvironment, 'setTimer' | 'clearTimer'>,
    private readonly handlers: MediaWatchHandlers,
  ) {
    media.addEventListener('error', this.onError);
    media.addEventListener('waiting', this.onStarving);
    media.addEventListener('stalled', this.onStarving);
    media.addEventListener('playing', this.onPlaying);
    media.addEventListener('ended', this.onEnded);
  }

  dispose(): void {
    this.clearStall();
    this.media.removeEventListener('error', this.onError);
    this.media.removeEventListener('waiting', this.onStarving);
    this.media.removeEventListener('stalled', this.onStarving);
    this.media.removeEventListener('playing', this.onPlaying);
    this.media.removeEventListener('ended', this.onEnded);
  }

  private clearStall(): void {
    if (this.stallTimer === undefined) return;
    this.env.clearTimer(this.stallTimer);
    this.stallTimer = undefined;
  }
}
