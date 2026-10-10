import { describe, expect, it } from 'vitest';
import { ANIM } from '../core.js';
import type { Vec3 } from './poses.js';
import {
  RING,
  VIEWS,
  VIEW_DEG,
  headView,
  proj,
  turn,
  viewIndex,
  viewName,
  viewState,
  yawOfRing,
  yawOfView,
  type RingKey,
  type ViewIndex,
} from './rig-views.js';
import { YAWS, loadRigOriginal, origFn } from './rig-test-support.js';

const original = loadRigOriginal();
const orig = (name: string): ((...args: unknown[]) => unknown) => origFn(original, name);

// prettier-ignore
const POINTS: readonly Vec3[] = [
  [0, 0, 0], [70, -552, 8], [-70, -552, 8], [36, -340, 0], [120, -300, 90], [-45, -700, -60], [0.5, -1, 300],
];

const TIMES = Array.from({ length: 97 }, (_, i) => i / 24);

describe('ring and turn (vs the original)', () => {
  it('yawOfRing walks the ring for any integer, spins included', () => {
    expect([...RING]).toEqual([0, 1, 2, 3, -2, -1]);
    for (let i = -14; i <= 14; i += 1) expect(yawOfRing(i), String(i)).toBe(orig('yawOfRing')(i));
    expect(yawOfRing(2.4)).toBe(orig('yawOfRing')(2.4));
  });

  it('turn matches the original for several key tables and rates', () => {
    const tables: RingKey[][] = [
      [[0, 0]],
      [
        [0, 0],
        [0.5, 2],
      ],
      [
        [0, 0],
        [0.5, 3],
        [1.5, 6],
        [2.2, 4],
      ],
      [
        [0, 2],
        [1, -1],
        [3, 9],
      ],
    ];
    for (const keys of tables) {
      for (const rate of [undefined, 6, 24]) {
        for (const t of TIMES) {
          expect(
            turn(t, keys, rate),
            `${JSON.stringify(keys)} r${String(rate)} @${String(t)}`,
          ).toBe(orig('turn')(t, keys, rate));
        }
      }
    }
  });

  it('turns one view per animation frame (never a flip) and throws on an empty table', () => {
    const keys: RingKey[] = [
      [0, 0],
      [1, 3],
    ];
    expect(turn(0.99, keys)).toBe(0);
    expect(turn(1, keys)).toBe(1);
    expect(turn(1 + 1 / ANIM, keys)).toBe(2);
    expect(turn(1 + 2 / ANIM, keys)).toBe(3);
    expect(turn(5, keys)).toBe(3);
    expect(() => turn(0, [])).toThrow(RangeError);
  });
});

describe('view state and names', () => {
  it('viewState matches ST.view for every ring yaw and the mirrored back', () => {
    for (const yaw of YAWS) expect(viewState(yaw), String(yaw)).toEqual(orig('view')(yaw));
  });

  it('rounds non-integer yaws and treats non-finite yaws as front', () => {
    expect(viewState(1.4)).toEqual({ yaw: 1.4, v: 1, mir: false });
    expect(viewState(-2.6)).toEqual({ yaw: -2.6, v: 3, mir: true });
    expect(viewState(7)).toEqual({ yaw: 7, v: 3, mir: false });
    expect(viewState(Number.NaN)).toEqual({ yaw: 0, v: 0, mir: false });
  });

  it('converts names, indices and yaws both ways', () => {
    expect(VIEWS).toEqual(['front', 'three-quarter', 'profile', 'back']);
    for (const v of [0, 1, 2, 3] as const satisfies readonly ViewIndex[]) {
      const name = viewName(v);
      expect(viewIndex(name)).toBe(v);
      expect(viewState(yawOfView(name)).v).toBe(v);
      expect(viewState(yawOfView(name, true)).v).toBe(v);
      expect(viewState(yawOfView(name, true)).mir).toBe(v > 0);
    }
    expect(yawOfView('three-quarter', true)).toBe(-1);
    expect(yawOfView('back', true)).toBe(-3);
    expect(yawOfView('front', true)).toBe(0);
  });
});

describe('projection', () => {
  it('matches ST.proj for all views, plain and mirrored', () => {
    for (const yaw of YAWS) {
      for (const p of POINTS) {
        expect(proj(viewState(yaw), p), `${String(yaw)} ${p.join(',')}`).toEqual(
          orig('proj')(orig('view')(yaw), p),
        );
      }
    }
  });

  it('a mirrored view is a true rotation once figure() flips it (the right hand stays right)', () => {
    for (const v of [1, 2, 3] as const) {
      const a = (-VIEW_DEG[v] * Math.PI) / 180;
      for (const p of POINTS) {
        const q = proj({ yaw: -v, v, mir: true }, p);
        // figure() scales x by -1 for a mirrored view: the result must equal a rotation by -deg.
        expect(-q[0]).toBeCloseTo(p[2] * Math.sin(a) + p[0] * Math.cos(a), 9);
        expect(q[1]).toBe(p[1]);
        expect(q[2]).toBeCloseTo(p[2] * Math.cos(a) - p[0] * Math.sin(a), 9);
      }
    }
  });

  it('profile right shows the right side, mirrored profile the left side', () => {
    const leftShoulder: Vec3 = [70, -552, 0];
    const rightShoulder: Vec3 = [-70, -552, 0];
    expect(proj(viewState(2), leftShoulder)[2]).toBeLessThan(0);
    expect(proj(viewState(2), rightShoulder)[2]).toBeGreaterThan(0);
    expect(proj(viewState(-2), leftShoulder)[2]).toBeGreaterThan(0);
    expect(proj(viewState(-2), rightShoulder)[2]).toBeLessThan(0);
    // front: the character's left is screen right; back: swapped
    expect(proj(viewState(0), leftShoulder)[0]).toBe(70);
    expect(proj(viewState(3), leftShoulder)[0]).toBeCloseTo(-70, 9);
  });
});

describe('headView', () => {
  it('matches ST.headView for every body / head yaw pair (and no head yaw)', () => {
    for (const body of YAWS) {
      for (const head of [undefined, ...YAWS]) {
        expect(headView(body, head), `${String(body)} ${String(head)}`).toEqual(
          orig('headView')(body, head),
        );
      }
    }
  });

  it('flips the head only when it faces the other way than the body', () => {
    expect(headView(1).flip).toBe(false);
    expect(headView(1, -2)).toEqual({ V: { yaw: -2, v: 2, mir: true }, flip: true });
    expect(headView(-1, -2).flip).toBe(false);
    expect(headView(-1, 0).flip).toBe(true);
  });
});
