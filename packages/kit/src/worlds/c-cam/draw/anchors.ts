/**
 * C-CAM rig anchors (PLAN.md#14.5): named points of a posed figure, computed from the SAME solve
 * the drawing uses (shoulder anchor == arm root, hip anchor == leg root), so later validators
 * (task 14.13) and contact code can measure against them.
 *
 * Names follow the c-plus contract (`docs/concepts/styles7/20-cplus-engine/CHARACTER_CONTRACT.md`
 * §1 and `js/contact.js` `anchorWorld`): `sh.L/R`, `shoulderNear/Far`, `hip.L/R`, `hipNear/Far`,
 * `neck`, plus `hand.L/R` (wrist) and `palm.L/R` (grip point), and the face anchors `chin`,
 * `cheek`, `nose`, `mouth`, `ear`, `forehead` from the character's optional `faceAnchors`.
 * Near = the side with the larger depth (toward the camera); ties pick L, as in c-plus.
 *
 * Divergences from c-plus: no shoulder tilt (`D.tilt` / `shY`) and no torso displacement field (C
 * has neither); no jaw rule (C heads have no `jaw` spec): face anchors do not drop with the jaw;
 * one point per face anchor (no candidate lists); the head box is the hand-set `D.head` (not
 * measured). `anchors` works in figure space without the bow (it has no placement);
 * `anchorWorld` applies the bow to every anchor except the hips (the hinge stays planted).
 *
 * Public API: `BODY_ANCHOR_NAMES`, `BodyAnchorName`, `AnchorName`, `AnchorOptions`, `RigAnchors`,
 * `anchors`, `anchorWorld`.
 */
import {
  FACE_ANCHOR_NAMES,
  neckBase,
  neckHead,
  type Character,
  type FaceAnchorName,
} from './character.js';
import { bowPt, figToWorld, type HandSide, type PlacedFigure, type Point2 } from './contact.js';
import { resolveView, type FigureView } from './figure.js';
import type { Pose } from './poses.js';
import { palm } from './rig-ik.js';
import { solve } from './rig-layers.js';
import { headView, proj } from './rig-views.js';

export const BODY_ANCHOR_NAMES = [
  'sh.L',
  'sh.R',
  'shoulderNear',
  'shoulderFar',
  'hip.L',
  'hip.R',
  'hipNear',
  'hipFar',
  'neck',
  'hand.L',
  'hand.R',
  'palm.L',
  'palm.R',
] as const;

export type BodyAnchorName = (typeof BODY_ANCHOR_NAMES)[number];

export type AnchorName = BodyAnchorName | FaceAnchorName;

/** The head's own yaw and jolt, as given to `drawFigure` (they move the face anchors only). */
export interface AnchorOptions {
  readonly headYaw?: number;
  readonly headDy?: number;
}

/** Figure-space anchors (feet at the origin, bob applied, no lean / flip / bow). */
export interface RigAnchors {
  readonly body: Readonly<Record<BodyAnchorName, Point2>>;
  /** Only the face anchors the character defines for the head's view. */
  readonly face: Readonly<Partial<Record<FaceAnchorName, Point2>>>;
  readonly near: HandSide;
  readonly far: HandSide;
}

const xy = (p: readonly number[]): Point2 => [p[0] ?? 0, p[1] ?? 0];

/** Anchors of `character` in `pose`, `view` (figure space, see `RigAnchors`). */
export function anchors(
  character: Pick<Character, 'D' | 'neck' | 'headScale' | 'faceAnchors'>,
  view: FigureView,
  pose: Pose,
  opts: AnchorOptions = {},
): RigAnchors {
  const V = resolveView(view);
  const D = character.D;
  const J = solve(V, D, pose);
  const sz = D.sz || 0;
  const shL = proj(V, [D.sw, D.sy + J.bob, sz]);
  const shR = proj(V, [-D.sw, D.sy + J.bob, sz]);
  const near: HandSide = shL[2] >= shR[2] ? 'L' : 'R';
  const far: HandSide = near === 'L' ? 'R' : 'L';
  const sh = { L: xy(shL), R: xy(shR) };
  const hip = { L: xy(J.lL.s), R: xy(J.lR.s) };
  const n = character.neck[V.v];
  const nb = neckBase(n);
  const body: Record<BodyAnchorName, Point2> = {
    'sh.L': sh.L,
    'sh.R': sh.R,
    shoulderNear: sh[near],
    shoulderFar: sh[far],
    'hip.L': hip.L,
    'hip.R': hip.R,
    hipNear: hip[near],
    hipFar: hip[far],
    neck: [nb[0], nb[1] + J.bob],
    'hand.L': xy(J.aL.h),
    'hand.R': xy(J.aR.h),
    'palm.L': palm(J.aL, D.hsz),
    'palm.R': palm(J.aR, D.hsz),
  };
  const H = headView(V.yaw, opts.headYaw);
  const table = character.faceAnchors?.[H.V.v];
  const face: Partial<Record<FaceAnchorName, Point2>> = {};
  if (table) {
    const k = character.headScale;
    const sx = (H.flip ? -1 : 1) * k;
    const [hx, hy] = neckHead(n);
    const ay = hy + J.bob + (opts.headDy || 0);
    for (const name of FACE_ANCHOR_NAMES) {
      const q = table[name];
      if (q) face[name] = [hx + sx * q[0], ay + k * q[1]];
    }
  }
  return { body, face, near, far };
}

const isFaceAnchor = (name: AnchorName): name is FaceAnchorName =>
  (FACE_ANCHOR_NAMES as readonly string[]).includes(name);

/**
 * World position of anchor `name` of a placed figure (as drawn with the same placement and pose
 * and the view `placement.yaw`), or null for a face anchor the character does not define.
 */
export function anchorWorld(
  fig: PlacedFigure & {
    readonly character: Pick<Character, 'D' | 'neck' | 'headScale' | 'faceAnchors'>;
  },
  name: AnchorName,
  opts: AnchorOptions = {},
): Point2 | null {
  const { placement: p, pose: P } = fig;
  const yaw = p.yaw ?? 0;
  const A = anchors(fig.character, yaw, P, opts);
  const q = isFaceAnchor(name) ? A.face[name] : A.body[name];
  if (q === undefined) return null;
  const D = fig.character.D;
  const bob = (P.bob || 0) * (D.l1l + D.l2l);
  const hinge = name === 'hip.L' || name === 'hip.R' || name === 'hipNear' || name === 'hipFar';
  const bent = hinge ? q : bowPt(q, D.hy + bob, p.bow || 0);
  return figToWorld(p, resolveView(yaw).mir, (p.lean || 0) + (P.lean || 0), bent);
}
