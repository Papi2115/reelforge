/**
 * The film's own things on pop-up pieces (real run Sketchbook 4: a pop-up could not carry the
 * film's pig, so its pull revealed a word instead of the subject). A `cutout` or `card` with
 * `asset: '<id>'` draws a project figure (ctx.worldAssets / `defineFigure`) or prop (`defineProp`)
 * on the piece instead of its `draw`: the same drawing as `page.person({ like })` /
 * `page.use(id)` elsewhere in the film, pre-drawn on the paper like the piece's own felt art.
 */
import {
  DEFAULT_EXPRESSION,
  DEFAULT_POSE,
  figureMarks,
  skeleton,
  type Pose,
} from '../draw/figures.js';
import { fitMarks, type Mark } from '../draw/marks.js';
import { seedOf as idSeed } from '../draw/math.js';
import { heldDrawing } from '../page/api-vocab.js';
import { compileDoodle } from '../vocab/compile.js';
import type { SketchLibrary } from '../vocab/library.js';
import { personLook, personParts, weave } from '../vocab/person.js';
import { sequenceOps } from '../vocab/sequence.js';

/**
 * Piece-local marks of an asset: centred on `cx`, feet / base on `ground` (y down), `h` tall
 * (a prop also at most `maxW` wide).
 */
export type AssetArt = (
  id: string,
  place: {
    readonly cx: number;
    readonly ground: number;
    readonly h: number;
    readonly maxW: number;
  },
  pose?: Partial<Pose>,
) => Mark[];

const FPS = 12;

function propMarks(
  library: SketchLibrary,
  id: string,
  place: Parameters<AssetArt>[1],
  call: string,
): Mark[] {
  const entry = library.prop(id, call);
  const [bw, bh] = entry.drawing(1).box;
  const h = Math.min(place.h, (place.maxW * bh) / bw);
  const spec = entry.drawing(h / bh);
  const scale = h / spec.box[1];
  const ops = compileDoodle(
    spec,
    { x: place.cx, y: place.ground, scale, anchor: 'bottom', flip: false, rot: 0, unit: 1 },
    idSeed(id),
  );
  return sequenceOps(ops, { t0: 0, seed: idSeed(id), speed: 1, fps: FPS, held: false, unit: 1 });
}

function figureArt(
  library: SketchLibrary,
  id: string,
  place: Parameters<AssetArt>[1],
  pose: Partial<Pose>,
  call: string,
): Mark[] {
  const stored = library.figure(id, call);
  const look = personLook.parse(
    Object.fromEntries(Object.keys(personLook.shape).map((key) => [key, stored[key]])),
  );
  const seed = idSeed(id);
  const full: Pose = { ...DEFAULT_POSE, ...pose };
  const spec = {
    x: place.cx,
    y: place.ground,
    h: place.h,
    t0: 0,
    seed,
    tool: look.pen,
    fps: FPS,
    belly: look.belly,
    brows: true,
    pose: () => full,
    expression: () => DEFAULT_EXPRESSION,
  };
  const sk = () => skeleton(spec, full);
  const thing =
    look.holds === undefined ? null : heldDrawing(library, look.holds, look.holdSize, call);
  return weave(figureMarks(spec), personParts(look, 1, sk, seed, thing, call), seed, FPS);
}

/** Draws the film's assets on pop-up pieces (already drawn when the card opens). */
export function popupAssetArt(library: SketchLibrary, call: string): AssetArt {
  return (id, place, pose = {}) => {
    const where = `${call} asset "${id}"`;
    const marks = library.hasProp(id)
      ? propMarks(library, id, place, where)
      : figureArt(library, id, place, pose, where);
    fitMarks(marks, 0, -5, -4.9);
    return marks.map((mark) => ({ ...mark, held: false }));
  };
}
