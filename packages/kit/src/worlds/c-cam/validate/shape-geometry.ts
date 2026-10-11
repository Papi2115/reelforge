/**
 * Geometry on recorded shapes (shape-paint.ts) and on boxes: point containment under the fill
 * rules, distance to the ink, bounds, and the segment / box test the tangle rules use (c-plus
 * `validate.js` `segBox`, Liang-Barsky).
 *
 * Public API: `Box`, `regionContains`, `shapeContains`, `inkContains`, `inkDistance`,
 * `inkBounds`, `unionBox`, `segmentHitsBox`, `circleHitsBox`, `segmentDistance`.
 */
import type { Point2 } from '../draw/contact.js';
import type { Polyline, Region, Shape } from './shape-paint.js';

/** Axis-aligned box (y down): x0 <= x1, y0 <= y1. */
export interface Box {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

const at = (pts: readonly number[], i: number): number => pts[i] ?? 0;

/** Visits every segment of a polyline (`closed` adds the closing one). */
function eachSegment(
  p: Polyline,
  visit: (ax: number, ay: number, bx: number, by: number) => void,
): void {
  const n = p.pts.length >> 1;
  const segs = p.closed ? n : n - 1;
  for (let i = 0; i < segs; i += 1) {
    const j = (i + 1) % n;
    visit(at(p.pts, 2 * i), at(p.pts, 2 * i + 1), at(p.pts, 2 * j), at(p.pts, 2 * j + 1));
  }
}

/** Winding number of the region's subpaths around (x, y) (nonzero) or its crossing count (evenodd). */
export function regionContains(region: Region, x: number, y: number): boolean {
  let winding = 0;
  let crossings = 0;
  for (const p of region.paths) {
    eachSegment({ pts: p.pts, closed: true }, (ax, ay, bx, by) => {
      if (ay <= y === by <= y) return;
      const t = (y - ay) / (by - ay);
      if (ax + t * (bx - ax) <= x) return;
      crossings += 1;
      winding += by > ay ? 1 : -1;
    });
  }
  return region.rule === 'evenodd' ? crossings % 2 === 1 : winding !== 0;
}

/** Distance from (x, y) to the segment a-b. */
export function segmentDistance(
  x: number,
  y: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2));
  return Math.hypot(x - ax - t * dx, y - ay - t * dy);
}

const clipsContain = (clips: readonly Region[], x: number, y: number): boolean =>
  clips.every((c) => regionContains(c, x, y));

/** Is (x, y) inked by this shape (inside the fill, or within half the line width of the stroke)? */
export function shapeContains(shape: Shape, x: number, y: number): boolean {
  if (!clipsContain(shape.clips, x, y)) return false;
  if (shape.kind === 'fill') return regionContains(shape.region, x, y);
  return shape.paths.some((p) => {
    let hit = false;
    eachSegment(p, (ax, ay, bx, by) => {
      if (!hit && segmentDistance(x, y, ax, ay, bx, by) <= shape.r) hit = true;
    });
    return hit;
  });
}

export function inkContains(shapes: readonly Shape[], x: number, y: number): boolean {
  return shapes.some((s) => shapeContains(s, x, y));
}

/**
 * Distance from (x, y) to the nearest ink (0 inside) and that nearest point. Clip regions are
 * ignored for the distance (they only ever trim ink inside a larger outline).
 */
export function inkDistance(
  shapes: readonly Shape[],
  x: number,
  y: number,
): { d: number; at: Point2 } {
  if (inkContains(shapes, x, y)) return { d: 0, at: [x, y] };
  let best = Infinity;
  let near: Point2 = [x, y];
  for (const s of shapes) {
    const paths = s.kind === 'fill' ? s.region.paths : s.paths;
    const r = s.kind === 'fill' ? 0 : s.r;
    for (const p of paths) {
      eachSegment(s.kind === 'fill' ? { pts: p.pts, closed: true } : p, (ax, ay, bx, by) => {
        const d = segmentDistance(x, y, ax, ay, bx, by) - r;
        if (d >= best) return;
        best = d;
        const dx = bx - ax;
        const dy = by - ay;
        const l2 = dx * dx + dy * dy;
        const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2));
        near = [ax + t * dx, ay + t * dy];
      });
    }
  }
  return { d: Math.max(0, best), at: near };
}

function shapeBounds(s: Shape): Box | null {
  const paths = s.kind === 'fill' ? s.region.paths : s.paths;
  const r = s.kind === 'fill' ? 0 : s.r;
  let box: Box | null = null;
  for (const p of paths) {
    for (let i = 0; i + 1 < p.pts.length; i += 2) {
      const x = at(p.pts, i);
      const y = at(p.pts, i + 1);
      box = unionBox(box, { x0: x - r, y0: y - r, x1: x + r, y1: y + r });
    }
  }
  for (const c of s.clips) {
    const cb = inkBounds([{ kind: 'fill', region: c, clips: [] }]);
    if (box === null || cb === null) continue;
    box = {
      x0: Math.max(box.x0, cb.x0),
      y0: Math.max(box.y0, cb.y0),
      x1: Math.min(box.x1, cb.x1),
      y1: Math.min(box.y1, cb.y1),
    };
    if (box.x0 > box.x1 || box.y0 > box.y1) return null;
  }
  return box;
}

/** Bounds of all ink (strokes include their half width; clipped shapes are trimmed to the clip bounds). */
export function inkBounds(shapes: readonly Shape[]): Box | null {
  let box: Box | null = null;
  for (const s of shapes) box = unionBox(box, shapeBounds(s));
  return box;
}

export function unionBox(a: Box | null, b: Box | null): Box | null {
  if (a === null) return b;
  if (b === null) return a;
  return {
    x0: Math.min(a.x0, b.x0),
    y0: Math.min(a.y0, b.y0),
    x1: Math.max(a.x1, b.x1),
    y1: Math.max(a.y1, b.y1),
  };
}

/** Does the segment a-b touch the box? (Liang-Barsky clipping, c-plus `segBox`.) */
export function segmentHitsBox(a: Point2, b: Point2, box: Box): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const sides: readonly (readonly [number, number])[] = [
    [-dx, a[0] - box.x0],
    [dx, box.x1 - a[0]],
    [-dy, a[1] - box.y0],
    [dy, box.y1 - a[1]],
  ];
  for (const [p, q] of sides) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const r = q / p;
    if (p < 0) t0 = Math.max(t0, r);
    else t1 = Math.min(t1, r);
    if (t0 > t1) return false;
  }
  return true;
}

/** c-plus `inBox`: the square of half size r round q overlaps the box (strictly). */
export function circleHitsBox(q: Point2, r: number, box: Box): boolean {
  return q[0] + r > box.x0 && q[0] - r < box.x1 && q[1] + r > box.y0 && q[1] - r < box.y1;
}
