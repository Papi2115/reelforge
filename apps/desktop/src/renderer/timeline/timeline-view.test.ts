import { describe, expect, it } from 'vitest';
import {
  clampView,
  contentWidth,
  fitView,
  followTime,
  MAX_PX_PER_SECOND,
  resizeView,
  timeToX,
  visibleRange,
  xToTime,
  zoomAround,
  type TimelineView,
} from './timeline-view.js';

const tenMinutes = fitView(600, 1200);

describe('timeline view', () => {
  it('fits the whole timeline into the lane', () => {
    expect(tenMinutes).toEqual({ duration: 600, width: 1200, pxPerSecond: 2, scrollX: 0 });
    expect(contentWidth(tenMinutes)).toBe(1200);
    expect(visibleRange(tenMinutes)).toEqual({ from: 0, to: 600 });
  });

  it('converts between time and lane position', () => {
    const view: TimelineView = { duration: 600, width: 1000, pxPerSecond: 100, scrollX: 250 };
    expect(timeToX(view, 5)).toBe(250);
    expect(xToTime(view, 250)).toBe(5);
    expect(xToTime(view, -1000)).toBe(0);
    expect(xToTime({ ...view, scrollX: 59_500 }, 1000)).toBe(600);
  });

  it('zooms around an anchor: the time under the pointer stays put', () => {
    const view: TimelineView = { duration: 600, width: 1000, pxPerSecond: 10, scrollX: 400 };
    const anchorT = xToTime(view, 300);
    const zoomed = zoomAround(view, 4, 300);
    expect(zoomed.pxPerSecond).toBe(40);
    expect(xToTime(zoomed, 300)).toBeCloseTo(anchorT, 9);
  });

  it('clamps zoom between fit and the maximum, and scroll to the content', () => {
    expect(zoomAround(tenMinutes, 0.1, 0).pxPerSecond).toBe(2);
    expect(zoomAround(tenMinutes, 1e6, 0).pxPerSecond).toBe(MAX_PX_PER_SECOND);
    const view = clampView({ duration: 10, width: 500, pxPerSecond: 100, scrollX: 9_999 });
    expect(view.scrollX).toBe(500);
    expect(clampView({ ...view, scrollX: -5 }).scrollX).toBe(0);
    expect(clampView({ ...view, scrollX: Number.NaN }).scrollX).toBe(0);
  });

  it('keeps fitting on resize when everything was in view, else keeps the zoom', () => {
    expect(resizeView(tenMinutes, 600, 600).pxPerSecond).toBe(1);
    const zoomed = { ...tenMinutes, pxPerSecond: 50, scrollX: 100 };
    expect(resizeView(zoomed, 700, 1000)).toEqual({ ...zoomed, duration: 700, width: 1000 });
  });

  it('pages to the playhead when it leaves the view', () => {
    const view: TimelineView = { duration: 600, width: 1000, pxPerSecond: 100, scrollX: 0 };
    expect(followTime(view, 5)).toBe(view);
    expect(followTime(view, 12).scrollX).toBe(1100);
  });
});
