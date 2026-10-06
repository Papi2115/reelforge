/**
 * Page flips of the Sketchbook (docs/worlds/sketchbook-v2 js/transitions.js): `sketchbook-page-flip`
 * turns the outgoing page over the spiral to the left (it narrows toward the binding, bows a
 * little, darkens as it stands up, casts a soft shadow, a graphite edge), revealing the incoming
 * page; `sketchbook-riffle` is three quick flips through two blank pages of the same notebook (the
 * incoming page with its ink lifted off: paper, rules and grid only).
 */
import type { Composition, Compositor } from '../pixels.js';
import { endFrames, phase } from '../wow.js';
import { inOut, sketchInks, type SketchInks } from './inks.js';

/** x of the binding the page turns about (page px). */
const HINGE = 40;
/** The binding area stays the incoming page's (blank pages keep its spiral). */
const BINDING = 44;

function flipInto(
  c: Composition,
  inks: SketchInks,
  top: Uint32Array,
  under: Uint32Array,
  k: number,
): void {
  const { width: W, height: H, out } = c;
  out.set(under);
  const theta = inOut(k) * (Math.PI / 2);
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  if (cos < 0.015) return;
  const s = W / 960;
  const x0 = Math.round(HINGE * s);
  const middle = H / 2;
  for (let y = 0; y < H; y += 1) {
    const yy = (y - middle) / middle;
    const span = (W - x0) * cos * (1 + 0.05 * sin * yy * yy);
    const edge = x0 + span;
    const row = y * W;
    for (let x = x0; x < Math.min(W, edge); x += 1) {
      const u = (x - x0) / span;
      const sx = Math.round(x0 + u * (W - x0));
      const sy = Math.round(middle + (y - middle) / (1 + 0.16 * sin * u));
      if (sy < 0 || sy >= H || sx >= W) continue;
      const pixel = top[sy * W + sx] ?? 0;
      out[row + x] = sin > 0.6 && inks.paperlike(pixel) ? inks.soft(pixel) : pixel;
    }
    const ex = Math.floor(edge);
    if (ex >= 0 && ex < W) out[row + ex] = inks.ink.GRAPH_L;
    const shadow = Math.round(30 * sin * s);
    for (let x = ex + 1; x < Math.min(W, ex + 1 + shadow); x += 1) {
      const pixel = out[row + x] ?? 0;
      if (inks.paperlike(pixel)) out[row + x] = inks.soft(pixel);
    }
  }
}

export const pageFlip: Compositor = (c) => {
  if (endFrames(c)) return;
  flipInto(c, sketchInks(c.tones), c.a, c.b, c.p);
};

/**
 * The incoming page with its ink, inserts, traces and shadows lifted: a blank page of the
 * notebook. Printed rules and grid stay; fibre and speck pixels stay only as thin strands (a
 * fibre has at most two such neighbours, a shadow area many).
 */
function blankPage(c: Composition, inks: SketchInks): Uint32Array {
  const { width: W, height: H, b } = c;
  const { PAPER, FIBRE, SHADE, RULE, MARGIN, GRID } = inks.ink;
  const printed = new Set([PAPER, RULE, MARGIN, GRID]);
  const tone = (x: number, y: number): boolean => {
    const pixel = b[y * W + x];
    return pixel === FIBRE || pixel === SHADE;
  };
  const binding = Math.round(BINDING * (W / 960));
  const blank = new Uint32Array(W * H);
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const pixel = b[y * W + x] ?? PAPER;
      let kept = x < binding || printed.has(pixel);
      if (!kept && tone(x, y)) {
        let around = 0;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            const [nx, ny] = [x + dx, y + dy];
            if ((dx !== 0 || dy !== 0) && nx >= 0 && ny >= 0 && nx < W && ny < H && tone(nx, ny))
              around += 1;
          }
        }
        kept = around <= 2;
      }
      blank[y * W + x] = kept ? pixel : PAPER;
    }
  }
  return blank;
}

/** Three overlapping quick flips: A -> blank, blank -> blank, blank -> B. */
const RIFFLE: readonly (readonly [number, number])[] = [
  [0, 0.42],
  [0.34, 0.7],
  [0.62, 1],
];

export const riffle: Compositor = (c) => {
  if (endFrames(c)) return;
  const inks = sketchInks(c.tones);
  const blank = blankPage(c, inks);
  const step = RIFFLE.reduce((last, [from], index) => (c.p >= from ? index : last), 0);
  const [from, to] = RIFFLE[step] ?? [0, 1];
  const top = step === 0 ? c.a : blank;
  const under = step === 2 ? c.b : blank;
  flipInto(c, inks, top, under, phase(c.p, from, to));
};
