import { describe, expect, it } from 'vitest';
import type { CameraPose, Vec3 } from '../contract.js';
import { EASINGS, progressBetween, resolveEase } from './easing.js';
import { crane, dolly, lookAt, orbit, pushIn, shake, valueNoise, type CameraRig } from './rigs.js';

function expectVec(actual: Vec3 | undefined, expected: Vec3): void {
  expect(actual).toBeDefined();
  actual?.forEach((value, index) => {
    expect(value).toBeCloseTo(expected[index] ?? Number.NaN, 9);
  });
}

function expectPose(actual: CameraPose, expected: { position: Vec3; target: Vec3 }): void {
  expectVec(actual.position, expected.position);
  expectVec(actual.target, expected.target);
}

/** Samples a rig at t = 0, 0.5, 1 (default move from 0 to 1). */
const at = (rig: CameraRig): [CameraPose, CameraPose, CameraPose] => [rig(0), rig(0.5), rig(1)];

describe('easing', () => {
  it('maps 0 -> 0 and 1 -> 1 for every curve; symmetric curves hit 0.5 at 0.5', () => {
    for (const [name, ease] of Object.entries(EASINGS)) {
      expect(ease(0), name).toBeCloseTo(0, 12);
      expect(ease(1), name).toBeCloseTo(1, 12);
    }
    for (const name of [
      'linear',
      'easeInOutQuad',
      'easeInOutCubic',
      'easeInOutSine',
      'smoothstep',
    ] as const) {
      expect(EASINGS[name](0.5)).toBeCloseTo(0.5, 12);
    }
    expect(EASINGS.easeInQuad(0.5)).toBe(0.25);
    expect(EASINGS.easeOutCubic(0.5)).toBe(0.875);
  });

  it('holds before/after the window and rejects unknown names', () => {
    expect(progressBetween(-1, 0, 2, 'linear')).toBe(0);
    expect(progressBetween(1, 0, 2, 'linear')).toBe(0.5);
    expect(progressBetween(5, 0, 2, 'linear')).toBe(1);
    expect(progressBetween(2, 2, 2)).toBe(1);
    expect(progressBetween(1.9, 2, 2)).toBe(0);
    expect(progressBetween(0.5, 0, 1, (x) => x * 0.5)).toBe(0.25);
    expect(() => resolveEase('bouncy' as 'linear')).toThrow(
      /unknown ease "bouncy"; use one of: linear/,
    );
  });
});

describe('camera rigs at t = 0 / 0.5 / 1', () => {
  it('dolly moves in a straight line and can track a moving target', () => {
    const [start, middle, end] = at(
      dolly({
        start: [0, 1, 10],
        end: [4, 1, 2],
        target: [0, 1, 0],
        targetEnd: [2, 1, 0],
        ease: 'linear',
      }),
    );
    expectPose(start, { position: [0, 1, 10], target: [0, 1, 0] });
    expectPose(middle, { position: [2, 1, 6], target: [1, 1, 0] });
    expectPose(end, { position: [4, 1, 2], target: [2, 1, 0] });
  });

  it('orbit circles the target (0 deg = +Z, 90 deg = +X) at a fixed height', () => {
    const rig = orbit({
      target: [1, 1, 0],
      radius: 5,
      height: 2,
      degrees: [0, 90],
      ease: 'linear',
    });
    const half = Math.SQRT1_2 * 5;
    const [start, middle, end] = at(rig);
    expectPose(start, { position: [1, 3, 5], target: [1, 1, 0] });
    expectPose(middle, { position: [1 + half, 3, half], target: [1, 1, 0] });
    expectPose(end, { position: [6, 3, 0], target: [1, 1, 0] });
  });

  it('pushIn moves along the direction from dist[0] to dist[1] with the default ease', () => {
    const rig = pushIn({ target: [0, 1, 0], dist: [6, 2], direction: [0, 0, 2] });
    const [start, middle, end] = at(rig);
    expectPose(start, { position: [0, 1, 6], target: [0, 1, 0] });
    expectPose(middle, { position: [0, 1, 4], target: [0, 1, 0] });
    expectPose(end, { position: [0, 1, 2], target: [0, 1, 0] });
    // easeInOutCubic: a quarter of the way in time is 1/16 of the way in distance.
    expectVec(rig(0.25).position, [0, 1, 6 - 4 / 16]);
    expect(() => pushIn({ dist: [1, 2], direction: [0, 0, 0] })).toThrow(/non-zero/);
  });

  it('pushIn honours from/to windows and holds outside them (PLAN §3.2 example)', () => {
    const rig = pushIn({ from: 1, to: 3, dist: [6, 3.5], ease: 'linear' });
    expect(rig(0)).toEqual(rig(1));
    expect(rig(3)).toEqual(rig(10));
    const length = (pose: CameraPose): number => Math.hypot(...pose.position);
    expect(length(rig(0))).toBeCloseTo(6, 9);
    expect(length(rig(2))).toBeCloseTo(4.75, 9);
    expect(length(rig(3))).toBeCloseTo(3.5, 9);
  });

  it('crane rises at a fixed distance and can tilt the look-at point', () => {
    const rig = crane({
      height: [0.5, 4.5],
      dist: 6,
      degrees: 90,
      targetHeight: [0, 2],
      ease: 'linear',
    });
    const [start, middle, end] = at(rig);
    expectPose(start, { position: [6, 0.5, 0], target: [0, 0, 0] });
    expectPose(middle, { position: [6, 2.5, 0], target: [0, 1, 0] });
    expectPose(end, { position: [6, 4.5, 0], target: [0, 2, 0] });
  });

  it('lookAt keeps the position and pans the target; fov can zoom', () => {
    const rig = lookAt({
      position: [0, 2, 8],
      target: [-2, 0, 0],
      targetEnd: [2, 0, 0],
      ease: 'linear',
      fov: [50, 30],
    });
    const [start, middle, end] = at(rig);
    expectPose(start, { position: [0, 2, 8], target: [-2, 0, 0] });
    expectPose(middle, { position: [0, 2, 8], target: [0, 0, 0] });
    expectPose(end, { position: [0, 2, 8], target: [2, 0, 0] });
    expect([start.fov, middle.fov, end.fov]).toEqual([50, 40, 30]);
  });
});

describe('shake', () => {
  const base: CameraPose = { position: [0, 2, 8], target: [0, 1, 0], fov: 45 };

  it('is deterministic per seed and differs between seeds', () => {
    const times = [0, 0.13, 0.5, 1, 2.71];
    const sample = (seed: number): CameraPose[] =>
      times.map((t) => shake(base, { amplitude: 0.3, seed })(t));
    expect(sample(7)).toEqual(sample(7));
    expect(sample(7)).not.toEqual(sample(8));
    for (const pose of sample(7)) {
      expect(pose.fov).toBe(45);
      pose.position.forEach((value, index) => {
        expect(Math.abs(value - (base.position[index] ?? 0))).toBeLessThanOrEqual(0.3);
      });
    }
  });

  it('is continuous in t (smooth noise, not per-frame jitter)', () => {
    const rig = shake(base, { amplitude: 1, seed: 3, frequency: 8 });
    for (let t = 0; t < 2; t += 0.05) {
      const a = rig(t).position;
      const b = rig(t + 1e-4).position;
      expect(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])).toBeLessThan(0.01);
    }
    expect(valueNoise(1, 0, 3)).toBe(valueNoise(1, 0, 3));
    expect(Math.abs(valueNoise(1, 0, 3.5))).toBeLessThanOrEqual(1);
  });

  it('is off outside its window, decays, and wraps rigs', () => {
    const rig = shake(base, { amplitude: 0.5, seed: 1, from: 1, to: 2, decay: 0.2 });
    expect(rig(0.5)).toBe(base);
    expect(rig(2.5)).toBe(base);
    expect(rig(1.3)).not.toEqual(base);
    const offset = (t: number): number => {
      const position = rig(t).position;
      return Math.hypot(position[0], position[1] - 2, position[2] - 8);
    };
    expect(Math.max(...[1.9, 1.93, 1.96].map(offset))).toBeLessThan(
      0.5 * Math.exp(-0.85 / 0.2) * 2,
    );
    const orbiting = orbit({ radius: 5, degrees: [0, 90], ease: 'linear' });
    expect(shake(orbiting, { amplitude: 0 })(0.5)).toEqual(orbiting(0.5));
  });
});
