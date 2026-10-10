import { describe, expect, it } from 'vitest';
import type { Vec3 } from './poses.js';
import { elbowPole, kneePole, limbRig, palm, solveIK, solveIK3 } from './rig-ik.js';
import { viewState } from './rig-views.js';
import { YAWS, loadRigOriginal, origFn } from './rig-test-support.js';

const original = loadRigOriginal();
const orig = (name: string): ((...args: unknown[]) => unknown) => origFn(original, name);

const dist = (a: Vec3, b: Vec3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const allFinite = (...vs: Vec3[]): boolean => vs.every((v) => v.every((x) => Number.isFinite(x)));

// prettier-ignore
const ROOTS: readonly Vec3[] = [[70, -552, 8], [-70, -552, 8], [36, -340, 0], [0, 0, 0]];
// prettier-ignore
const TARGETS: readonly Vec3[] = [
  [90, -350, 30], [-90, -350, 40], [150, -800, 20], [0, -552, 200], [36, 0, 4], [300, 100, -300],
  [70, -552, 8], [71, -551, 8], [-20, -600, -50],
];
// prettier-ignore
const POLES: readonly Vec3[] = [
  [0.7, 0.25, -1], [-0.7, 0.25, -1], [0.18, 0, 1], [1, 0, -0.35], [0, 1, 0], [0, 0, 0], [0, -1, 0],
];

describe('solveIK3 (vs ST.ik)', () => {
  it('matches the original over a grid of roots, targets, lengths and poles', () => {
    for (const S of ROOTS) {
      for (const T of TARGETS) {
        for (const [l1, l2] of [
          [114, 108],
          [164, 150],
          [64, 60],
          [40, 90],
        ] as const) {
          for (const pole of POLES) {
            expect(solveIK3(S, T, l1, l2, pole)).toEqual(orig('ik')(S, T, l1, l2, pole));
          }
        }
      }
    }
  });

  it('keeps the bone lengths and clamps the reach when out of range', () => {
    const S: Vec3 = [0, 0, 0];
    const far: Vec3 = [0, 1000, 0];
    const [E, H] = solveIK3(S, far, 114, 108, [0, 0, 1]);
    expect(dist(S, H)).toBeCloseTo(114 + 108 - 0.5, 9);
    expect(dist(S, E)).toBeCloseTo(114, 6);
    expect(dist(E, H)).toBeCloseTo(108, 6);
    const near: Vec3 = [0, 1, 0];
    const [E2, H2] = solveIK3(S, near, 40, 90, [0, 0, 1]);
    expect(dist(S, H2)).toBeCloseTo(50 + 0.5, 9);
    expect(dist(S, E2)).toBeCloseTo(40, 6);
    expect(dist(E2, H2)).toBeCloseTo(90, 6);
    const reachable: Vec3 = [30, 150, 20];
    const [E3, H3] = solveIK3(S, reachable, 114, 108, [0, 0, 1]);
    expect(dist(H3, reachable)).toBeLessThan(1e-9);
    expect(dist(S, E3)).toBeCloseTo(114, 6);
  });

  it('bends toward the pole', () => {
    const [E] = solveIK3([0, 0, 0], [0, 150, 0], 100, 100, [0, 0, 1]);
    expect(E[2]).toBeGreaterThan(0);
    const [E2] = solveIK3([0, 0, 0], [0, 150, 0], 100, 100, [0, 0, -1]);
    expect(E2[2]).toBeLessThan(0);
  });

  it('never returns NaN: zero distance, zero pole, pole parallel to the limb, tiny or zero bones', () => {
    const S: Vec3 = [5, -10, 2];
    const cases: [Vec3, number, number, Vec3][] = [
      [S, 114, 108, [0, 0, 1]],
      [[5, 100, 2], 114, 108, [0, 0, 0]],
      [[5, 100, 2], 114, 108, [0, 1, 0]],
      [[5, -10, 300], 114, 108, [0, 0, 1]],
      [[5, 100, 2], 0, 0, [0, 0, 1]],
      [[5, 100, 2], 0.25, 0.25, [0, 0, 1]],
      [S, 0, 0, [0, 0, 0]],
    ];
    for (const [T, l1, l2, pole] of cases) {
      const [E, H] = solveIK3(S, T, l1, l2, pole);
      expect(allFinite(E, H), JSON.stringify([T, l1, l2, pole])).toBe(true);
    }
  });

  it('diverges from the original only where it produced NaN (bones summing to 0.5 px)', () => {
    const legacy = orig('ik')([0, 0, 0], [0, 10, 0], 0.25, 0.25, [0, 0, 1]) as Vec3[];
    expect(legacy.flat().some((x) => Number.isNaN(x))).toBe(true);
    const [E, H] = solveIK3([0, 0, 0], [0, 10, 0], 0.25, 0.25, [0, 0, 1]);
    expect(allFinite(E, H)).toBe(true);
  });
});

describe('solveIK (convenience)', () => {
  it('is solveIK3 with a straight forward / backward pole', () => {
    const a: Vec3 = [0, -340, 0];
    const b: Vec3 = [10, -20, 30];
    expect(solveIK(a, b, 164, 150, 1)).toEqual(solveIK3(a, b, 164, 150, [0, 0, 1]));
    expect(solveIK(a, b, 164, 150, -1)).toEqual(solveIK3(a, b, 164, 150, [0, 0, -1]));
    expect(solveIK(a, [0, 0, 0], 180, 180, 1)[0][2]).toBeGreaterThan(0);
    expect(solveIK(a, [0, 0, 0], 180, 180, -1)[0][2]).toBeLessThan(0);
  });
});

describe('limbRig, poles and palm (vs the original)', () => {
  it('limbRig matches for every view, plain and mirrored, with and without sideW', () => {
    for (const yaw of YAWS) {
      for (const S of ROOTS) {
        for (const T of TARGETS) {
          for (const pole of POLES.slice(0, 4)) {
            for (const sideW of [undefined, 0, 70, 36]) {
              expect(limbRig(viewState(yaw), S, T, 114, 108, pole, sideW)).toEqual(
                orig('limbRig')(orig('view')(yaw), S, T, 114, 108, pole, sideW),
              );
            }
          }
        }
      }
    }
  });

  it('elbowPole, kneePole and palm match', () => {
    for (const sgn of [1, -1]) {
      expect(elbowPole(sgn)).toEqual(orig('elbowPole')(sgn));
      expect(elbowPole(sgn, undefined)).toEqual(orig('elbowPole')(sgn, undefined));
      expect(elbowPole(sgn, 0)).toEqual(orig('elbowPole')(sgn, 0));
      expect(elbowPole(sgn, 0.85)).toEqual(orig('elbowPole')(sgn, 0.85));
      expect(kneePole(sgn)).toEqual(orig('kneePole')(sgn));
    }
    for (const yaw of YAWS) {
      const j = limbRig(viewState(yaw), [70, -552, 8], [120, -300, 90], 114, 108, elbowPole(1));
      for (const hsz of [32, 42]) expect(palm(j, hsz)).toEqual(orig('palm')(j, hsz));
    }
  });

  it('palm sits 0.55 x hsz from the wrist along the forearm', () => {
    const p = palm({ h: [10, 20, 0], ang: 0 }, 40);
    expect(p[0]).toBe(10);
    expect(p[1]).toBe(42);
    const q = palm({ h: [0, 0, 0], ang: 90 }, 40);
    expect(q[0]).toBeCloseTo(22, 9);
    expect(q[1]).toBeCloseTo(0, 9);
  });
});
