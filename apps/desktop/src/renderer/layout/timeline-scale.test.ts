import { describe, expect, it } from 'vitest';
import {
  formatRulerLabel,
  formatTime,
  rulerTicks,
  timeAtPosition,
  timePercent,
} from './timeline-scale.js';

describe('formatTime', () => {
  it('formats minutes, seconds and centiseconds', () => {
    expect(formatTime(0)).toBe('0:00.00');
    expect(formatTime(2.2)).toBe('0:02.20');
    expect(formatTime(62.505)).toBe('1:02.51');
    expect(formatTime(59.999)).toBe('1:00.00');
    expect(formatTime(-3)).toBe('0:00.00');
    expect(formatTime(Number.NaN)).toBe('0:00.00');
  });

  it('formats ruler labels', () => {
    expect(formatRulerLabel(0)).toBe('0:00');
    expect(formatRulerLabel(75)).toBe('1:15');
    expect(formatRulerLabel(1.5)).toBe('0:01.5');
  });
});

describe('rulerTicks', () => {
  it('picks a step that keeps labels apart', () => {
    expect(rulerTicks(7.5, 700)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(rulerTicks(7.5, 1500)).toEqual([
      0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5,
    ]);
    expect(rulerTicks(600, 800)).toEqual([0, 60, 120, 180, 240, 300, 360, 420, 480, 540, 600]);
  });

  it('returns nothing for an empty timeline', () => {
    expect(rulerTicks(0, 800)).toEqual([]);
    expect(rulerTicks(10, 0)).toEqual([]);
  });
});

describe('timePercent', () => {
  it('clamps to the timeline', () => {
    expect(timePercent(2.5, 10)).toBe(25);
    expect(timePercent(20, 10)).toBe(100);
    expect(timePercent(-1, 10)).toBe(0);
    expect(timePercent(1, 0)).toBe(0);
  });
});

describe('timeAtPosition', () => {
  it('maps a pointer position on the lane to a clamped time', () => {
    expect(timeAtPosition(200, 800, 10)).toBe(2.5);
    expect(timeAtPosition(-5, 800, 10)).toBe(0);
    expect(timeAtPosition(900, 800, 10)).toBe(10);
    expect(timeAtPosition(100, 0, 10)).toBe(0);
    expect(timeAtPosition(100, 800, 0)).toBe(0);
  });
});
