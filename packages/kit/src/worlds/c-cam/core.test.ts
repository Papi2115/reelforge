import { describe, expect, it } from 'vitest';
import { loadOriginal } from './draw/original.js';
import {
  ANIM,
  C,
  FPS,
  H,
  W,
  blink,
  clamp01,
  ease,
  hash,
  key,
  lerp,
  noise1,
  rnd,
  seg,
  shadeOf,
  step,
  talk,
  twos,
  type Keyframe,
} from './core.js';

const original = loadOriginal();
const call = (name: string, ...args: unknown[]): unknown =>
  (original[name] as unknown as (...a: unknown[]) => unknown)(...args);

/** Deterministic input stream (LCG), no Math.random. */
function stream(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe('frame constants', () => {
  it('match the original', () => {
    expect([W, H, FPS, ANIM]).toEqual([original.W, original.H, original.FPS, original.ANIM]);
    expect([W, H, FPS, ANIM]).toEqual([1920, 1080, 24, 12]);
  });
});

describe('hash', () => {
  it('equals the original on 1000 inputs (incl. negatives, fractions, missing args)', () => {
    const next = stream(7);
    for (let i = 0; i < 1000; i += 1) {
      const a = Math.floor((next() - 0.5) * 2e6);
      const b = (next() - 0.5) * 4000;
      const c = Math.floor(next() * 500);
      const d = Math.floor((next() - 0.5) * 1e9);
      expect(hash(a, b, c, d)).toBe(call('hash', a, b, c, d));
      expect(hash(a)).toBe(call('hash', a));
      expect(hash(a, c)).toBe(call('hash', a, c));
    }
  });

  it('stays in [0, 1)', () => {
    const next = stream(3);
    for (let i = 0; i < 1000; i += 1) {
      const h = hash(Math.floor(next() * 1e6), i);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1);
    }
  });

  it('rnd and noise1 equal the original', () => {
    const next = stream(11);
    for (let i = 0; i < 1000; i += 1) {
      const a = Math.floor(next() * 1000);
      const x = (next() - 0.5) * 200;
      expect(rnd(-3, 9, a, i, 2, 1)).toBe(call('rnd', -3, 9, a, i, 2, 1));
      expect(rnd(0, 1, a)).toBe(call('rnd', 0, 1, a));
      expect(noise1(a, x)).toBe(call('noise1', a, x));
    }
  });
});

describe('easing and keyframes', () => {
  it('clamp01, lerp, seg, ease equal the original', () => {
    for (let i = -20; i <= 120; i += 1) {
      const x = i / 100;
      expect(clamp01(x)).toBe(call('clamp01', x));
      expect(lerp(2, 10, x)).toBe(call('lerp', 2, 10, x));
      expect(seg(x, 0.2, 0.8)).toBe(call('seg', x, 0.2, 0.8));
      for (const name of ['lin', 'inOut', 'out', 'back'] as const) {
        expect(ease[name](x)).toBe(original.ease[name]?.(x));
      }
    }
  });

  it('has the known endpoints', () => {
    for (const name of ['lin', 'inOut', 'out', 'back'] as const) {
      expect(ease[name](0)).toBeCloseTo(0, 12);
      expect(ease[name](1)).toBeCloseTo(1, 12);
    }
    expect(ease.inOut(0.5)).toBe(0.5);
    expect(ease.lin(2)).toBe(1);
  });

  const keys: Keyframe[] = [
    [1, 10],
    [2, 20, 'out'],
    [3, 5, 'back'],
    [5, 40, 'lin'],
  ];

  it('key eases into each key and holds outside', () => {
    expect(key(0, keys)).toBe(10);
    expect(key(1, keys)).toBe(10);
    expect(key(2, keys)).toBe(call('key', 2, keys));
    expect(key(9, keys)).toBe(40);
    expect(key(4, keys)).toBeCloseTo(22.5, 12);
    for (let i = 0; i <= 700; i += 1) {
      expect(key(i / 100, keys)).toBe(call('key', i / 100, keys));
    }
  });

  it('step returns the last passed key', () => {
    const pose = [
      [0, 'a'],
      [1.5, 'b'],
      [3, 'c'],
    ] as const;
    expect([-1, 0, 1.49, 1.5, 2.9, 3, 99].map((t) => step(t, pose))).toEqual([
      'a',
      'a',
      'a',
      'b',
      'b',
      'c',
      'c',
    ]);
    expect(
      step(1.6, [
        [0, 1],
        [1.5, 2],
      ]),
    ).toBe(
      call('step', 1.6, [
        [0, 1],
        [1.5, 2],
      ]),
    );
  });

  it('empty key lists throw a named error', () => {
    expect(() => key(0, [])).toThrow(RangeError);
    expect(() => step(0, [])).toThrow(RangeError);
  });
});

describe('twos', () => {
  it('holds every pose for 1/12 s', () => {
    expect(twos(0)).toBe(0);
    expect(twos(0.05)).toBe(0);
    expect(twos(1 / 12)).toBe(1 / 12);
    expect(twos(0.1)).toBe(1 / 12);
    expect(twos(1 / 6)).toBe(2 / 12);
    expect(twos(1)).toBe(1);
  });

  it('quantises to multiples of 1/12 and equals the original', () => {
    for (let i = 0; i < 2000; i += 1) {
      const t = i / 240;
      expect(twos(t)).toBe(call('twos', t));
      expect(twos(t) * ANIM).toBeCloseTo(Math.round(twos(t) * ANIM), 9);
      expect(twos(t)).toBeLessThanOrEqual(t + 1e-6);
    }
  });
});

describe('acting clocks', () => {
  const spans = [
    [0.5, 1.5],
    [2, 3.2],
  ] as const;

  it('talk equals the original and is shut outside the spans', () => {
    for (let i = 0; i < 1000; i += 1) {
      const t = i / 200;
      expect(talk(t, 9, spans)).toBe(call('talk', t, 9, spans));
    }
    expect(talk(0.2, 9, spans)).toBe(0);
    expect(talk(1.7, 9, spans)).toBe(0);
    expect(talk(1, 9, spans)).toBeGreaterThan(0);
  });

  it('blink equals the original and is 0, 0.6 or 1', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 4000; i += 1) {
      const t = i / 200;
      const value = blink(t, 5);
      expect(value).toBe(call('blink', t, 5));
      seen.add(value);
    }
    expect([...seen].sort()).toEqual([0, 0.6, 1]);
  });
});

describe('palette', () => {
  it('equals the original tokens', () => {
    expect({ ...C }).toEqual({ ...original.C });
    expect(C.INK).toBe('#16120e');
  });

  it('shadeOf returns the _D sibling', () => {
    expect(shadeOf('RUST')).toBe(C.RUST_D);
    expect(shadeOf('SKIN_OLIVE')).toBe('#71633f');
  });
});
