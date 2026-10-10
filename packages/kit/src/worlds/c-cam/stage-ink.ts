/**
 * `env.ink` of the Grim Ink stage (PLAN.md#14.12): the kit's C-CAM draw functions as a scene
 * calls them inside `stage.paint(t, (g, env) => …)`, with their own signatures — the brushes,
 * scenery and grime `(g, inkEnv, …)` where `inkEnv` is `cam.env` after the camera (or `env` at
 * zoom 1), the camera (cut table, foreground, coverage), faces, poses, hands, the rig and the
 * contact helpers, and the ink-stroke lettering bound to this frame's surface
 * (`drawText(text, options)`: the string first, for the text-provenance guard). Scene-facing
 * entry points that a typo would break silently are checked (stage-ink-checks.ts). Everything is
 * a pure function of its arguments: no clock, no state between frames.
 */
import { bbox, brushStroke, curve, figure, inkLine, makeEnv, tracePath } from './draw/brushes.js';
import {
  FG_INK,
  SCREEN_ENV,
  applyCamera,
  cutFramingAt,
  fgScreen,
  fgWorld,
  screenToWorld,
  silhouette,
  visibleRect,
  worldToScreen,
} from './draw/camera.js';
import {
  bowPt,
  figToWorld,
  palmWorld,
  reachPalm,
  reachPalmChecked,
  worldToFig,
} from './draw/contact.js';
import { brow, eye, mouth } from './draw/face-parts.js';
import { face, pores, stubble, wart } from './draw/face.js';
import { solvePose } from './draw/figure.js';
import { cobbles, crack, flies, house, peel, puddle, stain, windowPane } from './draw/grime.js';
import { hand } from './draw/hand.js';
import type { Paint2D } from './draw/paint.js';
import { footAt, handAt } from './draw/poses.js';
import { turn } from './draw/rig-views.js';
import { bands, beam, bricks, gloom, pool, rect, rough, stars, wobble } from './draw/scenery.js';
import { blob, ellipseRing, hatch, mottle, tube } from './draw/shapes.js';
import {
  layoutText,
  measureText,
  paintInkSurface,
  posterLayers,
  thudIn,
  thudScale,
  wrapText,
} from './lettering/index.js';
import { CHECKED, boundDrawText } from './stage-ink-checks.js';

/** The frame-independent part of `env.ink` (built once). */
const INK_FUNCTIONS = Object.freeze({
  // Lines and shapes: (g, inkEnv, …).
  inkLine,
  brushStroke,
  blob,
  tube,
  hatch,
  mottle,
  rough,
  rect,
  beam,
  figure,
  // Scenery and light: (g, …) without an env (flat fills).
  bands,
  stars,
  pool,
  gloom,
  bricks,
  // Grime.
  stain,
  peel,
  crack,
  cobbles,
  house,
  windowPane,
  puddle,
  flies,
  // Pure point helpers.
  curve,
  ellipseRing,
  wobble,
  bbox,
  tracePath,
  makeEnv,
  // Camera.
  resolveCut: CHECKED.resolveCut,
  cutFramingAt,
  applyCamera,
  worldToScreen,
  screenToWorld,
  visibleRect,
  fgScreen,
  fgWorld,
  silhouette,
  coverage: CHECKED.coverage,
  SCREEN_ENV,
  FG_INK,
  // Faces and hands.
  face,
  exprAt: CHECKED.exprAt,
  eye,
  brow,
  mouth,
  stubble,
  wart,
  pores,
  hand,
  // Poses and the rig.
  pose: CHECKED.pose,
  handAt,
  footAt,
  turn,
  drawFigure: CHECKED.drawFigure,
  solvePose,
  anchors: CHECKED.anchors,
  anchorWorld: CHECKED.anchorWorld,
  // Contacts (world space, before the camera).
  palmWorld,
  reachPalm,
  reachPalmChecked,
  figToWorld,
  worldToFig,
  bowPt,
  // Lettering layout (pure; drawText is bound per frame).
  layoutText,
  wrapText,
  measureText,
  posterLayers,
  thudScale,
  thudIn,
});

/** `env.ink` of one frame: the kit's draw functions plus `drawText` on that frame's surface. */
export function stageInk(g: Paint2D) {
  return Object.freeze({ ...INK_FUNCTIONS, drawText: boundDrawText(paintInkSurface(g)) });
}

export type StageInk = ReturnType<typeof stageInk>;

/** Names of `env.ink` (docs and tests). */
export const STAGE_INK_NAMES: readonly string[] = Object.freeze(
  [...Object.keys(INK_FUNCTIONS), 'drawText'].sort(),
);
