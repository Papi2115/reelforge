import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  applyDollyZoom,
  applyOrbit,
  cameraForward,
  cameraRight,
  DOLLY_ZOOM_FOV_RANGE,
  dollyZoomFov,
  moveProgress,
  moveWindow,
  parallaxOffset,
  subjectPoint,
  viewDepth,
} from './moves.js';

const WIDTH = 640;
const HEIGHT = 360;

function camera(position: THREE.Vector3Tuple, target: THREE.Vector3Tuple, fov = 50) {
  const result = new THREE.PerspectiveCamera(fov, WIDTH / HEIGHT, 0.1, 1000);
  result.position.set(...position);
  result.lookAt(...target);
  result.updateMatrixWorld();
  return result;
}

/** Pixel position (x right, y down) of a world point in a 640x360 frame. */
function project(view: THREE.PerspectiveCamera, point: THREE.Vector3): [number, number] {
  view.updateMatrixWorld();
  const ndc = point.clone().project(view);
  return [((ndc.x + 1) / 2) * WIDTH, ((1 - ndc.y) / 2) * HEIGHT];
}

describe('move timing', () => {
  it('takes numbers as they are and anchors as their start (t0) and end (t1)', () => {
    expect(moveWindow({ t0: 1, t1: 2 })).toEqual([1, 2]);
    const hit = { t: 1.5, tEnd: 2.25 };
    expect(moveWindow({ t0: hit, t1: hit })).toEqual([1.5, 2.25]);
    expect(moveProgress({ t0: hit, t1: hit, ease: 'linear' }, 1.875)).toBeCloseTo(0.5, 12);
    expect(moveProgress({ t0: 1, t1: 2 }, 0)).toBe(0);
    expect(moveProgress({ t0: 1, t1: 2 }, 5)).toBe(1);
  });
});

describe('dolly zoom', () => {
  const subject = new THREE.Vector3(0.4, 1.2, -0.5);
  const base = (): THREE.PerspectiveCamera => camera([0.6, 1.6, 5.5], [0.4, 1.2, -0.5], 50);

  it('keeps the subject plane within 1 px of its size and place from 2 to 14 units', () => {
    const reference = base();
    const right = cameraRight(reference);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(reference.quaternion);
    // A 1.2 x 2 card at the subject, facing the camera (the hero's silhouette).
    const corners = [
      subject.clone().addScaledVector(right, -0.6).addScaledVector(up, -1),
      subject.clone().addScaledVector(right, 0.6).addScaledVector(up, 1),
    ] as const;
    const box = (view: THREE.PerspectiveCamera): number[] => [
      ...project(view, corners[0]),
      ...project(view, corners[1]),
    ];
    const expected = box(reference);
    for (const distance of [2, 3.5, 6, 9, 14]) {
      const view = base();
      expect(applyDollyZoom(view, subject, distance)).toBe(true);
      expect(viewDepth(view, subject)).toBeCloseTo(distance, 9);
      box(view).forEach((value, index) => {
        expect(Math.abs(value - (expected[index] ?? Number.NaN))).toBeLessThan(1);
      });
    }
  });

  it('widens the view when dollying in and narrows it when dollying out', () => {
    const view = base();
    const depth = viewDepth(view, subject);
    expect(dollyZoomFov(depth, 50, depth / 2)).toBeGreaterThan(50);
    expect(dollyZoomFov(depth, 50, depth * 2)).toBeLessThan(50);
    expect(dollyZoomFov(depth, 50, depth)).toBeCloseTo(50, 9);
    expect(dollyZoomFov(depth, 50, 1e-6)).toBe(DOLLY_ZOOM_FOV_RANGE[1]);
  });

  it('refuses a subject behind the camera and leaves the camera alone', () => {
    const view = base();
    const before = view.position.clone();
    expect(applyDollyZoom(view, new THREE.Vector3(0.6, 1.6, 9), 3)).toBe(false);
    expect(view.position.equals(before)).toBe(true);
  });
});

describe('orbit move', () => {
  const pivot = new THREE.Vector3(0.6, 1.1, -0.5);

  it('preserves the radius and keeps looking at the pivot for any angle and axis', () => {
    for (const axis of ['y', 'x', [0.3, 1, 0.2]] as const) {
      for (const degrees of [-90, 0, 33, 180, 270]) {
        const view = camera([0.6, 2.4, 6.2], [0.6, 1.1, -0.5]);
        const radius = view.position.distanceTo(pivot);
        expect(applyOrbit(view, pivot, degrees, axis)).toBe(true);
        expect(view.position.distanceTo(pivot)).toBeCloseTo(radius, 9);
        const toPivot = pivot.clone().sub(view.position).normalize();
        expect(cameraForward(view).dot(toPivot)).toBeCloseTo(1, 9);
      }
    }
  });

  it('moves to the requested radius first', () => {
    const view = camera([0.6, 2.4, 6.2], [0.6, 1.1, -0.5]);
    applyOrbit(view, pivot, 45, 'y', 4);
    expect(view.position.distanceTo(pivot)).toBeCloseTo(4, 9);
  });

  it("turns about world up for 'y' (height kept) and over the subject for 'x'", () => {
    const view = camera([0.6, 2.4, 6.2], [0.6, 1.1, -0.5]);
    applyOrbit(view, pivot, 90, 'y');
    expect(view.position.y).toBeCloseTo(2.4, 9);
    expect(view.position.x).toBeGreaterThan(pivot.x + 6);
    const over = camera([0.6, 1.1, 6.2], [0.6, 1.1, -0.5]);
    applyOrbit(over, pivot, 30, 'x');
    expect(over.position.y).toBeGreaterThan(1.1 + 3);
  });

  it('refuses a radius when the camera sits on the pivot', () => {
    const view = camera([0.6, 1.1, -0.5], [0, 0, -9]);
    expect(applyOrbit(view, pivot, 45, 'y', 3)).toBe(false);
  });
});

describe('parallax', () => {
  it('moves each layer at its ratio of the natural screen motion', () => {
    const points = [new THREE.Vector3(-1, 1, 2), new THREE.Vector3(0.5, 1.5, -3)];
    const truck = 1.5;
    for (const point of points) {
      const start = camera([0, 1.5, 6], [0, 1.2, -1]);
      const before = project(start, point);
      const right = cameraRight(start);
      const natural = project(
        (() => {
          const moved = start.clone();
          moved.position.addScaledVector(right, truck);
          return moved;
        })(),
        point,
      );
      for (const ratio of [0, 0.4, 1, 2]) {
        const moved = start.clone();
        moved.position.addScaledVector(right, truck);
        const shifted = point.clone().add(parallaxOffset(right, truck, ratio));
        const after = project(moved, shifted);
        const naturalShift = natural[0] - before[0];
        expect(Math.abs(naturalShift)).toBeGreaterThan(10);
        expect((after[0] - before[0]) / naturalShift).toBeCloseTo(ratio, 6);
        expect(after[1]).toBeCloseTo(before[1], 6);
      }
    }
  });
});

describe('subjects', () => {
  it('uses a point as is and an object by its world bounding-box centre', () => {
    expect(subjectPoint([1, 2, 3]).toArray()).toEqual([1, 2, 3]);
    const group = new THREE.Group();
    group.position.set(2, 0, -1);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1));
    mesh.position.y = 1;
    group.add(mesh);
    expect(subjectPoint(group).toArray()).toEqual([2, 1, -1]);
    expect(subjectPoint(new THREE.Group()).toArray()).toEqual([0, 0, 0]);
  });
});
