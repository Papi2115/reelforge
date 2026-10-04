/**
 * Node-graph geometry for the blueprint look (pure, unit-tested): automatic layouts (layered flow
 * left to right, row, column, circle), box sizes from the labels, and edge paths that start and
 * end on the box borders (orthogonal elbows in flow layout).
 */
import type { Area } from './paper.js';
import type { Point } from './raster.js';

export const GRAPH_LAYOUTS = ['flow', 'row', 'column', 'circle'] as const;
export type GraphLayout = (typeof GRAPH_LAYOUTS)[number];

export interface GraphBox {
  readonly cx: number;
  readonly cy: number;
  readonly width: number;
  readonly height: number;
}

/** Layer index of every node: longest path from a source (edges given as index pairs). */
export function flowLayers(count: number, edges: readonly (readonly [number, number])[]): number[] {
  const layers = new Array<number>(count).fill(0);
  // Longest-path relaxation; capped at `count` rounds so cycles cannot loop forever.
  for (let round = 0; round < count; round += 1) {
    let changed = false;
    for (const [from, to] of edges) {
      const next = (layers[from] ?? 0) + 1;
      if (next > (layers[to] ?? 0) && next < count) {
        layers[to] = next;
        changed = true;
      }
    }
    if (!changed) break;
  }
  // Sources sit right before their first target (a side input joins next to its consumer).
  const hasInput = new Set(edges.map(([, to]) => to));
  for (let node = 0; node < count; node += 1) {
    if (hasInput.has(node)) continue;
    const targets = edges.filter(([from]) => from === node).map(([, to]) => layers[to] ?? 0);
    if (targets.length > 0) layers[node] = Math.max(0, Math.min(...targets) - 1);
  }
  return layers;
}

/** Node centres inside `area` for an automatic layout. */
export function layoutCentres(
  layout: GraphLayout,
  count: number,
  edges: readonly (readonly [number, number])[],
  area: Area,
): Point[] {
  const cx = area.x + area.width / 2;
  const cy = area.y + area.height / 2;
  if (layout === 'row') {
    return Array.from(
      { length: count },
      (_, i) => [area.x + (area.width * (i + 0.5)) / count, cy] as const,
    );
  }
  if (layout === 'column') {
    return Array.from(
      { length: count },
      (_, i) => [cx, area.y + (area.height * (i + 0.5)) / count] as const,
    );
  }
  if (layout === 'circle') {
    const rx = area.width * 0.36;
    const ry = area.height * 0.36;
    return Array.from({ length: count }, (_, i) => {
      const angle = -Math.PI / 2 + (i / count) * Math.PI * 2;
      return [cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry] as const;
    });
  }
  const layers = flowLayers(count, edges);
  const depth = Math.max(0, ...layers) + 1;
  const members: number[][] = Array.from({ length: depth }, () => []);
  layers.forEach((layer, index) => members[layer]?.push(index));
  const centres: Point[] = new Array<Point>(count).fill([cx, cy]);
  members.forEach((nodes, layer) => {
    nodes.forEach((node, slot) => {
      centres[node] = [
        area.x + (area.width * (layer + 0.5)) / depth,
        area.y + (area.height * (slot + 0.5)) / nodes.length,
      ];
    });
  });
  return centres;
}

/** Point where the ray from the box centre towards (tx, ty) leaves the box. */
export function borderPoint(box: GraphBox, tx: number, ty: number): Point {
  const dx = tx - box.cx;
  const dy = ty - box.cy;
  if (dx === 0 && dy === 0) return [box.cx, box.cy];
  const sx = dx === 0 ? Infinity : box.width / 2 / Math.abs(dx);
  const sy = dy === 0 ? Infinity : box.height / 2 / Math.abs(dy);
  const k = Math.min(sx, sy);
  return [box.cx + dx * k, box.cy + dy * k];
}

/** Path of an edge between two boxes, ending a pixel off the target border (arrow tip). */
export function edgePath(from: GraphBox, to: GraphBox, orthogonal: boolean): Point[] {
  if (orthogonal && Math.abs(to.cx - from.cx) > (from.width + to.width) / 2) {
    const direction = to.cx > from.cx ? 1 : -1;
    const startX = from.cx + (direction * from.width) / 2 + direction;
    const endX = to.cx - (direction * to.width) / 2 - direction * 2;
    // The vertical run sits in the gutter just before the target, never across other boxes.
    const gutter = Math.min(Math.abs(endX - startX) / 2, 12);
    const midX = Math.round(endX - direction * gutter);
    if (Math.round(from.cy) === Math.round(to.cy)) {
      return [
        [startX, from.cy],
        [endX, to.cy],
      ];
    }
    return [
      [startX, from.cy],
      [midX, from.cy],
      [midX, to.cy],
      [endX, to.cy],
    ];
  }
  const start = borderPoint(from, to.cx, to.cy);
  const end = borderPoint(to, from.cx, from.cy);
  const length = Math.hypot(end[0] - start[0], end[1] - start[1]) || 1;
  const pull = 2 / length;
  return [
    [start[0] + (end[0] - start[0]) * (1 / length), start[1] + (end[1] - start[1]) * (1 / length)],
    [end[0] - (end[0] - start[0]) * pull, end[1] - (end[1] - start[1]) * pull],
  ];
}

/** Point at share k (0..1) of a polyline's length. */
export function pointAlong(points: readonly Point[], k: number): Point {
  const lengths = points.slice(1).map((point, index) => {
    const previous = points[index] ?? point;
    return Math.hypot(point[0] - previous[0], point[1] - previous[1]);
  });
  let remaining = lengths.reduce((sum, length) => sum + length, 0) * Math.min(1, Math.max(0, k));
  for (let index = 0; index < lengths.length; index += 1) {
    const length = lengths[index] ?? 0;
    const a = points[index] ?? [0, 0];
    const b = points[index + 1] ?? a;
    if (remaining <= length || index === lengths.length - 1) {
      const share = length > 0 ? Math.min(1, remaining / length) : 0;
      return [a[0] + (b[0] - a[0]) * share, a[1] + (b[1] - a[1]) * share];
    }
    remaining -= length;
  }
  return points[0] ?? [0, 0];
}

/** Unit direction of the last segment of a path (arrowheads). */
export function endDirection(points: readonly Point[]): Point {
  const b = points.at(-1) ?? [0, 0];
  const a = points.at(-2) ?? b;
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
}
