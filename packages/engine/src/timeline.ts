/**
 * Global time -> active shot(s) + local time. Pure functions, no rendering.
 *
 * Shots are contiguous: shot i covers [t0, t1). A transition into shot i starts at its t0 and
 * lasts `duration`; during it the previous shot keeps rendering past its own t1 ("overhang"),
 * so a shot's local time is always >= 0 and t = 0 is when it starts to appear.
 */
import type { Transition, TransitionFocus, TransitionType } from '@reelforge/shared';

export interface TimelineShot {
  readonly id: string;
  readonly t0: number;
  readonly t1: number;
  readonly transitionIn: Transition;
}

export interface Timeline {
  readonly shots: readonly TimelineShot[];
  readonly duration: number;
}

export interface ShotSample {
  /** Index into `Timeline.shots`. */
  readonly index: number;
  /** Local shot time in seconds (`t - shot.t0`). */
  readonly localTime: number;
}

export interface TimelineSample {
  /** Shot shown on top / at the end of the transition (the incoming one). */
  readonly current: ShotSample;
  /** Present only while a non-cut transition is running: the outgoing shot. */
  readonly transition?: {
    readonly type: Exclude<TransitionType, 'cut'>;
    /** Transition kit style (PLAN.md#12.15); absent = the plain `type`. */
    readonly style?: string;
    /** Subject point of a wow style (ADR-028); absent = the centre. */
    readonly focus?: TransitionFocus;
    readonly outgoing: ShotSample;
    /** 0 at the start of the transition, approaching 1 at its end. */
    readonly progress: number;
  };
}

export function createTimeline(shots: readonly TimelineShot[]): Timeline {
  const last = shots.at(-1);
  if (!last) throw new RangeError('timeline needs at least one shot');
  return { shots, duration: last.t1 };
}

/** Index of the shot covering global time t (clamped to the timeline). */
export function shotIndexAt(timeline: Timeline, t: number): number {
  const { shots } = timeline;
  let low = 0;
  let high = shots.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    const shot = shots[middle];
    if (shot !== undefined && shot.t0 <= t) low = middle;
    else high = middle - 1;
  }
  return low;
}

/**
 * Samples the timeline at global time t. Times outside [0, duration) are clamped: t < 0 shows the
 * first shot at local time 0; t >= duration shows the last shot at its final local time.
 */
export function sampleTimeline(timeline: Timeline, t: number): TimelineSample {
  if (!Number.isFinite(t)) throw new RangeError(`seek time must be finite, got ${String(t)}`);
  const clamped = Math.min(Math.max(t, 0), timeline.duration);
  const index = shotIndexAt(timeline, clamped);
  const shot = timeline.shots[index];
  if (!shot) throw new RangeError(`no shot at t=${String(t)}`);
  const current: ShotSample = { index, localTime: clamped - shot.t0 };
  const transition = shot.transitionIn;
  const previous = timeline.shots[index - 1];
  if (transition.type === 'cut' || !previous) return { current };
  const elapsed = clamped - shot.t0;
  if (elapsed >= transition.duration) return { current };
  return {
    current,
    transition: {
      type: transition.type,
      ...(transition.style === undefined ? {} : { style: transition.style }),
      ...(transition.focus === undefined ? {} : { focus: transition.focus }),
      outgoing: { index: index - 1, localTime: clamped - previous.t0 },
      progress: elapsed / transition.duration,
    },
  };
}

/** Time of frame `frameIndex` at `fps` (frames sit on exact multiples of 1/fps). */
export function frameTime(frameIndex: number, fps: number): number {
  return frameIndex / fps;
}

/** Number of frames needed to cover `duration` seconds at `fps`. */
export function frameCount(duration: number, fps: number): number {
  return Math.ceil(duration * fps - 1e-9);
}
