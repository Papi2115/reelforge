/**
 * C-CAM rig (PLAN.md#14.5), part 3: resolving a pose for a character (`solve`: the hip bob, the
 * face guard, both arms and legs as projected limb rigs) and the fixed draw order of a figure
 * (`FIGURE_ORDER`, `armLayer`, `legsFarFirst`).
 *
 * Face guard: a hand target that would land on the head silhouette (`D.head`: per-view centre x,
 * top, bottom, half width) is slid along this view's screen axis until it clears it, so no pose in
 * any view puts a hand on the face. Raised arms are then drawn under the head (`armLayer` 1), so
 * only the clear hand shows, never an arm across a face.
 *
 * Port of `docs/concepts/c-cam-style/films/03-apollo-11/js/rig.js` (guard / solve / armLayer).
 * Divergences:
 *  - no `window.ST`; `guard` is exported (the original kept it private) and typed;
 *  - the draw order, which every cast file repeated inside its own `draw()`, is the documented
 *    constant `FIGURE_ORDER` plus `legsFarFirst` (same stable sort by depth as the cast files);
 *  - `P.bob || 0`, `D.sz || 0` and the `P.poleL || elbowPole(...)` fallbacks are kept as in the
 *    original.
 *
 * Public API: `guard`, `RigJoints`, `solve`, `ArmLayer`, `armLayer`, `FIGURE_ORDER`, `FigureStep`,
 * `LegDraw`, `legsFarFirst` (+ re-exported type `LimbRig`).
 */
import type { RigDims } from './character.js';
import type { Pose, Vec3 } from './poses.js';
import { elbowPole, kneePole, limbRig, type LimbRig } from './rig-ik.js';
import { VIEW_DEG, proj, type ViewState } from './rig-views.js';

export type { LimbRig } from './rig-ik.js';

/** Extra clearance beyond the head half width, in body px. */
const GUARD_MARGIN = 34;

/**
 * Face guard for one hand target T (body space, already dropped by the bob). Returns T untouched
 * when the character has no `D.head` or the target projects outside the head box; otherwise a
 * copy slid sideways (along this view's screen x axis) to the nearer edge of the box.
 */
export function guard(V: ViewState, D: Pick<RigDims, 'head'>, T: Vec3, bob: number): Vec3 {
  const h = D.head;
  if (!h) return T;
  const p = proj(V, T);
  const cx = h.x[V.v];
  const m = h.hw + GUARD_MARGIN;
  if (p[1] < h.top + bob || p[1] > h.bottom + bob || Math.abs(p[0] - cx) >= m) return T;
  const a = (VIEW_DEG[V.v] * Math.PI) / 180;
  const dir = p[0] - cx >= 0 ? 1 : -1;
  const shift = dir * m - (p[0] - cx);
  return [T[0] + shift * Math.cos(a) * (V.mir ? -1 : 1), T[1], T[2] + shift * Math.sin(a)];
}

/** A resolved pose: the hip drop and the four solved limbs (screen joints in figure space). */
export interface RigJoints {
  /** Hip drop in body px (`P.bob` x leg length); the upper body and hand targets drop with it. */
  readonly bob: number;
  readonly aL: LimbRig;
  readonly aR: LimbRig;
  readonly lL: LimbRig;
  readonly lR: LimbRig;
}

/**
 * Resolves pose P for dimensions D in view V. Hand targets ride with the upper body (they drop by
 * the bob) and pass the face guard; feet stay planted in body space.
 */
export function solve(V: ViewState, D: RigDims, P: Pose): RigJoints {
  const bob = (P.bob || 0) * (D.l1l + D.l2l);
  const shL: Vec3 = [D.sw, D.sy + bob, D.sz || 0];
  const shR: Vec3 = [-D.sw, D.sy + bob, D.sz || 0];
  const off = (q: Vec3): Vec3 => guard(V, D, [q[0], q[1] + bob, q[2]], bob);
  return {
    bob,
    aL: limbRig(V, shL, off(P.hL), D.l1a, D.l2a, P.poleL || elbowPole(1, D.elbowOut), D.sw),
    aR: limbRig(V, shR, off(P.hR), D.l1a, D.l2a, P.poleR || elbowPole(-1, D.elbowOut), D.sw),
    lL: limbRig(V, [D.hw, D.hy + bob, 0], P.fL, D.l1l, D.l2l, kneePole(1), D.hw),
    lR: limbRig(V, [-D.hw, D.hy + bob, 0], P.fR, D.l1l, D.l2l, kneePole(-1), D.hw),
  };
}

/** 0 = behind the torso, 1 = over the torso but under the head, 2 = in front of everything. */
export type ArmLayer = 0 | 1 | 2;

/**
 * Draw layer of an arm. 0 when the limb is behind the body plane; 1 when the hand is above the
 * neck line `neckY` or the elbow more than 20 px above it (a raised near arm passes BEHIND the
 * head, never across the face); 2 otherwise. `force` overrides (2 for hands that must sit on the
 * face: a pipe at the lips, a hankie at the nose).
 */
export function armLayer(
  j: Pick<LimbRig, 'behind' | 'h' | 'e'>,
  neckY: number,
  force?: ArmLayer,
): ArmLayer {
  if (force !== undefined) return force;
  if (j.behind) return 0;
  return j.h[1] < neckY || j.e[1] < neckY - 20 ? 1 : 2;
}

/**
 * The fixed draw order of a figure (inside `figure` space, `CHARACTER_GUIDE` §7):
 *  1. `arms-behind`  arms with `armLayer` 0 (behind the body plane);
 *  2. `legs`         both legs, far one first (`legsFarFirst`);
 *  3. `torso`        neck + torso for the view, translated down by `bob`;
 *  4. `arms-raised`  arms with `armLayer` 1 (raised: over the torso, under the head);
 *  5. `head`         head in its own view (`headView`), scaled by the head scale, mirrored if needed;
 *  6. `before-hand`  hook: props under the near hand (a control stick, a held object);
 *  7. `arms-front`   arms with `armLayer` 2 (in front of everything);
 *  8. `after`        hook: things drawn over the hands (a blade from the palm).
 */
export const FIGURE_ORDER = [
  'arms-behind',
  'legs',
  'torso',
  'arms-raised',
  'head',
  'before-hand',
  'arms-front',
  'after',
] as const;

export type FigureStep = (typeof FIGURE_ORDER)[number];

/** A leg to draw and its side (+1 left, -1 right). */
export interface LegDraw {
  readonly leg: LimbRig;
  readonly sgn: 1 | -1;
}

/** Both legs, the far one (smaller depth) first; ties keep left before right (stable sort). */
export function legsFarFirst(J: Pick<RigJoints, 'lL' | 'lR'>): readonly LegDraw[] {
  const legs: LegDraw[] = [
    { leg: J.lL, sgn: 1 },
    { leg: J.lR, sgn: -1 },
  ];
  return legs.sort((a, b) => a.leg.depth - b.leg.depth);
}
