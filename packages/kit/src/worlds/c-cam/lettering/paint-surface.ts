/**
 * The world's ink ribbon for the lettering (PLAN.md#14.7, #14.12): an `InkSurface` that fills each
 * stroke ribbon on a `Paint2D` under its current transform. The outline walks the left edge forward
 * and the right edge back (an open stroke: one ring); a closed stroke (last point = first) is two
 * rings of opposite winding filled `nonzero`, so its counter stays open, like `inkLine({ closed })`.
 * Same input -> same path, call for call.
 */
import type { Paint2D } from '../draw/paint.js';
import type { InkSurface, Pt } from './types.js';

const ORIGIN: Pt = { x: 0, y: 0 };

function isClosed(points: readonly Pt[]): boolean {
  const first = points[0];
  const end = points[points.length - 1];
  return (
    points.length > 3 &&
    first !== undefined &&
    end !== undefined &&
    first.x === end.x &&
    first.y === end.y
  );
}

/** The two edges of a ribbon (`right` in drawing order: from the end back to the start). */
function edges(
  points: readonly Pt[],
  widths: readonly number[],
  closed: boolean,
): { readonly left: Pt[]; readonly right: Pt[] } {
  const count = closed ? points.length - 1 : points.length;
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i < count; i += 1) {
    const point = points[i] ?? ORIGIN;
    const before = points[closed ? (i - 1 + count) % count : Math.max(0, i - 1)] ?? point;
    const after = points[closed ? (i + 1) % count : Math.min(count - 1, i + 1)] ?? point;
    const length = Math.hypot(after.x - before.x, after.y - before.y) || 1;
    const half = (widths[i] ?? 0) / 2;
    const nx = (-(after.y - before.y) / length) * half;
    const ny = ((after.x - before.x) / length) * half;
    left.push({ x: point.x + nx, y: point.y + ny });
    right.push({ x: point.x - nx, y: point.y - ny });
  }
  right.reverse();
  return { left, right };
}

function ring(g: Paint2D, points: readonly Pt[]): void {
  const first = points[0];
  if (first === undefined) return;
  g.moveTo(first.x, first.y);
  for (let i = 1; i < points.length; i += 1) {
    const point = points[i] ?? first;
    g.lineTo(point.x, point.y);
  }
  g.closePath();
}

/** An `InkSurface` drawing on `g` (the stage surface of the frame, or any Paint2D). */
export function paintInkSurface(g: Paint2D): InkSurface {
  return {
    ribbon(points: readonly Pt[], widths: readonly number[], fill: string): void {
      if (points.length < 2) return;
      const closed = isClosed(points);
      const { left, right } = edges(points, widths, closed);
      g.fillStyle = fill;
      g.beginPath();
      if (closed) {
        ring(g, left);
        ring(g, right);
      } else {
        ring(g, [...left, ...right]);
      }
      g.fill('nonzero');
    },
  };
}
