/**
 * `kit.fx.blueprintGraph`: a flow chart / network on the blueprint sheet. Boxes trace their
 * outline and letter their label when they appear (own time or spoken phrase), edges draw in once
 * both ends exist and end in arrowheads, highlights turn nodes/edges hot, and `flow` sends pulses
 * along drawn edges.
 */
import { z } from 'zod';
import { KitError } from '../../errors.js';
import { boardParams, defineBoard, type BoardContext, type Painter } from './board.js';
import {
  edgePath,
  endDirection,
  GRAPH_LAYOUTS,
  layoutCentres,
  pointAlong,
  type GraphBox,
} from './graph-layout.js';
import type { Area } from './paper.js';
import type { Pixel, Point, Raster } from './raster.js';
import { drawText, fitScale, textHeight, textWidth } from './text.js';
import { ramp, whenParam } from './timing.js';

const graphParams = z.object({
  nodes: z
    .array(
      z.object({
        id: z.string().min(1).describe('Unique id (edges and highlights refer to it)'),
        label: z.string().max(24).default('').describe('Text in the box'),
        position: z
          .tuple([z.number(), z.number()])
          .optional()
          .describe('[x, y] centre in 640x360-frame pixels (default: from layout)'),
        shape: z.enum(['box', 'diamond', 'circle']).default('box'),
        at: whenParam.optional().describe('When it appears (default start + i * stagger)'),
      }),
    )
    .min(1)
    .max(16),
  edges: z
    .array(
      z.object({
        from: z.string(),
        to: z.string(),
        label: z.string().max(16).default('').describe('Small text at the middle'),
        dashed: z.boolean().default(false),
        at: whenParam.optional().describe('When it starts drawing (default: after both ends)'),
      }),
    )
    .max(32)
    .default([]),
  layout: z.enum(GRAPH_LAYOUTS).default('flow').describe('flow: layered left to right by edges'),
  start: z.number().default(0.3),
  stagger: z.number().min(0).default(0.5),
  drawTime: z.number().positive().default(0.5).describe('Seconds an edge takes to draw'),
  highlights: z
    .array(
      z.object({
        id: z.string().describe("Node id, or 'from>to' for an edge"),
        at: whenParam,
        until: whenParam.optional(),
      }),
    )
    .max(32)
    .default([]),
  flow: z.boolean().default(true).describe('Pulses run along drawn edges'),
});

type GraphParams = z.output<typeof graphParams>;

const TRACE_TIME = 0.35;
const PULSE_PERIOD = 1.4;

function checkIds(params: GraphParams): Map<string, number> {
  const ids = new Map<string, number>();
  params.nodes.forEach((node, index) => {
    if (ids.has(node.id)) {
      throw new KitError(
        'invalid-params',
        `kit.fx.blueprintGraph(): duplicate node id "${node.id}"`,
      );
    }
    ids.set(node.id, index);
  });
  for (const edge of params.edges) {
    for (const id of [edge.from, edge.to]) {
      if (!ids.has(id)) {
        throw new KitError(
          'invalid-params',
          `kit.fx.blueprintGraph(): edge ${edge.from}>${edge.to} refers to unknown node "${id}" (nodes: ${[...ids.keys()].join(', ')})`,
        );
      }
    }
  }
  return ids;
}

function outline(box: GraphBox, shape: GraphParams['nodes'][number]['shape']): Point[] {
  const left = Math.round(box.cx - box.width / 2);
  const top = Math.round(box.cy - box.height / 2);
  const right = left + Math.round(box.width) - 1;
  const bottom = top + Math.round(box.height) - 1;
  if (shape === 'diamond') {
    const cx = Math.round(box.cx);
    const cy = Math.round(box.cy);
    return [
      [left, cy],
      [cx, top],
      [right, cy],
      [cx, bottom],
      [left, cy],
    ];
  }
  if (shape === 'circle') {
    const r = Math.max(box.width, box.height) / 2;
    const segments = Math.max(16, Math.round(r));
    return Array.from({ length: segments + 1 }, (_, i) => {
      const angle = Math.PI + (i / segments) * Math.PI * 2;
      return [box.cx + Math.cos(angle) * r, box.cy + Math.sin(angle) * r * 0.75] as const;
    });
  }
  return [
    [left, top],
    [right, top],
    [right, bottom],
    [left, bottom],
    [left, top],
  ];
}

function setupGraph(params: GraphParams, context: BoardContext): Painter {
  const ids = checkIds(params);
  const { theme } = context;
  const times = params.nodes.map((node, index) =>
    context.resolve(node.at, params.start + index * params.stagger),
  );
  const pairs = params.edges.map(
    (edge) => [ids.get(edge.from) ?? 0, ids.get(edge.to) ?? 0] as const,
  );
  const edgeTimes = params.edges.map((edge, index) => {
    const [from, to] = pairs[index] ?? [0, 0];
    return context.resolve(edge.at, Math.max(times[from] ?? 0, times[to] ?? 0) + TRACE_TIME);
  });
  const highlights = params.highlights.map((entry) => ({
    id: entry.id,
    at: context.resolve(entry.at, 0),
    until: context.resolve(entry.until, Infinity),
  }));
  const hot = (id: string, t: number): boolean =>
    highlights.some((entry) => entry.id === id && t >= entry.at && t < entry.until);
  let geometry: { area: Area; boxes: GraphBox[]; paths: Point[][]; scales: number[] } | undefined;
  const geometryFor = (area: Area) => {
    if (geometry?.area.y === area.y && geometry.area.height === area.height) return geometry;
    const centres = layoutCentres(params.layout, params.nodes.length, pairs, area);
    const maxWidth =
      (area.width / Math.max(1, params.layout === 'row' ? params.nodes.length : 4)) * 0.85;
    // One lettering size for every box: the largest at which all labels fit.
    const shared = Math.min(
      ...params.nodes.map((node) =>
        fitScale(node.label, maxWidth - context.px(14), context.textScale(2)),
      ),
    );
    const scales = params.nodes.map(() => shared);
    const boxes = params.nodes.map((node, index): GraphBox => {
      const scale = scales[index] ?? 1;
      const [cx, cy] = node.position
        ? [context.px(node.position[0]), context.px(node.position[1])]
        : (centres[index] ?? [0, 0]);
      const width = Math.max(context.px(36), textWidth(node.label, scale) + context.px(16));
      const height = textHeight(1, scale) + context.px(14);
      const grow = node.shape === 'box' ? 1 : 1.5;
      return {
        cx: Math.round(cx),
        cy: Math.round(cy),
        width: Math.round(width * grow),
        height: Math.round(height * (node.shape === 'diamond' ? 1.6 : 1)),
      };
    });
    const paths = pairs.map(([from, to]) =>
      edgePath(
        boxes[from] ?? boxes[0] ?? { cx: 0, cy: 0, width: 0, height: 0 },
        boxes[to] ?? boxes[0] ?? { cx: 0, cy: 0, width: 0, height: 0 },
        params.layout === 'flow',
      ),
    );
    geometry = { area, boxes, paths, scales };
    return geometry;
  };
  return (raster, t, area) => {
    const { boxes, paths, scales } = geometryFor(area);
    params.edges.forEach((edge, index) => {
      const k = ramp(t, edgeTimes[index] ?? 0, params.drawTime);
      if (k <= 0) return;
      const path = paths[index] ?? [];
      const color = hot(`${edge.from}>${edge.to}`, t) ? theme.hot : theme.ink;
      paintEdge(raster, context, path, k, color, edge.dashed);
      if (k >= 1 && params.flow) {
        const phase =
          ((((t - (edgeTimes[index] ?? 0) - params.drawTime) / PULSE_PERIOD) % 1) + 1) % 1;
        const [x, y] = pointAlong(path, phase);
        raster.dot(x, y, Math.max(3, context.px(4)) | 1, theme.accent);
      }
      if (edge.label.length > 0 && k >= 1) {
        const [x, y] = pointAlong(path, 0.5);
        drawText(raster, [edge.label], x, y - context.px(4), {
          scale: context.textScale(1),
          color: theme.dim,
          align: 'center',
          valign: 'bottom',
          plate: theme.paper,
          pad: context.px(2),
        });
      }
    });
    params.nodes.forEach((node, index) => {
      const begin = times[index] ?? 0;
      const k = ramp(t, begin, TRACE_TIME);
      if (k <= 0) return;
      const box = boxes[index];
      if (!box) return;
      const isHot = hot(node.id, t);
      const color = isHot ? theme.hot : theme.ink;
      const shape = outline(box, node.shape);
      if (k >= 1) raster.polygon([shape], theme.paper);
      raster.polyline(shape, color, { progress: k, width: isHot ? context.px(2) : 1 });
      const typed = Math.floor(ramp(t, begin + TRACE_TIME * 0.6, 0.3) * node.label.length);
      if (typed > 0) {
        drawText(raster, [node.label], box.cx, box.cy, {
          scale: scales[index] ?? 1,
          color: isHot ? theme.hot : theme.ink,
          align: 'center',
          valign: 'middle',
          chars: typed,
        });
      }
    });
  };
}

function paintEdge(
  raster: Raster,
  context: BoardContext,
  path: readonly Point[],
  k: number,
  color: Pixel,
  dashed: boolean,
): void {
  raster.polyline(path, color, { progress: k, ...(dashed ? { dash: [4, 3] as const } : {}) });
  if (k < 1) return;
  const tip = path.at(-1) ?? [0, 0];
  const [dx, dy] = endDirection(path);
  const length = context.px(6);
  const wing = context.px(3);
  for (const side of [1, -1]) {
    raster.line(
      tip[0],
      tip[1],
      tip[0] - dx * length - dy * wing * side,
      tip[1] - dy * length + dx * wing * side,
      color,
    );
  }
}

export const blueprintGraph = defineBoard({
  name: 'blueprintGraph',
  description:
    "Blueprint flow chart / network: labelled boxes (box, diamond, circle) trace in at their own times or phrases, arrows draw in once both ends exist, `flow` pulses run along them, highlights ({ id: 'a' or 'a>b', at, until }) turn them hot. Layout flow (layered left to right), row, column, circle or explicit positions. Full-frame 2D board: call update(t) every frame.",
  params: graphParams.extend(boardParams),
  setup: (params, context) => setupGraph(params, context),
});
