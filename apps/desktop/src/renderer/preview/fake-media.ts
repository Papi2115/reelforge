/**
 * Test doubles of the player's environment: a manual clock / frame / timer environment and a fake
 * `<audio>` element whose playhead advances with that clock. Used by the player unit tests only.
 */
import type { MediaEvent } from './media-watch.js';
import type { PlayerEnvironment, PlayerMedia } from './player.js';

export class ManualEnvironment implements PlayerEnvironment {
  ms = 0;
  private nextHandle = 1;
  readonly frames = new Map<number, () => void>();
  readonly timers = new Map<number, { callback: () => void; at: number }>();

  now(): number {
    return this.ms;
  }
  requestFrame(callback: () => void): number {
    const handle = this.nextHandle++;
    this.frames.set(handle, callback);
    return handle;
  }
  cancelFrame(handle: number): void {
    this.frames.delete(handle);
  }
  setTimer(callback: () => void, ms: number): number {
    const handle = this.nextHandle++;
    this.timers.set(handle, { callback, at: this.ms + ms });
    return handle;
  }
  clearTimer(handle: number): void {
    this.timers.delete(handle);
  }

  /** Advances time by `ms`, firing due timers, then runs one animation frame. */
  advance(ms: number, media?: FakeMedia): void {
    this.ms += ms;
    media?.advance(ms);
    for (const [handle, timer] of [...this.timers]) {
      if (timer.at <= this.ms) {
        this.timers.delete(handle);
        timer.callback();
      }
    }
    const frames = [...this.frames.values()];
    this.frames.clear();
    for (const frame of frames) frame();
  }
}

export class FakeMedia implements PlayerMedia {
  currentTime = 0;
  playbackRate = 1;
  preservesPitch = false;
  muted = false;
  paused = true;
  readyState = 4;
  error: { readonly message: string } | null = null;
  loads = 0;
  readonly plays: number[] = [];
  private readonly listeners = new Map<MediaEvent, Set<() => void>>();
  /** Set to make the next play() reject with this error. */
  rejectNext: Error | undefined;

  constructor(public duration: number) {}

  play(): Promise<void> {
    this.plays.push(this.currentTime);
    if (this.rejectNext) {
      const error = this.rejectNext;
      this.rejectNext = undefined;
      return Promise.reject(error);
    }
    this.paused = false;
    return Promise.resolve();
  }
  pause(): void {
    this.paused = true;
  }
  /** Like HTMLMediaElement.load(): back to no data, paused, at 0 (emit 'loadedmetadata' next). */
  load(): void {
    this.loads += 1;
    this.error = null;
    this.paused = true;
    this.currentTime = 0;
    this.readyState = 0;
  }
  /** The reloaded source has its metadata again. */
  loaded(): void {
    this.readyState = 4;
    this.emit('loadedmetadata');
  }
  addEventListener(type: MediaEvent, listener: () => void): void {
    const set = this.listeners.get(type) ?? new Set();
    set.add(listener);
    this.listeners.set(type, set);
  }
  removeEventListener(type: MediaEvent, listener: () => void): void {
    this.listeners.get(type)?.delete(listener);
  }
  emit(type: MediaEvent): void {
    for (const listener of this.listeners.get(type) ?? []) listener();
  }
  advance(ms: number): void {
    if (this.paused) return;
    this.currentTime = Math.min(this.currentTime + (ms / 1000) * this.playbackRate, this.duration);
    if (this.currentTime >= this.duration) {
      this.paused = true;
      this.emit('ended');
    }
  }
}
