/**
 * C-CAM rig (PLAN.md#14.5), part 1: views, the turn ring, the body -> figure projection and the
 * head view. Body space: x = the character's LEFT, y down (feet at 0), z forward. A view is one of
 * four hand-drawn angles (front, three-quarter, profile, back); a mirrored view (`mir`, facing
 * screen-left) is the same drawing flipped by `figure`, never a separate drawing. Turns walk the
 * ring front -> 3/4 -> profile -> back -> profile -> 3/4 one step per animation frame, never a flip.
 *
 * Port of `docs/concepts/c-cam-style/films/03-apollo-11/js/rig.js` (views part). Divergences:
 *  - no `window.ST`, no module state; named exports, typed (`ViewState`, `ViewIndex`, `RingKey`);
 *  - `ST.view` is `viewState`. The original took any number and produced `v = min(3, |yaw|)`, so a
 *    non-integer yaw gave a fractional `v` (and NaN projections); here `|yaw|` is rounded (and a
 *    non-finite yaw reads as 0), identical for every integer yaw;
 *  - `turn` with an empty key list throws a `RangeError` (the original threw a `TypeError`);
 *  - added: `VIEWS`, `View` names and `viewName` / `viewIndex` / `yawOfView` conversions.
 *
 * Public API: `VIEWS`, `View`, `ViewIndex`, `ViewState`, `RingKey`, `RING`, `VIEW_DEG`,
 * `yawOfRing`, `turn`, `viewState`, `viewName`, `viewIndex`, `yawOfView`, `proj`, `headView`,
 * `HeadView`.
 */
import { ANIM, twos } from '../core.js';
import type { Vec3 } from './poses.js';

/** The four hand-drawn view names, in `ViewIndex` order. */
export const VIEWS = ['front', 'three-quarter', 'profile', 'back'] as const;

export type View = (typeof VIEWS)[number];

/** 0 front, 1 three-quarter, 2 profile, 3 back. */
export type ViewIndex = 0 | 1 | 2 | 3;

/** The original `ST.view(yaw)`: signed yaw, the drawing to use and whether it is mirrored. */
export interface ViewState {
  /** Ring yaw: 0, 1, 2, 3 facing screen-right / front, negative = the same view facing screen-left. */
  readonly yaw: number;
  readonly v: ViewIndex;
  /** Facing screen-left: drawn mirrored (a flip of the figure, not a redraw). */
  readonly mir: boolean;
}

/** Ring index -> yaw: 0 front, 1 3/4 right, 2 profile right, 3 back, 4 profile left, 5 3/4 left. */
export const RING: readonly [0, 1, 2, 3, -2, -1] = [0, 1, 2, 3, -2, -1];

/** Rotation about the vertical axis per view, in degrees. */
export const VIEW_DEG: readonly [number, number, number, number] = [0, 45, 90, 180];

/** Ring index (any integer, keeps counting for spins) -> yaw. */
export function yawOfRing(i: number): number {
  return RING[((Math.round(i) % 6) + 6) % 6] ?? 0;
}

/** `[time, ring]`: from `time` the ring walks toward `ring` (ring 6 = front again, keep counting for spins). */
export type RingKey = readonly [time: number, ring: number];

/**
 * Yaw at time t. From each key time the ring walks one step per animation frame (on twos) toward
 * the key value; `rate` = steps per second (default `ANIM`, 0 falls back to it as in the original).
 */
export function turn(t: number, keys: readonly RingKey[], rate = 0): number {
  const first = keys[0];
  if (first === undefined) throw new RangeError('turn: key list is empty');
  const tt = twos(t);
  const r = rate || ANIM;
  let cur = first[1];
  for (let i = 1; i < keys.length; i += 1) {
    const k = keys[i];
    if (k === undefined) continue;
    const [kt, kv] = k;
    if (tt < kt) break;
    const next = keys[i + 1];
    const until = next === undefined ? tt : Math.min(tt, next[0]);
    const steps = Math.floor((until - kt) * r + 1e-6) + 1;
    cur += Math.sign(kv - cur) * Math.min(Math.abs(kv - cur), steps);
  }
  return yawOfRing(cur);
}

function toViewIndex(n: number): ViewIndex {
  return n <= 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : 3;
}

/** The original `ST.view`: yaw -> view state (`v = min(3, |yaw|)`, mirrored when yaw < 0). */
export function viewState(yaw: number): ViewState {
  const y = Number.isFinite(yaw) ? yaw : 0;
  return { yaw: y, v: toViewIndex(Math.min(3, Math.round(Math.abs(y)))), mir: y < 0 };
}

export function viewName(v: ViewIndex): View {
  return VIEWS[v];
}

export function viewIndex(name: View): ViewIndex {
  return toViewIndex(VIEWS.indexOf(name));
}

/**
 * Yaw of a named view; `mirrored` = facing screen-left. The front view has no mirrored yaw (0 is
 * returned either way); the mirrored back view is -3 (valid for `viewState`, not on the ring).
 */
export function yawOfView(name: View, mirrored = false): number {
  const v = viewIndex(name);
  return mirrored && v > 0 ? -v : v;
}

/**
 * Body point -> `[screen x, screen y, depth toward camera]` in figure space. The mirror flip
 * itself is applied by `figure`; x is negated first so a mirrored view is a true rotation (the
 * right hand stays the right hand).
 */
export function proj(V: ViewState, p: Vec3): Vec3 {
  const a = (VIEW_DEG[V.v] * Math.PI) / 180;
  const x = V.mir ? -p[0] : p[0];
  return [p[2] * Math.sin(a) + x * Math.cos(a), p[1], p[2] * Math.cos(a) - x * Math.sin(a)];
}

/** The head's own view and whether to mirror it inside the (already flipped) figure space. */
export interface HeadView {
  readonly V: ViewState;
  readonly flip: boolean;
}

/** The head may look elsewhere than the body: `headYaw` undefined = same as the body. */
export function headView(bodyYaw: number, headYaw?: number): HeadView {
  const hy = headYaw === undefined ? bodyYaw : headYaw;
  return { V: viewState(hy), flip: hy < 0 !== bodyYaw < 0 };
}
