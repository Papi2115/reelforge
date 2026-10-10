/**
 * The ink toolbox of a Grim Ink project module (PLAN.md#14.8): people and place modules are plain
 * JS files without imports, so every drawing function they get (`torso(g, ink, view)`,
 * `head(g, ink, view, face)`, `draw(g, ink, t)`) receives `ink`: the brush env of the moment
 * (`zoom`, `lw`: the ink width of the figure / camera) plus the ported brushes already bound to
 * `g` and that env, the palette `C` and the pure time / hash helpers. Same inputs -> same strokes.
 */
import { C, clamp01, ease, hash, key, lerp, noise1, rnd, seg, step, twos } from '../core.js';
import { bbox, brushStroke, curve, inkLine, type BrushEnv } from '../draw/brushes.js';
import { brow, eye, mouth } from '../draw/face-parts.js';
import { stubble, wart } from '../draw/face.js';
import { crack, cobbles, peel, puddle, stain, windowPane } from '../draw/grime.js';
import type { Paint2D } from '../draw/paint.js';
import { bands, beam, bricks, gloom, pool, rect, rough, stars, wobble } from '../draw/scenery.js';
import { blob, ellipseRing, hatch, mottle, tube } from '../draw/shapes.js';

/** Pure helpers of core.ts (all functions of their arguments). */
export const INK_TIME = Object.freeze({
  twos,
  key,
  step,
  seg,
  ease,
  lerp,
  clamp01,
  hash,
  rnd,
  noise1,
});

type EnvBrush<A extends unknown[], R> = (g: Paint2D, env: BrushEnv, ...rest: A) => R;
type PlainBrush<A extends unknown[], R> = (g: Paint2D, ...rest: A) => R;

function withEnv<A extends unknown[], R>(
  g: Paint2D,
  env: BrushEnv,
  brush: EnvBrush<A, R>,
): (...rest: A) => R {
  return (...rest) => brush(g, env, ...rest);
}

function withPaint<A extends unknown[], R>(g: Paint2D, brush: PlainBrush<A, R>): (...rest: A) => R {
  return (...rest) => brush(g, ...rest);
}

function bindTools(g: Paint2D, env: BrushEnv) {
  return {
    zoom: env.zoom,
    lw: env.lw,
    C,
    time: INK_TIME,
    // Lines and shapes.
    inkLine: withEnv(g, env, inkLine),
    brushStroke: withEnv(g, env, brushStroke),
    blob: withEnv(g, env, blob),
    tube: withEnv(g, env, tube),
    rough: withEnv(g, env, rough),
    rect: withEnv(g, env, rect),
    beam: withEnv(g, env, beam),
    hatch: withEnv(g, env, hatch),
    mottle: withPaint(g, mottle),
    // Scenery and grime.
    bands: withPaint(g, bands),
    stars: withPaint(g, stars),
    pool: withPaint(g, pool),
    gloom: withPaint(g, gloom),
    bricks: withEnv(g, env, bricks),
    stain: withEnv(g, env, stain),
    peel: withEnv(g, env, peel),
    crack: withEnv(g, env, crack),
    cobbles: withEnv(g, env, cobbles),
    windowPane: withEnv(g, env, windowPane),
    puddle: withEnv(g, env, puddle),
    // Face parts (heads).
    eye: withEnv(g, env, eye),
    brow: withEnv(g, env, brow),
    mouth: withEnv(g, env, mouth),
    stubble: withEnv(g, env, stubble),
    wart: withEnv(g, env, wart),
    // Pure point helpers.
    curve,
    ellipseRing,
    wobble,
    bbox,
  };
}

/** What a module's drawing functions get as `ink` (frozen, rebuilt per call). */
export type InkTools = Readonly<ReturnType<typeof bindTools>>;

/** The toolbox bound to `g` at the ink width of `env`. */
export function inkTools(g: Paint2D, env: BrushEnv): InkTools {
  return Object.freeze(bindTools(g, env));
}
