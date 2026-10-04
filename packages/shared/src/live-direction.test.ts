import { describe, expect, it } from 'vitest';
import {
  clampOverlayPoint,
  directedShotIds,
  directionsFileSchema,
  emptyDirections,
  manifestDirections,
  normalizeDirection,
  rateWindows,
  withShotDirection,
  type DirectionOverlay,
} from './live-direction.js';
import { renderManifestSchema } from './render-manifest.js';
import { remapTime } from './time-remap.js';

const ARROW: DirectionOverlay = {
  id: 'arrow-1',
  kind: 'arrow',
  x: 0.5,
  y: 0.5,
  region: 'center',
  at: 2,
  until: 4,
  word: { index: 3, text: 'light' },
};

describe('directions.json schema', () => {
  it('accepts a full file and rejects out-of-range values', () => {
    const file = {
      version: 1,
      shots: { s01: { rate: 0.8, dim: -0.25, zoom: 1.1, overlays: [ARROW] } },
    };
    expect(directionsFileSchema.parse(file)).toEqual(file);
    expect(
      directionsFileSchema.safeParse({ version: 1, shots: { s01: { zoom: 1.5 } } }).success,
    ).toBe(false);
    expect(
      directionsFileSchema.safeParse({ version: 1, shots: { s01: { dim: -2 } } }).success,
    ).toBe(false);
    expect(
      directionsFileSchema.safeParse({ version: 1, shots: { s01: { rate: 0.1 } } }).success,
    ).toBe(false);
    expect(
      directionsFileSchema.safeParse({
        version: 1,
        shots: { s01: { overlays: [{ ...ARROW, until: 1 }] } },
      }).success,
    ).toBe(false);
    expect(directionsFileSchema.safeParse({ version: 2, shots: {} }).success).toBe(false);
  });

  it('is accepted by the render manifest as a shot direction', () => {
    const manifest = {
      version: 1,
      fps: 30,
      seed: 1,
      shots: [
        {
          id: 's01',
          t0: 0,
          t1: 5,
          scene: { file: 'scenes/s01.js', source: 'x' },
          direction: { dim: 0.5, overlays: [ARROW] },
        },
      ],
    };
    expect(renderManifestSchema.safeParse(manifest).success).toBe(true);
  });
});

describe('normalizeDirection / withShotDirection', () => {
  it('drops neutral values and empty directions', () => {
    expect(normalizeDirection({ rate: 1, dim: 0, zoom: 1, overlays: [] })).toBeUndefined();
    expect(normalizeDirection({ rate: 0.80000001, dim: 0 })).toEqual({ rate: 0.8 });
  });

  it('replaces, sorts and removes shots', () => {
    let file = withShotDirection(emptyDirections(), 's02', { dim: -0.5 });
    file = withShotDirection(file, 's01', { zoom: 1.2 });
    expect(Object.keys(file.shots)).toEqual(['s01', 's02']);
    file = withShotDirection(file, 's02', { dim: 0 });
    expect(file.shots).toEqual({ s01: { zoom: 1.2 } });
    expect(directedShotIds(file, [{ id: 's02' }, { id: 's01' }])).toEqual(['s01']);
  });

  it('merges only storyboard shots into the manifest', () => {
    const file = withShotDirection(
      withShotDirection(emptyDirections(), 'gone', { dim: 1 }),
      's01',
      { rate: 0.6 },
    );
    const merged = manifestDirections(file, [{ id: 's01' }, { id: 's02' }]);
    expect([...merged.entries()]).toEqual([['s01', { rate: 0.6 }]]);
    expect(manifestDirections(undefined, [{ id: 's01' }]).size).toBe(0);
  });
});

describe('rateWindows', () => {
  const shot = { t0: 10, t1: 20 };

  it('covers the gaps between hits, never moving a hit', () => {
    const hits = [12, 12.3, 16, 25];
    const windows = rateWindows(shot, 0.6, hits);
    expect(windows).toEqual([
      { from: 10, to: 12, rate: 0.6 },
      { from: 12.3, to: 16, rate: 0.6 },
      { from: 16, to: 20, rate: 0.6 },
    ]);
    for (const hit of [10, 12, 12.3, 16, 20]) expect(remapTime(windows, hit)).toBe(hit);
    // Slower inside: scene time lags behind film time in the first half of a window.
    expect(remapTime(windows, 13)).toBeLessThan(13);
  });

  it('runs ahead for faster and keeps the window edges', () => {
    const windows = rateWindows(shot, 1.4, [15]);
    expect(remapTime(windows, 12)).toBeGreaterThan(12);
    expect(remapTime(windows, 15)).toBe(15);
  });

  it('uses the whole shot without hits, nothing at rate 1, at most 4 windows', () => {
    expect(rateWindows(shot, 0.8, [])).toEqual([{ from: 10, to: 20, rate: 0.8 }]);
    expect(rateWindows(shot, 1, [])).toEqual([]);
    const many = rateWindows(shot, 0.8, [11, 12, 13, 14, 15, 16, 17, 18, 19]);
    expect(many).toHaveLength(4);
    expect(many.map((window) => window.from)).toEqual(
      [...many.map((window) => window.from)].sort((a, b) => a - b),
    );
  });

  it('remap stays monotone for every allowed rate', () => {
    for (const rate of [0.4, 0.8, 1.2, 1.6]) {
      const windows = rateWindows(shot, rate, []);
      let previous = -Infinity;
      for (let t = 10; t <= 20; t += 0.01) {
        const s = remapTime(windows, t);
        expect(s).toBeGreaterThanOrEqual(previous);
        previous = s;
      }
    }
  });
});

describe('clampOverlayPoint', () => {
  it('keeps clicked points inside the margins', () => {
    expect(clampOverlayPoint(0, 1)).toEqual({ x: 0.1, y: 0.9 });
    expect(clampOverlayPoint(0.4567, 0.5)).toEqual({ x: 0.457, y: 0.5 });
  });
});
