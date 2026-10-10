/**
 * C-CAM contact helpers (PLAN.md#14.5): where a palm lands in the world, and the hand target that
 * puts a palm on a world point (a coin on another palm, a key in a lock, a hand on a counter).
 * Contact is solved in world space before the camera, from the same placement the figure is drawn
 * with, so it holds whatever the camera does.
 *
 * Units and spaces (all px, y down):
 *  - world space: the scene's coordinates (before `camera`);
 *  - figure space: what `figure` (brushes.ts) sets up for a placement `p`: origin at the feet,
 *    scaled by `p.s`, mirrored (x negated) when the view is mirrored (`V.mir`), rotated by the
 *    lean in degrees about the feet (+ = clockwise on screen). The rig's projected joints live here;
 *  - bow: the upper body rotated by `bow` degrees (+ = forward) about the hip pivot
 *    `(0, D.hy + bob)` in figure space; the legs stay planted;
 *  - body space: rig-views.ts (x = the character's LEFT, y down, feet at 0, z forward).
 *
 * Port of the film-1 helpers (`docs/concepts/c-cam-style/films/01-samurai-edo/js/props.js:25-58`,
 * the ones kept by 08-KNOWN_ISSUES #6). Divergences:
 *  - ONE signature each; film 2's `palmWorld(ch, p, side, hsz)` (ignores lean, `hsz` passed in) and
 *    film 3's `reachTo(p, wx, wy, free)` (aims the wrist, ignores bob, lean and the palm offset)
 *    are dropped. The hand size is always `character.D.hsz`;
 *  - the character, its placement and its pose travel together as a `PlacedFigure`; the side is
 *    `'L' | 'R'` (the film's `'a' + side` key lookup is gone);
 *  - `reachPalm`'s `keep` (the body coordinate the view cannot see: x for 3/4 and profile, z for
 *    front and back) is optional and defaults to that coordinate of the pose's own hand target;
 *  - added `reachPalmChecked`, which also reports the residual distance (`miss`, world px) between
 *    the solved palm and the target: an unreachable target is clamped by the IK and the face guard
 *    may slide a hand, and that must be detectable, not silent.
 *
 * Public API: `HandSide`, `Placement`, `PlacedFigure`, `Point2`, `bowPt`, `figToWorld`,
 * `worldToFig`, `bodyAt`, `palmWorld`, `reachPalm`, `ReachResult`, `reachPalmChecked`,
 * `REACH_STEPS`.
 */
import type { Character } from './character.js';
import type { FigurePlacement } from './brushes.js';
import type { Pose, Vec3 } from './poses.js';
import { palm } from './rig-ik.js';
import { solve } from './rig-layers.js';
import { VIEW_DEG, viewState, type ViewState } from './rig-views.js';

const RAD = Math.PI / 180;

/** The character's left or right hand. */
export type HandSide = 'L' | 'R';

/** A 2D point `[x, y]` in px. */
export type Point2 = readonly [x: number, y: number];

/**
 * Where and how a figure is drawn: feet at world `(x, y)`, scale `s`, ring `yaw` (default 0;
 * negative = mirrored), `lean` in degrees (default 0; the pose's own `lean` is added), `bow` in
 * degrees (default 0).
 */
export interface Placement extends FigurePlacement {
  readonly yaw?: number;
  readonly bow?: number;
}

/** Everything that decides where a figure's joints land in the world. */
export interface PlacedFigure {
  readonly character: Pick<Character, 'D'>;
  readonly placement: Placement;
  readonly pose: Pose;
}

/** Number of fixed-point steps on the palm offset (film 1's count). */
export const REACH_STEPS = 4;

function rotateAbout(pt: Point2, cx: number, cy: number, deg: number): Point2 {
  const a = deg * RAD;
  const x = pt[0] - cx;
  const y = pt[1] - cy;
  return [cx + x * Math.cos(a) - y * Math.sin(a), cy + x * Math.sin(a) + y * Math.cos(a)];
}

/** Figure-space point pt after the upper body bows by `deg` (+ forward) about the hip pivot `(0, hy)`. */
export function bowPt(pt: Point2, hy: number, deg: number): Point2 {
  return rotateAbout(pt, 0, hy, deg || 0);
}

/** Figure-space point -> world point for placement p (`flip` = mirrored view, `lean` in degrees). */
export function figToWorld(p: FigurePlacement, flip: boolean, lean: number, pt: Point2): Point2 {
  const r = rotateAbout(pt, 0, 0, lean || 0);
  return [p.x + (flip ? -1 : 1) * p.s * r[0], p.y + p.s * r[1]];
}

/** World point -> figure-space point (the inverse of `figToWorld`). */
export function worldToFig(p: FigurePlacement, flip: boolean, lean: number, w: Point2): Point2 {
  const fx = ((w[0] - p.x) / p.s) * (flip ? -1 : 1);
  return rotateAbout([fx, (w[1] - p.y) / p.s], 0, 0, -(lean || 0));
}

/**
 * Body-space hand target whose projection for view V lands on the figure-space point q, for a
 * pose with hip drop `bob` (the rig adds the bob back to hand targets). A view fixes only one
 * horizontal body axis: `keep` is the other one, held fixed (body x for 3/4 and profile, body z
 * for front and back).
 */
export function bodyAt(V: ViewState, q: Point2, bob: number, keep: number): Vec3 {
  const a = VIEW_DEG[V.v] * RAD;
  const s = Math.sin(a);
  const c = Math.cos(a);
  const y = q[1] - bob;
  if (Math.abs(s) > 0.5) {
    const xp = V.mir ? -keep : keep;
    return [keep, y, (q[0] - xp * c) / s];
  }
  const xp = (q[0] - keep * s) / c;
  return [V.mir ? -xp : xp, y, keep];
}

const handTarget = (P: Pose, side: HandSide): Vec3 => (side === 'L' ? P.hL : P.hR);

const withHand = (P: Pose, side: HandSide, T: Vec3): Pose =>
  side === 'L' ? { ...P, hL: T } : { ...P, hR: T };

interface Frame {
  readonly V: ViewState;
  readonly lean: number;
  readonly bob: number;
  readonly bow: number;
}

function frameOf(fig: PlacedFigure): Frame {
  const { placement: p, pose: P, character } = fig;
  const D = character.D;
  return {
    V: viewState(p.yaw ?? 0),
    lean: (p.lean || 0) + (P.lean || 0),
    bob: (P.bob || 0) * (D.l1l + D.l2l),
    bow: p.bow || 0,
  };
}

/** World position `[x, y]` (px) of the palm centre of hand `side` for the figure as it will be drawn. */
export function palmWorld(fig: PlacedFigure, side: HandSide): Point2 {
  const { V, lean, bow } = frameOf(fig);
  const D = fig.character.D;
  const J = solve(V, D, fig.pose);
  const g = palm(side === 'L' ? J.aL : J.aR, D.hsz);
  return figToWorld(fig.placement, V.mir, lean, bowPt(g, D.hy + J.bob, bow));
}

/** A solved reach: the body-space hand target and how far (world px) its palm ends from the goal. */
export interface ReachResult {
  readonly target: Vec3;
  /** Distance palm -> goal in world px; > 0 beyond rounding when clamped (out of reach, guard). */
  readonly miss: number;
}

/**
 * `reachPalm` plus the residual: the palm of the returned target lands `miss` world px from
 * `goal`. Within reach and clear of the head the miss is well under 2 px.
 */
export function reachPalmChecked(
  fig: PlacedFigure,
  side: HandSide,
  goal: Point2,
  keep?: number,
): ReachResult {
  const { V, lean, bob, bow } = frameOf(fig);
  const D = fig.character.D;
  const own = handTarget(fig.pose, side);
  const held = keep ?? (Math.abs(Math.sin(VIEW_DEG[V.v] * RAD)) > 0.5 ? own[0] : own[2]);
  const q = bowPt(worldToFig(fig.placement, V.mir, lean, goal), D.hy + bob, -bow);
  let aim = q;
  let target: Vec3 = own;
  let miss = Infinity;
  for (let i = 0; i < REACH_STEPS; i += 1) {
    target = bodyAt(V, aim, bob, held);
    const J = solve(V, D, withHand(fig.pose, side, target));
    const g = palm(side === 'L' ? J.aL : J.aR, D.hsz);
    miss = Math.hypot(q[0] - g[0], q[1] - g[1]) * fig.placement.s;
    aim = [aim[0] + q[0] - g[0], aim[1] + q[1] - g[1]];
  }
  return { target, miss };
}

/**
 * Body-space target for hand `side` (merge it into the pose as `hL` / `hR`) so that its PALM lands
 * on the world point `goal`: `REACH_STEPS` fixed-point steps on the palm offset, aware of the
 * bob, lean, bow and mirror. `keep` = the body coordinate held fixed (see `bodyAt`; default: the
 * pose's own hand target). Unreachable goals are clamped silently: use `reachPalmChecked`.
 */
export function reachPalm(fig: PlacedFigure, side: HandSide, goal: Point2, keep?: number): Vec3 {
  return reachPalmChecked(fig, side, goal, keep).target;
}
