/**
 * Roughness primitives of the open vocabulary (PLAN.md#13.15a): every shape a doodle or a
 * generator draws goes through these, so nothing comes out slick. Loops never close neatly and
 * wander off-round, straight lines bow a little, polygons keep their corners but miss them by a
 * pixel or two, shading is a zigzag the hand scribbles back and forth. All seeded (`hash`), all
 * in the caller's units (amplitudes are passed already scaled).
 */
import { at, hash, rnd } from '../draw/math.js';
import type { Pts } from '../draw/paths.js';

/** Moves every point by up to `amp` (seeded). */
export function jitter(pts: Pts, amp: number, seed: number): Pts {
  if (amp <= 0) return pts.slice();
  return pts.map((value, index) => value + rnd(-amp, amp, seed, index, 31));
}

/**
 * A lumpy closed loop around (cx, cy): the radius drifts with two low harmonics, it starts at a
 * seeded angle and overlaps its start (a pen never closes a loop exactly).
 */
export function blobPts(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  seed: number,
  lumps = 0.12,
  rotDeg = 0,
): Pts {
  const perimeter = Math.PI * (Math.abs(rx) + Math.abs(ry));
  const n = Math.max(10, Math.min(44, Math.round(perimeter / 7)));
  const a0 = rnd(0, Math.PI * 2, seed, 1);
  const [p1, p2] = [rnd(0, 6.28, seed, 2), rnd(0, 6.28, seed, 3)];
  const turns = 1 + rnd(0.05, 0.13, seed, 4);
  const [c, s] = [Math.cos((rotDeg * Math.PI) / 180), Math.sin((rotDeg * Math.PI) / 180)];
  const out: Pts = [];
  const steps = Math.round(n * turns);
  for (let i = 0; i <= steps; i += 1) {
    const a = a0 + (i / n) * Math.PI * 2;
    const k =
      1 +
      lumps * (0.6 * Math.sin(2 * a + p1) + 0.4 * Math.sin(3 * a + p2)) +
      rnd(-0.025, 0.025, seed, i, 5) +
      (i / steps) * rnd(0.01, 0.05, seed, 6);
    const x = Math.cos(a) * rx * k;
    const y = Math.sin(a) * ry * k;
    out.push(cx + x * c - y * s, cy + x * s + y * c);
  }
  return out;
}

/** An arc from `fromDeg` to `toDeg` (0 = right, 90 = down) with a slight seeded drift. */
export function arcPts(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  fromDeg: number,
  toDeg: number,
  seed: number,
): Pts {
  const span = Math.abs(toDeg - fromDeg);
  const n = Math.max(3, Math.min(36, Math.round((span / 360) * Math.PI * (rx + ry) * 0.15)));
  const out: Pts = [];
  for (let i = 0; i <= n; i += 1) {
    const a = ((fromDeg + ((toDeg - fromDeg) * i) / n) * Math.PI) / 180;
    const k = 1 + rnd(-0.03, 0.03, seed, i, 7);
    out.push(cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k);
  }
  return out;
}

/**
 * A hand-drawn straight segment: subdivided, bowed to one side by up to `bow` and wobbling by
 * `amp`; the ends stay where they are (overshoot is the caller's choice).
 */
export function handLine(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  seed: number,
  amp: number,
): Pts {
  const length = Math.hypot(x1 - x0, y1 - y0);
  const parts = Math.max(1, Math.min(6, Math.round(length / 45)));
  const [nx, ny] = length > 0 ? [-(y1 - y0) / length, (x1 - x0) / length] : [0, 0];
  const bow = rnd(-1, 1, seed, 8) * Math.min(amp * 1.6, length * 0.03);
  const out: Pts = [x0, y0];
  for (let i = 1; i < parts; i += 1) {
    const k = i / parts;
    const off = bow * Math.sin(Math.PI * k) + rnd(-amp, amp, seed, i, 9) * 0.5;
    out.push(x0 + (x1 - x0) * k + nx * off, y0 + (y1 - y0) * k + ny * off);
  }
  out.push(x1, y1);
  return out;
}

/**
 * A closed or open polyline through `vertices` drawn by hand: every edge a `handLine`, corners
 * sharp, the vertices missed by up to `amp`; a closed one runs past its start by a few units.
 */
export function roughPoly(
  vertices: Pts,
  closed: boolean,
  seed: number,
  amp: number,
): { readonly pts: Pts; readonly corners: boolean[] } {
  const n = vertices.length >> 1;
  const v = jitter(vertices, amp, seed);
  const pts: Pts = [];
  const corners: boolean[] = [];
  const edges = closed ? n : n - 1;
  for (let i = 0; i < edges; i += 1) {
    const j = (i + 1) % n;
    const line = handLine(
      at(v, 2 * i),
      at(v, 2 * i + 1),
      at(v, 2 * j),
      at(v, 2 * j + 1),
      seed + i,
      amp,
    );
    const from = i === 0 ? 0 : 2;
    for (let k = from; k < line.length; k += 2) {
      pts.push(at(line, k), at(line, k + 1));
      corners.push(k === 0 || k === line.length - 2);
    }
  }
  if (closed && n > 1) {
    // Overshoot: run a little way along the first edge again.
    const k = rnd(0.08, 0.22, seed, 10);
    pts.push(at(v, 0) + (at(v, 2) - at(v, 0)) * k, at(v, 1) + (at(v, 3) - at(v, 1)) * k);
    corners.push(false);
  }
  if (corners.length > 0) {
    corners[0] = false;
    corners[corners.length - 1] = false;
  }
  return { pts, corners };
}

/** Segments [x0, y0, x1, y1] where parallel lines at `deg`, `spacing` apart, cross a polygon. */
export function scanSegments(poly: Pts, spacing: number, deg: number): Pts[] {
  const a = (deg * Math.PI) / 180;
  const [ux, uy] = [Math.cos(a), Math.sin(a)];
  const [vx, vy] = [-uy, ux];
  const n = poly.length >> 1;
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < n; i += 1) {
    const d = at(poly, 2 * i) * vx + at(poly, 2 * i + 1) * vy;
    lo = Math.min(lo, d);
    hi = Math.max(hi, d);
  }
  const out: Pts[] = [];
  for (let d = lo + spacing / 2; d < hi; d += spacing) {
    const hits: number[] = [];
    for (let i = 0, j = n - 1; i < n; j = i, i += 1) {
      const [ax, ay, bx, by] = [
        at(poly, 2 * i),
        at(poly, 2 * i + 1),
        at(poly, 2 * j),
        at(poly, 2 * j + 1),
      ];
      const da = ax * vx + ay * vy - d;
      const db = bx * vx + by * vy - d;
      if (da > 0 === db > 0) continue;
      const k = da / (da - db);
      hits.push((ax + (bx - ax) * k) * ux + (ay + (by - ay) * k) * uy);
    }
    hits.sort((p, q) => p - q);
    for (let h = 0; h + 1 < hits.length; h += 2) {
      const [s0, s1] = [hits[h] ?? 0, hits[h + 1] ?? 0];
      out.push([ux * s0 + vx * d, uy * s0 + vy * d, ux * s1 + vx * d, uy * s1 + vy * d]);
    }
  }
  return out;
}

/**
 * Scribble shading: one zigzag stroke back and forth across a polygon (the hand does not lift),
 * each turn landing a little short of or past the outline.
 */
export function scribblePts(poly: Pts, spacing: number, deg: number, seed: number): Pts {
  const segments = scanSegments(poly, spacing, deg);
  const out: Pts = [];
  segments.forEach((segment, index) => {
    const flip = index % 2 === 1;
    const [x0, y0, x1, y1] = flip
      ? [at(segment, 2), at(segment, 3), at(segment, 0), at(segment, 1)]
      : [at(segment, 0), at(segment, 1), at(segment, 2), at(segment, 3)];
    const length = Math.hypot(x1 - x0, y1 - y0) || 1;
    const miss = (salt: number): number =>
      rnd(-0.12, 0.08, seed, index, salt) * Math.min(length, 30);
    const [dx, dy] = [(x1 - x0) / length, (y1 - y0) / length];
    const s = miss(1);
    const e = miss(2);
    out.push(x0 - dx * s, y0 - dy * s, x1 + dx * e, y1 + dy * e);
  });
  return out;
}

/** A seeded choice from a list. */
export function pick<T>(items: readonly T[], seed: number, salt = 0): T {
  const index = Math.floor(hash(seed, salt, 41) * items.length);
  const item = items[Math.min(items.length - 1, index)];
  if (item === undefined) throw new RangeError('pick: empty list');
  return item;
}
