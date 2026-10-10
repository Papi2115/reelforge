/**
 * C-CAM brushes (PLAN.md#14.3), part 2: flat tone shapes. Crescents, mottling, hatching, the
 * filled `blob` and the soft `tube`, all through `Paint2D` with the explicit `BrushEnv` from
 * brushes.ts (see its header for the divergences from the original `brushes.js`).
 */
import { hash, rnd } from '../core.js';
import {
  TAU,
  bbox,
  curve,
  inkLine,
  tracePath,
  type Bbox,
  type BrushEnv,
  type Pts,
} from './brushes.js';
import type { Paint2D } from './paint.js';

const num = (values: Pts, index: number): number => values[index] ?? 0;

function scaled(c: Pts, k: number, dx: number, dy: number): number[] {
  const b = bbox(c);
  const out: number[] = new Array<number>(c.length).fill(0);
  for (let i = 0; i < c.length; i += 2) {
    out[i] = b.cx + (num(c, i) - b.cx) * k + dx;
    out[i + 1] = b.cy + (num(c, i + 1) - b.cy) * k + dy;
  }
  return out;
}

/** `[colour, dx, dy]`: a flat crescent on the (dx, dy) side of a shape. */
export type CrescentSpec = readonly [colour: string, dx: number, dy: number];

function crescent(g: Paint2D, c: Pts, spec: CrescentSpec): void {
  const [col, dx, dy] = spec;
  g.beginPath();
  const s = scaled(c, 1, -dx, -dy);
  g.moveTo(num(c, 0), num(c, 1));
  for (let i = 2; i < c.length; i += 2) g.lineTo(num(c, i), num(c, i + 1));
  g.closePath();
  g.moveTo(num(s, 0), num(s, 1));
  for (let i = 2; i < s.length; i += 2) g.lineTo(num(s, i), num(s, i + 1));
  g.closePath();
  g.fillStyle = col;
  g.fill('evenodd');
}

/** `[colour, count, size]`. */
export type MottleSpec = readonly [colour: string, count: number, size: number];

/** Irregular flat tone shapes (mottling, stains drawn as deliberate patches, never noise). */
export function mottle(g: Paint2D, bb: Bbox, m: MottleSpec, seed: number): void {
  const [col, count, size] = m;
  g.fillStyle = col;
  for (let k = 0; k < count; k += 1) {
    const cx = bb.x0 + hash(seed, k, 21) * bb.w;
    const cy = bb.y0 + hash(seed, k, 22) * bb.h;
    const r = size * (0.5 + hash(seed, k, 23));
    const pts: number[] = [];
    for (let j = 0; j < 7; j += 1) {
      const a = (j / 7) * TAU;
      const rr = r * (0.55 + 0.6 * hash(seed, k, j));
      pts.push(cx + Math.cos(a) * rr * 1.35, cy + Math.sin(a) * rr * 0.8);
    }
    tracePath(g, curve(pts, true, 4), true);
    g.fill();
  }
}

export interface HatchSpec {
  /** Stroke colour (default translucent ink). */
  readonly c?: string;
  readonly w?: number;
  /** Clusters. */
  readonly n?: number;
  /** Strokes per cluster. */
  readonly k?: number;
  readonly len?: number;
  readonly gap?: number;
  /** Cluster direction in degrees (default -40, jittered +-14 per cluster). */
  readonly ang?: number;
  /** Bend as a share of the stroke length (default 0.18). */
  readonly bend?: number;
}

/** Hatching: clusters of short, bent parallel strokes (cloth folds, grime, shadow sides). */
export function hatch(g: Paint2D, env: BrushEnv, bb: Bbox, h: HatchSpec, seed: number): void {
  g.strokeStyle = h.c || 'rgba(22,18,14,0.6)';
  g.lineWidth = (h.w || 2.8) * env.lw;
  g.lineCap = 'round';
  const n = h.n || 6;
  const k = h.k || 4;
  const len = h.len || 30;
  const gap = h.gap || 7;
  for (let i = 0; i < n; i += 1) {
    const cx = bb.x0 + hash(seed, i, 31) * bb.w;
    const cy = bb.y0 + hash(seed, i, 32) * bb.h;
    const a = (((h.ang === undefined ? -40 : h.ang) + rnd(-14, 14, seed, i, 33)) * Math.PI) / 180;
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    const nx = -uy;
    const ny = ux;
    const bend = (h.bend === undefined ? 0.18 : h.bend) * len;
    g.beginPath();
    for (let j = 0; j < k; j += 1) {
      const l = len * (0.55 + 0.6 * hash(seed, i, j + 40));
      const ox = cx + nx * gap * j;
      const oy = cy + ny * gap * j;
      g.moveTo(ox - (ux * l) / 2, oy - (uy * l) / 2);
      g.quadraticCurveTo(ox + nx * bend, oy + ny * bend, ox + (ux * l) / 2, oy + (uy * l) / 2);
    }
    g.stroke();
  }
}

export interface BlobOptions {
  /** Points are already a polygon: skip the Catmull-Rom smoothing. */
  readonly sharp?: boolean;
  readonly step?: number;
  readonly seed?: number;
  readonly shade?: CrescentSpec;
  readonly light?: CrescentSpec;
  /** `[colour, dx, dy, k]`: an inner patch, the outline scaled by k (default 0.5) and shifted. */
  readonly patch?: readonly [colour: string, dx: number, dy: number, k?: number];
  readonly mottle?: MottleSpec;
  readonly hatch?: HatchSpec;
  /** Extra drawing clipped to the shape, given its bbox. */
  readonly inner?: (bb: Bbox) => void;
  /** Outline width (default 7); 0 = no outline. */
  readonly lw?: number;
  readonly lineColor?: string;
}

/**
 * Filled shape: base fill -> shadow crescent -> rim crescent -> inner patch -> tone shapes ->
 * hatching -> inner -> ink outline. Returns the smoothed outline.
 */
export function blob(
  g: Paint2D,
  env: BrushEnv,
  pts: Pts,
  fill: string,
  o: BlobOptions = {},
): number[] {
  const c = o.sharp ? pts.slice() : curve(pts, true, o.step ?? 0);
  const seed = o.seed || 1;
  tracePath(g, c, true);
  g.fillStyle = fill;
  g.fill();
  if (o.shade || o.light || o.patch || o.mottle || o.hatch || o.inner) {
    g.save();
    tracePath(g, c, true);
    g.clip();
    const bb = bbox(c);
    if (o.shade) crescent(g, c, o.shade);
    if (o.light) crescent(g, c, o.light);
    if (o.patch) {
      const [col, dx, dy, k] = o.patch;
      tracePath(g, scaled(c, k || 0.5, dx, dy), true);
      g.fillStyle = col;
      g.fill();
    }
    if (o.mottle) mottle(g, bb, o.mottle, seed);
    if (o.hatch) hatch(g, env, bb, o.hatch, seed);
    if (o.inner) o.inner(bb);
    g.restore();
  }
  if (o.lw !== 0) {
    inkLine(g, env, c, {
      w: o.lw || 7,
      closed: true,
      seed,
      ...(o.lineColor === undefined ? {} : { color: o.lineColor }),
    });
  }
  return c;
}

/** Limb / sleeve / strap: a soft tube through joints with per-joint widths, filled like a blob. */
export function tube(
  g: Paint2D,
  env: BrushEnv,
  pts: Pts,
  widths: readonly number[],
  fill: string,
  o: BlobOptions = {},
): number[] {
  const n = pts.length >> 1;
  const left: number[] = [];
  const rightPairs: [number, number][] = [];
  let t0: [number, number] = [0, 1];
  let t1: [number, number] = [0, 1];
  for (let i = 0; i < n; i += 1) {
    const a = Math.max(0, i - 1);
    const b = Math.min(n - 1, i + 1);
    let tx = num(pts, 2 * b) - num(pts, 2 * a);
    let ty = num(pts, 2 * b + 1) - num(pts, 2 * a + 1);
    const tl = Math.hypot(tx, ty);
    if (tl < 1e-3) {
      tx = 0;
      ty = 1;
    } else {
      tx /= tl;
      ty /= tl;
    }
    if (i === 0) t0 = [tx, ty];
    if (i === n - 1) t1 = [tx, ty];
    const w = (widths[i] ?? 0) / 2;
    left.push(num(pts, 2 * i) - ty * w, num(pts, 2 * i + 1) + tx * w);
    rightPairs.push([num(pts, 2 * i) + ty * w, num(pts, 2 * i + 1) - tx * w]);
  }
  const we = (widths[n - 1] ?? 0) * 0.45;
  const ws = (widths[0] ?? 0) * 0.45;
  const poly = [
    ...left,
    num(pts, 2 * n - 2) + t1[0] * we,
    num(pts, 2 * n - 1) + t1[1] * we,
    ...rightPairs.reverse().flat(),
    num(pts, 0) - t0[0] * ws,
    num(pts, 1) - t0[1] * ws,
  ];
  return blob(g, env, poly, fill, o);
}

/** Control points of an ellipse (feed to `blob` / `curve`). */
export function ellipseRing(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  n: number,
  rot = 0,
): number[] {
  const out: number[] = [];
  const cr = Math.cos(rot);
  const sr = Math.sin(rot);
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * TAU;
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry;
    out.push(cx + x * cr - y * sr, cy + x * sr + y * cr);
  }
  return out;
}
