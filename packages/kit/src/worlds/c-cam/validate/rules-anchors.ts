/**
 * Anchor rules (c-plus `validate-raster.js` `V.anchors`, `CHARACTER_CONTRACT.md` §1): the
 * shoulder anchors sit inside the torso drawing and below the measured chin plus the neck gap
 * (jaw shut: error; jaw fully open: warning, C-CAM guide §9 "arms growing out of an open chin");
 * the hand-set face anchors sit on the head drawing.
 *
 * Not ported: "drawn shoulder == arm root within 2 px". In C-CAM the torso has no shoulder of its
 * own: `anchors` and `drawArm` both read the one `solve`, so they agree by construction.
 *
 * Public API: `shoulderOutsideTorso`, `shoulderAboveChin`, `shoulderAboveOpenChin`,
 * `faceAnchorOffHead`.
 */
import { anchors } from '../draw/anchors.js';
import { FACE_ANCHOR_NAMES, neckHead } from '../draw/character.js';
import { pose } from '../draw/poses.js';
import { viewState } from '../draw/rig-views.js';
import { fmt, str, viewIndices, type RuleContext } from './context.js';
import { inkContains, inkDistance } from './shape-geometry.js';
import type { Shape } from './shape-paint.js';
import { THRESHOLDS } from './thresholds.js';

const SIDES = ['L', 'R'] as const;

/** px to move (x, y) toward the body axis / downward until it is inside the ink (capped). */
function stepsInside(
  ink: readonly Shape[],
  x: number,
  y: number,
  dx: number,
  dy: number,
): number | null {
  for (let i = 1; i <= 400; i += 1) {
    if (inkContains(ink, x + dx * i, y + dy * i)) return i;
  }
  return null;
}

/** Every shoulder anchor (both sides, every view) lies inside the torso drawing of its view. */
export function shoulderOutsideTorso(ctx: RuleContext): void {
  const D = ctx.character.D;
  const P = pose('stand', D);
  for (const yaw of ctx.views) {
    const v = viewState(yaw).v;
    const torso = ctx.torso(v);
    const A = anchors(ctx.character, yaw, P);
    for (const side of SIDES) {
      ctx.check();
      const [x, y] = A.body[side === 'L' ? 'sh.L' : 'sh.R'];
      if (inkContains(torso, x, y)) continue;
      const inward = stepsInside(torso, x, y, x > 0 ? -1 : 1, 0);
      const down = stepsInside(torso, x, y, 0, 1);
      const off = inkDistance(torso, x, y).d;
      const fix =
        inward !== null && (down === null || inward <= down)
          ? `move the ${side} shoulder ${str(inward)} px toward the body axis (D.sw ${str(D.sw)} -> about ${str(D.sw - inward)}) or widen the torso outline of view ${str(v)}`
          : down !== null
            ? `lower the shoulders ${str(down)} px (D.sy ${str(D.sy)} -> ${str(D.sy + down)}) or raise the torso outline of view ${str(v)}`
            : `the torso of view ${str(v)} does not reach the shoulder line: redraw it round (±D.sw, D.sy)`;
      ctx.fail({
        view: yaw,
        pose: null,
        message: `${side} shoulder anchor (${fmt(x)}, ${fmt(y)}) is ${fmt(off)} px outside the torso drawing`,
        fix,
        measured: off,
        limit: 0,
      });
    }
  }
}

function shoulderVsChin(ctx: RuleContext, open: boolean): void {
  const D = ctx.character.D;
  const gap = D.neckGap ?? THRESHOLDS.neckGap;
  const P = pose('stand', D);
  for (const yaw of ctx.views) {
    const v = viewState(yaw).v;
    const head = ctx.head(v);
    const chin = open ? head.chinOpen : head.chinShut;
    const A = anchors(ctx.character, yaw, P);
    const shoulderY = Math.min(A.body['sh.L'][1], A.body['sh.R'][1]);
    const clearance = shoulderY - (chin + gap);
    ctx.check();
    ctx.metric(
      `anchors: min shoulder clearance below ${open ? 'open' : 'shut'} chin+gap px`,
      clearance,
      true,
    );
    if (clearance >= 0) continue;
    const need = Math.ceil(-clearance);
    ctx.fail({
      view: yaw,
      pose: null,
      message: `shoulders (y ${fmt(shoulderY)}) are ${fmt(-clearance)} px above the ${open ? 'fully open' : 'shut'} chin (y ${fmt(chin)}) + neck gap ${str(gap)}`,
      fix: `lower the shoulders by ${str(need)} px (D.sy ${str(D.sy)} -> ${str(D.sy + need)}) or raise the head in neck[${str(v)}] by ${str(need)} px`,
      measured: clearance,
      limit: 0,
    });
  }
}

/** The shoulder line sits at least the neck gap below the chin with the jaw shut (c-plus rule). */
export function shoulderAboveChin(ctx: RuleContext): void {
  shoulderVsChin(ctx, false);
}

/** The same with the jaw fully open (C-CAM: the jaw drops the one chin outline). */
export function shoulderAboveOpenChin(ctx: RuleContext): void {
  shoulderVsChin(ctx, true);
}

/** Each defined face anchor lies on the head drawing (jaw shut) within `faceAnchorPx`. */
export function faceAnchorOffHead(ctx: RuleContext): void {
  const ch = ctx.character;
  const table = ch.faceAnchors;
  if (!table) return;
  const k = ch.headScale;
  for (const v of viewIndices(ctx.views)) {
    const entries = table[v];
    const [hx, hy] = neckHead(ch.neck[v]);
    const ink = ctx.head(v).shut;
    for (const name of FACE_ANCHOR_NAMES) {
      const q = entries[name];
      if (!q) continue;
      ctx.check();
      const { d, at } = inkDistance(ink, hx + k * q[0], hy + k * q[1]);
      ctx.metric('anchors: max face anchor distance from the head ink px', d);
      if (d <= THRESHOLDS.faceAnchorPx) continue;
      const nx = (at[0] - hx) / k;
      const ny = (at[1] - hy) / k;
      ctx.fail({
        view: v,
        pose: null,
        message: `face anchor '${name}' [${str(q[0])}, ${str(q[1])}] is ${fmt(d)} px off the head drawing`,
        fix: `move faceAnchors[${str(v)}].${name} onto the head, e.g. to [${fmt(nx, 0)}, ${fmt(ny, 0)}] (head-local)`,
        measured: d,
        limit: THRESHOLDS.faceAnchorPx,
      });
    }
  }
}
