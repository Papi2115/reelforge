import { describe, expect, it } from 'vitest';
import type { RigDims } from './character.js';
import { POSE_NAMES, handAt, pose, type Pose, type Vec3 } from './poses.js';
import type { LimbRig } from './rig-ik.js';
import { FIGURE_ORDER, armLayer, guard, legsFarFirst, solve } from './rig-layers.js';
import { proj, viewState, type ViewState } from './rig-views.js';
import { COMMANDER, CROWD, YAWS, YOU, loadRigOriginal, origFn } from './rig-test-support.js';

const original = loadRigOriginal();
const orig = (name: string): ((...args: unknown[]) => unknown) => origFn(original, name);

const PHASES = [0, 0.3, 0.75];

/** Poses with a hand driven into the face, so the guard has work to do. */
function faceHands(D: RigDims): Pose[] {
  const head = D.head;
  const y = head ? (head.top + head.bottom) / 2 : D.sy - 80;
  return [
    pose('stand', D, 0, { hL: [10, y, 40], hR: [-10, y + 20, 30] }),
    pose('stand', D, 0, { hL: [0, y, 0], hR: [-60, y - 30, 80], kR: 'open' }),
    pose('jig', D, 0.25, { hR: handAt(D, -1, -0.6, -0.4, 0.3) }),
    pose('stand', D, 0, { hL: [30, y, -50], bob: 0.08 }),
  ];
}

function allPoses(D: RigDims): Pose[] {
  const out: Pose[] = [];
  for (const name of POSE_NAMES) {
    for (const ph of name === 'point' ? [1, -1] : PHASES) out.push(pose(name, D, ph));
  }
  return [...out, ...faceHands(D)];
}

describe('solve (vs ST.solve)', () => {
  it('matches the original for every pose, view and mirror, three bodies', () => {
    for (const D of [COMMANDER, YOU, CROWD]) {
      for (const P of allPoses(D)) {
        for (const yaw of YAWS) {
          expect(solve(viewState(yaw), D, P)).toEqual(orig('solve')(orig('view')(yaw), D, P));
        }
      }
    }
  });

  it('the right hand stays the right hand in mirrored views', () => {
    const P = pose('point', COMMANDER, -1);
    for (const yaw of [1, 2, -1, -2]) {
      const J = solve(viewState(yaw), COMMANDER, P);
      expect(J.aR.H3[0]).toBeLessThan(0);
      expect(J.aL.H3[0]).toBeGreaterThan(0);
    }
    // facing right we see the right side, facing left the left side
    expect(solve(viewState(2), COMMANDER, P).aL.behind).toBe(true);
    expect(solve(viewState(2), COMMANDER, P).aR.behind).toBe(false);
    expect(solve(viewState(-2), COMMANDER, P).aL.behind).toBe(false);
    expect(solve(viewState(-2), COMMANDER, P).aR.behind).toBe(true);
  });

  it('drops the shoulders, hips and hand targets by the bob', () => {
    const P = pose('slump', COMMANDER);
    const J = solve(viewState(0), COMMANDER, P);
    expect(J.bob).toBeCloseTo(0.12 * (164 + 150), 9);
    expect(J.aL.s[1]).toBeCloseTo(COMMANDER.sy + J.bob, 9);
    expect(J.lL.s[1]).toBeCloseTo(COMMANDER.hy + J.bob, 9);
  });
});

describe('face guard', () => {
  const head = COMMANDER.head;
  if (!head) throw new Error('fixture without a head box');
  const margin = head.hw + 34;
  /** A body point that projects to screen x `sx` at height y with depth 0 in view V. */
  const onScreen = (V: ViewState, sx: number, y: number): Vec3 => {
    const a = ([0, 45, 90, 180][V.v] ?? 0) * (Math.PI / 180);
    const x = sx * Math.cos(a);
    return [V.mir ? -x : x, y, sx * Math.sin(a)];
  };

  it('slides a target inside the head box to the nearer edge, in every view and mirror', () => {
    for (const yaw of YAWS) {
      const V = viewState(yaw);
      const cx = head.x[V.v];
      for (const off of [-40, -5, 0, 12, 60]) {
        for (const bob of [0, 25]) {
          const y = (head.top + head.bottom) / 2 + bob;
          const T = onScreen(V, cx + off, y);
          expect(proj(V, T)[0]).toBeCloseTo(cx + off, 9);
          const G = guard(V, COMMANDER, T, bob);
          const p = proj(V, G);
          const side = off >= 0 ? 1 : -1;
          expect(p[0], `${String(yaw)} ${String(off)}`).toBeCloseTo(cx + side * margin, 6);
          expect(G[1]).toBe(T[1]);
          expect(p[2]).toBeCloseTo(proj(V, T)[2], 6);
        }
      }
    }
  });

  it('leaves targets outside the box untouched (same object)', () => {
    for (const yaw of YAWS) {
      const V = viewState(yaw);
      const cx = head.x[V.v];
      const mid = (head.top + head.bottom) / 2;
      const outside = [
        onScreen(V, cx + margin + 1, mid),
        onScreen(V, cx - margin - 1, mid),
        onScreen(V, cx, head.top - 1),
        onScreen(V, cx, head.bottom + 1),
      ];
      for (const T of outside) expect(guard(V, COMMANDER, T, 0)).toBe(T);
      // the box moves with the bob: a target just below the box is inside once the body drops
      const below = onScreen(V, cx, head.bottom + 10);
      expect(guard(V, COMMANDER, below, 20)).not.toBe(below);
    }
  });

  it('does nothing for a character without a head box', () => {
    const T: Vec3 = [0, -200, 0];
    for (const yaw of YAWS) expect(guard(viewState(yaw), CROWD, T, 0)).toBe(T);
  });

  it('solve keeps reachable hands off the face (the slide is one-shot: only a clamped reach stays)', () => {
    const reach = COMMANDER.l1a + COMMANDER.l2a - 0.5;
    let checked = 0;
    for (const yaw of YAWS) {
      const V = viewState(yaw);
      for (const P of faceHands(COMMANDER)) {
        const J = solve(V, COMMANDER, P);
        for (const [arm, sgn] of [
          [J.aL, 1],
          [J.aR, -1],
        ] as const) {
          const [x, y] = arm.h;
          const inside =
            y >= head.top + J.bob &&
            y <= head.bottom + J.bob &&
            Math.abs(x - head.x[V.v]) < margin - 1e-6;
          const shoulder: Vec3 = [sgn * COMMANDER.sw, COMMANDER.sy + J.bob, COMMANDER.sz ?? 0];
          const H = arm.H3;
          const d = Math.hypot(H[0] - shoulder[0], H[1] - shoulder[1], H[2] - shoulder[2]);
          if (inside) expect(d, `${String(yaw)} clamped`).toBeCloseTo(reach, 6);
          else checked += 1;
        }
      }
    }
    expect(checked).toBeGreaterThan(40);
  });
});

describe('armLayer', () => {
  const limb = (
    behind: boolean,
    handY: number,
    elbowY: number,
  ): Pick<LimbRig, 'behind' | 'h' | 'e'> => ({
    behind,
    h: [0, handY, 0],
    e: [0, elbowY, 0],
  });

  it('0 behind the body, 1 raised above the neck, 2 in front; force wins', () => {
    const neck = -570;
    expect(armLayer(limb(true, -700, -700), neck)).toBe(0);
    expect(armLayer(limb(false, -571, -400), neck)).toBe(1);
    expect(armLayer(limb(false, -400, -591), neck)).toBe(1);
    expect(armLayer(limb(false, -400, -590), neck)).toBe(2);
    expect(armLayer(limb(false, -570, -500), neck)).toBe(2);
    expect(armLayer(limb(true, -700, -700), neck, 2)).toBe(2);
    expect(armLayer(limb(false, -400, -400), neck, 0)).toBe(0);
    expect(armLayer(limb(false, -400, -400), neck, 1)).toBe(1);
  });

  it('matches ST.armLayer over solved poses', () => {
    for (const P of allPoses(COMMANDER)) {
      for (const yaw of YAWS) {
        const J = solve(viewState(yaw), COMMANDER, P);
        for (const j of [J.aL, J.aR]) {
          for (const force of [undefined, 0, 2] as const) {
            expect(armLayer(j, -570 + J.bob, force)).toBe(orig('armLayer')(j, -570 + J.bob, force));
          }
        }
      }
    }
  });
});

describe('figure draw order', () => {
  it('is the fixed order of the cast files', () => {
    expect(FIGURE_ORDER).toEqual([
      'arms-behind',
      'legs',
      'torso',
      'arms-raised',
      'head',
      'before-hand',
      'arms-front',
      'after',
    ]);
  });

  it('draws the far leg first (stable for ties), like the cast files', () => {
    for (const yaw of YAWS) {
      const J = solve(viewState(yaw), COMMANDER, pose('walk', COMMANDER, 0.25));
      const order = legsFarFirst(J);
      const legacy = [
        [J.lL, 1],
        [J.lR, -1],
      ].sort((a, b) => (a[0] as LimbRig).depth - (b[0] as LimbRig).depth);
      expect(order.map((l) => l.sgn)).toEqual(legacy.map((l) => l[1]));
      expect(order[0]?.leg.depth).toBeLessThanOrEqual(order[1]?.leg.depth ?? Infinity);
    }
    const tie = solve(
      viewState(0),
      COMMANDER,
      pose('stand', COMMANDER, 0, { fL: [36, 0, 0], fR: [-36, 0, 0] }),
    );
    expect(legsFarFirst(tie).map((l) => l.sgn)).toEqual([1, -1]);
  });
});
