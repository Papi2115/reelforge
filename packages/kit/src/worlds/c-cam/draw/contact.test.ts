import { describe, expect, it } from 'vitest';
import {
  bodyAt,
  bowPt,
  figToWorld,
  palmWorld,
  reachPalm,
  reachPalmChecked,
  worldToFig,
  type HandSide,
  type PlacedFigure,
  type Placement,
  type Point2,
} from './contact.js';
import { pose, type Pose, type PoseName, type Vec3 } from './poses.js';
import { palm } from './rig-ik.js';
import { solve } from './rig-layers.js';
import { proj, viewState } from './rig-views.js';
import { TEST_CHARACTER, WARDEN_DIMS as D } from './test-character.js';

const ARM = D.l1a + D.l2a;
const CH = TEST_CHARACTER;

const withHand = (P: Pose, side: HandSide, T: Vec3): Pose =>
  side === 'L' ? { ...P, hL: T } : { ...P, hR: T };

const dist = (a: Point2, b: Point2): number => Math.hypot(a[0] - b[0], a[1] - b[1]);

describe('bowPt / figToWorld / worldToFig', () => {
  it('bowPt is the identity at 0 and rotates about the hip pivot', () => {
    expect(bowPt([12, -500], -334, 0)).toEqual([12, -500]);
    expect(bowPt([0, -334], -334, 30)).toEqual([0, -334]);
    const p = bowPt([0, -434], -334, 90);
    expect(p[0]).toBeCloseTo(100, 9);
    expect(p[1]).toBeCloseTo(-334, 9);
  });

  it('figToWorld maps feet, scale, mirror and lean; worldToFig inverts it', () => {
    const p = { x: 900, y: 800, s: 0.75 };
    expect(figToWorld(p, false, 0, [0, 0])).toEqual([900, 800]);
    expect(figToWorld(p, false, 0, [100, -200])).toEqual([975, 650]);
    expect(figToWorld(p, true, 0, [100, -200])).toEqual([825, 650]);
    for (const flip of [false, true]) {
      for (const lean of [0, 7, -12, 33]) {
        for (const pt of [
          [0, 0],
          [64, -410],
          [-120, -700],
          [33.3, 12.5],
        ] as const) {
          const back = worldToFig(p, flip, lean, figToWorld(p, flip, lean, pt));
          expect(dist(back, pt)).toBeLessThan(1e-9);
        }
      }
    }
  });
});

describe('bodyAt', () => {
  it('returns a body point whose projection lands on q (after the bob), keeping one axis', () => {
    for (const yaw of [0, 1, 2, 3, -1, -2, -3]) {
      const V = viewState(yaw);
      const T = bodyAt(V, [40, -420], 12, 25);
      const p = proj(V, [T[0], T[1] + 12, T[2]]);
      expect(p[0]).toBeCloseTo(40, 9);
      expect(p[1]).toBeCloseTo(-420, 9);
      expect(V.v === 0 || V.v === 3 ? T[2] : T[0]).toBe(25);
    }
  });
});

interface ReachCase {
  readonly yaw: number;
  readonly side: HandSide;
  readonly base: PoseName;
  readonly ph: number;
  readonly placement: Placement;
  /** Hand target offsets (arm lengths): sideways (front / back) or forward (3/4, profile), and down. */
  readonly across: number;
  readonly down: number;
}

const YAWS = [0, 1, 2, 3, -1, -2, -3] as const;
const BASES: readonly PoseName[] = ['stand', 'walk', 'akimbo', 'stand', 'walk'];

/** 20 deterministic cases: every view (plain and mirrored), both hands, lean, bow, scales. */
const CASES: readonly ReachCase[] = Array.from({ length: 20 }, (_, i) => ({
  yaw: YAWS[i % YAWS.length] ?? 0,
  side: i % 2 === 0 ? 'L' : 'R',
  base: BASES[i % BASES.length] ?? 'stand',
  ph: (i % 4) * 0.25,
  placement: {
    x: 400 + i * 61,
    y: 900 - (i % 3) * 40,
    s: [0.5, 0.8, 1.2, 0.65][i % 4] ?? 1,
    lean: [0, 6, -8, 3, 0][i % 5] ?? 0,
    bow: [0, 0, 18, 0, 30, 10][i % 6] ?? 0,
  },
  across: -0.25 + ((i * 7) % 11) * 0.06,
  down: 0.15 + ((i * 5) % 7) * 0.1,
}));

/** A reachable goal: the palm of a pose whose hand target shares the base pose's hidden axis. */
function goalFor(c: ReachCase): { fig: PlacedFigure; goal: Point2 } {
  const P = pose(c.base, D, c.ph);
  const own = c.side === 'L' ? P.hL : P.hR;
  const sgn = c.side === 'L' ? 1 : -1;
  const V = viewState(c.yaw);
  const y = D.sy + c.down * ARM;
  const T: Vec3 =
    V.v === 0 || V.v === 3
      ? [sgn * D.sw + c.across * ARM, y, own[2]]
      : [own[0], y, (D.sz || 0) + c.across * ARM + 0.2 * ARM];
  const fig: PlacedFigure = { character: CH, placement: { ...c.placement, yaw: c.yaw }, pose: P };
  const goal = palmWorld({ ...fig, pose: withHand(P, c.side, T) }, c.side);
  return { fig, goal };
}

describe('reachPalm (contact accuracy)', () => {
  it('lands the palm within 2 px of 20 reachable world points, and palmWorld agrees', () => {
    let maxMiss = 0;
    let maxWorld = 0;
    for (const c of CASES) {
      const { fig, goal } = goalFor(c);
      const r = reachPalmChecked(fig, c.side, goal);
      const landed = palmWorld({ ...fig, pose: withHand(fig.pose, c.side, r.target) }, c.side);
      const err = dist(landed, goal);
      expect(Number.isFinite(err)).toBe(true);
      expect(Math.abs(err - r.miss)).toBeLessThan(1e-6);
      expect(reachPalm(fig, c.side, goal)).toEqual(r.target);
      maxMiss = Math.max(maxMiss, r.miss);
      maxWorld = Math.max(maxWorld, err);
    }
    process.stdout.write(
      `c-cam contact: max palm error over ${String(CASES.length)} targets = ${maxWorld.toExponential(3)} px (reported miss ${maxMiss.toExponential(3)} px)\n`,
    );
    expect(maxWorld).toBeLessThanOrEqual(2);
  });

  it('keeps the hidden body axis given in keep', () => {
    const fig: PlacedFigure = {
      character: CH,
      placement: { x: 500, y: 900, s: 1, yaw: 2 },
      pose: pose('stand', D),
    };
    const T = reachPalm(fig, 'L', [540, 520], 30);
    expect(T[0]).toBe(30);
    const front = reachPalm(
      { ...fig, placement: { ...fig.placement, yaw: 0 } },
      'R',
      [430, 520],
      -12,
    );
    expect(front[2]).toBe(-12);
  });

  it('reports an out-of-reach goal as a miss instead of hiding it (never NaN)', () => {
    for (const yaw of [0, 1, 2, 3, -1, -2, -3]) {
      const fig: PlacedFigure = {
        character: CH,
        placement: { x: 600, y: 900, s: 0.8, yaw, lean: 4, bow: 12 },
        pose: pose('stand', D),
      };
      const r = reachPalmChecked(fig, 'L', [600 + 900, 200]);
      expect(r.target.every(Number.isFinite)).toBe(true);
      expect(r.miss).toBeGreaterThan(50);
      const landed = palmWorld({ ...fig, pose: { ...fig.pose, hL: r.target } }, 'L');
      expect(landed.every(Number.isFinite)).toBe(true);
    }
  });

  it('is deterministic', () => {
    const c = CASES[7];
    if (!c) throw new Error('missing case');
    const { fig, goal } = goalFor(c);
    expect(reachPalmChecked(fig, c.side, goal)).toEqual(reachPalmChecked(fig, c.side, goal));
  });
});

describe('palmWorld', () => {
  it('is the rig palm placed through bow, lean, scale and mirror', () => {
    const P = pose('point', D, 1);
    for (const yaw of [0, 1, 2, 3, -1, -2, -3]) {
      const placement: Placement = { x: 700, y: 950, s: 0.6, yaw, lean: 5, bow: 20 };
      const V = viewState(yaw);
      const J = solve(V, D, P);
      const g = palm(J.aL, D.hsz);
      const expected = figToWorld(placement, V.mir, 5, bowPt(g, D.hy + J.bob, 20));
      expect(palmWorld({ character: CH, placement, pose: P }, 'L')).toEqual(expected);
    }
  });

  it('adds the pose lean to the placement lean and uses the pose bob', () => {
    const P = pose('slump', D);
    const placement: Placement = { x: 0, y: 0, s: 1, yaw: 1 };
    const J = solve(viewState(1), D, P);
    const g = palm(J.aR, D.hsz);
    const expected = figToWorld(placement, false, P.lean ?? 0, g);
    expect(palmWorld({ character: CH, placement, pose: P }, 'R')).toEqual(expected);
    expect(J.bob).toBeGreaterThan(0);
  });
});
