/**
 * C-CAM brushes (PLAN.md#14.3), part 1: camera, figure space, curves, the uneven ink line. Flat
 * tone shapes (blob, tube, mottle, hatch) are in shapes.ts, scenery (architecture, sky, light,
 * bricks) in scenery.ts. Everything draws through `Paint2D`. The split keeps files under 400 lines.
 *
 * Port of `docs/concepts/c-cam-style/films/03-apollo-11/js/brushes.js`. Divergences:
 *  - no `window.ST`, no module state: the original globals `ST.LW` (ink width multiplier) and
 *    `ST.camZ` (camera zoom) become the immutable `BrushEnv`, returned by `camera` and `figure`'s
 *    callback and passed explicitly as the second argument of every function that scales ink
 *    (`inkLine`, `brushStroke`, `hatch`, `blob`, `tube`). Same zoom -> same output;
 *  - `ST.stroke` is `brushStroke` (it is not `Paint2D.stroke`); `ST.label` is dropped (system
 *    fonts, ADR-005); `ST.path` is `tracePath`;
 *  - `camera` and `figure` keep film 3's names (`rot`); film 1 calls the same argument `tilt`
 *    (comment-only difference), films 1-3 are otherwise byte-identical;
 *  - options are typed objects; `||` defaults of the original (0 falls back) are kept on purpose
 *    (`seed`, `w`, `lw`, `n`, ...), `lw: 0` still means "no outline";
 *  - `blob({ sharp: true })` returns a copy of the points (the original returned the caller's
 *    array); `tube` builds the right edge by reversing pairs instead of `unshift`ing (same order,
 *    linear time). No bugs needed fixing: the tests compare every function call-by-call with the
 *    original loaded in `node:vm` (original.ts).
 */
import { C, H, W, noise1 } from '../core.js';
import type { Paint2D } from './paint.js';

export const TAU = Math.PI * 2;

/** Flat `[x, y, x, y, ...]` points. */
export type Pts = readonly number[];

/** Per-render drawing state that the original kept in `ST.camZ` / `ST.LW`. */
export interface BrushEnv {
  /** Camera zoom. */
  readonly zoom: number;
  /** Ink width multiplier (lines thicken gently in close-ups): `scale ^ -0.55`. */
  readonly lw: number;
}

const lwFor = (scale: number): number => Math.pow(scale, -0.55);

export function makeEnv(zoom: number): BrushEnv {
  return { zoom, lw: lwFor(zoom) };
}

/** Zoom 1, ink width 1. */
export const DEFAULT_ENV: BrushEnv = makeEnv(1);

const num = (values: Pts, index: number): number => values[index] ?? 0;

/** Camera: world point (cx, cy) lands in the frame centre at zoom z, rolled by rot degrees (Dutch tilt). */
export function camera(g: Paint2D, cx: number, cy: number, z: number, rot = 0): BrushEnv {
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.translate(W / 2, H / 2);
  if (rot) g.rotate((rot * Math.PI) / 180);
  g.scale(z, z);
  g.translate(-cx, -cy);
  return makeEnv(z);
}

export interface FigurePlacement {
  readonly x: number;
  readonly y: number;
  readonly s: number;
  readonly lean?: number;
}

/**
 * Figure space: origin at the feet, +x = the way the figure faces (`flip` mirrors it). `draw`
 * receives the env with the figure's own ink width (camera zoom times figure scale).
 */
export function figure(
  g: Paint2D,
  env: BrushEnv,
  p: FigurePlacement,
  flip: boolean,
  draw: (inner: BrushEnv) => void,
): void {
  g.save();
  g.translate(p.x, p.y);
  g.scale(flip ? -p.s : p.s, p.s);
  if (p.lean) g.rotate((p.lean * Math.PI) / 180);
  draw({ zoom: env.zoom, lw: lwFor(p.s * env.zoom) });
  g.restore();
}

/** Catmull-Rom through control points (flat [x,y,...]); `step` = target segment length (default 7). */
export function curve(pts: Pts, closed = false, step = 0): number[] {
  const n = pts.length >> 1;
  if (n < 3) return pts.slice();
  const out: number[] = [];
  const st = step || 7;
  const at = (i: number): number =>
    2 * (closed ? ((i % n) + n) % n : Math.max(0, Math.min(n - 1, i)));
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i += 1) {
    const a = at(i - 1);
    const b = at(i);
    const c = at(i + 1);
    const d = at(i + 2);
    const x0 = num(pts, a);
    const y0 = num(pts, a + 1);
    const x1 = num(pts, b);
    const y1 = num(pts, b + 1);
    const x2 = num(pts, c);
    const y2 = num(pts, c + 1);
    const x3 = num(pts, d);
    const y3 = num(pts, d + 1);
    const m = Math.max(2, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / st));
    for (let k = 0; k < m; k += 1) {
      const t = k / m;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push(
        0.5 *
          (2 * x1 +
            (-x0 + x2) * t +
            (2 * x0 - 5 * x1 + 4 * x2 - x3) * t2 +
            (-x0 + 3 * x1 - 3 * x2 + x3) * t3),
        0.5 *
          (2 * y1 +
            (-y0 + y2) * t +
            (2 * y0 - 5 * y1 + 4 * y2 - y3) * t2 +
            (-y0 + 3 * y1 - 3 * y2 + y3) * t3),
      );
    }
  }
  if (!closed) out.push(num(pts, 2 * n - 2), num(pts, 2 * n - 1));
  return out;
}

/** Starts a new path through the points (does not fill or stroke). */
export function tracePath(g: Paint2D, c: Pts, closed = false): void {
  g.beginPath();
  g.moveTo(num(c, 0), num(c, 1));
  for (let i = 2; i < c.length; i += 2) g.lineTo(num(c, i), num(c, i + 1));
  if (closed) g.closePath();
}

export interface Bbox {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
  readonly w: number;
  readonly h: number;
  readonly cx: number;
  readonly cy: number;
}

export function bbox(c: Pts): Bbox {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < c.length; i += 2) {
    const x = num(c, i);
    const y = num(c, i + 1);
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

export interface InkLineOptions {
  readonly closed?: boolean;
  readonly seed?: number;
  /** Base width in px before the env multiplier (default 7). */
  readonly w?: number;
  /** Open lines taper to a point at both ends unless false. */
  readonly taper?: boolean;
  readonly color?: string;
}

/**
 * The ink line: a filled ribbon whose width swells (0.4-1.9x the base) and pinches along its
 * length, as with a loaded, uneven brush. Open ends taper.
 */
export function inkLine(g: Paint2D, env: BrushEnv, c: Pts, o: InkLineOptions = {}): void {
  const n = c.length >> 1;
  if (n < 2) return;
  const closed = !!o.closed;
  const seed = o.seed || 1;
  const base = (o.w || 7) * env.lw;
  const left: number[] = [];
  const right: number[] = [];
  let acc = 0;
  for (let i = 0; i < n; i += 1) {
    const prev = closed ? (i - 1 + n) % n : Math.max(0, i - 1);
    const next = closed ? (i + 1) % n : Math.min(n - 1, i + 1);
    let tx = num(c, 2 * next) - num(c, 2 * prev);
    let ty = num(c, 2 * next + 1) - num(c, 2 * prev + 1);
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl;
    ty /= tl;
    if (i > 0)
      acc += Math.hypot(num(c, 2 * i) - num(c, 2 * i - 2), num(c, 2 * i + 1) - num(c, 2 * i - 1));
    const k = noise1(seed, acc / 30);
    let w = base * (0.4 + 1.25 * k * k + 0.25 * noise1(seed + 7, acc / 9));
    if (!closed && o.taper !== false)
      w *= Math.min(1, 0.12 + 2.2 * Math.sin(Math.PI * (i / (n - 1))));
    left.push(num(c, 2 * i) - (ty * w) / 2, num(c, 2 * i + 1) + (tx * w) / 2);
    right.push(num(c, 2 * i) + (ty * w) / 2, num(c, 2 * i + 1) - (tx * w) / 2);
  }
  g.fillStyle = o.color || C.INK;
  g.beginPath();
  g.moveTo(num(left, 0), num(left, 1));
  for (let i = 2; i < left.length; i += 2) g.lineTo(num(left, i), num(left, i + 1));
  if (closed) {
    g.closePath();
    g.moveTo(num(right, right.length - 2), num(right, right.length - 1));
    for (let i = right.length - 4; i >= 0; i -= 2) g.lineTo(num(right, i), num(right, i + 1));
    g.closePath();
  } else {
    for (let i = right.length - 2; i >= 0; i -= 2) g.lineTo(num(right, i), num(right, i + 1));
  }
  g.fill('nonzero');
}

/** Open brush stroke through control points (wrinkles, folds, brows, cracks); default width 4.5. */
export function brushStroke(g: Paint2D, env: BrushEnv, pts: Pts, o: InkLineOptions = {}): void {
  inkLine(g, env, pts.length > 4 ? curve(pts, false, 4) : pts, { w: 4.5, ...o });
}
