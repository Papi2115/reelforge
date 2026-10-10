/**
 * Head and figure coherence (c-plus `validate-raster.js` `V.heads`, `V.figures`), raster rules:
 *  - `headPieces`: each head view alone, flat, is ONE piece with NO holes for every expression,
 *    at the expression's own jaw and with the jaw fully open (a hole = the collar showing through
 *    a gap between skull and jaw; a second piece = a detached jaw / chin tier);
 *  - `figurePieces`: each whole figure, flat, is ONE piece in every view x pose (no floating head,
 *    hand or shoe).
 * C-CAM has no visemes: the jaw drop stands in for them.
 *
 * Public API: `headPieces`, `figurePieces`.
 */
import { EXPR_NAMES, face } from '../draw/face.js';
import { fmt, str, viewIndices, type RuleContext } from './context.js';
import { headShapes, figureShapes, OPEN_JAW } from './measure.js';
import { components, rasterize } from './raster.js';
import { inkBounds } from './shape-geometry.js';
import { THRESHOLDS } from './thresholds.js';

export function headPieces(ctx: RuleContext): void {
  const ch = ctx.character;
  for (const v of viewIndices(ctx.views)) {
    for (const expr of EXPR_NAMES) {
      const own = face(0, ch.seed, expr, { noBlink: true });
      const jaws = own.jaw === OPEN_JAW ? [own.jaw] : [own.jaw, OPEN_JAW];
      for (const jaw of jaws) {
        ctx.check();
        const shapes = headShapes(ch, v, { ...own, jaw });
        const box = inkBounds(shapes);
        if (box === null) continue;
        const r = components(rasterize(shapes, box), THRESHOLDS.minPiecePx, THRESHOLDS.minHolePx);
        ctx.metric('head: biggest hole in a head px', r.biggestHole);
        if (r.comps === 1 && r.holes === 0) continue;
        ctx.fail({
          view: v,
          pose: `${expr} jaw ${fmt(jaw, 2)}`,
          message: `head view ${str(v)} '${expr}' with jaw ${fmt(jaw, 2)}: ${str(r.comps)} piece(s), ${str(r.holes)} hole(s) (biggest ${str(r.biggestHole)} px)`,
          fix: 'add the jaw drop to the chin points of the ONE head outline (and the beard / jowls with it) instead of moving a separate chin or jaw piece; keep the mouth inside the chin',
          measured: r.comps + r.holes,
          limit: 1,
        });
      }
    }
  }
}

export function figurePieces(ctx: RuleContext): void {
  const ch = ctx.character;
  const top = Math.abs(ch.D.top ?? ctx.head(0).box.y0) || 1;
  const s = THRESHOLDS.figureHeightPx / top;
  for (const yaw of ctx.views) {
    for (const pc of ctx.poses) {
      ctx.check();
      const shapes = figureShapes(ch, yaw, pc.pose(ch.D), s);
      const box = inkBounds(shapes);
      if (box === null) continue;
      const r = components(rasterize(shapes, box), THRESHOLDS.minPiecePx, Number.POSITIVE_INFINITY);
      if (r.comps === 1) continue;
      ctx.fail({
        view: yaw,
        pose: pc.name,
        message: `the figure falls apart into ${str(r.comps)} separate pieces`,
        fix: 'check neck[v] (the head point must sit on the collar or the neck), the torso outline round the shoulder and hip anchors, and the leg / shoe sizes',
        measured: r.comps,
        limit: 1,
      });
    }
  }
}
