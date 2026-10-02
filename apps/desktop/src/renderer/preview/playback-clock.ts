/**
 * Master clock of the player (PLAN.md#6.4). While playing with project audio, the `<audio>`
 * element IS the clock: the picture follows `currentTime`, so it can never drift from the sound.
 * Without (usable) audio, or past the end of a shorter audio file, a monotonic system clock
 * (`performance.now`, app code only, never in scenes) runs at the playback rate instead.
 * DOM-free: the media element and the time source are injected, so the logic is unit-tested.
 */

/** The part of HTMLMediaElement the clock drives. */
export interface ClockMedia {
  currentTime: number;
  playbackRate: number;
  preservesPitch: boolean;
  readonly duration: number;
  readonly readyState: number;
  play(): Promise<void>;
  pause(): void;
}

export type ClockSource = 'audio' | 'system';

/** HTMLMediaElement.HAVE_METADATA */
const HAVE_METADATA = 1;
/** Audio positions this close to its end count as "ended". */
const END_EPSILON = 1e-3;

function usable(media: ClockMedia | undefined): media is ClockMedia {
  return (
    media !== undefined &&
    media.readyState >= HAVE_METADATA &&
    Number.isFinite(media.duration) &&
    media.duration > 0
  );
}

/** True for the rejection of a `play()` that a later `pause()` interrupted (not a failure). */
export function isInterruptedPlay(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

export class PlaybackClock {
  private playing = false;
  /** Paused: the time. System clock: the time at `anchorMs`. */
  private position = 0;
  private anchorMs: number;
  private rate = 1;
  private media: ClockMedia | undefined;
  /** Playing, and the media element is the master. */
  private following = false;

  /**
   * @param now monotonic milliseconds
   * @param onMediaError called when audio playback fails; the clock continues on the system clock
   */
  constructor(
    private readonly now: () => number,
    private readonly onMediaError: (error: unknown) => void,
  ) {
    this.anchorMs = now();
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  get playbackRate(): number {
    return this.rate;
  }

  /** What drives the time right now. */
  get source(): ClockSource {
    if (this.playing) return this.following ? 'audio' : 'system';
    return usable(this.media) ? 'audio' : 'system';
  }

  /** Current time in seconds (not clamped to the video). */
  time(): number {
    if (!this.playing) return this.position;
    const media = this.media;
    if (this.following && media) {
      const t = media.currentTime;
      if (t < media.duration - END_EPSILON) return t;
      // The audio ran out before the video: continue on the system clock.
      this.following = false;
      this.reanchor(media.duration);
      return media.duration;
    }
    return this.position + ((this.now() - this.anchorMs) / 1000) * this.rate;
  }

  play(): void {
    if (this.playing) return;
    this.reanchor(this.position);
    this.playing = true;
    this.startMedia();
  }

  pause(): void {
    if (!this.playing) return;
    this.reanchor(this.time());
    this.playing = false;
    this.following = false;
    this.media?.pause();
  }

  seek(t: number): void {
    this.reanchor(t);
    const media = this.media;
    if (!usable(media)) return;
    if (t < media.duration - END_EPSILON) {
      media.currentTime = t;
      if (this.playing && !this.following) this.startMedia();
    } else if (this.following) {
      media.pause();
      this.following = false;
    }
  }

  setRate(rate: number): void {
    this.reanchor(this.time());
    this.rate = rate;
    if (this.media) {
      this.media.playbackRate = rate;
      this.media.preservesPitch = true;
    }
  }

  /** Switches the master audio (undefined: system clock only), keeping time and play state. */
  attachMedia(media: ClockMedia | undefined): void {
    const t = this.time();
    if (this.following) this.media?.pause();
    this.following = false;
    this.media = media;
    this.reanchor(t);
    if (media) {
      media.playbackRate = this.rate;
      media.preservesPitch = true;
    }
    if (this.playing) this.startMedia();
  }

  /** The media element loaded its metadata: follow it from now on if playing. */
  mediaReady(): void {
    if (!this.playing || this.following) return;
    this.reanchor(this.time());
    this.startMedia();
  }

  private reanchor(position: number): void {
    this.position = position;
    this.anchorMs = this.now();
  }

  private startMedia(): void {
    const media = this.media;
    if (!usable(media) || this.position >= media.duration - END_EPSILON) {
      this.following = false;
      return;
    }
    media.currentTime = this.position;
    media.playbackRate = this.rate;
    this.following = true;
    media.play().catch((error: unknown) => {
      this.mediaFailed(media, error);
    });
  }

  private mediaFailed(media: ClockMedia, error: unknown): void {
    // Paused or switched meanwhile: the rejection belongs to a play() that no longer matters.
    if (!this.following || this.media !== media || isInterruptedPlay(error)) return;
    this.following = false;
    this.reanchor(media.currentTime);
    this.onMediaError(error);
  }
}
