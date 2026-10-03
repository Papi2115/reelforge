import { describe, expect, it } from 'vitest';
import {
  clampPaneSizes,
  DEFAULT_PANE_SIZES,
  PANE_LIMITS,
  parseStoredPaneSizes,
  serializePaneSizes,
} from './pane-sizes.js';

const centerWidth = (width: number, left: number, right: number): number =>
  width - left - right - 2 * PANE_LIMITS.splitterSize;

describe('clampPaneSizes', () => {
  it('keeps the defaults at 1280x720 and leaves the preview room for a 640x360 frame', () => {
    const sizes = clampPaneSizes(DEFAULT_PANE_SIZES, { width: 1280, height: 660 });
    expect(sizes).toEqual(DEFAULT_PANE_SIZES);
    expect(centerWidth(1280, sizes.left, sizes.right)).toBeGreaterThanOrEqual(640);
  });

  it('raises panes to their minimums', () => {
    expect(
      clampPaneSizes({ left: 10, right: 10, bottom: 10 }, { width: 1920, height: 1000 }),
    ).toEqual({
      left: PANE_LIMITS.minLeft,
      right: PANE_LIMITS.minRight,
      bottom: PANE_LIMITS.minBottom,
    });
  });

  it('shrinks the chat first, then the left column, to keep the preview usable', () => {
    const wide = clampPaneSizes(
      { left: 400, right: 600, bottom: 200 },
      { width: 1280, height: 720 },
    );
    expect(wide.left).toBe(400);
    expect(centerWidth(1280, wide.left, wide.right)).toBe(PANE_LIMITS.minCenterWidth);
    const huge = clampPaneSizes(
      { left: 900, right: 900, bottom: 200 },
      { width: 1280, height: 720 },
    );
    expect(huge.right).toBe(PANE_LIMITS.minRight);
    expect(centerWidth(1280, huge.left, huge.right)).toBe(PANE_LIMITS.minCenterWidth);
  });

  it('never goes below the minimums on tiny windows', () => {
    expect(clampPaneSizes(DEFAULT_PANE_SIZES, { width: 600, height: 300 })).toEqual({
      left: PANE_LIMITS.minLeft,
      right: PANE_LIMITS.minRight,
      bottom: PANE_LIMITS.minBottom,
    });
  });

  it('with the chat collapsed to its rail, only the left column gives way', () => {
    const sizes = clampPaneSizes(
      { left: 900, right: 500, bottom: 200 },
      { width: 1280, height: 720 },
      44,
    );
    expect(sizes.right).toBe(500);
    expect(1280 - sizes.left - 44 - 2 * PANE_LIMITS.splitterSize).toBe(PANE_LIMITS.minCenterWidth);
    const defaults = clampPaneSizes(DEFAULT_PANE_SIZES, { width: 1280, height: 660 }, 44);
    expect(defaults).toEqual(DEFAULT_PANE_SIZES);
    expect(1280 - defaults.left - 44 - PANE_LIMITS.splitterSize).toBeGreaterThanOrEqual(900);
  });

  it('caps the timeline so the preview keeps its minimum height', () => {
    const sizes = clampPaneSizes(
      { ...DEFAULT_PANE_SIZES, bottom: 900 },
      { width: 1280, height: 660 },
    );
    expect(sizes.bottom).toBe(660 - PANE_LIMITS.splitterSize - PANE_LIMITS.minCenterHeight);
  });
});

describe('stored pane sizes', () => {
  it('round-trips and falls back to the defaults for junk', () => {
    const sizes = { left: 300, right: 360, bottom: 220 };
    expect(parseStoredPaneSizes(serializePaneSizes(sizes))).toEqual(sizes);
    expect(parseStoredPaneSizes(null)).toBe(DEFAULT_PANE_SIZES);
    expect(parseStoredPaneSizes('{not json')).toBe(DEFAULT_PANE_SIZES);
    expect(parseStoredPaneSizes('{"left":"wide"}')).toBe(DEFAULT_PANE_SIZES);
    expect(parseStoredPaneSizes('{"left":1e999,"right":1,"bottom":1}')).toBe(DEFAULT_PANE_SIZES);
  });
});
