/**
 * Slow-motion time remap (PLAN.md#12.27): property tests over seeded random windows — monotone,
 * s(from) = from, s(to) = to, identity outside, speed within [rate, 2 − rate] — plus the
 * palette-shift envelope and the manifest window checks.
 */
import { describe, expect, it } from 'vitest';
import { renderManifestSchema } from './render-manifest.js';
import {
  MAX_REMAP_RATE,
  MIN_REMAP_RATE,
  maxRemapLag,
  paletteShiftAmount,
  remapRate,
  remapTime,
  type TimeRemapWindow,
} from './time-remap.js';

/** Deterministic PRNG for the property runs (mulberry32). */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function randomWindow(next: () => number): TimeRemapWindow {
  const from = next() * 120;
  const span = 0.2 + next() * 4;
  const rate = MIN_REMAP_RATE + next() * (MAX_REMAP_RATE - MIN_REMAP_RATE);
  return { from, to: from + span, rate };
}

describe('remapTime', () => {
  it('is monotone, pins both edges, keeps the speed in [rate, 2 - rate] (500 random windows)', () => {
    const next = random(2027);
    for (let run = 0; run < 500; run += 1) {
      const window = randomWindow(next);
      const windows = [window];
      expect(remapTime(windows, window.from)).toBe(window.from);
      expect(remapTime(windows, window.to)).toBe(window.to);
      let previous = remapTime(windows, window.from - 0.5);
      const steps = 200;
      for (let step = 0; step <= steps; step += 1) {
        const t = window.from - 0.5 + ((window.to - window.from + 1) * step) / steps;
        const s = remapTime(windows, t);
        expect(s).toBeGreaterThanOrEqual(previous);
        previous = s;
        const rate = remapRate(windows, t);
        expect(rate).toBeGreaterThanOrEqual(window.rate - 1e-12);
        expect(rate).toBeLessThanOrEqual(2 - window.rate + 1e-12);
        // Scene time never runs ahead of film time and lags at most the documented maximum.
        expect(s).toBeLessThanOrEqual(t + 1e-12);
        expect(t - s).toBeLessThanOrEqual(maxRemapLag(window) + 1e-9);
      }
    }
  });

  it('is the identity outside every window (bit for bit)', () => {
    const windows = [
      { from: 2, to: 4, rate: 0.4 },
      { from: 6.5, to: 7.5, rate: 0.25 },
    ];
    for (const t of [0, 1.999, 2, 4, 4.0001, 6.5, 7.5, 9, 123.456]) {
      expect(Object.is(remapTime(windows, t), t)).toBe(true);
    }
    expect(remapTime(windows, 3)).toBeLessThan(3);
    expect(remapTime(windows, 7)).toBeLessThan(7);
    expect(remapTime([], 5)).toBe(5);
  });

  it('matches the derivative numerically and is slowest a quarter in', () => {
    const window = { from: 10, to: 12, rate: 0.4 };
    const quarter = 10.5;
    const h = 1e-5;
    const numeric = (remapTime([window], quarter + h) - remapTime([window], quarter - h)) / (2 * h);
    expect(numeric).toBeCloseTo(0.4, 5);
    expect(remapRate([window], quarter)).toBeCloseTo(0.4, 12);
    expect(remapRate([window], 11.5)).toBeCloseTo(1.6, 12);
    expect(10 + 1 - remapTime([window], 11)).toBeCloseTo(maxRemapLag(window), 12);
  });
});

describe('paletteShiftAmount', () => {
  it('attacks, holds and releases inside the window, 0 outside', () => {
    const windows = [{ from: 5, to: 6 }];
    expect(paletteShiftAmount(windows, 4.99)).toBe(0);
    expect(paletteShiftAmount(windows, 5)).toBe(0);
    expect(paletteShiftAmount(windows, 5.075)).toBeCloseTo(0.5, 9);
    expect(paletteShiftAmount(windows, 5.4)).toBe(1);
    expect(paletteShiftAmount(windows, 5.8)).toBeCloseTo(0.5, 9);
    expect(paletteShiftAmount(windows, 6)).toBe(0);
  });
});

describe('manifest shot effects', () => {
  const manifest = (shot: Record<string, unknown>) => ({
    version: 1,
    fps: 30,
    seed: 1,
    shots: [{ id: 's01', t0: 0, t1: 5, scene: { file: 'scenes/s01.js', source: 'x' }, ...shot }],
  });

  it('accepts windows inside the shot, refuses windows outside or overlapping', () => {
    expect(
      renderManifestSchema.safeParse(
        manifest({
          timeRemap: [{ from: 1, to: 3, rate: 0.4 }],
          paletteShift: [{ from: 1, to: 1.5 }],
        }),
      ).success,
    ).toBe(true);
    expect(
      renderManifestSchema.safeParse(manifest({ timeRemap: [{ from: 4, to: 6, rate: 0.4 }] }))
        .success,
    ).toBe(false);
    expect(
      renderManifestSchema.safeParse(
        manifest({
          paletteShift: [
            { from: 1, to: 2 },
            { from: 1.5, to: 2.5 },
          ],
        }),
      ).success,
    ).toBe(false);
    expect(
      renderManifestSchema.safeParse(manifest({ timeRemap: [{ from: 1, to: 2, rate: 0.1 }] }))
        .success,
    ).toBe(false);
  });
});
