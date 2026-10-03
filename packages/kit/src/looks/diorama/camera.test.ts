import { describe, expect, it } from 'vitest';
import type { Vec3 } from '../../types.js';
import { idlePan, isoBasis, isoCameraPose, pixelWorldSize, type IsoBounds } from './camera.js';

const BOUNDS: IsoBounds = { min: [-5, -1, -4], max: [5, 3, 4] };

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

describe('iso camera preset', () => {
  it('has an orthonormal basis with the camera on the +x/+z corner', () => {
    const { back, right, up } = isoBasis(45, 30);
    expect(dot(back, right)).toBeCloseTo(0);
    expect(dot(back, up)).toBeCloseTo(0);
    expect(dot(right, up)).toBeCloseTo(0);
    expect(back[0]).toBeGreaterThan(0);
    expect(back[2]).toBeCloseTo(back[0]);
    expect(Math.asin(back[1]) * (180 / Math.PI)).toBeCloseTo(30);
    expect(up[1]).toBeGreaterThan(0);
  });

  it('looks from the iso angle and frames the bounds inside the margin', () => {
    const pose = isoCameraPose({ bounds: BOUNDS, screen: [640, 360] });
    const offset = sub(pose.position, pose.target);
    const distance = Math.hypot(...offset);
    const { back, right, up } = isoBasis(45, 30);
    for (let axis = 0; axis < 3; axis += 1) {
      expect((offset[axis] ?? 0) / distance).toBeCloseTo(back[axis] ?? 0);
    }
    const halfHeight = distance * Math.tan((pose.fov * Math.PI) / 360);
    const halfWidth = halfHeight * (640 / 360);
    for (const x of [BOUNDS.min[0], BOUNDS.max[0]]) {
      for (const y of [BOUNDS.min[1], BOUNDS.max[1]]) {
        for (const z of [BOUNDS.min[2], BOUNDS.max[2]]) {
          const relative = sub([x, y, z], pose.target);
          expect(Math.abs(dot(relative, right))).toBeLessThanOrEqual(halfWidth * 0.93);
          expect(Math.abs(dot(relative, up))).toBeLessThanOrEqual(halfHeight * 0.93);
        }
      }
    }
  });

  it('snaps the target to whole output pixels in the image plane', () => {
    const { right, up } = isoBasis(45, 30);
    for (const pan of [0, 0.3, 2.7, -5.5]) {
      const pose = isoCameraPose({ bounds: BOUNDS, pan, screen: [640, 360] });
      const distance = Math.hypot(...sub(pose.position, pose.target));
      const pixel = pixelWorldSize(distance, pose.fov, 360);
      for (const axis of [right, up]) {
        const steps = dot(pose.target, axis) / pixel;
        expect(Math.abs(steps - Math.round(steps))).toBeLessThan(1e-6);
      }
    }
  });

  it('zooms towards a focus point and offsets the subject in frame fractions', () => {
    const wide = isoCameraPose({ bounds: BOUNDS });
    const close = isoCameraPose({ bounds: BOUNDS, zoom: 2, focus: [3, 0, 2] });
    const wideDistance = Math.hypot(...sub(wide.position, wide.target));
    const closeDistance = Math.hypot(...sub(close.position, close.target));
    expect(closeDistance).toBeCloseTo(wideDistance / 2);
    const { right } = isoBasis(45, 30);
    const pixel = pixelWorldSize(closeDistance, close.fov, 360);
    expect(Math.abs(dot(sub(close.target, [3, 0, 2]), right))).toBeLessThanOrEqual(pixel);
    const shifted = isoCameraPose({ bounds: BOUNDS, offset: [-0.2, 0] });
    // The subject moves left, i.e. the camera looks further right.
    expect(dot(shifted.target, right)).toBeGreaterThan(dot(wide.target, right));
  });

  it('is a pure function of its input', () => {
    const input = { bounds: BOUNDS, zoom: 1.3, pan: idlePan(2.2, 6), offset: [0.1, 0] as const };
    expect(isoCameraPose(input)).toEqual(isoCameraPose(input));
  });

  it('pans idly as a slow sine that starts at zero', () => {
    expect(idlePan(0, 6)).toBe(0);
    expect(idlePan(3, 6)).toBeCloseTo(6);
    expect(idlePan(9, 6)).toBeCloseTo(-6);
    expect(idlePan(5, 0)).toBe(0);
  });
});
