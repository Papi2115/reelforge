/**
 * Flow charts for `whiteboardDiagram`: nodes (box, circle, cloud, a doodle with a caption, or a
 * bare word) laid out in a row, two snaking rows, a column or a cycle, and arrows between them.
 * Drawn in explainer order: a node, the arrow out of it, the next node.
 */
import { KitError } from '../../errors.js';
import type { When } from '../blueprint/timing.js';
import { DOODLES, type DoodleName } from './doodles.js';
import {
  arrowHead,
  bezier,
  boundsOf,
  ellipse,
  transform,
  type Box,
  type Point,
  type Polyline,
} from './geometry.js';
import type { Entry, Item, WhiteboardContext } from './tools.js';

export interface FlowNode {
  readonly id: string;
  readonly label: string;
  readonly at?: When | undefined;
  readonly shape: 'box' | 'circle' | 'cloud' | 'none';
  readonly doodle?: DoodleName | undefined;
  readonly color?: string | undefined;
}

export interface FlowEdge {
  readonly from: string;
  readonly to: string;
  readonly label?: string | undefined;
  readonly at?: When | undefined;
  readonly color?: string | undefined;
}

export type FlowLayout = 'auto' | 'row' | 'column' | 'cycle';

/** Node centres (raster px) for a layout in the safe area. */
export function flowCentres(count: number, layout: FlowLayout, area: Box): Point[] {
  const resolved = layout === 'auto' ? (count <= 4 ? 'row' : 'snake') : layout;
  const at = (fx: number, fy: number): Point => [
    area.x + area.width * fx,
    area.y + area.height * fy,
  ];
  return Array.from({ length: count }, (_, index) => {
    if (resolved === 'row') return at((index + 0.5) / count, 0.5);
    if (resolved === 'column') return at(0.5, (index + 0.5) / count);
    if (resolved === 'cycle') {
      const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;
      return at(0.5 + Math.cos(angle) * 0.36, 0.5 + Math.sin(angle) * 0.38);
    }
    const top = Math.ceil(count / 2);
    if (index < top) return at((index + 0.5) / top, 0.27);
    // Second row right to left under the first row's columns (a snake).
    return at((2 * top - index - 0.5) / top, 0.77);
  });
}

/** Where the segment from the centre of `box` towards `target` leaves the box (+ margin). */
function exitPoint(box: Box, target: Point, margin: number): Point {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const dx = target[0] - cx;
  const dy = target[1] - cy;
  const scale = Math.min(
    dx === 0 ? Infinity : (box.width / 2 + margin) / Math.abs(dx),
    dy === 0 ? Infinity : (box.height / 2 + margin) / Math.abs(dy),
  );
  return [cx + dx * scale, cy + dy * scale];
}

/** A polyline stretched so its bounds fill `target`. */
function fitInto(points: Polyline, target: Box): Point[] {
  const bounds = boundsOf([points]);
  return points.map(([x, y]) => [
    target.x + ((x - bounds.x) / (bounds.width || 1)) * target.width,
    target.y + ((y - bounds.y) / (bounds.height || 1)) * target.height,
  ]);
}

interface PlacedNode {
  readonly entry: Entry;
  readonly box: Box;
}

function placeNode(
  node: FlowNode,
  index: number,
  centre: Point,
  cellWidth: number,
  context: WhiteboardContext,
): PlacedNode {
  const { s } = context;
  let scale = context.cell(3);
  while (scale > context.cell(2) && context.textWidth(node.label, scale) > cellWidth - 20 * s) {
    scale -= 1;
  }
  const items: Item[] = [];
  const key = 200 + index * 10;
  const [cx, cy] = centre;
  const textHeight = context.textHeight(scale);
  if (node.doodle) {
    const size = Math.min(cellWidth * 0.8, 92 * s);
    const spacing = 6 * s;
    const top = cy - (size + spacing + textHeight) / 2;
    const paths = transform(DOODLES[node.doodle](), size / 100, [cx, top + size / 2]);
    items.push({ shape: context.penRaster(paths, { color: node.color, key }), at: node.at });
    const written = context.write(node.label, cx, top + size + spacing, {
      scale,
      align: 'center',
      key: key + 1,
    });
    items.push({ shape: written.shape, gap: 0.1 });
    const box: Box = { x: cx - size / 2, y: top, width: size, height: size + spacing + textHeight };
    return { entry: { name: node.id, items }, box };
  }
  const written = context.write(node.label, cx, cy, {
    scale,
    align: 'center',
    valign: 'middle',
    key: key + 1,
  });
  const label = written.line.box;
  const padX = 12 * s;
  const padY = 10 * s;
  const box: Box = {
    x: label.x - padX,
    y: label.y - padY,
    width: label.width + padX * 2,
    height: label.height + padY * 2,
  };
  const outline: Polyline | undefined =
    node.shape === 'box'
      ? [
          [box.x + 3 * s, box.y],
          [box.x + box.width, box.y + 1 * s],
          [box.x + box.width - 1 * s, box.y + box.height],
          [box.x, box.y + box.height - 1 * s],
          [box.x + 1 * s, box.y - 3 * s],
        ]
      : node.shape === 'circle'
        ? ellipse(
            cx,
            cy,
            box.width / 2 + 6 * s,
            box.height / 2 + 6 * s,
            -1.9,
            -1.9 + Math.PI * 2.08,
            3,
          )
        : node.shape === 'cloud'
          ? fitInto(DOODLES.cloud()[0] ?? [], {
              x: box.x - 16 * s,
              y: box.y - 14 * s,
              width: box.width + 32 * s,
              height: box.height + 22 * s,
            })
          : undefined;
  if (outline)
    items.push({ shape: context.penRaster([outline], { color: node.color, key }), at: node.at });
  items.push({ shape: written.shape, ...(outline ? { gap: 0.08 } : { at: node.at }) });
  const outer: Box =
    node.shape === 'none'
      ? label
      : node.shape === 'box'
        ? box
        : {
            x: box.x - 8 * s,
            y: box.y - 8 * s,
            width: box.width + 16 * s,
            height: box.height + 16 * s,
          };
  return { entry: { name: node.id, items }, box: outer };
}

function edgeEntry(
  edge: FlowEdge,
  index: number,
  from: Box,
  to: Box,
  curved: boolean,
  context: WhiteboardContext,
): Entry {
  const { s } = context;
  const centreOf = (box: Box): Point => [box.x + box.width / 2, box.y + box.height / 2];
  const start = exitPoint(from, centreOf(to), 6 * s);
  const end = exitPoint(to, centreOf(from), 8 * s);
  const mid: Point = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
  const length = Math.hypot(end[0] - start[0], end[1] - start[1]) || 1;
  const normal: Point = [(start[1] - end[1]) / length, (end[0] - start[0]) / length];
  const bend = curved ? length * 0.18 : 0;
  const control: Point = [mid[0] - normal[0] * bend, mid[1] - normal[1] * bend];
  const shaft = curved ? bezier([start, control, end]) : [start, end];
  const back = shaft[Math.max(0, shaft.length - 3)] ?? start;
  const key = 400 + index * 10;
  const items: Item[] = [
    {
      shape: context.penRaster([shaft, arrowHead(back, end, Math.min(11 * s, length * 0.3))], {
        color: edge.color,
        key,
      }),
      at: edge.at,
    },
  ];
  if (edge.label) {
    const scale = context.cell(2);
    const lift = curved ? bend + 12 * s : 12 * s;
    const above: Point = [mid[0] - normal[0] * lift, mid[1] - normal[1] * lift];
    const written = context.write(edge.label, above[0], above[1], {
      scale,
      align: 'center',
      valign: 'middle',
      color: edge.color ?? 'blue',
      key: key + 1,
    });
    items.push({ shape: written.shape, gap: 0.05 });
  }
  return { name: `edge:${edge.from}>${edge.to}`, items };
}

/** Entries of a flow chart in drawing order. */
export function flowEntries(
  nodes: readonly FlowNode[],
  edges: readonly FlowEdge[] | undefined,
  layout: FlowLayout,
  context: WhiteboardContext,
): Entry[] {
  const ids = nodes.map((node) => node.id);
  const resolvedEdges =
    edges ?? nodes.slice(1).map((node, index) => ({ from: ids[index] ?? '', to: node.id }));
  for (const edge of resolvedEdges) {
    for (const end of [edge.from, edge.to]) {
      if (!ids.includes(end)) {
        throw new KitError(
          'invalid-params',
          `${context.call}: edge ${edge.from}>${edge.to} refers to unknown node "${end}" (nodes: ${ids.join(', ')})`,
        );
      }
    }
  }
  const centres = flowCentres(nodes.length, layout, context.area);
  const perRow =
    layout === 'column' || layout === 'cycle'
      ? 1
      : layout === 'row' || nodes.length <= 4
        ? nodes.length
        : Math.ceil(nodes.length / 2);
  const cellWidth =
    layout === 'cycle' ? context.area.width / 3.2 : context.area.width / Math.max(1, perRow);
  const placed = nodes.map((node, index) =>
    placeNode(node, index, centres[index] ?? [0, 0], cellWidth, context),
  );
  const entries: Entry[] = [];
  const done = new Set<number>();
  placed.forEach((node, index) => {
    resolvedEdges.forEach((edge, edgeIndex) => {
      const a = ids.indexOf(edge.from);
      const b = ids.indexOf(edge.to);
      if (done.has(edgeIndex) || b !== index || a >= index) return;
      done.add(edgeIndex);
      const from = placed[a]?.box;
      if (from)
        entries.push(edgeEntry(edge, edgeIndex, from, node.box, layout === 'cycle', context));
    });
    entries.push(node.entry);
    resolvedEdges.forEach((edge, edgeIndex) => {
      const a = ids.indexOf(edge.from);
      const b = ids.indexOf(edge.to);
      if (done.has(edgeIndex) || Math.max(a, b) > index) return;
      done.add(edgeIndex);
      const from = placed[a]?.box;
      const to = placed[b]?.box;
      if (from && to) entries.push(edgeEntry(edge, edgeIndex, from, to, true, context));
    });
  });
  return entries;
}
