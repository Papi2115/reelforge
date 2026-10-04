/**
 * Live co-direction in the engine (PLAN.md#12.14): the rate clock composed with reveal moments
 * (hits keep their times), and the frame passes (tone, zoom, overlay marks) keeping every pixel a
 * palette colour.
 */
import { remapTime, type DirectionOverlay } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import {
  blendFrameDirections,
  createFrameDirector,
  directedClock,
  directionWindows,
  frameDirection,
} from './direction.js';
import { applyZoom, zoomIndexMap } from './direction-frame.js';
import { hexToRgb } from './palette.js';
import { resolveStyle } from './style.js';

const style = resolveStyle({ style: 'voxel-pixel-crisp640' });
const paletteKeys = new Set(
  Object.values(style.swatches).map((hex) => {
    const [r, g, b] = hexToRgb(hex).map((channel) => Math.round(channel * 255));
    return ((r ?? 0) << 16) | ((g ?? 0) << 8) | (b ?? 0);
  }),
);
const swatchBytes = [...paletteKeys].map((key) => [(key >> 16) & 255, (key >> 8) & 255, key & 255]);

/** A palette-pure test frame: horizontal bands of every style colour. */
function paletteFrame(): Uint8Array {
  const { width, height } = style;
  const frame = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const colour = swatchBytes[Math.floor((y * swatchBytes.length) / height)] ?? [0, 0, 0];
    for (let x = 0; x < width; x += 1) {
      frame.set([colour[0] ?? 0, colour[1] ?? 0, colour[2] ?? 0, 255], (y * width + x) * 4);
    }
  }
  return frame;
}

/** Byte equality (toEqual on 1 MB arrays is very slow). */
const same = (first: Uint8Array, second: Uint8Array): boolean =>
  Buffer.from(first).equals(Buffer.from(second));

function offPalette(frame: Uint8Array): number {
  let count = 0;
  for (let offset = 0; offset < frame.length; offset += 4) {
    const key =
      ((frame[offset] ?? 0) << 16) | ((frame[offset + 1] ?? 0) << 8) | (frame[offset + 2] ?? 0);
    if (!paletteKeys.has(key) || frame[offset + 3] !== 255) count += 1;
  }
  return count;
}

describe('rate clock', () => {
  const shot = { t0: 10, t1: 20 };
  const hits = { anchors: [{ t: 13 }], cues: [{ t: 16 }] };

  it('is the plain moment clock without a rate', () => {
    expect(directedClock(shot, directionWindows(shot, undefined, hits))).toBeUndefined();
    expect(directionWindows(shot, { dim: 0.5 }, hits)).toEqual([]);
  });

  it('keeps every hit and the shot edges on their times', () => {
    const windows = directionWindows(shot, { rate: 0.6 }, hits);
    expect(windows.map((window) => [window.from, window.to])).toEqual([
      [10, 13],
      [13, 16],
      [16, 20],
    ]);
    const clock = directedClock(shot, windows);
    for (const local of [0, 3, 6, 10]) expect(clock?.(local)).toBe(local);
    expect(clock?.(1)).toBeLessThan(1);
  });

  it('composes with a reveal-moment slow motion (both present)', () => {
    const moment = { from: 17, to: 19, rate: 0.4 };
    const windows = directionWindows(shot, { rate: 1.4 }, hits);
    const clock = directedClock({ ...shot, timeRemap: [moment] }, windows);
    // Composition: the direction remaps film time first, then the moment's slow motion.
    for (const t of [11, 14.2, 17.5, 18.4, 19.5]) {
      const expected = remapTime([moment], remapTime(windows, t)) - shot.t0;
      expect(clock?.(t - shot.t0)).toBeCloseTo(expected, 12);
    }
    for (const t of [13, 16, 20]) expect(clock?.(t - shot.t0)).toBe(t - shot.t0);
    let previous = -1;
    for (let local = 0; local <= 10; local += 1 / 30) {
      const s = clock?.(local) ?? local;
      expect(s).toBeGreaterThanOrEqual(previous);
      previous = s;
    }
  });
});

describe('frame directions', () => {
  it('drops neutral directions and blends transitions', () => {
    expect(frameDirection(undefined)).toBeUndefined();
    expect(frameDirection({ rate: 0.6 })).toBeUndefined();
    expect(frameDirection({ zoom: 1.2 })).toEqual({ dim: 0, zoom: 1.2, overlays: [] });
    const blended = blendFrameDirections({ dim: -0.5, zoom: 1.2, overlays: [] }, undefined, 0.25);
    expect(blended).toEqual({ dim: -0.5, zoom: 1.15, overlays: [] });
    expect(blendFrameDirections({ dim: -0.5, zoom: 1, overlays: [] }, undefined, 0.75)?.dim).toBe(
      0,
    );
  });

  it('zooms by integer nearest neighbour around the centre', () => {
    expect([...zoomIndexMap(8, 1)]).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect([...zoomIndexMap(8, 2)]).toEqual([2, 2, 3, 3, 4, 4, 5, 5]);
    const frame = paletteFrame();
    const out = new Uint8Array(frame.length);
    applyZoom(frame, style.width, style.height, 1.3, out);
    expect(offPalette(out)).toBe(0);
    expect(same(out, frame)).toBe(false);
  });

  it('keeps tone, zoom and marks inside the palette, deterministically', () => {
    const arrow: DirectionOverlay = {
      id: 'arrow-1',
      kind: 'arrow',
      x: 0.5,
      y: 0.5,
      at: 1,
      until: 3,
    };
    const marks: DirectionOverlay[] = [
      arrow,
      { ...arrow, id: 'ring-1', kind: 'ring', x: 0.3 },
      { ...arrow, id: 'underline-1', kind: 'underline', y: 0.7 },
      { ...arrow, id: 'callout-1', kind: 'callout', x: 0.7, text: 'GLASS' },
      { ...arrow, id: 'badge-1', kind: 'badge', x: 0.2, y: 0.3 },
      { ...arrow, id: 'highlight-1', kind: 'highlight', x: 0.6, y: 0.4 },
    ];
    const frame = paletteFrame();
    for (const dim of [-1, -0.5, 0.25, 1]) {
      const director = createFrameDirector(style, 7);
      const out = director.apply(frame, { dim, zoom: 1.1, overlays: marks }, 2);
      expect(offPalette(out)).toBe(0);
      expect(same(out, frame)).toBe(false);
      const again = createFrameDirector(style, 7).apply(
        frame,
        { dim, zoom: 1.1, overlays: marks },
        2,
      );
      expect(same(again, out)).toBe(true);
    }
    // Before its word the arrow is not drawn: only the zoom remains.
    const before = createFrameDirector(style, 7).apply(
      frame,
      { dim: 0, zoom: 1, overlays: [arrow] },
      0.5,
    );
    expect(same(before, frame)).toBe(true);
    const during = createFrameDirector(style, 7).apply(
      frame,
      { dim: 0, zoom: 1, overlays: [arrow] },
      2,
    );
    expect(same(during, frame)).toBe(false);
  });

  it('darker and lighter move the picture in opposite directions', () => {
    const frame = paletteFrame();
    const luma = (bytes: Uint8Array): number => {
      let sum = 0;
      for (let offset = 0; offset < bytes.length; offset += 4) {
        sum +=
          0.3 * (bytes[offset] ?? 0) +
          0.59 * (bytes[offset + 1] ?? 0) +
          0.11 * (bytes[offset + 2] ?? 0);
      }
      return sum;
    };
    const darker = createFrameDirector(style, 1).apply(
      frame,
      { dim: -1, zoom: 1, overlays: [] },
      0,
    );
    const lighter = createFrameDirector(style, 1).apply(
      frame,
      { dim: 1, zoom: 1, overlays: [] },
      0,
    );
    expect(luma(darker)).toBeLessThan(luma(frame));
    expect(luma(lighter)).toBeGreaterThan(luma(frame));
  });
});
