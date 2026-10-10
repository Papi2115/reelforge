import { describe, expect, it } from 'vitest';
import { DEFAULT_SET_BOUNDS, coverage, type SetBounds } from './camera-coverage.js';
import { cutSchema, cutTableSchema, framingSchema } from './camera-schema.js';
import type { Cut } from './camera.js';

const BASE = { at: 0, x: 960, y: 540, z: 1 };

describe('cut table schema', () => {
  it('accepts hard cuts, named cuts and moves', () => {
    const table: unknown = [
      BASE,
      { at: 1.5, name: 'cu', x: 700, y: 400, z: 2.2, rot: -4 },
      { at: 3, x: 500, y: 500, z: 1.5, ease: 'back', end: 4, to: { x: 600, y: 450, z: 2, rot: 6 } },
      { at: 4, x: 0, y: 1330, z: 5.4, rot: 7, ease: 'cut' },
    ];
    const parsed = cutTableSchema.parse(table);
    expect(parsed).toHaveLength(4);
    expect(parsed[1]?.name).toBe('cu');
  });

  it.each([
    ['z = 0', { ...BASE, z: 0 }],
    ['z above 5.4', { ...BASE, z: 5.5 }],
    ['z below 0.8', { ...BASE, z: 0.79 }],
    ['rot = 8', { ...BASE, rot: 8 }],
    ['rot = -7.5', { ...BASE, rot: -7.5 }],
    ['missing z', { at: 0, x: 960, y: 540 }],
    ['negative at', { ...BASE, at: -0.1 }],
    ['`to` without `end`', { ...BASE, to: { x: 1, y: 1, z: 1 } }],
    ['`end` not after `at`', { ...BASE, at: 2, end: 2 }],
    ['unknown ease', { ...BASE, ease: 'bounce' }],
    ['unknown field', { ...BASE, zoom: 2 }],
    ['infinite x', { ...BASE, x: Infinity }],
    ['NaN y', { ...BASE, y: Number.NaN }],
    ['empty name', { ...BASE, name: '' }],
    ['`to` out of range', { ...BASE, end: 1, to: { x: 1, y: 1, z: 6 } }],
    ['`to` with an unknown field', { ...BASE, end: 1, to: { x: 1, y: 1, z: 1, tilt: 2 } }],
  ])('rejects a cut with %s', (_label, cut) => {
    expect(cutSchema.safeParse(cut).success).toBe(false);
  });

  it('rejects empty, unsorted and duplicate-time tables', () => {
    expect(cutTableSchema.safeParse([]).success).toBe(false);
    expect(
      cutTableSchema.safeParse([
        { ...BASE, at: 2 },
        { ...BASE, at: 1 },
      ]).success,
    ).toBe(false);
    expect(cutTableSchema.safeParse([BASE, { ...BASE }]).success).toBe(false);
  });

  it('accepts the range limits themselves', () => {
    expect(framingSchema.safeParse({ x: 0, y: 0, z: 0.8, rot: -7 }).success).toBe(true);
    expect(framingSchema.safeParse({ x: 0, y: 0, z: 5.4, rot: 7 }).success).toBe(true);
  });
});

describe('coverage', () => {
  // a set exactly one frame wide around the neutral framing, plus a margin of 100 px
  const SET: SetBounds = { x0: -100, y0: -100, x1: 2020, y1: 1180 };

  it('exports the film set bounds', () => {
    expect(DEFAULT_SET_BOUNDS).toEqual({ x0: -300, y0: -300, x1: 2300, y1: 1300 });
  });

  it('passes framings inside the set (including an exact touch)', () => {
    const cuts: Cut[] = [
      { at: 0, x: 960, y: 540, z: 1 },
      { at: 1, x: 300, y: 300, z: 3, rot: 5 },
      { at: 2, x: 860, y: 440, z: 1 },
    ];
    expect(coverage(cuts, SET)).toEqual([]);
  });

  it.each([
    ['left', { x: 700, y: 540, z: 1 }, 160],
    ['right', { x: 1300, y: 540, z: 1 }, 240],
    ['top', { x: 960, y: 300, z: 1 }, 140],
    ['bottom', { x: 960, y: 800, z: 1 }, 160],
  ] as const)('reports the %s side overflowing', (side, framing, px) => {
    const issues = coverage([{ at: 0.5, name: 'shot', ...framing }], SET);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.sides).toEqual([side]);
    expect(issues[0]?.overflow[side]).toBeCloseTo(px, 9);
    expect(issues[0]).toMatchObject({ index: 0, at: 0.5, name: 'shot', worstAt: 0.5 });
  });

  it('accounts for the roll enlarging the footprint', () => {
    const tight: SetBounds = { x0: -20, y0: -20, x1: 1940, y1: 1100 };
    const level: Cut = { at: 0, x: 960, y: 540, z: 1 };
    expect(coverage([level], tight)).toEqual([]);
    const issues = coverage([{ ...level, rot: 6 }], tight);
    expect(issues[0]?.sides).toEqual(['left', 'top', 'right', 'bottom']);
  });

  it('checks the `to` of a move and the sampled path, not only the start', () => {
    const move: Cut = { at: 1, x: 960, y: 540, z: 1.2, end: 3, to: { x: 1500, y: 540, z: 1.2 } };
    const issues = coverage([{ at: 0, x: 960, y: 540, z: 1 }, move], SET);
    expect(issues.map((i) => i.index)).toEqual([1]);
    expect(issues[0]?.sides).toEqual(['right']);
    expect(issues[0]?.worstAt).toBe(3);
    expect(issues[0]?.name).toBeUndefined();
    expect(coverage([{ ...move, ease: 'cut' }], SET)).toEqual([]);
  });

  it('catches a `back` overshoot past an endpoint that itself fits', () => {
    const fits: Cut = { at: 0, x: 960, y: 540, z: 1, end: 2, to: { x: 1060, y: 540, z: 1 } };
    expect(coverage([fits], SET)).toEqual([]);
    const issues = coverage([{ ...fits, ease: 'back' }], SET);
    expect(issues[0]?.sides).toEqual(['right']);
    expect(issues[0]?.worstAt).toBeGreaterThan(0);
    expect(issues[0]?.worstAt).toBeLessThan(2);
  });

  it('uses the clamped camera and the frame size', () => {
    expect(coverage([{ at: 0, x: 960, y: 540, z: 0.5 }], SET)).toEqual(
      coverage([{ at: 0, x: 960, y: 540, z: 0.8 }], SET),
    );
    expect(
      coverage([{ at: 0, x: 960, y: 540, z: 1 }], SET, { w: 1080, h: 1920 })[0]?.sides,
    ).toEqual(['top', 'bottom']);
  });

  it('defaults to the film set bounds', () => {
    expect(coverage([{ at: 0, x: 960, y: 540, z: 0.8 }])).toEqual([]);
    expect(coverage([{ at: 0, x: 1820, y: 160, z: 1.5, rot: -7 }])[0]?.sides).toEqual(['right']);
  });
});
