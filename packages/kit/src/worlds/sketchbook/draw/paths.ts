/**
 * Polyline helpers of the Sketchbook renderer: flat point arrays `[x, y, x, y, ...]`, ellipses,
 * affine placements (inserts taped onto the page), Catmull-Rom smoothing with corners, arc-length
 * prefixes (a stroke drawn up to a fraction) and integer pixel paths with 1 px thinning.
 */
import { at } from './math.js';

/** Flat [x, y, x, y, ...] points. */
export type Pts = number[];
export type Point = readonly [number, number];
/** Maps a point (local or page coordinates) to another space. */
export type Xform = (x: number, y: number) => Point;

export const identity: Xform = (x, y) => [x, y];

/** n points of an ellipse (rotated by `rot`, starting at angle a0). */
export function ellipsePts(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  n: number,
  rot = 0,
  a0 = 0,
): Pts {
  const out: Pts = [];
  const cr = Math.cos(rot);
  const sr = Math.sin(rot);
  for (let i = 0; i < n; i += 1) {
    const a = a0 + (i / n) * Math.PI * 2;
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry;
    out.push(cx + x * cr - y * sr, cy + x * sr + y * cr);
  }
  return out;
}

export function xformPts(pts: Pts, xf: Xform): Pts {
  const out: Pts = new Array<number>(pts.length);
  for (let i = 0; i < pts.length; i += 2) {
    const [x, y] = xf(at(pts, i), at(pts, i + 1));
    out[i] = x;
    out[i + 1] = y;
  }
  return out;
}

export function polyLen(pts: Pts): number {
  let sum = 0;
  for (let i = 0; i + 3 < pts.length; i += 2) {
    sum += Math.hypot(at(pts, i + 2) - at(pts, i), at(pts, i + 3) - at(pts, i + 1));
  }
  return sum;
}

/** The part of a polyline up to `frac` of its length, and the tip there. */
export function prefix(pts: Pts, frac: number): { readonly pts: Pts; readonly tip: Point } {
  const last: Point = [at(pts, pts.length - 2), at(pts, pts.length - 1)];
  if (frac >= 1) return { pts, tip: last };
  const want = polyLen(pts) * Math.max(0, frac);
  const out: Pts = [at(pts, 0), at(pts, 1)];
  let acc = 0;
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const ax = at(pts, i);
    const ay = at(pts, i + 1);
    const bx = at(pts, i + 2);
    const by = at(pts, i + 3);
    const length = Math.hypot(bx - ax, by - ay);
    if (acc + length >= want) {
      const k = length > 0 ? (want - acc) / length : 0;
      const x = ax + (bx - ax) * k;
      const y = ay + (by - ay) * k;
      out.push(x, y);
      return { pts: out, tip: [x, y] };
    }
    acc += length;
    out.push(bx, by);
  }
  return { pts: out, tip: [at(out, out.length - 2), at(out, out.length - 1)] };
}

/** Integer pixels along a polyline, deduplicated; `thin` removes L-corners of 1 px lines. */
export function pixelPath(pts: Pts, thin: boolean): Pts {
  const np = pts.length >> 1;
  if (np === 1) return [Math.round(at(pts, 0)), Math.round(at(pts, 1))];
  const out: Pts = [];
  let lx = 1e9;
  let ly = 1e9;
  for (let i = 0; i < np - 1; i += 1) {
    const ax = at(pts, 2 * i);
    const ay = at(pts, 2 * i + 1);
    const bx = at(pts, 2 * i + 2);
    const by = at(pts, 2 * i + 3);
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) * 2));
    for (let k = 0; k <= n; k += 1) {
      const x = Math.round(ax + ((bx - ax) * k) / n);
      const y = Math.round(ay + ((by - ay) * k) / n);
      if (x === lx && y === ly) continue;
      out.push(x, y);
      lx = x;
      ly = y;
    }
  }
  if (!thin || out.length < 6) return out;
  const res: Pts = [at(out, 0), at(out, 1)];
  for (let i = 2; i < out.length; i += 2) {
    const n = res.length;
    const x = at(out, i);
    const y = at(out, i + 1);
    if (n >= 4 && i + 1 < out.length) {
      const px = at(res, n - 4);
      const py = at(res, n - 3);
      const qx = at(res, n - 2);
      const qy = at(res, n - 1);
      const diagonal = Math.abs(x - px) === 1 && Math.abs(y - py) === 1;
      if (diagonal && (qx === px || qy === py) && (qx === x || qy === y)) {
        res[n - 2] = x;
        res[n - 1] = y;
        continue;
      }
    }
    res.push(x, y);
  }
  return res;
}

function catmull(a: number, b: number, c: number, d: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
  );
}

/** Catmull-Rom through the points; `corners[i]` splits the curve at point i. */
export function smoothPath(pts: Pts, corners: readonly boolean[] | null, step = 3): Pts {
  const n = pts.length >> 1;
  if (n < 2) return pts.slice();
  const runs: (readonly [number, number])[] = [];
  let start = 0;
  for (let i = 1; i < n - 1; i += 1) {
    if (corners?.[i] === true) {
      runs.push([start, i]);
      start = i;
    }
  }
  runs.push([start, n - 1]);
  const out: Pts = [];
  for (const [first, last] of runs) {
    for (let i = first; i < last; i += 1) {
      const p0 = Math.max(first, i - 1);
      const p3 = Math.min(last, i + 2);
      const x0 = at(pts, 2 * p0);
      const y0 = at(pts, 2 * p0 + 1);
      const x1 = at(pts, 2 * i);
      const y1 = at(pts, 2 * i + 1);
      const x2 = at(pts, 2 * i + 2);
      const y2 = at(pts, 2 * i + 3);
      const x3 = at(pts, 2 * p3);
      const y3 = at(pts, 2 * p3 + 1);
      const m = last - first < 2 ? 1 : Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / step));
      for (let k = out.length > 0 ? 1 : 0; k <= m; k += 1) {
        const t = k / m;
        out.push(catmull(x0, x1, x2, x3, t), catmull(y0, y1, y2, y3, t));
      }
    }
  }
  return out;
}

/** An insert's local box placed on the page: at (x, y), rotated `deg`, scaled `scale`. */
export interface Placement {
  /** Local -> page. */
  readonly toPage: Xform;
  /** Page -> local. */
  readonly toLocal: Xform;
  readonly deg: number;
  readonly scale: number;
}

export function placement(x: number, y: number, deg: number, scale = 1): Placement {
  const angle = (deg * Math.PI) / 180;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return {
    toPage: (u, v) => [x + (u * c - v * s) * scale, y + (u * s + v * c) * scale],
    toLocal: (px, py) => {
      const dx = px - x;
      const dy = py - y;
      return [(dx * c + dy * s) / scale, (-dx * s + dy * c) / scale];
    },
    deg,
    scale,
  };
}

/** The four corners of a w x h local box through `xf`. */
export function quad(xf: Xform, width: number, height: number): Pts {
  return [...xf(0, 0), ...xf(width, 0), ...xf(width, height), ...xf(0, height)];
}
