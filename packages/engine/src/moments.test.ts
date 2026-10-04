/**
 * Reveal-moment effects in the engine (PLAN.md#12.27): the slow-motion shot clock (identity
 * outside its window, the shared remap inside) and the palette shift (every output pixel stays a
 * style colour; strength follows the window's envelope).
 */
import { describe, expect, it } from 'vitest';
import { applyPaletteShift, paletteShiftMap, shotClock, shotPaletteShift } from './moments.js';
import { hexToRgb } from './palette.js';
import { resolveStyle } from './style.js';

describe('shotClock', () => {
  it('is undefined without windows and the identity outside them', () => {
    expect(shotClock({ t0: 10 })).toBeUndefined();
    expect(shotClock({ t0: 10, timeRemap: [] })).toBeUndefined();
    const clock = shotClock({ t0: 10.1, timeRemap: [{ from: 12, to: 14, rate: 0.4 }] });
    for (const local of [0, 0.3, 1.9, 3.9, 4.2, 7.77]) {
      expect(Object.is(clock?.(local), local)).toBe(true);
    }
    const inside = clock?.(2.9) ?? 0;
    expect(inside).toBeLessThan(2.9);
    expect(inside).toBeGreaterThan(1.9);
  });

  it('is deterministic and monotone across the window', () => {
    const clock = shotClock({ t0: 0, timeRemap: [{ from: 1, to: 3, rate: 0.3 }] });
    let previous = -1;
    for (let frame = 0; frame <= 120; frame += 1) {
      const t = frame / 30;
      const s = clock?.(t) ?? t;
      expect(s).toBeGreaterThanOrEqual(previous);
      expect(clock?.(t)).toBe(s);
      previous = s;
    }
  });
});

describe('palette shift', () => {
  const style = resolveStyle({ style: 'voxel-pixel-crisp640' });
  const map = paletteShiftMap(style.swatches, style.variation);
  const colours = new Set(
    Object.values(style.swatches).map((hex) => {
      const [r, g, b] = hexToRgb(hex).map((value) => Math.round(value * 255));
      return `${String(r)},${String(g)},${String(b)}`;
    }),
  );

  it('maps style colours to lighter style colours', () => {
    expect(map.size).toBeGreaterThan(5);
    for (const target of map.values()) {
      const key = `${String((target >> 16) & 255)},${String((target >> 8) & 255)},${String(target & 255)}`;
      expect(colours.has(key)).toBe(true);
    }
  });

  it('keeps every pixel a style colour and shifts more pixels at a higher amount', () => {
    const width = 16;
    const hexes = Object.values(style.swatches);
    const frame = new Uint8Array(width * 16 * 4);
    for (let index = 0; index < width * 16; index += 1) {
      const [r, g, b] = hexToRgb(hexes[index % hexes.length] ?? '#000000').map((value) =>
        Math.round(value * 255),
      );
      frame.set([r ?? 0, g ?? 0, b ?? 0, 255], index * 4);
    }
    const changed = (amount: number): number => {
      const out = new Uint8Array(frame.length);
      applyPaletteShift(frame, width, map, amount, out);
      let count = 0;
      for (let offset = 0; offset < out.length; offset += 4) {
        const key = `${String(out[offset])},${String(out[offset + 1])},${String(out[offset + 2])}`;
        expect(colours.has(key)).toBe(true);
        if (out[offset] !== frame[offset] || out[offset + 1] !== frame[offset + 1]) count += 1;
      }
      return count;
    };
    expect(changed(0)).toBe(0);
    const half = changed(0.5);
    const full = changed(1);
    expect(half).toBeGreaterThan(0);
    expect(full).toBeGreaterThan(half);
  });

  it('reads the shot window (strength 0 outside)', () => {
    const shot = { t0: 2, paletteShift: [{ from: 3, to: 4 }] };
    expect(shotPaletteShift(shot, 0.5)).toBe(0);
    expect(shotPaletteShift(shot, 1.5)).toBe(1);
    expect(shotPaletteShift({ t0: 2 }, 1.5)).toBe(0);
  });
});
