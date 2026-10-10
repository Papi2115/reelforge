/**
 * Tangle rules (c-plus `validate.js` `checkArms` / `V.tangle`), on every view x static pose and on
 * every frame of the phase sweeps:
 *  - `handInHead`: no palm inside the MEASURED head box (C-CAM's guard uses the hand-set `D.head`,
 *    so a box smaller than the drawing lets hands into the face);
 *  - `armAcrossFace`: an arm drawn in front (`armLayer` 2) never crosses the face (the head box
 *    shrunk by `faceInset` per side);
 *  - `outOfReach`: a pose target never asks for more arm than there is (error);
 *    `guardOutOfReach`: nor does the face guard push it there (warning; c-plus checked only the
 *    guarded target, its guard being reach-aware);
 *  - `elbowFlip`: along a sweep the elbow never jumps to the other side of the shoulder -> wrist
 *    line while the wrist barely moves.
 * Not ported: the 3D "elbow against its pole" check (`solveIK3` always bends toward the pole's
 * perpendicular part, so it cannot fail) and the face-contact checks (C-CAM has no `ST.touch`).
 *
 * Public API: `ArmCase`, `armCases`, `headBoxAt`, `handInHead`, `armAcrossFace`, `outOfReach`,
 * `guardOutOfReach`, `elbowFlip`.
 */
import { neckBase, type RigDims } from '../draw/character.js';
import type { Pose, Vec3 } from '../draw/poses.js';
import { palm } from '../draw/rig-ik.js';
import { armLayer, guard, solve, type RigJoints } from '../draw/rig-layers.js';
import type { LimbRig } from '../draw/rig-ik.js';
import { viewState, type ViewState } from '../draw/rig-views.js';
import { fmt, str, type RuleContext } from './context.js';
import { circleHitsBox, segmentHitsBox, type Box } from './shape-geometry.js';
import { SWEEP_FRAMES, THRESHOLDS } from './thresholds.js';

const SIDES = ['L', 'R'] as const;
type Side = (typeof SIDES)[number];

/** One solved pose in one view. */
export interface ArmCase {
  readonly yaw: number;
  readonly V: ViewState;
  readonly name: string;
  readonly pose: Pose;
  readonly J: RigJoints;
}

/** Every view x (static pose + every sweep frame). */
export function armCases(ctx: RuleContext): readonly ArmCase[] {
  const D = ctx.character.D;
  const out: ArmCase[] = [];
  for (const yaw of ctx.views) {
    const V = viewState(yaw);
    const add = (name: string, P: Pose): void => {
      out.push({ yaw, V, name, pose: P, J: solve(V, D, P) });
    };
    for (const pc of ctx.poses) add(pc.name, pc.pose(D));
    for (const sweep of ctx.sweeps) {
      for (let i = 0; i <= SWEEP_FRAMES; i += 1) {
        add(`${sweep.name} ${str(i)}/${str(SWEEP_FRAMES)}`, sweep.pose(D, i / SWEEP_FRAMES));
      }
    }
  }
  return out;
}

/**
 * The measured head box of the case's view with the jaw shut (the resting face the grid is drawn
 * with), dropped by the bob. c-plus measured shut + open because its guard used the box; here the
 * guard is the hand-set `D.head`, and a talking jaw's dip under a passing hand is a shot matter.
 */
export function headBoxAt(ctx: RuleContext, c: ArmCase): Box {
  const b = ctx.head(c.V.v).shutBox;
  return { x0: b.x0, y0: b.y0 + c.J.bob, x1: b.x1, y1: b.y1 + c.J.bob };
}

const arm = (J: RigJoints, side: Side): LimbRig => (side === 'L' ? J.aL : J.aR);

function guardHint(D: RigDims, box: Box, v: number): string {
  const measured = `measured head box x ${fmt(box.x0, 0)}..${fmt(box.x1, 0)}, y ${fmt(box.y0, 0)}..${fmt(box.y1, 0)}`;
  if (!D.head) return `add D.head (the face-guard box) covering the head drawing (${measured})`;
  const h = D.head;
  const cx = h.x[v as 0 | 1 | 2 | 3];
  return `D.head (x ${fmt(cx - h.hw, 0)}..${fmt(cx + h.hw, 0)}, y ${str(h.top)}..${str(h.bottom)}) must cover the drawing (${measured}): widen hw / move x[${str(v)}] / lower bottom, or move the pose's hand target`;
}

export function handInHead(ctx: RuleContext): void {
  const D = ctx.character.D;
  const r = D.hsz * THRESHOLDS.palmRadius;
  for (const c of armCases(ctx)) {
    const box = headBoxAt(ctx, c);
    for (const side of SIDES) {
      ctx.check();
      const q = palm(arm(c.J, side), D.hsz);
      if (!circleHitsBox(q, r, box)) continue;
      const depth = Math.min(
        q[0] + r - box.x0,
        box.x1 - q[0] + r,
        q[1] + r - box.y0,
        box.y1 - q[1] + r,
      );
      ctx.fail({
        view: c.yaw,
        pose: c.name,
        message: `${side} palm (${fmt(q[0])}, ${fmt(q[1])}) is ${fmt(depth)} px inside the head box`,
        fix: guardHint(D, box, c.V.v),
        measured: depth,
        limit: 0,
      });
    }
  }
}

export function armAcrossFace(ctx: RuleContext): void {
  const ch = ctx.character;
  const k = THRESHOLDS.faceInset;
  for (const c of armCases(ctx)) {
    const b = headBoxAt(ctx, c);
    const sx = ((b.x1 - b.x0) / 2) * k;
    const sy = (b.y1 - b.y0) * k;
    const faceBox: Box = { x0: b.x0 + sx, y0: b.y0 + sy, x1: b.x1 - sx, y1: b.y1 - sy };
    const neckY = neckBase(ch.neck[c.V.v])[1] + c.J.bob;
    for (const side of SIDES) {
      ctx.check();
      const j = arm(c.J, side);
      if (armLayer(j, neckY) !== 2) continue;
      const s: readonly [number, number] = [j.s[0], j.s[1]];
      const e: readonly [number, number] = [j.e[0], j.e[1]];
      const h: readonly [number, number] = [j.h[0], j.h[1]];
      if (!segmentHitsBox(s, e, faceBox) && !segmentHitsBox(e, h, faceBox)) continue;
      ctx.fail({
        view: c.yaw,
        pose: c.name,
        message: `${side} arm is drawn in front (layer 2) across the face`,
        fix: `neck[${str(c.V.v)}] base y (${fmt(neckY - c.J.bob, 0)}) is the line above which a raised hand goes behind the head: put it at the collar, between the chin (${fmt(ctx.head(c.V.v).chinShut, 0)}) and the shoulders (${str(ch.D.sy)})`,
        measured: 1,
        limit: 0,
      });
    }
  }
}

/** Share of the arm by which target T (body space, bob applied) overshoots the shoulder's reach. */
function overshoot(D: RigDims, side: Side, bob: number, T: Vec3): number {
  const len = D.l1a + D.l2a;
  const S: Vec3 = [side === 'L' ? D.sw : -D.sw, D.sy + bob, D.sz || 0];
  return Math.max(0, Math.hypot(T[0] - S[0], T[1] - S[1], T[2] - S[2]) - len) / len;
}

function reachRule(ctx: RuleContext, guarded: boolean): void {
  const D = ctx.character.D;
  const len = D.l1a + D.l2a;
  for (const c of armCases(ctx)) {
    for (const side of SIDES) {
      ctx.check();
      const t = side === 'L' ? c.pose.hL : c.pose.hR;
      const dropped: Vec3 = [t[0], t[1] + c.J.bob, t[2]];
      const raw = overshoot(D, side, c.J.bob, dropped);
      const over = guarded ? overshoot(D, side, c.J.bob, guard(c.V, D, dropped, c.J.bob)) : raw;
      ctx.metric(
        `tangle: max ${guarded ? 'guarded' : 'raw'} pose target beyond reach (share of arm)`,
        over,
      );
      // the guard rule only reports what the guard added (raw overshoot is `out-of-reach`)
      if (over <= THRESHOLDS.reachOvershoot || (guarded && raw > THRESHOLDS.reachOvershoot))
        continue;
      const px = Math.ceil(over * len);
      const fix = guarded
        ? `the face guard slid the hand ${str(px)} px past the arm's reach (the IK clamps it, the arm locks straight): give D.head a tighter box or move this pose's hand target clear of the head`
        : `lengthen the arm (D.l1a + D.l2a ${str(len)} -> ${str(Math.ceil(len * (1 + over - THRESHOLDS.reachOvershoot)))}) or bring the target closer (D.waist for akimbo)`;
      ctx.fail({
        view: c.yaw,
        pose: c.name,
        message: `${side} hand target${guarded ? ' (after the face guard)' : ''} is ${str(px)} px beyond the ${str(len)} px arm (${fmt(over * 100, 0)}% > ${fmt(THRESHOLDS.reachOvershoot * 100, 0)}%)`,
        fix,
        measured: over,
        limit: THRESHOLDS.reachOvershoot,
      });
    }
  }
}

/** The pose itself asks for more arm than the character has. */
export function outOfReach(ctx: RuleContext): void {
  reachRule(ctx, false);
}

/**
 * The face guard pushed a target out of reach. A warning in C-CAM: its guard slides targets
 * sideways without regard to reach (c-plus pulled them into reach first), so this measures the
 * rig as much as the character.
 */
export function guardOutOfReach(ctx: RuleContext): void {
  reachRule(ctx, true);
}

/** Signed screen cross product of shoulder->wrist and shoulder->elbow (c-plus `cross`). */
const cross = (j: LimbRig): number =>
  (j.h[0] - j.s[0]) * (j.e[1] - j.s[1]) - (j.h[1] - j.s[1]) * (j.e[0] - j.s[0]);

export function elbowFlip(ctx: RuleContext): void {
  const D = ctx.character.D;
  const len = D.l1a + D.l2a;
  const bend = len * len * THRESHOLDS.flipBend;
  for (const yaw of ctx.views) {
    const V = viewState(yaw);
    for (const sweep of ctx.sweeps) {
      let prev: RigJoints | null = null;
      for (let i = 0; i <= SWEEP_FRAMES; i += 1) {
        const J = solve(V, D, sweep.pose(D, i / SWEEP_FRAMES));
        for (const side of SIDES) {
          if (prev === null) break;
          ctx.check();
          const a = arm(prev, side);
          const b = arm(J, side);
          const ca = cross(a);
          const cb = cross(b);
          const moved = Math.hypot(a.h[0] - b.h[0], a.h[1] - b.h[1]);
          const flipped =
            Math.abs(ca) > bend && Math.abs(cb) > bend && Math.sign(ca) !== Math.sign(cb);
          if (!flipped || moved >= len * THRESHOLDS.flipHandMove) continue;
          ctx.fail({
            view: yaw,
            pose: `${sweep.name} ${str(i)}/${str(SWEEP_FRAMES)}`,
            message: `${side} elbow flips to the other side of the arm between frames ${str(i - 1)} and ${str(i)} (wrist moved ${fmt(moved)} px)`,
            fix: `keep the elbow pole (pole${side}) of '${sweep.name}' on one side through the sweep, or move the wrist further between the frames (a flip is only invisible as part of a big swing)`,
            measured: moved,
            limit: len * THRESHOLDS.flipHandMove,
          });
        }
        prev = J;
      }
    }
  }
}
