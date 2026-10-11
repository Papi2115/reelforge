/**
 * Measurements the validators take from the character's own drawings (c-plus
 * `character.js` `measure`): each head view drawn alone with the jaw shut and fully open, the
 * torso of each view, and a whole figure, all recorded as shapes by `ShapePaint` in figure space
 * at scale 1 (feet at the origin, no bob; the brush env of a figure at scale 1).
 *
 * Public API: `OPEN_JAW`, `HeadMeasure`, `measureHead`, `torsoShapes`, `headShapes`,
 * `figureShapes`, `shutFace`, `openFace`.
 */
import { DEFAULT_ENV } from '../draw/brushes.js';
import { neckHead, type Character } from '../draw/character.js';
import { face, type FaceState } from '../draw/face.js';
import { drawFigure } from '../draw/figure.js';
import type { Pose } from '../draw/poses.js';
import type { ViewIndex } from '../draw/rig-views.js';
import { inkBounds, unionBox, type Box } from './shape-geometry.js';
import { ShapePaint, type Shape } from './shape-paint.js';

/** The widest jaw drop any face state reaches (`EXPR.yelling.jaw`; talking flaps stay <= 0.8). */
export const OPEN_JAW = 1;

/** The character's resting face with the jaw shut (no blink). */
export function shutFace(character: Character): FaceState {
  const f = face(0, character.seed, character.defaultExpr ?? 'deadpan', { noBlink: true });
  return { ...f, jaw: 0 };
}

/** The resting face with the jaw fully open and an open mouth. */
export function openFace(character: Character): FaceState {
  return { ...shutFace(character), jaw: OPEN_JAW, mouth: 'open' };
}

/** One head view drawn alone where `drawFigure` puts it (`neck[v]` head point, head scale), bob 0. */
export function headShapes(character: Character, v: ViewIndex, f: FaceState): Shape[] {
  const g = new ShapePaint();
  const [hx, hy] = neckHead(character.neck[v]);
  const k = character.headScale;
  g.translate(hx, hy);
  g.scale(k, k);
  character.head(g, DEFAULT_ENV, v, f);
  return g.shapes;
}

/** A measured head view in figure space (bob 0). */
export interface HeadMeasure {
  readonly v: ViewIndex;
  readonly shut: readonly Shape[];
  /** Bounds of the head with the jaw shut and fully open (the c-plus head box). */
  readonly box: Box;
  /** Bounds of the head with the jaw shut (the resting face the pose grid is drawn with). */
  readonly shutBox: Box;
  /** Lowest ink with the jaw shut (c-plus `rest`) and fully open. */
  readonly chinShut: number;
  readonly chinOpen: number;
}

export function measureHead(character: Character, v: ViewIndex): HeadMeasure {
  const shut = headShapes(character, v, shutFace(character));
  const open = headShapes(character, v, openFace(character));
  const [hx, hy] = neckHead(character.neck[v]);
  const fallback: Box = { x0: hx, y0: hy, x1: hx, y1: hy };
  const shutBox = inkBounds(shut) ?? fallback;
  const openBox = inkBounds(open) ?? fallback;
  return {
    v,
    shut,
    box: unionBox(shutBox, openBox) ?? fallback,
    shutBox,
    chinShut: shutBox.y1,
    chinOpen: openBox.y1,
  };
}

/** The torso drawing of view v alone (figure space, bob 0). */
export function torsoShapes(character: Character, v: ViewIndex): Shape[] {
  const g = new ShapePaint();
  character.torso(g, DEFAULT_ENV, v);
  return g.shapes;
}

/** The whole figure as `drawFigure` draws it at feet (0, 0), scale s, time 0. */
export function figureShapes(character: Character, yaw: number, pose: Pose, s: number): Shape[] {
  const g = new ShapePaint();
  drawFigure(g, DEFAULT_ENV, character, { x: 0, y: 0, s }, pose, yaw, undefined, 0);
  return g.shapes;
}
