/**
 * `kit.fx.blueprintSchematic`: a technical drawing built from parts (rectangles, circles, lines,
 * closed polygons) that trace themselves in order, section fills (hatch/dots), callouts with
 * leader lines and numbered balloons, and dimension lines with arrows and measurements. All
 * positions are 640x360-frame pixels from the board's top-left corner.
 */
import { z } from 'zod';
import { boardParams, defineBoard, type BoardContext, type Painter } from './board.js';
import {
  arcPoints,
  PATTERNS,
  type PatternName,
  type Pixel,
  type Point,
  type Raster,
} from './raster.js';
import { drawText, textHeight, textWidth } from './text.js';
import { easeOutCubic, ramp, whenParam } from './timing.js';

const xy = z.tuple([z.number(), z.number()]);
const LINE_STYLES = {
  solid: undefined,
  dashed: [5, 3],
  hidden: [3, 3],
  center: [9, 3],
} as const satisfies Record<string, readonly [number, number] | undefined>;

const common = {
  line: z.enum(['solid', 'dashed', 'hidden', 'center']).default('solid'),
  fill: z
    .enum(['none', 'hatch', 'dots', 'sparse', 'solid'])
    .default('none')
    .describe('Section fill'),
  color: z
    .string()
    .default('ink')
    .describe('Palette or role name (ink, dim, accent, hot, alt, good)'),
  width: z.int().min(1).max(3).default(1).describe('Pen width in pixels'),
  at: whenParam.optional().describe('When it starts tracing (default start + i * stagger)'),
  draw: z.number().positive().default(0.6).describe('Seconds the trace takes'),
};

const part = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('rect'),
    box: z
      .tuple([z.number(), z.number(), z.number(), z.number()])
      .describe('[x, y, width, height]'),
    round: z.number().min(0).default(0).describe('Corner radius'),
    ...common,
  }),
  z.object({ kind: z.literal('circle'), center: xy, r: z.number().positive(), ...common }),
  z.object({ kind: z.literal('line'), points: z.array(xy).min(2).max(32), ...common }),
  z.object({
    kind: z.literal('poly'),
    points: z.array(xy).min(3).max(32).describe('Closed outline'),
    ...common,
  }),
]);

const schematicParams = z.object({
  parts: z.array(part).min(1).max(40),
  callouts: z
    .array(
      z.object({
        target: xy.describe('Point the leader touches'),
        text: z.string().max(24),
        label: xy
          .optional()
          .describe('Where the text sits (default: up and outwards from the target)'),
        number: z.int().min(0).max(99).optional().describe('Balloon number before the text'),
        at: whenParam,
      }),
    )
    .max(12)
    .default([]),
  dimensions: z
    .array(
      z.object({
        from: xy,
        to: xy,
        text: z.string().max(16).describe('Measurement, e.g. "113 MM"'),
        offset: z
          .number()
          .default(14)
          .describe('Distance of the dimension line from the edge (sign = side)'),
        at: whenParam,
      }),
    )
    .max(12)
    .default([]),
  start: z.number().default(0.2),
  stagger: z.number().min(0).default(0.3),
});

type SchematicParams = z.output<typeof schematicParams>;
type Part = SchematicParams['parts'][number];

/** Outline of a part as a polyline in raster pixels (closed shapes repeat the first point). */
export function partOutline(item: Part, px: (value: number) => number): Point[] {
  if (item.kind === 'circle') return arcPoints(px(item.center[0]), px(item.center[1]), px(item.r));
  if (item.kind === 'line') return item.points.map(([x, y]) => [px(x), px(y)] as const);
  if (item.kind === 'poly') {
    const points = item.points.map(([x, y]) => [px(x), px(y)] as const);
    return [...points, points[0] ?? [0, 0]];
  }
  const [x, y, w, h] = item.box.map(px) as [number, number, number, number];
  const r = Math.min(px(item.round), Math.floor(Math.min(w, h) / 2));
  if (r <= 0) {
    return [
      [x, y],
      [x + w - 1, y],
      [x + w - 1, y + h - 1],
      [x, y + h - 1],
      [x, y],
    ];
  }
  const right = x + w - 1 - r;
  const bottom = y + h - 1 - r;
  const half = Math.PI / 2;
  return [
    ...arcPoints(x + r, y + r, r, Math.PI, Math.PI + half),
    ...arcPoints(right, y + r, r, -half, 0),
    ...arcPoints(right, bottom, r, 0, half),
    ...arcPoints(x + r, bottom, r, half, Math.PI),
    [x, y + r],
  ];
}

function setupSchematic(params: SchematicParams, context: BoardContext): Painter {
  const { theme, px } = context;
  const outlines = params.parts.map((item) => partOutline(item, px));
  const times = params.parts.map((item, index) =>
    context.resolve(item.at, params.start + index * params.stagger),
  );
  const callouts = params.callouts.map((callout) => ({
    ...callout,
    t: context.resolve(callout.at, 0),
  }));
  const dimensions = params.dimensions.map((dimension) => ({
    ...dimension,
    t: context.resolve(dimension.at, 0),
  }));
  return (raster, t) => {
    params.parts.forEach((item, index) => {
      const begin = times[index] ?? 0;
      const k = ramp(t, begin, item.draw);
      if (k <= 0) return;
      const color = theme.color(item.color);
      const outline = outlines[index] ?? [];
      if (item.fill !== 'none' && item.kind !== 'line') {
        const fill = ramp(t, begin + item.draw, 0.3);
        if (fill > 0) {
          raster.faded(fill, () => {
            raster.polygon(
              [outline],
              item.fill === 'solid' ? theme.deep : color,
              item.fill === 'solid' ? undefined : PATTERNS[item.fill as PatternName],
            );
          });
        }
      }
      raster.polyline(outline, color, {
        progress: k,
        width: item.width,
        dash: LINE_STYLES[item.line],
      });
    });
    for (const dimension of dimensions) paintDimension(raster, context, dimension, t);
    for (const callout of callouts) paintCallout(raster, context, callout, t);
  };
}

function arrowHead(raster: Raster, tip: Point, direction: Point, size: number, color: Pixel): void {
  const [dx, dy] = direction;
  for (const side of [1, -1]) {
    raster.line(
      tip[0],
      tip[1],
      tip[0] - dx * size - dy * size * 0.5 * side,
      tip[1] - dy * size + dx * size * 0.5 * side,
      color,
    );
  }
}

function paintDimension(
  raster: Raster,
  context: BoardContext,
  dimension: SchematicParams['dimensions'][number] & { readonly t: number },
  t: number,
): void {
  const k = easeOutCubic(ramp(t, dimension.t, 0.5));
  if (k <= 0) return;
  const { theme, px } = context;
  const [ax, ay] = [px(dimension.from[0]), px(dimension.from[1])];
  const [bx, by] = [px(dimension.to[0]), px(dimension.to[1])];
  const length = Math.hypot(bx - ax, by - ay) || 1;
  const [ux, uy] = [(bx - ax) / length, (by - ay) / length];
  const [nx, ny] = [uy, -ux];
  const offset = px(dimension.offset);
  const beyond = offset + Math.sign(offset || 1) * px(4);
  raster.line(
    ax + nx * px(2) * Math.sign(offset || 1),
    ay + ny * px(2) * Math.sign(offset || 1),
    ax + nx * beyond,
    ay + ny * beyond,
    theme.dim,
  );
  raster.line(
    bx + nx * px(2) * Math.sign(offset || 1),
    by + ny * px(2) * Math.sign(offset || 1),
    bx + nx * beyond,
    by + ny * beyond,
    theme.dim,
  );
  const [cx, cy] = [(ax + bx) / 2 + nx * offset, (ay + by) / 2 + ny * offset];
  const half = (length / 2) * k;
  const a: Point = [cx - ux * half, cy - uy * half];
  const b: Point = [cx + ux * half, cy + uy * half];
  raster.line(a[0], a[1], b[0], b[1], theme.dim);
  if (k < 1) return;
  arrowHead(raster, a, [-ux, -uy], px(6), theme.dim);
  arrowHead(raster, b, [ux, uy], px(6), theme.dim);
  drawText(raster, [dimension.text], cx, cy, {
    scale: context.textScale(Math.abs(ux) > 0.5 ? 2 : 1),
    color: theme.ink,
    align: 'center',
    valign: 'middle',
    plate: theme.paper,
    pad: px(3),
  });
}

function paintCallout(
  raster: Raster,
  context: BoardContext,
  callout: SchematicParams['callouts'][number] & { readonly t: number },
  t: number,
): void {
  const k = ramp(t, callout.t, 0.4);
  if (k <= 0) return;
  const { theme, px } = context;
  const target: Point = [px(callout.target[0]), px(callout.target[1])];
  const outward = target[0] < raster.width / 2 ? -1 : 1;
  const label: Point = callout.label
    ? [px(callout.label[0]), px(callout.label[1])]
    : [target[0] + outward * px(70), target[1] - px(44)];
  const toRight = label[0] >= target[0];
  const scale = context.textScale(2);
  // Label group: [balloon][text] right of the leader, [text][balloon] left of it.
  const radius = callout.number === undefined ? 0 : Math.round(textHeight(1, scale) / 2 + px(4));
  const balloon = radius > 0 ? radius * 2 + px(5) : 0;
  const width = balloon + textWidth(callout.text, scale);
  // Kept inside the frame whatever the frame size (positions scale, lettering is integer).
  const margin = px(10);
  const left = Math.max(
    margin,
    Math.min(raster.width - margin - width, toRight ? label[0] : label[0] - width),
  );
  const shoulder: Point = [toRight ? left - px(4) : left + width + px(4), label[1]];
  const knee: Point = [shoulder[0] + (toRight ? -px(10) : px(10)), label[1]];
  raster.disc(target[0], target[1], Math.max(1, px(2)), theme.accent);
  raster.polyline([target, knee, shoulder], theme.accent, { progress: k });
  if (k < 1) return;
  if (radius > 0) {
    const centre = toRight ? left + radius : left + width - radius;
    raster.disc(centre, label[1], radius, theme.paper);
    raster.circle(centre, label[1], radius, theme.accent);
    drawText(raster, [String(callout.number)], centre + 1, label[1], {
      scale,
      color: theme.accent,
      align: 'center',
      valign: 'middle',
    });
  }
  const typed = Math.floor(ramp(t, callout.t + 0.4, 0.35) * callout.text.length);
  if (typed <= 0) return;
  drawText(raster, [callout.text], toRight ? left + balloon : left, label[1], {
    scale,
    color: theme.ink,
    valign: 'middle',
    plate: theme.paper,
    pad: px(3),
    chars: typed,
  });
}

export const blueprintSchematic = defineBoard({
  name: 'blueprintSchematic',
  description:
    'Blueprint technical drawing: parts (rect with optional round corners, circle, line, closed poly; solid/dashed/hidden/center lines, hatch/dots fills) trace in one after another, then dimension lines with arrows and measurements and callouts with leader lines (optional balloon numbers) appear on their times or phrases. Coordinates are 640x360-frame pixels. Full-frame 2D board: call update(t) every frame.',
  params: schematicParams.extend(boardParams),
  setup: (params, context) => setupSchematic(params, context),
});
