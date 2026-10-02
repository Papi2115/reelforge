import { describe, expect, it } from 'vitest';
import {
  createTimeline,
  frameCount,
  frameTime,
  sampleTimeline,
  shotIndexAt,
  type TimelineShot,
} from './timeline.js';

const shots: TimelineShot[] = [
  { id: 'a', t0: 0, t1: 2, transitionIn: { type: 'cut' } },
  { id: 'b', t0: 2, t1: 5, transitionIn: { type: 'crossfade', duration: 1 } },
  { id: 'c', t0: 5, t1: 6, transitionIn: { type: 'cut' } },
  { id: 'd', t0: 6, t1: 8, transitionIn: { type: 'wipe', duration: 0.5 } },
];
const timeline = createTimeline(shots);

describe('createTimeline', () => {
  it('derives the duration from the last shot and rejects an empty list', () => {
    expect(timeline.duration).toBe(8);
    expect(() => createTimeline([])).toThrow(RangeError);
  });
});

describe('shotIndexAt', () => {
  it('finds the covering shot, boundaries belong to the next shot', () => {
    expect([0, 1.999, 2, 4.9, 5, 6, 7.99].map((t) => shotIndexAt(timeline, t))).toEqual([
      0, 0, 1, 1, 2, 3, 3,
    ]);
  });
});

describe('sampleTimeline', () => {
  it('maps global to local time without a transition', () => {
    expect(sampleTimeline(timeline, 1.5)).toEqual({ current: { index: 0, localTime: 1.5 } });
    expect(sampleTimeline(timeline, 5.25)).toEqual({ current: { index: 2, localTime: 0.25 } });
  });

  it('keeps the outgoing shot running past its end during a transition', () => {
    expect(sampleTimeline(timeline, 2.5)).toEqual({
      current: { index: 1, localTime: 0.5 },
      transition: { type: 'crossfade', outgoing: { index: 0, localTime: 2.5 }, progress: 0.5 },
    });
    expect(sampleTimeline(timeline, 2).transition?.progress).toBe(0);
    expect(sampleTimeline(timeline, 3).transition).toBeUndefined();
    expect(sampleTimeline(timeline, 6.25).transition).toEqual({
      type: 'wipe',
      outgoing: { index: 2, localTime: 1.25 },
      progress: 0.5,
    });
  });

  it('clamps out-of-range times and rejects non-finite ones', () => {
    expect(sampleTimeline(timeline, -3)).toEqual({ current: { index: 0, localTime: 0 } });
    expect(sampleTimeline(timeline, 99)).toEqual({ current: { index: 3, localTime: 2 } });
    expect(() => sampleTimeline(timeline, Number.NaN)).toThrow(RangeError);
  });
});

describe('frames', () => {
  it('converts frame indices and counts frames', () => {
    expect(frameTime(45, 30)).toBe(1.5);
    expect(frameCount(8, 30)).toBe(240);
    expect(frameCount(8.01, 30)).toBe(241);
  });
});
