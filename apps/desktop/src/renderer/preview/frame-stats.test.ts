import { describe, expect, it } from 'vitest';
import { FrameStats, frameIndexAt } from './frame-stats.js';

describe('frameIndexAt', () => {
  it('puts exact frame times on their own frame', () => {
    expect(frameIndexAt(2.2, 30)).toBe(66);
    expect(frameIndexAt(66 / 30, 30)).toBe(66);
    expect(frameIndexAt(2.2 - 0.01, 30)).toBe(65);
    expect(frameIndexAt(-1, 30)).toBe(0);
  });
});

describe('FrameStats', () => {
  it('counts frames drawn in the last second', () => {
    const stats = new FrameStats();
    for (let frame = 0; frame < 30; frame += 1) {
      stats.noteDrawn(frame / 30, 30, frame * 33, 2, true);
    }
    expect(stats.snapshot(990)).toMatchObject({ fps: 30, dropped: 0, drawn: 30 });
    expect(stats.snapshot(1500).fps).toBe(14);
    expect(stats.snapshot(5000).fps).toBe(0);
  });

  it('counts skipped frames during continuous playback only', () => {
    const stats = new FrameStats();
    stats.noteDrawn(0, 30, 0, 2, true);
    stats.noteDrawn(1 / 30, 30, 33, 2, true);
    // The engine was slow: frames 2 and 3 were never shown.
    stats.noteDrawn(4 / 30, 30, 133, 2, true);
    expect(stats.snapshot(133).dropped).toBe(2);
    // A seek breaks continuity: jumping ahead is not a drop.
    stats.breakContinuity();
    stats.noteDrawn(3, 30, 150, 2, true);
    stats.noteDrawn(3 + 1 / 30, 30, 183, 2, true);
    // Scrubbing while paused is never a drop.
    stats.noteDrawn(5, 30, 200, 2, false);
    stats.noteDrawn(6, 30, 210, 2, false);
    expect(stats.snapshot(210).dropped).toBe(2);
    stats.resetDropped();
    expect(stats.snapshot(210).dropped).toBe(0);
  });

  it('smooths the render time', () => {
    const stats = new FrameStats();
    stats.noteDrawn(0, 30, 0, 10, false);
    expect(stats.snapshot(0).renderMs).toBe(10);
    stats.noteDrawn(0, 30, 1, 20, false);
    expect(stats.snapshot(1).renderMs).toBeCloseTo(12, 9);
  });
});
