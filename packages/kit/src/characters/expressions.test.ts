import { describe, expect, it } from 'vitest';
import { EXPRESSIONS } from './clips.js';
import {
  blinkAt,
  FACE_EXPRESSIONS,
  SCREEN_COLUMNS,
  SCREEN_FACES,
  SCREEN_ROWS,
  screenPixels,
} from './expressions.js';

describe('blink schedule', () => {
  it('is a pure function of time and seed', () => {
    for (const t of [0, 0.42, 3.7, 12.01]) expect(blinkAt(t, 2.3)).toBe(blinkAt(t, 2.3));
    const times = Array.from({ length: 300 }, (_, i) => i / 30);
    const forward = times.map((t) => blinkAt(t, 1.1));
    const backward = [...times].reverse().map((t) => blinkAt(t, 1.1));
    expect(backward.reverse()).toEqual(forward);
  });

  it('closes the lids briefly every few seconds, on its own phase per seed', () => {
    const sample = (seed: number) => Array.from({ length: 600 }, (_, i) => blinkAt(i / 60, seed));
    const lids = sample(0.7);
    expect(Math.min(...lids)).toBeLessThan(0.2);
    expect(Math.max(...lids)).toBe(1);
    expect(lids.filter((value) => value < 0.5).length / lids.length).toBeLessThan(0.1);
    // Blinks every 3.3-4.7 s: closed at least twice in 10 s.
    let blinks = 0;
    lids.forEach((value, index) => {
      if (value < 0.5 && (lids[index - 1] ?? 1) >= 0.5) blinks += 1;
    });
    expect(blinks).toBeGreaterThanOrEqual(2);
    expect(sample(3.9)).not.toEqual(lids);
  });
});

describe('expressions', () => {
  it('defines a voxel face and a screen face for every expression', () => {
    for (const name of EXPRESSIONS) {
      expect(FACE_EXPRESSIONS[name]).toBeDefined();
      const face = SCREEN_FACES[name];
      expect(face.eyes).toHaveLength(5);
      expect(face.mouth).toHaveLength(3);
      for (const row of [...face.eyes, ...face.mouth]) expect(row).toHaveLength(SCREEN_COLUMNS);
    }
  });

  it("draws Screen's display: blinks, animated dots, flashing alarm", () => {
    const open = screenPixels('neutral', 0, 1);
    expect(open).toHaveLength(SCREEN_COLUMNS * SCREEN_ROWS);
    expect(screenPixels('neutral', 0, 0.1)).not.toEqual(open);
    expect(screenPixels('joy', 0, 0.1)).toEqual(screenPixels('joy', 0, 1));
    expect(screenPixels('thinking', 0, 1)).not.toEqual(screenPixels('thinking', 0.4, 1));
    expect(screenPixels('alarm', 0, 1)).toContain(2);
    expect(screenPixels('alarm', 0.3, 1)).toContain(3);
  });
});
