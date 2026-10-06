/**
 * The accordion strip (docs/worlds/sketchbook-v2/js/accordion-strip.js, shot 8): a long creased
 * paper strip under a fixed view; for a strip offset S the part already read bunches into a
 * zigzag pleat stack, in perspective, at the left (older pleats tighter). Panel widths are uneven
 * on purpose, the strip wanders a pixel or two at every crease. u = strip coordinate (= page x at
 * S = 0), v = 0..HEIGHT across the strip; everything in page px, painted at the canvas scale.
 */
import { InkCanvas } from '../draw/canvas.js';
import { at, ease, hash, rnd } from '../draw/math.js';
import { fibreAt } from '../draw/paper.js';
import { pixelPath, type Point, type Pts } from '../draw/paths.js';
import { INK, SOFT, TAPE } from '../inks.js';

export const STRIP_HEIGHT = 184;
/** Page x where a panel starts to fold into the stack. */
const FOLD_X = 200;
const FOLD = (74 * Math.PI) / 180;
const FOLD_MAX = (88.5 * Math.PI) / 180;
/** How high folded panels stand (x their width) and how a raised point shifts on the page. */
const RISE = 0.4;
const LIFT: Point = [0.1, 0.42];
const TILT = (-1 * Math.PI) / 180;

export interface StripLayout {
  readonly S: number;
  /** Page x of every crease. */
  readonly x: Float64Array;
  /** Height of every crease (odd creases are the peaks). */
  readonly z: Float64Array;
  /** cos of every panel's fold. */
  readonly cos: Float64Array;
}

export interface StripShape {
  readonly creases: readonly number[];
  readonly n: number;
  layout(S: number): StripLayout;
  /** Strip (u, v) -> page px for a layout. */
  mapper(L: StripLayout): (u: number, v: number) => Point;
  panelOf(u: number): number;
  /** Paints the strip; onFace(k) draws panel k's marks right after its face. */
  draw(canvas: InkCanvas, L: StripLayout, onFace: (k: number) => void): void;
  /** Clear tape across the strip (it follows the folds): centre (u, v), w x h, deg. */
  tape(canvas: InkCanvas, L: StripLayout, tape: readonly number[]): void;
}

const PANEL_WIDTHS = [205, 251] as const;

export function stripShape(u0: number, u1: number, y0: number, seed: number): StripShape {
  const creases = [u0];
  for (let i = 0; (creases.at(-1) ?? u1) < u1; i += 1) {
    const next = (creases.at(-1) ?? u1) + rnd(PANEL_WIDTHS[0], PANEL_WIDTHS[1], seed, i, 9);
    creases.push(next > u1 - 70 ? u1 : next);
  }
  const c = creases;
  const n = c.length - 1;
  const cAt = (k: number): number => c[k] ?? u1;
  const wander = c.map((_, k) => rnd(-1.6, 1.6, seed, k, 1));
  const kinkT = c.map((_, k) => rnd(-0.9, 0.9, seed, k, 2));
  const kinkB = c.map((_, k) => rnd(-0.9, 0.9, seed, k, 3));
  const angle = (f: number): number =>
    f <= 1 ? FOLD * ease('sine', f) : FOLD + (FOLD_MAX - FOLD) * (1 - Math.exp(-(f - 1) * 1.8));
  const layout = (S: number): StripLayout => {
    const x = new Float64Array(n + 1);
    const z = new Float64Array(n + 1);
    const cos = new Float64Array(n);
    const rise = new Float64Array(n);
    let k0 = n;
    while (k0 > 0 && cAt(k0 - 1) - S >= FOLD_X) k0 -= 1;
    for (let k = k0; k <= n; k += 1) x[k] = cAt(k) - S;
    for (let k = k0; k < n; k += 1) cos[k] = 1;
    for (let k = k0 - 1; k >= 0; k -= 1) {
      const w = cAt(k + 1) - cAt(k);
      const th = angle((FOLD_X - (cAt(k) - S)) / (w * 0.85));
      cos[k] = Math.cos(th);
      x[k] = at(x, k + 1) - w * Math.cos(th);
      rise[k] = RISE * w * Math.sin(th);
    }
    for (let k = 1; k < n; k += 2) z[k] = Math.min(at(rise, k - 1), at(rise, k));
    return { S, x, z, cos };
  };
  const pivot: Point = [480, y0 + STRIP_HEIGHT / 2];
  const tilt = (px: number, py: number): Point => [
    pivot[0] + px * Math.cos(TILT) - py * Math.sin(TILT),
    pivot[1] + px * Math.sin(TILT) + py * Math.cos(TILT),
  ];
  // A raised point lifts up (and a touch left); its shadow falls down-right.
  const proj = (x: number, z: number, y: number): Point =>
    tilt(x - LIFT[0] * z - pivot[0], y - LIFT[1] * z - pivot[1]);
  const shade = (x: number, z: number, y: number): Point =>
    tilt(x + 0.55 * z + 3 - pivot[0], y + 0.3 * z + 5 - pivot[1]);
  const ground = (x: number, _z: number, y: number): Point => shade(x, 0, y);
  const panelOf = (u: number): number => {
    let k = 0;
    while (k < n - 1 && u >= cAt(k + 1)) k += 1;
    return k;
  };
  const mapper =
    (L: StripLayout) =>
    (u: number, v: number): Point => {
      const k = panelOf(u);
      const a = Math.max(0, Math.min(1, (u - cAt(k)) / (cAt(k + 1) - cAt(k))));
      const w0 = wander[k] ?? 0;
      const w1 = wander[k + 1] ?? 0;
      return proj(
        at(L.x, k) + (at(L.x, k + 1) - at(L.x, k)) * a,
        at(L.z, k) + (at(L.z, k + 1) - at(L.z, k)) * a,
        y0 + w0 + (w1 - w0) * a + v,
      );
    };
  type Project = (x: number, z: number, y: number) => Point;
  const corner = (L: StripLayout, k: number, bottom: boolean, fn: Project): Point =>
    fn(
      at(L.x, k),
      at(L.z, k),
      y0 + (wander[k] ?? 0) + (bottom ? STRIP_HEIGHT + (kinkB[k] ?? 0) : (kinkT[k] ?? 0)),
    );
  const quad = (L: StripLayout, k: number, fn: Project): Pts => [
    ...corner(L, k, false, fn),
    ...corner(L, k + 1, false, fn),
    ...corner(L, k + 1, true, fn),
    ...corner(L, k, true, fn),
  ];
  let mask: InkCanvas | undefined;
  let stack: InkCanvas | undefined;
  const scratch = (canvas: InkCanvas): [InkCanvas, InkCanvas] => {
    if (mask?.width !== canvas.width || mask.height !== canvas.height || !stack) {
      mask = new InkCanvas(canvas.width, canvas.height);
      stack = new InkCanvas(canvas.width, canvas.height);
    }
    return [mask, stack];
  };
  const line = (canvas: InkCanvas, a: Point, z: Point, color: number, skip = 0, s = 5): void => {
    const pix = pixelPath([a[0], a[1], z[0], z[1]], true);
    for (let i = 0; i < pix.length; i += 2) {
      if (skip === 0 || hash(at(pix, i), at(pix, i + 1), s) > skip)
        canvas.put(at(pix, i), at(pix, i + 1), color);
    }
  };

  function face(
    canvas: InkCanvas,
    st: InkCanvas,
    L: StripLayout,
    k: number,
    kind: 'flat' | 'back' | 'front',
  ): void {
    const s = canvas.width / 960;
    const q = quad(L, k, proj);
    const w = cAt(k + 1) - cAt(k);
    const xa = (at(q, 0) + at(q, 6)) / 2;
    const xb = (at(q, 2) + at(q, 4)) / 2;
    const ya = (at(q, 1) + at(q, 3)) / 2;
    const span = xb - xa;
    // Shade by the slope: rising faces catch the light, falling ones darken as they close.
    const fall = (at(L.z, k) - at(L.z, k + 1)) / (RISE * w);
    const dark = fall > 0.7 ? 2 : fall > 0.25 ? 1 : 0;
    const base = [INK.PAPER, INK.FIBRE, INK.SHADE][dark] ?? INK.PAPER;
    const fib = [INK.FIBRE, INK.SHADE, INK.FIBRE][dark] ?? INK.FIBRE;
    const band = kind === 'flat' && k % 2 === 1;
    canvas.fillPoly(
      q.map((value) => value * s),
      (x, y) => {
        const a = span > 0.5 ? ((x + 0.5) / s - xa) / span : 0.5;
        const f = fibreAt(cAt(k) + a * w + 413, (y + 0.5) / s - ya + 300);
        let col = f === 1 ? fib : f === 2 ? INK.SHADE : base;
        if (band && a * w < 2) col = INK.FIBRE; // the old fold still catches the light a little
        if (kind === 'flat' && st.data[y * canvas.width + x] === 1) col = SOFT[col] ?? col;
        return col;
      },
    );
    const p = (i: number): Point => [at(q, 2 * i) * s, at(q, 2 * i + 1) * s];
    line(canvas, p(0), p(1), INK.SHADE);
    line(canvas, p(3), p(2), INK.SHADE);
    if (kind === 'flat') {
      if (k % 2 === 0 && k > 0) line(canvas, p(0), p(3), INK.GRAPH_L, 0.45, k);
      if (k === n - 1) line(canvas, p(1), p(2), INK.SHADE);
    } else {
      line(canvas, p(0), p(3), k % 2 === 1 ? INK.PAPER : INK.GRAPH_L);
      line(canvas, p(1), p(2), (k + 1) % 2 === 1 ? INK.PAPER : INK.GRAPH_L);
    }
  }

  return {
    creases,
    n,
    layout,
    mapper,
    panelOf,
    draw(canvas, L, onFace) {
      const s = canvas.width / 960;
      const [m, st] = scratch(canvas);
      const flat: number[] = [];
      const back: number[] = [];
      const front: number[] = [];
      for (let k = 0; k < n; k += 1) {
        if (
          Math.max(at(L.x, k), at(L.x, k + 1)) < -40 ||
          Math.min(at(L.x, k), at(L.x, k + 1)) > 1000
        )
          continue;
        if (at(L.cos, k) > 0.985) flat.push(k);
        else if (at(L.z, k + 1) > at(L.z, k)) back.push(k);
        else front.push(k);
      }
      const stacked = [...back, ...front];
      const scaled = (pts: Pts): Pts => pts.map((value) => value * s);
      m.data.fill(0);
      for (const k of [...flat, ...stacked]) m.fillPoly(scaled(quad(L, k, shade)), 1);
      for (const k of stacked) m.fillPoly(scaled(quad(L, k, ground)), 1);
      for (let i = 0; i < m.data.length; i += 1) {
        if (m.data[i] === 1) canvas.data[i] = SOFT[canvas.data[i] ?? 0] ?? 0;
      }
      st.data.fill(0);
      for (const k of stacked) st.fillPoly(scaled(quad(L, k, shade)), 1);
      for (const k of stacked) {
        face(canvas, st, L, k, back.includes(k) ? 'back' : 'front');
        if (at(L.cos, k) > 0.33) onFace(k);
      }
      for (const k of flat) face(canvas, st, L, k, 'flat');
      for (const k of flat) onFace(k);
    },
    tape(canvas, L, [uc = 0, vc = 0, w = 50, h = 18, deg = 0, tapeSeed = 0]) {
      const s = canvas.width / 960;
      const xf = mapper(L);
      const a = (deg * Math.PI) / 180;
      const point = (p: number, q: number): Point => {
        const [x, y] = xf(
          uc + p * Math.cos(a) - q * Math.sin(a),
          vc + p * Math.sin(a) + q * Math.cos(a),
        );
        return [x * s, y * s];
      };
      const loop: Pts = [];
      const top: Point[] = [];
      const bottom: Point[] = [];
      for (let i = 0; i <= 5; i += 1)
        loop.push(...point(-w / 2 + rnd(-2.2, 2.2, tapeSeed, i, 1), -h / 2 + (i / 5) * h));
      for (let p = -w / 2 + 3; p < w / 2 - 2; p += 6) {
        const pt = point(p, h / 2);
        loop.push(...pt);
        bottom.push(pt);
      }
      for (let i = 5; i >= 0; i -= 1)
        loop.push(...point(w / 2 + rnd(-2.2, 2.2, tapeSeed, i, 2), -h / 2 + (i / 5) * h));
      for (let p = w / 2 - 3; p > -w / 2 + 2; p -= 6) {
        const pt = point(p, -h / 2);
        loop.push(...pt);
        top.push(pt);
      }
      canvas.remapped(TAPE, () => {
        canvas.fillPoly(loop, 0);
      });
      for (const edge of [top, bottom]) {
        for (let i = 0; i + 1 < edge.length; i += 1) {
          const [p0, p1] = [edge[i], edge[i + 1]];
          if (p0 && p1) line(canvas, p0, p1, INK.SHADE, 0.35, tapeSeed);
        }
      }
    },
  };
}
