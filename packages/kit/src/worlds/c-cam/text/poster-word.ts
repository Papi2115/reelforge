/**
 * The prototypes' heavy poster word (`ST.posterWord`, `docs/concepts/c-cam-style/films/03-apollo-11
 * /js/shots/shots-a.js:9-37`): letter by letter, each rotated +-4 deg about a base rotation and
 * nudged +-8 px, an ink outline at the extrusion depth, rust extrusion steps every 2 px, the ink
 * outline and the bone fill on top; the letters thud in on twos (`thudIn`: 1.6 -> 1.0 in 3 stepped
 * moves at 12 fps, 0.04 s apart). With the role's system font (Impact) it is the prototype's own
 * drawing; without it, the CC0 poster lettering with `posterLayers` (PLAN.md#14.7).
 */
import { rnd } from '../core.js';
import type { Paint2D } from '../draw/paint.js';
import {
  POSTER_COLOURS,
  THUD_FPS,
  THUD_LETTER_STEP,
  drawText,
  posterLayers,
  thudIn,
  thudScale,
  thudStart,
} from '../lettering/index.js';
import { paintInkSurface } from '../lettering/paint-surface.js';
import { fallbackCap, measureInkText, roleFont, type TextTarget } from './ink-text.js';
import { ROLE_SPECS, roleUsesSystemFont } from './roles.js';

/** Steps of the thud before a letter rests (THUD_SCALES of thud-in.ts). */
const THUD_REST_STEPS = 4;

export interface PosterWordOptions {
  readonly x: number;
  /** Vertical middle of the capitals. */
  readonly y: number;
  /** Font size in px (the cap height of the fallback follows the role's measured share). */
  readonly size: number;
  /** Start of the thud-in (seconds, the stage's t). */
  readonly t0: number;
  /** Base rotation in degrees. */
  readonly rot?: number | undefined;
  readonly seed?: number | undefined;
}

/** Time (s) the last letter of `word` rests after a thud-in starting at `t0`. */
export function posterWordSettled(word: string, t0: number): number {
  const letters = Array.from(word).length;
  return thudStart(t0, Math.max(0, letters - 1)) + THUD_REST_STEPS / THUD_FPS;
}

function systemLetters(target: TextTarget, word: string, t: number, o: PosterWordOptions): void {
  const chars = Array.from(word);
  const widths = chars.map((ch) => measureInkText(target, ch, 'title', o.size) * 0.97);
  const total = widths.reduce((sum, width) => sum + width, 0);
  const ex = o.size * 0.07;
  let cx = o.x - total / 2;
  chars.forEach((ch, index) => {
    const width = widths[index] ?? 0;
    const lx = cx + width / 2;
    cx += width;
    const thud = thudIn(t, o.t0 + index * THUD_LETTER_STEP);
    if (!thud.visible || ch === ' ') return;
    const seed = o.seed ?? 77;
    const rot = (o.rot ?? 0) + rnd(-4, 4, seed, index);
    const dy = rnd(-8, 8, seed + 1, index);
    target.save();
    target.translate(lx, o.y + dy);
    target.rotate((rot * Math.PI) / 180);
    target.font = roleFont('title', o.size * thud.scale);
    target.textAlign = 'center';
    target.textBaseline = 'middle';
    target.lineJoin = 'round';
    target.lineWidth = o.size * thud.scale * ROLE_SPECS.title.outlineScale;
    target.strokeStyle = POSTER_COLOURS.ink;
    target.strokeText(ch, ex * 0.7, ex);
    target.fillStyle = POSTER_COLOURS.extrusion;
    for (let d = ex; d > 0; d -= 2) target.fillText(ch, d * 0.7, d);
    target.strokeText(ch, 0, 0);
    target.fillStyle = POSTER_COLOURS.fill;
    target.fillText(ch, 0, 0);
    target.restore();
  });
}

/** Draws a poster word at time `t` (see the module comment). */
export function posterWord(
  g: Paint2D,
  target: TextTarget | undefined,
  word: string,
  t: number,
  o: PosterWordOptions,
): void {
  if (target !== undefined && roleUsesSystemFont(target, 'title')) {
    systemLetters(target, word, t, o);
    return;
  }
  const cap = fallbackCap('title', o.size);
  drawText(word, paintInkSurface(g), {
    face: 'poster',
    size: cap,
    x: o.x,
    y: o.y + cap / 2,
    seed: o.seed ?? 77,
    align: 'center',
    rot: o.rot ?? 0,
    track: ROLE_SPECS.title.track,
    fill: POSTER_COLOURS.fill,
    layers: posterLayers(cap),
    charScale: thudScale(t, o.t0),
  });
}
