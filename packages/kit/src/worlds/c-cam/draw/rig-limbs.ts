/**
 * C-CAM rig (PLAN.md#14.5), part 4: limb drawing. An arm is a sleeve tube shoulder -> elbow ->
 * wrist (optionally a bare forearm from a fraction of it, a cuff) and the mitten hand; a leg is a
 * tube hip -> knee -> ankle (optionally a bare shin) and a shoe built from a projected heel / ball /
 * toe so it turns with the view. Everything draws through `Paint2D` with an explicit `BrushEnv`.
 *
 * Port of `docs/concepts/c-cam-style/films/03-apollo-11/js/rig.js` (drawArm / drawLeg / drawFoot).
 * Divergences:
 *  - explicit `BrushEnv` instead of the `ST.LW` global; typed styles (`ArmStyle`, `LegStyle`) with
 *    zod schemas so character modules (14.8) can be validated; `seed` / `lw` keep the original `||`
 *    defaults (50 / 70 / 6);
 *  - `hand` is `HandKind | 'none'` (character-specific kinds such as the commander's thumbs-up are
 *    drawn by the character with `hand: 'none'`, as in the cast files);
 *  - a bare shin (`LegStyle.skin`) without `skinD` draws no shadow crescent (the original set an
 *    undefined fill style, which a canvas ignores but a recording does not); everything else is
 *    call-for-call identical (tests compare `RecordingPaint` recordings with the original).
 *
 * Public API: `FOOT_TILT`, `hatchSpecSchema`, `armStyleSchema`, `ArmStyle`, `legStyleSchema`,
 * `LegStyle`, `FootStyle`, `drawArm`, `drawLeg`, `drawFoot`.
 */
import { z } from 'zod';
import type { BrushEnv } from './brushes.js';
import { HAND_KINDS, hand } from './hand.js';
import type { Paint2D } from './paint.js';
import type { Vec3 } from './poses.js';
import type { LimbRig } from './rig-ik.js';
import { proj, type ViewState } from './rig-views.js';
import { tube, type HatchSpec } from './shapes.js';

/** Feet only: the camera sits a little above, so a forward-pointing foot reads lower on screen. */
export const FOOT_TILT = 0.16;

const num = z.number();
const widths3 = z.tuple([num, num, num]).readonly();

/** zod mirror of `HatchSpec` (shapes.ts). */
export const hatchSpecSchema = z
  .object({
    c: z.string().exactOptional(),
    w: num.exactOptional(),
    n: num.exactOptional(),
    k: num.exactOptional(),
    len: num.exactOptional(),
    gap: num.exactOptional(),
    ang: num.exactOptional(),
    bend: num.exactOptional(),
  })
  .readonly();

/** Sleeve / arm style (the cast files' `ARM` constant, plus `hand` and `seed` per call). */
export const armStyleSchema = z
  .object({
    cloth: z.string(),
    clothD: z.string(),
    /** Widths at shoulder, elbow, wrist. */
    w: widths3,
    /** Skin from this fraction of the forearm (0..1); 1 or absent = fully sleeved. */
    bare: num.min(0).max(1).exactOptional(),
    skin: z.string(),
    skinD: z.string(),
    /** Hand size. */
    hsz: z.number().positive(),
    /** Hand kind (default fist); 'none' = the character draws its own hand. */
    hand: z.enum([...HAND_KINDS, 'none']).exactOptional(),
    cuff: z.string().exactOptional(),
    hatch: hatchSpecSchema.exactOptional(),
    /** Hairy bare forearm. */
    hair: z.boolean().exactOptional(),
    seed: num.exactOptional(),
    lw: num.exactOptional(),
  })
  .readonly();

export type ArmStyle = z.infer<typeof armStyleSchema>;

/** Leg and shoe style (the cast files' `LEG` constant). */
export const legStyleSchema = z
  .object({
    cloth: z.string(),
    clothD: z.string(),
    /** Widths at hip, knee, ankle. */
    w: widths3,
    shoe: z.string(),
    shoeD: z.string(),
    /** Optional shoe highlight. */
    shoeL: z.string().exactOptional(),
    /** Shoe length. */
    len: z.number().positive(),
    /** Shoe width. */
    sw: z.number().positive(),
    /** Toe-out share (default 0.25). */
    splay: num.exactOptional(),
    /** Bare shin colour (the lower 65% of the shin). */
    skin: z.string().exactOptional(),
    skinD: z.string().exactOptional(),
    hatch: hatchSpecSchema.exactOptional(),
    seed: num.exactOptional(),
    lw: num.exactOptional(),
  })
  .readonly();

export type LegStyle = z.infer<typeof legStyleSchema>;

/** The part of `LegStyle` the shoe reads. */
export type FootStyle = Pick<
  LegStyle,
  'len' | 'sw' | 'shoe' | 'shoeD' | 'shoeL' | 'splay' | 'seed' | 'lw'
>;

const hatchOf = (h: HatchSpec | undefined): { hatch?: HatchSpec } =>
  h === undefined ? {} : { hatch: h };

const HAIR: HatchSpec = { c: 'rgba(25,18,12,0.5)', n: 3, len: 10, gap: 4, k: 3, ang: 60 };

/** Draws an arm (sleeve, optional bare forearm and cuff, then the hand) for a solved limb. */
export function drawArm(
  g: Paint2D,
  env: BrushEnv,
  j: Pick<LimbRig, 's' | 'e' | 'h' | 'ang'>,
  st: ArmStyle,
): void {
  const { s, e, h } = j;
  const lw = st.lw || 6;
  const seed = st.seed || 50;
  const w = st.w;
  const bare = st.bare === undefined ? 1 : st.bare;
  if (bare < 1) {
    const bx = e[0] + (h[0] - e[0]) * bare;
    const by = e[1] + (h[1] - e[1]) * bare;
    // prettier-ignore
    tube(g, env, [bx, by, h[0], h[1]], [w[1] * 0.86, w[2] * 0.9], st.skin, { lw, seed: seed + 1, shade: [st.skinD, -w[2] * 0.22, 2], ...hatchOf(st.hair ? HAIR : undefined) });
    const ex = bx + (e[0] - bx) * -0.12;
    const ey = by + (e[1] - by) * -0.12;
    // prettier-ignore
    tube(g, env, [s[0], s[1], e[0], e[1], ex, ey], [w[0], w[1], w[1] * 1.05], st.cloth, { lw, seed, shade: [st.clothD, -w[1] * 0.25, 3], ...hatchOf(st.hatch) });
    if (st.cuff) {
      // prettier-ignore
      tube(g, env, [ex + (e[0] - ex) * 0.6, ey + (e[1] - ey) * 0.6, ex, ey], [w[1] * 1.12, w[1] * 1.12], st.cuff, { lw: lw * 0.8, seed: seed + 3 });
    }
  } else {
    // prettier-ignore
    tube(g, env, [s[0], s[1], e[0], e[1], h[0], h[1]], w, st.cloth, { lw, seed, shade: [st.clothD, -w[1] * 0.25, 3], ...hatchOf(st.hatch) });
    if (st.cuff) {
      // prettier-ignore
      tube(g, env, [e[0] + (h[0] - e[0]) * 0.8, e[1] + (h[1] - e[1]) * 0.8, h[0], h[1]], [w[2] * 1.12, w[2] * 1.1], st.cuff, { lw: lw * 0.8, seed: seed + 3 });
    }
  }
  if (st.hand !== 'none') {
    // prettier-ignore
    hand(g, env, h[0], h[1], j.ang, st.hsz, st.skin, st.hand || 'fist', { seed: seed + 5, lw: lw * 0.9, shade: st.skinD });
  }
}

/** Draws a leg (trouser tube, optional bare shin, then the shoe). sgn = side (+1 left, -1 right). */
export function drawLeg(
  g: Paint2D,
  env: BrushEnv,
  V: ViewState,
  j: Pick<LimbRig, 's' | 'e' | 'h' | 'H3'>,
  sgn: number,
  st: LegStyle,
): void {
  const { s, e, h } = j;
  const lw = st.lw || 6;
  const seed = st.seed || 70;
  // prettier-ignore
  tube(g, env, [s[0], s[1], e[0], e[1], h[0], h[1] - 4], st.w, st.cloth, { lw, seed, shade: [st.clothD, -st.w[1] * 0.25, 2], ...hatchOf(st.hatch) });
  if (st.skin) {
    const shade = st.skinD === undefined ? {} : { shade: [st.skinD, -5, 0] as const };
    // prettier-ignore
    tube(g, env, [e[0] + (h[0] - e[0]) * 0.35, e[1] + (h[1] - e[1]) * 0.35, h[0], h[1] - 4], [st.w[1] * 0.8, st.w[2]], st.skin, { lw, seed: seed + 2, ...shade });
  }
  drawFoot(g, env, V, j.H3, sgn, st);
}

/** Draws a shoe at the body-space ankle A for view V; forward-pointing feet drop by depth x FOOT_TILT. */
export function drawFoot(
  g: Paint2D,
  env: BrushEnv,
  V: ViewState,
  A: Vec3,
  sgn: number,
  st: FootStyle,
): void {
  const len = st.len;
  const sp = (st.splay === undefined ? 0.25 : st.splay) * sgn;
  const pt = (dx: number, dy: number, dz: number): readonly [number, number] => {
    const q = proj(V, [A[0] + dx, A[1] + dy, A[2] + dz]);
    return [q[0], q[1] + q[2] * FOOT_TILT];
  };
  const heel = pt(-sp * len * 0.2, 4, -len * 0.25);
  const ball = pt(sp * len * 0.45, 8, len * 0.5);
  const toe = pt(sp * len * 0.8, 4, len * 0.85);
  const light = st.shoeL ? { light: [st.shoeL, 3, -4] as const } : {};
  // prettier-ignore
  tube(g, env, [heel[0], heel[1], ball[0], ball[1], toe[0], toe[1]], [st.sw * 0.95, st.sw, st.sw * 0.72], st.shoe, { lw: st.lw || 6, seed: (st.seed || 70) + 9, shade: [st.shoeD, -4, 4], ...light });
}
