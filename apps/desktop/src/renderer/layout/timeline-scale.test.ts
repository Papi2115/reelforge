import { describe, expect, it } from 'vitest';
import { formatRulerLabel, formatTime, rulerStep, rulerTicks } from './timeline-scale.js';

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
    expect(rulerTicks(0, 7.5, 700 / 7.5)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(rulerTicks(0, 7.5, 200)).toEqual([
      0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5,
    ]);
    expect(rulerTicks(0, 600, 800 / 600)).toEqual([
      0, 60, 120, 180, 240, 300, 360, 420, 480, 540, 600,
    ]);
    expect(rulerStep(800)).toBe(0.1);
  });

  it('lists only the visible window', () => {
    expect(rulerTicks(12.3, 15.1, 100)).toEqual([13, 14, 15]);
    expect(rulerTicks(1.05, 1.45, 700)).toEqual([1.1, 1.2, 1.3, 1.4]);
  });

  it('returns nothing for an empty window', () => {
    expect(rulerTicks(0, 0, 800)).toEqual([]);
    expect(rulerTicks(0, 10, 0)).toEqual([]);
  });
});
