/**
 * Frame bookkeeping of the player (PLAN.md#6.4): the frame grid (playback shows frame
 * floor(t * fps), like the export) and the debug overlay numbers: achieved fps, dropped frames
 * (video frames skipped because the engine or the display could not keep up) and render time.
 */

/** Index of the video frame shown at time t (frames sit on multiples of 1/fps). */
export function frameIndexAt(t: number, fps: number): number {
  // The epsilon keeps exact frame times (e.g. 2.2 s at 30 fps) on their own frame.
  return Math.max(Math.floor(t * fps + 1e-6), 0);
}

export interface FrameStatsSnapshot {
  /** Frames drawn during the last second. */
  readonly fps: number;
  /** Video frames skipped during continuous playback since the last reset. */
  readonly dropped: number;
  /** Smoothed engine round trip (seek request -> frame back), milliseconds. */
  readonly renderMs: number;
  readonly drawn: number;
}

const WINDOW_MS = 1000;
const SMOOTHING = 0.2;

export class FrameStats {
  private readonly draws: number[] = [];
  private lastIndex: number | undefined;
  private dropped = 0;
  private drawn = 0;
  private renderMs = 0;

  /**
   * Records a drawn frame. `continuous` is true while playing: then a gap in frame indices since
   * the previous drawn frame counts as dropped frames.
   */
  noteDrawn(t: number, fps: number, nowMs: number, renderMs: number, continuous: boolean): void {
    const index = frameIndexAt(t, fps);
    if (continuous && this.lastIndex !== undefined && index > this.lastIndex + 1) {
      this.dropped += index - this.lastIndex - 1;
    }
    this.lastIndex = continuous ? index : undefined;
    this.drawn += 1;
    this.renderMs =
      this.drawn === 1 ? renderMs : this.renderMs + (renderMs - this.renderMs) * SMOOTHING;
    this.draws.push(nowMs);
    this.trim(nowMs);
  }

  /** A seek, loop or pause: the next frame does not continue the previous one. */
  breakContinuity(): void {
    this.lastIndex = undefined;
  }

  resetDropped(): void {
    this.dropped = 0;
  }

  snapshot(nowMs: number): FrameStatsSnapshot {
    this.trim(nowMs);
    return {
      fps: this.draws.length,
      dropped: this.dropped,
      renderMs: this.renderMs,
      drawn: this.drawn,
    };
  }

  private trim(nowMs: number): void {
    while (this.draws.length > 0 && (this.draws[0] ?? nowMs) <= nowMs - WINDOW_MS) {
      this.draws.shift();
    }
  }
}
