import { describe, expect, it } from 'vitest';
import { BODY_ANCHOR_NAMES, anchorWorld, anchors } from './anchors.js';
import { FACE_ANCHOR_NAMES } from './character.js';
import { bowPt, figToWorld, palmWorld, type Placement, type Point2 } from './contact.js';
import { pose, type PoseName } from './poses.js';
import { palm } from './rig-ik.js';
import { solve } from './rig-layers.js';
import { headView, viewState } from './rig-views.js';
import { TEST_CHARACTER, WARDEN_DIMS as D } from './test-character.js';

const YAWS = [0, 1, 2, 3, -1, -2, -3] as const;
const POSES: readonly PoseName[] = ['stand', 'akimbo', 'point', 'armsUp', 'walk', 'slump'];
const dist = (a: Point2, b: readonly number[]): number =>
  Math.hypot(a[0] - (b[0] ?? 0), a[1] - (b[1] ?? 0));

describe('anchors', () => {
  it('agree with the solve: shoulder == arm root, hip == leg root, hand / palm == wrist / palm', () => {
    for (const name of POSES) {
      for (const yaw of YAWS) {
        const P = pose(name, D, 0.3);
        const J = solve(viewState(yaw), D, P);
        const A = anchors(TEST_CHARACTER, yaw, P);
        expect(Object.keys(A.body).sort()).toEqual([...BODY_ANCHOR_NAMES].sort());
        expect(dist(A.body['sh.L'], J.aL.s)).toBeLessThanOrEqual(2);
        expect(dist(A.body['sh.R'], J.aR.s)).toBeLessThanOrEqual(2);
        expect(dist(A.body['hip.L'], J.lL.s)).toBeLessThanOrEqual(2);
        expect(dist(A.body['hip.R'], J.lR.s)).toBeLessThanOrEqual(2);
        expect(A.body['hand.L']).toEqual([J.aL.h[0], J.aL.h[1]]);
        expect(A.body['palm.R']).toEqual(palm(J.aR, D.hsz));
        expect(A.body.neck).toEqual([
          TEST_CHARACTER.neck[viewState(yaw).v][0],
          TEST_CHARACTER.neck[viewState(yaw).v][1] + J.bob,
        ]);
      }
    }
  });

  it('near is the shoulder toward the camera', () => {
    const P = pose('stand', D);
    // profile facing right: the character's right side faces the camera
    expect(anchors(TEST_CHARACTER, 2, P).near).toBe('R');
    expect(anchors(TEST_CHARACTER, -2, P).near).toBe('L');
    const A = anchors(TEST_CHARACTER, 1, P);
    expect(A.body.shoulderNear).toEqual(A.body[A.near === 'L' ? 'sh.L' : 'sh.R']);
    expect(A.body.hipFar).toEqual(A.body[A.far === 'L' ? 'hip.L' : 'hip.R']);
  });

  it('places face anchors through the neck, head view, head scale, flip and jolt', () => {
    const P = pose('walk', D, 0.25);
    const k = TEST_CHARACTER.headScale;
    for (const yaw of YAWS) {
      for (const headYaw of [undefined, 0, 2, -1]) {
        const V = viewState(yaw);
        const H = headView(yaw, headYaw);
        const J = solve(V, D, P);
        const A = anchors(TEST_CHARACTER, yaw, P, {
          headDy: 5,
          ...(headYaw === undefined ? {} : { headYaw }),
        });
        const table = TEST_CHARACTER.faceAnchors?.[H.V.v] ?? {};
        const n = TEST_CHARACTER.neck[V.v];
        for (const name of FACE_ANCHOR_NAMES) {
          const q = table[name];
          if (!q) {
            expect(A.face[name]).toBeUndefined();
            continue;
          }
          const expected = [
            (n[2] ?? 0) + (H.flip ? -k : k) * q[0],
            (n[3] ?? 0) + J.bob + 5 + k * q[1],
          ];
          expect(dist(A.face[name] ?? [NaN, NaN], expected)).toBeLessThan(1e-9);
        }
      }
    }
    // the chin sits inside the guard's head box in the front view
    const chin = anchors(TEST_CHARACTER, 0, pose('stand', D)).face.chin;
    const head = D.head;
    if (!chin || !head) throw new Error('missing chin or head box');
    expect(chin[1]).toBeLessThanOrEqual(head.bottom + 2);
    expect(chin[1]).toBeGreaterThan(head.top);
  });
});

describe('anchorWorld', () => {
  it('matches palmWorld and places body anchors through bow, lean, scale and mirror', () => {
    const P = pose('point', D, -1);
    for (const yaw of YAWS) {
      const placement: Placement = { x: 820, y: 940, s: 0.7, yaw, lean: -6, bow: 22 };
      const fig = { character: TEST_CHARACTER, placement, pose: P };
      for (const side of ['L', 'R'] as const) {
        const a = anchorWorld(fig, side === 'L' ? 'palm.L' : 'palm.R');
        expect(dist(a ?? [NaN, NaN], palmWorld(fig, side))).toBeLessThan(1e-9);
      }
      const V = viewState(yaw);
      const A = anchors(TEST_CHARACTER, yaw, P);
      const hy = D.hy + solve(V, D, P).bob;
      const shoulder = figToWorld(placement, V.mir, -6, bowPt(A.body.shoulderNear, hy, 22));
      expect(anchorWorld(fig, 'shoulderNear')).toEqual(shoulder);
      // the hips are the hinge: not bowed
      expect(anchorWorld(fig, 'hipFar')).toEqual(figToWorld(placement, V.mir, -6, A.body.hipFar));
    }
  });

  it('returns null for a face anchor the head view lacks', () => {
    const fig = {
      character: TEST_CHARACTER,
      placement: { x: 0, y: 0, s: 1, yaw: 3 },
      pose: pose('stand', D),
    };
    expect(anchorWorld(fig, 'nose')).toBeNull();
    expect(anchorWorld(fig, 'ear')).not.toBeNull();
    const { faceAnchors, ...plain } = TEST_CHARACTER;
    expect(faceAnchors).toBeDefined();
    expect(
      anchorWorld({ ...fig, character: plain, placement: { ...fig.placement, yaw: 0 } }, 'chin'),
    ).toBeNull();
  });
});
