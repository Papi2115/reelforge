/**
 * ShapePaint: a `Paint2D` that turns drawing calls into flat shapes in device space (the
 * validators' silhouette mode, c-plus `ST.silhouette`): every fill and stroke counts as ink,
 * whatever its colour or alpha. Paths are flattened as they are added (with the transform current
 * at that moment, as a canvas does); quadratic curves and ellipses become polylines. Clip regions
 * are kept per shape so containment and rasterizing can honour them.
 *
 * Public API: `Polyline`, `Region`, `FillShape`, `StrokeShape`, `Shape`, `ShapePaint`.
 */
import type { FillRule, LineCap, Paint2D } from '../draw/paint.js';

const TAU = Math.PI * 2;
const QUAD_SEGMENTS = 8;
const ELLIPSE_SEGMENTS = 32;

/** Flat device-space points `[x, y, x, y, ...]`; `closed` adds the segment back to the start. */
export interface Polyline {
  readonly pts: readonly number[];
  readonly closed: boolean;
}

/** A filled area: subpaths (implicitly closed) under a fill rule. */
export interface Region {
  readonly paths: readonly Polyline[];
  readonly rule: FillRule;
}

export interface FillShape {
  readonly kind: 'fill';
  readonly region: Region;
  readonly clips: readonly Region[];
}

export interface StrokeShape {
  readonly kind: 'stroke';
  readonly paths: readonly Polyline[];
  /** Half the line width in device px. */
  readonly r: number;
  readonly clips: readonly Region[];
}

export type Shape = FillShape | StrokeShape;

type Matrix = readonly [a: number, b: number, c: number, d: number, e: number, f: number];

interface State {
  readonly m: Matrix;
  readonly clips: readonly Region[];
}

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

function mul(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

export class ShapePaint implements Paint2D {
  fillStyle = '#000000';
  strokeStyle = '#000000';
  lineWidth = 1;
  lineCap: LineCap = 'butt';
  globalAlpha = 1;
  readonly shapes: Shape[] = [];
  private state: State = { m: IDENTITY, clips: [] };
  private readonly stack: State[] = [];
  private paths: { pts: number[]; closed: boolean }[] = [];
  private current: { pts: number[]; closed: boolean } | null = null;
  private lastLocal: readonly [number, number] = [0, 0];

  private apply(x: number, y: number): readonly [number, number] {
    const m = this.state.m;
    return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  }

  private transform(n: Matrix): void {
    this.state = { ...this.state, m: mul(this.state.m, n) };
  }

  private push(x: number, y: number): void {
    const [dx, dy] = this.apply(x, y);
    if (this.current === null) {
      this.current = { pts: [], closed: false };
      this.paths.push(this.current);
    }
    this.current.pts.push(dx, dy);
    this.lastLocal = [x, y];
  }

  private snapshot(): Polyline[] {
    return this.paths
      .filter((p) => p.pts.length >= 4)
      .map((p) => ({ pts: p.pts.slice(), closed: p.closed }));
  }

  save(): void {
    this.stack.push(this.state);
  }
  restore(): void {
    const s = this.stack.pop();
    if (s) this.state = s;
  }
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void {
    this.state = { ...this.state, m: [a, b, c, d, e, f] };
  }
  translate(x: number, y: number): void {
    this.transform([1, 0, 0, 1, x, y]);
  }
  rotate(angle: number): void {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    this.transform([c, s, -s, c, 0, 0]);
  }
  scale(x: number, y: number): void {
    this.transform([x, 0, 0, y, 0, 0]);
  }

  beginPath(): void {
    this.paths = [];
    this.current = null;
  }
  closePath(): void {
    if (this.current === null) return;
    this.current.closed = true;
    const start = this.current.pts;
    // a canvas starts a new subpath at the closed subpath's first point
    this.current = { pts: [], closed: false };
    this.paths.push(this.current);
    if (start.length >= 2) this.current.pts.push(start[0] ?? 0, start[1] ?? 0);
  }
  moveTo(x: number, y: number): void {
    this.current = null;
    this.push(x, y);
  }
  lineTo(x: number, y: number): void {
    this.push(x, y);
  }
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void {
    const [x0, y0] = this.lastLocal;
    for (let i = 1; i <= QUAD_SEGMENTS; i += 1) {
      const t = i / QUAD_SEGMENTS;
      const u = 1 - t;
      this.push(u * u * x0 + 2 * u * t * cpx + t * t * x, u * u * y0 + 2 * u * t * cpy + t * t * y);
    }
  }
  rect(x: number, y: number, width: number, height: number): void {
    this.moveTo(x, y);
    this.push(x + width, y);
    this.push(x + width, y + height);
    this.push(x, y + height);
    this.closePath();
  }
  ellipse(
    x: number,
    y: number,
    radiusX: number,
    radiusY: number,
    rotation: number,
    startAngle: number,
    endAngle: number,
    anticlockwise = false,
  ): void {
    let sweep = endAngle - startAngle;
    if (!anticlockwise) sweep = sweep >= TAU ? TAU : ((sweep % TAU) + TAU) % TAU;
    else sweep = -sweep >= TAU ? -TAU : ((sweep % TAU) - TAU) % TAU;
    const n = Math.max(4, Math.ceil((ELLIPSE_SEGMENTS * Math.abs(sweep)) / TAU));
    const cr = Math.cos(rotation);
    const sr = Math.sin(rotation);
    for (let i = 0; i <= n; i += 1) {
      const a = startAngle + (sweep * i) / n;
      const lx = radiusX * Math.cos(a);
      const ly = radiusY * Math.sin(a);
      this.push(x + lx * cr - ly * sr, y + lx * sr + ly * cr);
    }
  }

  fill(rule: FillRule = 'nonzero'): void {
    const paths = this.snapshot().map((p) => ({ pts: p.pts, closed: true }));
    if (paths.length > 0)
      this.shapes.push({ kind: 'fill', region: { paths, rule }, clips: this.state.clips });
  }
  stroke(): void {
    const m = this.state.m;
    const scale = Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
    const paths = this.snapshot();
    if (paths.length > 0) {
      this.shapes.push({
        kind: 'stroke',
        paths,
        r: (this.lineWidth * scale) / 2,
        clips: this.state.clips,
      });
    }
  }
  clip(): void {
    const paths = this.snapshot().map((p) => ({ pts: p.pts, closed: true }));
    this.state = { ...this.state, clips: [...this.state.clips, { paths, rule: 'nonzero' }] };
  }
  fillRect(x: number, y: number, width: number, height: number): void {
    const corners = [
      this.apply(x, y),
      this.apply(x + width, y),
      this.apply(x + width, y + height),
      this.apply(x, y + height),
    ].flat();
    this.shapes.push({
      kind: 'fill',
      region: { paths: [{ pts: corners, closed: true }], rule: 'nonzero' },
      clips: this.state.clips,
    });
  }
}
