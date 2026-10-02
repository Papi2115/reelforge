/**
 * The preview player (PLAN.md#6.4): play/pause, seek, frame steps, scrub with short audio
 * snippets, 0.5x-2x, loop and mute. Every animation frame reads the master clock and asks the
 * engine for the video frame at that time; requests are "latest wins" (PreviewController), so a
 * slow frame is dropped instead of letting the picture drift from the sound.
 * DOM-free: timers, the frame callback and the media element are injected (player.test.ts).
 */
import { FrameStats, frameIndexAt, type FrameStatsSnapshot } from './frame-stats.js';
import {
  isInterruptedPlay,
  PlaybackClock,
  type ClockMedia,
  type ClockSource,
} from './playback-clock.js';
import type { TransportAction } from './transport-keys.js';

export const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
/** Length of the audio heard per scrub step while paused. */
export const SCRUB_SNIPPET_MS = 100;
/** At most one scrub snippet per this many milliseconds. */
export const SCRUB_SNIPPET_INTERVAL_MS = 120;

export interface PlayerEnvironment {
  /** Monotonic milliseconds. */
  now(): number;
  requestFrame(callback: () => void): number;
  cancelFrame(handle: number): void;
  setTimer(callback: () => void, ms: number): number;
  clearTimer(handle: number): void;
}

export type MediaEvent = 'loadedmetadata' | 'error';

export interface PlayerMedia extends ClockMedia {
  muted: boolean;
  addEventListener(type: MediaEvent, listener: () => void): void;
  removeEventListener(type: MediaEvent, listener: () => void): void;
}

/** Where frames are requested (PreviewController). */
export interface SeekTarget {
  requestSeek(t: number): void;
}

export interface PlayerState {
  readonly time: number;
  readonly playing: boolean;
  readonly rate: number;
  readonly loop: boolean;
  readonly muted: boolean;
  readonly duration: number;
  readonly fps: number;
  readonly clock: ClockSource;
}

const INITIAL_STATE: PlayerState = {
  time: 0,
  playing: false,
  rate: 1,
  loop: false,
  muted: false,
  duration: 0,
  fps: 30,
  clock: 'system',
};

export class Player {
  private readonly clock: PlaybackClock;
  private readonly stats = new FrameStats();
  private readonly listeners = new Set<() => void>();
  private state: PlayerState = INITIAL_STATE;
  private target: SeekTarget | undefined;
  private media: PlayerMedia | undefined;
  private frameHandle: number | undefined;
  /** Frame index last requested while playing. */
  private lastIndex: number | undefined;
  private snippetTimer: number | undefined;
  private lastSnippetAt = Number.NEGATIVE_INFINITY;
  private readonly onMediaReady = (): void => {
    this.clock.mediaReady();
    this.publish({});
  };
  private readonly onMediaFailed = (): void => {
    this.reportMediaError(new Error('the audio file cannot be played'));
    this.attachMedia(undefined);
  };

  constructor(
    private readonly env: PlayerEnvironment,
    private readonly reportMediaError: (error: unknown) => void,
  ) {
    this.clock = new PlaybackClock(() => env.now(), reportMediaError);
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  readonly getState = (): PlayerState => this.state;

  attachTarget(target: SeekTarget | undefined): void {
    this.target = target;
  }

  /** Master audio (undefined: system clock). Time and play state are kept. */
  attachMedia(media: PlayerMedia | undefined): void {
    this.media?.removeEventListener('loadedmetadata', this.onMediaReady);
    this.media?.removeEventListener('error', this.onMediaFailed);
    this.stopSnippet();
    this.media = media;
    if (media) {
      media.muted = this.state.muted;
      media.addEventListener('loadedmetadata', this.onMediaReady);
      media.addEventListener('error', this.onMediaFailed);
    }
    this.clock.attachMedia(media);
    this.publish({});
  }

  /** A video was loaded: its duration and frame rate. */
  setVideo(duration: number, fps: number): void {
    const time = Math.min(this.state.time, duration);
    if (time !== this.state.time) this.clock.seek(time);
    this.publish({ duration, fps, time });
  }

  play(): void {
    const { duration, fps } = this.state;
    if (this.clock.isPlaying || duration <= 0) return;
    // At the end: play again from the start.
    if (this.state.time >= duration - 0.5 / fps) this.clock.seek(0);
    this.stopSnippet();
    this.clock.play();
    this.stats.breakContinuity();
    this.lastIndex = undefined;
    this.publish({ playing: true, time: this.clock.time() });
    this.schedule();
  }

  /** Pauses on the frame on screen, so the shown frame and the time agree. */
  pause(): void {
    if (!this.clock.isPlaying) return;
    this.clock.pause();
    this.cancelTick();
    const t = this.clampedFrameTime(this.clock.time());
    this.clock.seek(t);
    this.publish({ playing: false, time: t });
    this.target?.requestSeek(t);
  }

  toggle(): void {
    if (this.clock.isPlaying) this.pause();
    else this.play();
  }

  /** Jumps to t (clamped to the video); playback continues if it was running. */
  seek(t: number): void {
    const time = this.clamp(t);
    this.clock.seek(time);
    this.stats.breakContinuity();
    this.lastIndex = this.clock.isPlaying ? frameIndexAt(time, this.state.fps) : undefined;
    this.publish({ time });
    this.target?.requestSeek(time);
  }

  /** Seek while dragging a playhead: while paused, plays a short, rate-limited audio snippet. */
  scrub(t: number): void {
    this.seek(t);
    if (!this.clock.isPlaying) this.playSnippet();
  }

  /** Pauses, then moves by whole frames. */
  step(frames: number): void {
    this.pause();
    const { fps } = this.state;
    this.seek((Math.round(this.state.time * fps) + frames) / fps);
  }

  jump(seconds: number): void {
    this.seek(this.state.time + seconds);
  }

  setRate(rate: number): void {
    this.clock.setRate(rate);
    this.publish({ rate });
  }

  /** One step down/up the PLAYBACK_RATES ladder. */
  shiftRate(direction: -1 | 1): void {
    const index = PLAYBACK_RATES.findIndex((rate) => rate >= this.state.rate);
    const current = index === -1 ? PLAYBACK_RATES.length - 1 : index;
    const next =
      PLAYBACK_RATES[Math.min(Math.max(current + direction, 0), PLAYBACK_RATES.length - 1)];
    if (next !== undefined) this.setRate(next);
  }

  setLoop(loop: boolean): void {
    this.publish({ loop });
  }

  setMuted(muted: boolean): void {
    if (this.media) this.media.muted = muted;
    this.publish({ muted });
  }

  /** Runs a keyboard shortcut (transport-keys.ts). */
  perform(action: TransportAction): void {
    switch (action.kind) {
      case 'toggle':
        this.toggle();
        return;
      case 'step':
        this.step(action.frames);
        return;
      case 'jump':
        this.jump(action.seconds);
        return;
      case 'start':
        this.seek(0);
        return;
      case 'end':
        this.seek(this.state.duration);
        return;
      case 'slower':
        this.shiftRate(-1);
        return;
      case 'pause':
        this.pause();
        return;
      case 'faster':
        if (this.clock.isPlaying) this.shiftRate(1);
        else this.play();
        return;
      case 'mute':
        this.setMuted(!this.state.muted);
        return;
    }
  }

  /** Requests the current frame again (after the engine reloaded a shot or the video). */
  redraw(): void {
    this.target?.requestSeek(this.state.time);
  }

  /** Called by the canvas sink for every drawn frame. */
  frameDrawn(t: number, renderMs: number): void {
    this.stats.noteDrawn(t, this.state.fps, this.env.now(), renderMs, this.clock.isPlaying);
  }

  frameStats(): FrameStatsSnapshot {
    return this.stats.snapshot(this.env.now());
  }

  resetFrameStats(): void {
    this.stats.resetDropped();
  }

  /** Stops playback and timers (component unmount). */
  stop(): void {
    this.pause();
    this.cancelTick();
    this.stopSnippet();
  }

  private readonly tick = (): void => {
    this.frameHandle = undefined;
    if (!this.clock.isPlaying) return;
    const { duration, fps, loop } = this.state;
    let t = this.clock.time();
    if (t >= duration) {
      if (!loop) {
        this.clock.pause();
        this.clock.seek(duration);
        this.publish({ playing: false, time: duration });
        this.target?.requestSeek(duration);
        return;
      }
      this.clock.seek(0);
      this.stats.breakContinuity();
      t = 0;
    }
    const index = frameIndexAt(t, fps);
    if (index !== this.lastIndex) {
      this.lastIndex = index;
      const frameTime = index / fps;
      this.target?.requestSeek(frameTime);
      this.publish({ time: frameTime });
    }
    this.schedule();
  };

  private schedule(): void {
    this.frameHandle ??= this.env.requestFrame(this.tick);
  }

  private cancelTick(): void {
    if (this.frameHandle !== undefined) this.env.cancelFrame(this.frameHandle);
    this.frameHandle = undefined;
  }

  private playSnippet(): void {
    const media = this.media;
    const now = this.env.now();
    if (!media || this.clock.source !== 'audio' || this.state.muted) return;
    if (now - this.lastSnippetAt < SCRUB_SNIPPET_INTERVAL_MS) return;
    this.lastSnippetAt = now;
    // clock.seek() has already moved the audio to the scrub position.
    media.play().catch((error: unknown) => {
      if (!isInterruptedPlay(error)) this.reportMediaError(error);
    });
    if (this.snippetTimer !== undefined) this.env.clearTimer(this.snippetTimer);
    this.snippetTimer = this.env.setTimer(() => {
      this.snippetTimer = undefined;
      if (!this.clock.isPlaying) media.pause();
    }, SCRUB_SNIPPET_MS);
  }

  private stopSnippet(): void {
    if (this.snippetTimer === undefined) return;
    this.env.clearTimer(this.snippetTimer);
    this.snippetTimer = undefined;
    if (!this.clock.isPlaying) this.media?.pause();
  }

  private clamp(t: number): number {
    return Math.min(Math.max(Number.isFinite(t) ? t : 0, 0), this.state.duration);
  }

  private clampedFrameTime(t: number): number {
    const { fps } = this.state;
    return this.clamp(frameIndexAt(this.clamp(t), fps) / fps);
  }

  private publish(patch: Partial<PlayerState>): void {
    this.state = {
      ...this.state,
      ...patch,
      playing: this.clock.isPlaying,
      clock: this.clock.source,
    };
    for (const listener of this.listeners) listener();
  }
}
