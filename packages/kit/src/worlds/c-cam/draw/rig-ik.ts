/**
 * C-CAM rig (PLAN.md#14.5), part 2: two-bone IK in body space, the projected limb rig (screen
 * joints, depth, behind-the-body flag, forearm angle), default elbow/knee poles and the palm
 * centre. Body space as in rig-views.ts (x = the character's LEFT, y down, z forward).
 *
 * Port of `docs/concepts/c-cam-style/films/03-apollo-11/js/rig.js` (IK part). Divergences:
 *  - no `window.ST`; `ST.ik` is `solveIK3` (same clamping and degenerate-pole fallback). The one
 *    numeric change: the clamped reach `d` is kept >= 1e-6. The original's clamp interval
 *    `[|l1 - l2| + 0.5, l1 + l2 - 0.5]` is empty for bones shorter than 0.5 px, where it returned
 *    NaN (d = 0) or a hand on the wrong side (d < 0); every other input is bit-identical;
 *  - added `solveIK(a, b, len1, len2, bendSign)`, the brief's convenience form (see its doc);
 *  - `limbRig` returns the typed `LimbRig`; `sideW` keeps the original `||` fallback (0 or
 *    undefined = |shoulder x|).
 *
 * Public API: `IKSolution`, `BendSign`, `solveIK3`, `solveIK`, `LimbRig`, `limbRig`, `elbowPole`,
 * `kneePole`, `palm`.
 */
import { proj, type ViewState } from './rig-views.js';
import type { Vec3 } from './poses.js';

/** `[E, H]`: the middle joint (elbow / knee) and the end joint (wrist / ankle), body space. */
export type IKSolution = readonly [E: Vec3, H: Vec3];

/**
 * Two-bone IK in 3D: from root S toward target T with bone lengths l1, l2. The end joint H is
 * clamped to the reachable shell `[|l1 - l2| + 0.5, l1 + l2 - 0.5]` along S -> T; the middle joint
 * E bends toward `pole` (its component perpendicular to the limb). A pole parallel to the limb
 * (or zero) falls back to `[u.y, -u.x, 0]` (u = limb direction), as in the original. Never NaN for
 * finite inputs (S = T included).
 */
export function solveIK3(S: Vec3, T: Vec3, l1: number, l2: number, pole: Vec3): IKSolution {
  const dx = T[0] - S[0];
  const dy = T[1] - S[1];
  const dz = T[2] - S[2];
  const d0 = Math.hypot(dx, dy, dz) || 1e-6;
  const d = Math.max(1e-6, Math.min(l1 + l2 - 0.5, Math.max(Math.abs(l1 - l2) + 0.5, d0)));
  const u: Vec3 = [dx / d0, dy / d0, dz / d0];
  const pd = pole[0] * u[0] + pole[1] * u[1] + pole[2] * u[2];
  let p: Vec3 = [pole[0] - pd * u[0], pole[1] - pd * u[1], pole[2] - pd * u[2]];
  const pl = Math.hypot(p[0], p[1], p[2]);
  p = pl < 1e-6 ? [u[1], -u[0], 0] : [p[0] / pl, p[1] / pl, p[2] / pl];
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  // prettier-ignore
  return [[S[0] + u[0] * a + p[0] * h, S[1] + u[1] * a + p[1] * h, S[2] + u[2] * a + p[2] * h], [S[0] + u[0] * d, S[1] + u[1] * d, S[2] + u[2] * d]];
}

/** +1 = the middle joint bends forward (+z, a knee); -1 = backward (-z, an elbow). */
export type BendSign = 1 | -1;

/**
 * Convenience two-bone IK: `solveIK3` with the pole straight forward (`bendSign` +1, knee-like) or
 * straight back (-1, elbow-like), i.e. pole `[0, 0, bendSign]`. Returns `[E, H]` like `solveIK3`.
 * Characters use `limbRig` with `elbowPole` / `kneePole` (which also lean the joint outward); this
 * form is for props and simple jointed things.
 */
export function solveIK(
  a: Vec3,
  b: Vec3,
  len1: number,
  len2: number,
  bendSign: BendSign,
): IKSolution {
  return solveIK3(a, b, len1, len2, [0, 0, bendSign]);
}

/** A solved limb: screen joints `[x, y, depth]` in figure space plus the 3D end joint. */
export interface LimbRig {
  /** Root (shoulder / hip). */
  readonly s: Vec3;
  /** Middle joint (elbow / knee). */
  readonly e: Vec3;
  /** End joint (wrist / ankle). */
  readonly h: Vec3;
  /** End joint in body space (feet are built from it). */
  readonly H3: Vec3;
  /** Mean depth of the three joints (toward the camera = positive). */
  readonly depth: number;
  /** The limb sits on the far side of the body plane for this view (drawn behind the torso). */
  readonly behind: boolean;
  /** Forearm / shin direction on screen in degrees (0 = straight down), for the hand. */
  readonly ang: number;
}

/** Solves the limb in body space, projects it for view V and works out its layering. */
export function limbRig(
  V: ViewState,
  S: Vec3,
  T: Vec3,
  l1: number,
  l2: number,
  pole: Vec3,
  sideW?: number,
): LimbRig {
  const [E, H] = solveIK3(S, T, l1, l2, pole);
  const s = proj(V, S);
  const e = proj(V, E);
  const h = proj(V, H);
  const depth = (s[2] + e[2] + h[2]) / 3;
  let fx = h[0] - e[0];
  let fy = h[1] - e[1];
  if (Math.hypot(fx, fy) < 12) {
    fx = h[0] - s[0];
    fy = h[1] - s[1];
  }
  return {
    s,
    e,
    h,
    H3: H,
    depth,
    behind: depth < -0.3 * (sideW || Math.abs(S[0])),
    ang: (Math.atan2(fx, fy) * 180) / Math.PI,
  };
}

/** Default elbow pole for the arm on side sgn (+1 left, -1 right): out by k (default 0.7), slightly down, behind. */
export function elbowPole(sgn: number, k?: number): Vec3 {
  return [sgn * (k === undefined ? 0.7 : k), 0.25, -1];
}

/** Default knee pole for side sgn: forward, slightly out. */
export function kneePole(sgn: number): Vec3 {
  return [sgn * 0.18, 0, 1];
}

/** Grip point: centre of the palm of a hand of size hsz drawn at the wrist `j.h` along `j.ang`. */
export function palm(j: Pick<LimbRig, 'h' | 'ang'>, hsz: number): readonly [x: number, y: number] {
  const a = (j.ang * Math.PI) / 180;
  return [j.h[0] + Math.sin(a) * hsz * 0.55, j.h[1] + Math.cos(a) * hsz * 0.55];
}
