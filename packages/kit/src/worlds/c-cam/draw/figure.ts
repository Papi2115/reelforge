/**
 * C-CAM figure (PLAN.md#14.5): draws a `Character` in a pose through the rig, in the fixed draw
 * order `FIGURE_ORDER` (rig-layers.ts), and resolves poses for a character.
 *
 * Views: a `FigureView` is either a `View` name (never mirrored) or a signed ring yaw as returned
 * by `turn` / `yawOfView` (negative = the same drawing mirrored, facing screen-left).
 *
 * Port of the `draw(ctx, p)` skeleton every cast file repeated
 * (`docs/concepts/c-cam-style/films/03-apollo-11/js/cast/commander.js:114-145`, with film 1's bow,
 * `films/01-samurai-edo/js/cast/you.js:146-179`). Divergences:
 *  - one rig-owned `drawFigure` instead of a `draw` per cast file; the character supplies only its
 *    torso / head (/ neck) drawings and styles (character.ts); the props object `p` is split into
 *    the placement (feet, scale, lean, bow), the pose, the view, the expression, the time and
 *    `DrawFigureOptions` (head yaw, head jolt, layer overrides, talk / look, hooks);
 *  - the drawn hand uses `D.hsz` (the size the contact helpers use for the palm), not `arm.hsz`;
 *  - the default neck is a skin tube from `neckBase` to `neckHead` (+ the head jolt) whose widths
 *    come from the head box (0.8 / 0.72 x `head.hw`, else 0.9 / 0.8 x `sw`); each cast file had its
 *    own; a 2-number neck spec (head on the collar) draws none. `drawNeck` gets the spec with the
 *    jolt already added to the head y;
 *  - the bow's hip "seat" blob (film 1, a per-character cloth patch over the hinge) is not drawn;
 *  - hooks receive `(J, env)` and run in the upper-body (bowed) frame, so palms line up.
 *
 * Public API: `FigureView`, `resolveView`, `BodyPlacement`, `ArmLayerOverrides`,
 * `FigureHook`, `DrawFigureOptions`, `solvePose`, `bowed`, `drawFigure`.
 */
import { figure, type BrushEnv, type FigurePlacement } from './brushes.js';
import { neckBase, neckHead, type Character, type NeckSpec } from './character.js';
import { face, type FaceOptions, type Pair } from './face.js';
import type { HandKind } from './hand.js';
import type { Paint2D } from './paint.js';
import type { Pose } from './poses.js';
import { armLayer, legsFarFirst, solve, type ArmLayer, type RigJoints } from './rig-layers.js';
import { drawArm, drawLeg, type ArmStyle } from './rig-limbs.js';
import { headView, viewState, yawOfView, type View, type ViewState } from './rig-views.js';
import { tube } from './shapes.js';
import type { LimbRig } from './rig-ik.js';

/** A view name (unmirrored) or a signed ring yaw (negative = mirrored). */
export type FigureView = View | number;

export function resolveView(view: FigureView): ViewState {
  return viewState(typeof view === 'number' ? view : yawOfView(view));
}

/** Feet, scale and lean of `figure` plus the bow (degrees, + forward, about the hip pivot). */
export interface BodyPlacement extends FigurePlacement {
  readonly bow?: number;
}

/** Forced arm layers (`armLayer`'s `force`): 2 = a hand that must sit in front (on the face). */
export interface ArmLayerOverrides {
  readonly L?: ArmLayer;
  readonly R?: ArmLayer;
}

/** A draw hook, run in figure space (upper-body frame) with the solved joints and the figure's env. */
export type FigureHook = (J: RigJoints, env: BrushEnv) => void;

export interface DrawFigureOptions {
  /** Head yaw (default: the body's), see `headView`. */
  readonly headYaw?: number;
  /** Head jolt / nod in body px (y down). */
  readonly headDy?: number;
  readonly layer?: ArmLayerOverrides;
  /** Speech spans for the jaw (`face`). */
  readonly talk?: readonly Pair[];
  /** Pupil offset override (`face`). */
  readonly look?: Pair;
  /** Step `before-hand`: props under the near hand. */
  readonly beforeHand?: FigureHook;
  /** Step `after`: things over the hands. */
  readonly after?: FigureHook;
}

/** Resolves `pose` for the character in `view` (the joints `drawFigure` draws). */
export function solvePose(
  character: Pick<Character, 'D'>,
  pose: Pose,
  view: FigureView,
): RigJoints {
  return solve(resolveView(view), character.D, pose);
}

/** Runs `draw` with the upper body rotated by `deg` (+ forward) about the hip pivot `(0, hy)`. */
export function bowed(g: Paint2D, hy: number, deg: number, draw: () => void): void {
  if (!deg) {
    draw();
    return;
  }
  g.save();
  g.translate(0, hy);
  g.rotate((deg * Math.PI) / 180);
  g.translate(0, -hy);
  draw();
  g.restore();
}

function defaultNeck(g: Paint2D, env: BrushEnv, character: Character, n: NeckSpec): void {
  if (n.length !== 4) return;
  const D = character.D;
  const widths = D.head ? [D.head.hw * 0.8, D.head.hw * 0.72] : [D.sw * 0.9, D.sw * 0.8];
  // prettier-ignore
  tube(g, env, [n[0], n[1] + 4, n[2], n[3] + 16], widths, character.tones.skin, { lw: 6, seed: character.seed + 60, shade: [character.tones.skinD, -8, 0] });
}

interface ArmDraw {
  readonly j: LimbRig;
  readonly layer: ArmLayer;
  readonly style: ArmStyle;
}

function armStyle(character: Character, kind: HandKind | undefined, sd: number): ArmStyle {
  const hand = character.arm.hand === 'none' ? 'none' : (kind ?? character.arm.hand ?? 'fist');
  return { ...character.arm, hsz: character.D.hsz, hand, seed: character.seed + 80 + sd };
}

/**
 * Draws the character with its feet at the placement, in `pose`, `view`, expression `expr`
 * (undefined = `character.defaultExpr`, else `deadpan`) at shot time `t` (blinks, talk), in the
 * order of `FIGURE_ORDER`. Returns the solved joints (figure space).
 */
export function drawFigure(
  g: Paint2D,
  env: BrushEnv,
  character: Character,
  placement: BodyPlacement,
  pose: Pose,
  view: FigureView,
  expr: string | undefined,
  t: number,
  opts: DrawFigureOptions = {},
): RigJoints {
  const V = resolveView(view);
  const D = character.D;
  const J = solve(V, D, pose);
  const faceOpts: FaceOptions = {
    ...(opts.talk === undefined ? {} : { talk: opts.talk }),
    ...(opts.look === undefined ? {} : { look: opts.look }),
  };
  const f = face(t, character.seed, expr ?? character.defaultExpr ?? 'deadpan', faceOpts);
  const n = character.neck[V.v];
  const neckY = neckBase(n)[1] + J.bob;
  const headDy = opts.headDy || 0;
  const arms: readonly ArmDraw[] = [
    {
      j: J.aL,
      layer: armLayer(J.aL, neckY, opts.layer?.L),
      style: armStyle(character, pose.kL, 1),
    },
    {
      j: J.aR,
      layer: armLayer(J.aR, neckY, opts.layer?.R),
      style: armStyle(character, pose.kR, 2),
    },
  ];
  const hy = D.hy + J.bob;
  const bow = placement.bow || 0;
  const lean = (placement.lean || 0) + (pose.lean || 0);
  const at = { x: placement.x, y: placement.y, s: placement.s, lean };
  figure(g, env, at, V.mir, (inner) => {
    const armsAt = (layer: ArmLayer): void => {
      for (const arm of arms) if (arm.layer === layer) drawArm(g, inner, arm.j, arm.style);
    };
    bowed(g, hy, bow, () => {
      armsAt(0);
    });
    for (const { leg, sgn } of legsFarFirst(J)) {
      drawLeg(g, inner, V, leg, sgn, { ...character.leg, seed: character.seed + 90 + sgn });
    }
    bowed(g, hy, bow, () => {
      g.save();
      g.translate(0, J.bob);
      const jolted: NeckSpec = n.length === 4 ? [n[0], n[1], n[2], n[3] + headDy] : n;
      if (character.drawNeck) character.drawNeck(g, inner, V.v, jolted);
      else defaultNeck(g, inner, character, jolted);
      character.torso(g, inner, V.v);
      g.restore();
      armsAt(1);
      const H = headView(V.yaw, opts.headYaw);
      const k = character.headScale;
      const [hx, hyHead] = neckHead(n);
      g.save();
      g.translate(hx, hyHead + J.bob + headDy);
      g.scale(H.flip ? -k : k, k);
      character.head(g, inner, H.V.v, f);
      g.restore();
      if (opts.beforeHand) opts.beforeHand(J, inner);
      armsAt(2);
      if (opts.after) opts.after(J, inner);
    });
  });
  return J;
}
