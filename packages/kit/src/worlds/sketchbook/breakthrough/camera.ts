/**
 * The 2.5D camera of the pop-up page (docs/worlds/sketchbook-v2 shot 5, js/popup-kit.js): it looks
 * straight down at the page from height `h` with a shifted lens centre (x, y), so the page plane
 * Z = 0 maps 1:1 onto the page (the notebook looks as in every other shot) while anything lifted
 * off the page grows toward the camera and leans away from the lens centre. A flat piece of paper
 * is a plane P(u, v) = O + u U + v V; faces are filled through the inverse homography so the
 * fibres stay glued to the paper. Shading and cast shadows are flat palette remaps (no dither).
 * Coordinates are page px; `s` maps them to the canvas. Pure maths, no state between frames.
 */
import type { FillColor, InkCanvas } from '../draw/canvas.js';
import { at } from '../draw/math.js';
import { fibreAt } from '../draw/paper.js';
import { pixelPath, type Point, type Pts } from '../draw/paths.js';
import { HARD, SOFT, type Remap } from '../inks.js';

export type Vec3 = readonly [number, number, number];

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unit = (a: Vec3): Vec3 => {
  const length = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / length, a[1] / length, a[2] / length];
};

/** Key light: high, a little right of and in front of the card (shadows fall back-left). */
const LIGHT = unit([0.25, 0.42, 0.87]);

export interface Plane {
  readonly O: Vec3;
  readonly U: Vec3;
  readonly V: Vec3;
  /** Front normal. */
  readonly n: Vec3;
  at(u: number, v: number): Vec3;
  /** (u, v) -> page px through the camera. */
  xf(u: number, v: number): Point;
  /** Page px -> homogeneous (u, v, w); null when the plane is seen edge-on. */
  readonly inverse: readonly number[] | null;
  /** The front faces the eye. */
  readonly facing: boolean;
}

/** Paper fill of a face: base ink, fibre and speck inks, uv offset, a shade remap, an edge ink. */
export interface FaceInk {
  readonly color: number;
  readonly fibre?: number;
  readonly speck?: number;
  readonly offset?: number;
  readonly shade?: Remap | null;
  readonly edge?: number;
}

function inverse3(m: readonly number[]): number[] | null {
  const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0, g = 0, h = 0, i = 0] = m;
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-9) return null;
  const k = 1 / det;
  return [
    A * k,
    -(b * i - c * h) * k,
    (b * f - c * e) * k,
    B * k,
    (a * i - c * g) * k,
    -(a * f - c * d) * k,
    C * k,
    -(a * h - b * g) * k,
    (a * e - b * d) * k,
  ];
}

function polyArea(p: Pts): number {
  let sum = 0;
  for (let i = 0, n = p.length; i < n; i += 2) {
    const j = (i + 2) % n;
    sum += at(p, i) * at(p, j + 1) - at(p, j) * at(p, i + 1);
  }
  return sum / 2;
}

/** Convex hull of flat points (monotone chain), flat out. */
function hull(pts: Pts): Pts {
  const points: [number, number][] = [];
  for (let i = 0; i < pts.length; i += 2) points.push([at(pts, i), at(pts, i + 1)]);
  points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (points.length < 3) return [];
  const turn = (o: Point, a: Point, b: Point): number =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const chain = (list: readonly [number, number][]): [number, number][] => {
    const out: [number, number][] = [];
    for (const q of list) {
      while (out.length >= 2) {
        const [p0, p1] = [out[out.length - 2], out[out.length - 1]];
        if (!p0 || !p1 || turn(p0, p1, q) > 0) break;
        out.pop();
      }
      out.push(q);
    }
    out.pop();
    return out;
  };
  return [...chain(points), ...chain([...points].reverse())].flat();
}

/** Sutherland-Hodgman against an axis-aligned uv box [u0, v0, u1, v1]. */
function clipBox(poly: Pts, box: readonly number[]): Pts {
  let out = poly;
  const edges: readonly (readonly [0 | 1, number, number])[] = [
    [0, at(box, 0), 1],
    [0, at(box, 2), -1],
    [1, at(box, 1), 1],
    [1, at(box, 3), -1],
  ];
  for (const [axis, limit, sign] of edges) {
    const input = out;
    const n = input.length >> 1;
    out = [];
    for (let i = 0; i < n; i += 1) {
      const j = (i + 1) % n;
      const a: Point = [at(input, 2 * i), at(input, 2 * i + 1)];
      const c: Point = [at(input, 2 * j), at(input, 2 * j + 1)];
      const inA = (a[axis] - limit) * sign >= 0;
      const inC = (c[axis] - limit) * sign >= 0;
      if (inA) out.push(a[0], a[1]);
      if (inA !== inC) {
        const k = (limit - a[axis]) / (c[axis] - a[axis]);
        out.push(a[0] + (c[0] - a[0]) * k, a[1] + (c[1] - a[1]) * k);
      }
    }
  }
  return out;
}

/** The projection alone (geometry at build time, hand positions). */
export class Lens {
  /** Lens centre and height (page px). */
  protected readonly x: number;
  protected readonly y: number;
  protected readonly h: number;
  private readonly eye: Vec3;

  constructor(eye: Vec3) {
    [this.x, this.y, this.h] = eye;
    this.eye = eye;
  }

  proj(X: number, Y: number, Z: number): Point {
    const k = this.h / (this.h - Z);
    return [this.x + (X - this.x) * k, this.y + (Y - this.y) * k];
  }

  plane(O: Vec3, U: Vec3, V: Vec3, normal?: Vec3): Plane {
    const { h, x, y } = this;
    const pointAt = (u: number, v: number): Vec3 => [
      O[0] + u * U[0] + v * V[0],
      O[1] + u * U[1] + v * V[1],
      O[2] + u * U[2] + v * V[2],
    ];
    // (u, v, 1) -> homogeneous page: X (h - Z) = h X - x Z, Y (h - Z) = h Y - y Z, w = h - Z.
    const m = [
      h * U[0] - x * U[2],
      h * V[0] - x * V[2],
      h * O[0] - x * O[2],
      h * U[1] - y * U[2],
      h * V[1] - y * V[2],
      h * O[1] - y * O[2],
      -U[2],
      -V[2],
      h - O[2],
    ];
    const n = unit(normal ?? cross(U, V));
    return {
      O,
      U,
      V,
      n,
      at: pointAt,
      xf: (u, v) => {
        const p = pointAt(u, v);
        return this.proj(p[0], p[1], p[2]);
      },
      inverse: inverse3(m),
      facing: dot(n, sub(this.eye, O)) > 0,
    };
  }
}

/** The lens drawing into a canvas. */
export class PopCamera extends Lens {
  /** Canvas px per page px. */
  readonly s: number;
  private readonly canvas: InkCanvas;
  private readonly mask: InkCanvas;

  /** `mask` = a scratch canvas of the same size (rewritten before every use). */
  constructor(canvas: InkCanvas, mask: InkCanvas, eye: Vec3) {
    super(eye);
    this.canvas = canvas;
    this.mask = mask;
    this.s = canvas.width / 960;
  }

  /** Light on a face: null = lit, SOFT = turned a little away, HARD = turned away. */
  static shadeOf(plane: Plane): Remap | null {
    const light = dot(plane.n, LIGHT);
    return light >= 0.6 ? null : light >= 0.12 ? SOFT : HARD;
  }

  /** Canvas polygon of a uv polygon on a plane. */
  screen(plane: Plane, uv: Pts): Pts {
    const out: Pts = [];
    for (let i = 0; i < uv.length; i += 2) {
      const [px, py] = plane.xf(at(uv, i), at(uv, i + 1));
      out.push(px * this.s, py * this.s);
    }
    return out;
  }

  /** Canvas polygon of page px points. */
  page(pts: Pts): Pts {
    return pts.map((value) => value * this.s);
  }

  /** A face of paper with its own fibres (they travel with the paper); returns its polygon. */
  face(plane: Plane, uv: Pts, ink: FaceInk): Pts {
    const pts = this.screen(plane, uv);
    const mi = plane.inverse;
    if (!mi || Math.abs(polyArea(pts)) < 1) return pts;
    const fibre = ink.fibre ?? ink.color;
    const speck = ink.speck ?? fibre;
    const offset = ink.offset ?? 0;
    const shade = ink.shade ?? null;
    const s = this.s;
    this.canvas.fillPoly(pts, (x, y) => {
      const X = (x + 0.5) / s;
      const Y = (y + 0.5) / s;
      const w = at(mi, 6) * X + at(mi, 7) * Y + at(mi, 8);
      const u = (at(mi, 0) * X + at(mi, 1) * Y + at(mi, 2)) / w;
      const v = (at(mi, 3) * X + at(mi, 4) * Y + at(mi, 5)) / w;
      const f = fibreAt(u + offset, v + 200);
      const c = f === 1 ? fibre : f === 2 ? speck : ink.color;
      return shade ? (shade[c] ?? c) : c;
    });
    if (ink.edge !== undefined) this.canvas.outline(pts, ink.edge);
    return pts;
  }

  /** A flat colour shape on a plane (cut paper, printed bands). */
  flat(plane: Plane, uv: Pts, color: FillColor, edge?: number): Pts {
    const pts = this.screen(plane, uv);
    this.canvas.fillPoly(pts, color);
    if (edge !== undefined) this.canvas.outline(pts, edge);
    return pts;
  }

  /** A crisp printed / cut line on a plane. */
  line(plane: Plane, u0: number, v0: number, u1: number, v1: number, color: number): void {
    const pix = pixelPath(this.screen(plane, [u0, v0, u1, v1]), true);
    for (let i = 0; i < pix.length; i += 2) this.canvas.put(at(pix, i), at(pix, i + 1), color);
  }

  /** Canvas polygon of the shadow convex casters (3D points) throw on a plane, clipped to uv. */
  shadowOn(plane: Plane, casters: readonly Vec3[], box?: readonly number[]): Pts | null {
    const ln = dot(LIGHT, plane.n);
    if (ln < 0.1) return null;
    const uv: Pts = [];
    for (const P of casters) {
      const k = dot(sub(P, plane.O), plane.n) / ln;
      const d = sub([P[0] - k * LIGHT[0], P[1] - k * LIGHT[1], P[2] - k * LIGHT[2]], plane.O);
      uv.push(dot(d, plane.U), dot(d, plane.V));
    }
    let outline = hull(uv);
    if (box) outline = clipBox(outline, box);
    return outline.length >= 6 ? this.screen(plane, outline) : null;
  }

  /** Darkens the union of canvas polygons once (overlaps never double up). */
  shade(polys: readonly (Pts | null)[], table: Remap): void {
    const list = polys.filter((poly): poly is Pts => poly !== null && poly.length >= 6);
    const { width, height, data } = this.canvas;
    let [x0, y0, x1, y1] = [width, height, -1, -1];
    for (const p of list) {
      for (let i = 0; i < p.length; i += 2) {
        x0 = Math.min(x0, at(p, i));
        x1 = Math.max(x1, at(p, i));
        y0 = Math.min(y0, at(p, i + 1));
        y1 = Math.max(y1, at(p, i + 1));
      }
    }
    x0 = Math.max(0, Math.floor(x0) - 1);
    y0 = Math.max(0, Math.floor(y0) - 1);
    x1 = Math.min(width - 1, Math.ceil(x1) + 1);
    y1 = Math.min(height - 1, Math.ceil(y1) + 1);
    if (x1 < x0 || y1 < y0) return;
    const mask = this.mask.data;
    for (let y = y0; y <= y1; y += 1) mask.fill(0, y * width + x0, y * width + x1 + 1);
    for (const p of list) this.mask.fillPoly(p, 1);
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        const i = y * width + x;
        if (mask[i] === 1) data[i] = table[data[i] ?? 0] ?? data[i] ?? 0;
      }
    }
  }
}
