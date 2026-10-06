/**
 * Draws timed marks for a time t: line boil (every point redrawn on the mark's 8-12 fps cadence
 * with a seeded 1 px wobble), the nib (round felt-tip, skipping ballpoint, chisel marker with
 * blots, grainy pencil), and pencil hatch fills revealed along their sweep, slightly out of the
 * lines. Returns the tip of the newest mark being drawn by the hand (the pen goes there).
 */
import { INK } from '../inks.js';
import { chiselBrush, roundBrush, type InkCanvas } from './canvas.js';
import { TOOLS, type FillMark, type Mark, type Shape, type StrokeMark } from './marks.js';
import { at, clamp01, ease, hash } from './math.js';
import {
  pixelPath,
  prefix,
  smoothPath,
  xformPts,
  type Point,
  type Pts,
  type Xform,
} from './paths.js';

/** Animated shapes (poses, carried things) are redrawn on twelves, like drawn animation. */
export const DRAWN_FPS = 12;

export function drawnTime(t: number): number {
  return Math.floor(t * DRAWN_FPS + 1e-6) / DRAWN_FPS;
}

export function markShape(mark: StrokeMark, t: number): Shape {
  return mark.source ? mark.source(drawnTime(t)) : mark.shape;
}

function boilPts(mark: StrokeMark, src: Pts, frame: number, xf: Xform): Pts {
  const out: Pts = new Array<number>(src.length);
  const p = 0.24 * mark.boil;
  for (let i = 0; i < src.length; i += 2) {
    let dx = 0;
    let dy = 0;
    if (p > 0) {
      const hx = hash(mark.seed, i, frame, 1);
      const hy = hash(mark.seed, i, frame, 2);
      dx = hx < p ? -1 : hx > 1 - p ? 1 : 0;
      dy = hy < p ? -1 : hy > 1 - p ? 1 : 0;
    }
    const [x, y] = xf(at(src, i) + dx, at(src, i + 1) + dy);
    out[i] = x;
    out[i + 1] = y;
  }
  return out;
}

function chiselStroke(canvas: InkCanvas, pts: Pts, mark: StrokeMark, done: boolean): void {
  const brush = chiselBrush(mark.len, mark.deg, mark.thick);
  const pix = pixelPath(pts, false);
  for (let i = 0; i < pix.length; i += 2)
    canvas.stamp(at(pix, i), at(pix, i + 1), brush, mark.color);
  if (mark.tool !== 'marker' || pix.length === 0) return;
  const blot = roundBrush(Math.max(3, Math.round(mark.len * 0.34)));
  if (hash(mark.seed, 78) < 0.5) canvas.stamp(at(pix, 0), at(pix, 1), blot, mark.color);
  if (done && hash(mark.seed, 77) < 0.35) {
    canvas.stamp(at(pix, pix.length - 2), at(pix, pix.length - 1), blot, mark.color);
  }
}

function ballpointStroke(canvas: InkCanvas, pts: Pts, mark: StrokeMark, done: boolean): void {
  const pix = pixelPath(pts, mark.width === 1);
  const brush = roundBrush(mark.width);
  for (let i = 0; i < pix.length; i += 2) {
    // The ballpoint skips now and then.
    if (i > 8 && hash(mark.seed, (i / 14) | 0, 5) < 0.07 && (i / 2) % 7 < 2) continue;
    canvas.stamp(at(pix, i), at(pix, i + 1), brush, mark.color);
  }
  if (done && pix.length > 8 && hash(mark.seed, 9) < 0.35) {
    canvas.stamp(at(pix, pix.length - 2), at(pix, pix.length - 1), roundBrush(2), mark.color);
  }
}

function pencilStroke(canvas: InkCanvas, pts: Pts, mark: StrokeMark): void {
  const pix = pixelPath(pts, mark.width === 1);
  const brush = roundBrush(mark.width);
  const graphite = TOOLS[mark.tool].kind === 'pencil' && mark.color === INK.GRAPHITE;
  for (let i = 0; i < pix.length; i += 2) {
    for (let k = 0; k < brush.length; k += 2) {
      const px = at(pix, i) + at(brush, k);
      const py = at(pix, i + 1) + at(brush, k + 1);
      const h = hash(px, py, mark.seed & 255);
      if (h < 0.14) continue;
      canvas.put(px, py, graphite && h < 0.32 ? INK.GRAPH_L : mark.color);
    }
  }
}

function rasterStroke(canvas: InkCanvas, pts: Pts, mark: StrokeMark, done: boolean): void {
  const kind = TOOLS[mark.tool].kind;
  const draw = (): void => {
    if (kind === 'chisel') chiselStroke(canvas, pts, mark, done);
    else if (kind === 'bic') ballpointStroke(canvas, pts, mark, done);
    else if (kind === 'pencil' || kind === 'cpencil') pencilStroke(canvas, pts, mark);
    else {
      const brush = roundBrush(mark.width);
      const pix = pixelPath(pts, mark.width === 1);
      for (let i = 0; i < pix.length; i += 2)
        canvas.stamp(at(pix, i), at(pix, i + 1), brush, mark.color);
    }
  };
  if (TOOLS[mark.tool].under) canvas.underInk(draw);
  else draw();
}

/** Where the scribbling tip is on the current hatch line (null when the fill is done). */
function hatchTip(poly: Pts, front: number, dir: number, t: number): Point | null {
  let vmin = Infinity;
  let vmax = -Infinity;
  const n = poly.length >> 1;
  for (let i = 0, j = n - 1; i < n; j = i, i += 1) {
    const ax = at(poly, 2 * i);
    const ay = at(poly, 2 * i + 1);
    const bx = at(poly, 2 * j);
    const by = at(poly, 2 * j + 1);
    const sa = ax + ay * dir;
    const sb = bx + by * dir;
    if (sa > front !== sb > front) {
      const k = (front - sa) / (sb - sa);
      const v = ax + (bx - ax) * k - (ay + (by - ay) * k) * dir;
      vmin = Math.min(vmin, v);
      vmax = Math.max(vmax, v);
    }
  }
  if (vmin === Infinity) return null;
  const v = vmin + (vmax - vmin) * (0.5 + 0.5 * Math.sin(t * Math.PI * 9));
  return [(front + v) / 2, (dir * (front - v)) / 2];
}

/** A fill at t: its progress, polygon (screen px) and the sweep front. */
function fillAt(mark: FillMark, t: number, xf: Xform): { p: number; poly: Pts; front: number } {
  const p = mark.dur > 0 ? clamp01((t - mark.t0) / mark.dur) : 1;
  const poly = xformPts(mark.source ? mark.source(drawnTime(t)) : mark.poly, xf);
  let s0 = Infinity;
  let s1 = -Infinity;
  for (let i = 0; i < poly.length; i += 2) {
    const s = at(poly, i) + at(poly, i + 1) * mark.dir;
    s0 = Math.min(s0, s);
    s1 = Math.max(s1, s);
  }
  return { p, poly, front: s0 + (s1 - s0 + 4) * ease('hand', p) };
}

/** Pencil hatch revealed along its sweep; returns the scribbling tip while active. */
function drawFill(canvas: InkCanvas, mark: FillMark, t: number, xf: Xform): Point | null {
  const { p, poly, front } = fillAt(mark, t, xf);
  const { dir, seed, spacing } = mark;
  canvas.fillPoly(poly, (x, y) => {
    const along = x + y * dir;
    const line = Math.floor(along / spacing);
    if (along > front + hash(seed, line, 3) * 5) return -1;
    const across = x - y * dir;
    const chunk = Math.floor((across + hash(seed, line, 4) * 9) / 9);
    const offset = hash(seed, line, chunk) < 0.33 ? 1 : 0;
    if ((((along + offset) % spacing) + spacing) % spacing !== 0) {
      return mark.dense && hash(x, y, seed) < 0.18 ? mark.color : -1;
    }
    if (hash(seed, line, chunk, 9) < 0.12) return -1;
    return mark.color;
  });
  return p >= 1 ? null : hatchTip(poly, front, dir, t);
}

/** The mark being drawn by the hand right now and its tip (screen px). */
export interface ActiveMark {
  readonly mark: Mark;
  readonly tip: Point;
}

/** The drawn part of a stroke at t (screen px) and its progress. */
function strokeAt(mark: StrokeMark, t: number, xf: Xform): { p: number; pts: Pts; tip: Point } {
  const p = mark.dur > 0 ? clamp01((t - mark.t0) / mark.dur) : 1;
  const src = markShape(mark, t);
  const frame = Math.floor(t * mark.fps + 1e-6);
  const boiled = boilPts(mark, src.pts, frame, xf);
  const path = mark.smooth ? smoothPath(boiled, src.corners, 2.5) : boiled;
  return { p, ...prefix(path, mark.ease === 'lin' ? p : ease(mark.ease, p)) };
}

/** Draws one mark at t; returns its tip while the hand is drawing it. */
export function drawMark(canvas: InkCanvas, mark: Mark, t: number, xf: Xform): Point | null {
  if (t < mark.t0) return null;
  if (mark.type === 'fill') return drawFill(canvas, mark, t, xf);
  const { p, pts, tip } = strokeAt(mark, t, xf);
  rasterStroke(canvas, pts, mark, p >= 1);
  return p < 1 ? tip : null;
}

/** Where the tip of a mark is at t while it is being drawn (what drawMark returns), no pixels. */
export function markTip(mark: Mark, t: number, xf: Xform): Point | null {
  if (t < mark.t0) return null;
  if (mark.type === 'fill') {
    const { p, poly, front } = fillAt(mark, t, xf);
    return p >= 1 ? null : hatchTip(poly, front, mark.dir, t);
  }
  const { p, tip } = strokeAt(mark, t, xf);
  return p < 1 ? tip : null;
}

/** Draws marks in order; returns the newest started mark the hand is drawing (or null). */
export function drawMarks(
  canvas: InkCanvas,
  marks: readonly Mark[],
  t: number,
  xf: Xform,
): ActiveMark | null {
  let active: ActiveMark | null = null;
  for (const mark of marks) {
    const tip = drawMark(canvas, mark, t, xf);
    if (tip && mark.held && (!active || mark.t0 >= active.mark.t0)) active = { mark, tip };
  }
  return active;
}
