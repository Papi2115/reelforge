/**
 * `kit.fx.blueprintTimeline`: events along a horizontal axis (years or any numbers). The visible
 * range can zoom/pan between views on cue (re-laid out every frame, so it stays pixel-crisp),
 * events pop in at their own times or phrases with leader lines and labels stacked above and
 * below without overlaps, and a now-marker follows the latest event or sweeps a range.
 */
import { z } from 'zod';
import { boardParams, defineBoard, type BoardContext, type Painter } from './board.js';
import type { Area } from './paper.js';
import type { Raster } from './raster.js';
import { decimalsOf, formatNumber, linear, niceStep } from './scale.js';
import { drawText, textHeight, textWidth } from './text.js';
import { easeInOutCubic, ramp, whenParam } from './timing.js';

const range = z
  .tuple([z.number(), z.number()])
  .refine(([a, b]) => b > a, 'range must be [low, high]');

const timelineParams = z.object({
  events: z
    .array(
      z.object({
        value: z.number().describe('Position on the axis, e.g. the year 1993'),
        label: z.string().max(24),
        caption: z.string().max(24).default('').describe('Second, dimmer line'),
        at: whenParam.optional().describe('When it appears (default start + i * stagger)'),
      }),
    )
    .min(1)
    .max(20),
  range: range.optional().describe('Visible axis range (default: events with a margin)'),
  views: z
    .array(z.object({ at: whenParam, range }))
    .max(8)
    .default([])
    .describe('Zoom/pan: from `at` on the axis eases to `range` (0.8 s)'),
  start: z.number().default(0.4),
  stagger: z.number().min(0).default(0.6),
  now: z
    .union([
      z.literal('follow'),
      z.literal('none'),
      z.object({ from: z.number(), to: z.number(), start: whenParam, end: whenParam }),
    ])
    .default('follow')
    .describe("Now-marker: 'follow' the latest event, 'none', or sweep { from, to, start, end }"),
  format: z.enum(['year', 'number']).default('year').describe('Tick labels: 1993 or 1,993'),
});

type TimelineParams = z.output<typeof timelineParams>;

const VIEW_TIME = 0.8;
const POP_TIME = 0.3;

/** Visible range at time t (views ease in one after another). */
export function visibleRange(
  base: readonly [number, number],
  views: readonly { readonly at: number; readonly range: readonly [number, number] }[],
  t: number,
): [number, number] {
  let current: [number, number] = [base[0], base[1]];
  for (const view of [...views].sort((a, b) => a.at - b.at)) {
    const k = easeInOutCubic(ramp(t, view.at, VIEW_TIME));
    if (k <= 0) break;
    current = [
      current[0] + (view.range[0] - current[0]) * k,
      current[1] + (view.range[1] - current[1]) * k,
    ];
  }
  return current;
}

export interface PlacedLabel {
  /** 0 = first row above the axis, 1 = first row below, 2 = second row above, ... */
  readonly row: number;
  readonly left: number;
  readonly right: number;
}

/**
 * Rows for labels at x positions (each `widths[i]` wide, centred): alternate above/below, and
 * move a label one row further out while it would overlap a label already in its row.
 */
export function stackLabels(
  xs: readonly number[],
  widths: readonly number[],
  gap: number,
): PlacedLabel[] {
  const placed: PlacedLabel[] = [];
  const order = xs.map((x, index) => ({ x, index })).sort((a, b) => a.x - b.x);
  const result = new Array<PlacedLabel>(xs.length);
  order.forEach(({ x, index }, rank) => {
    const width = widths[index] ?? 0;
    const left = x - width / 2;
    const right = x + width / 2;
    let row = rank % 2;
    while (
      placed.some(
        (other) => other.row === row && left < other.right + gap && right > other.left - gap,
      )
    ) {
      row += 2;
    }
    const label = { row, left, right };
    placed.push(label);
    result[index] = label;
  });
  return result;
}

function tickLabel(value: number, format: TimelineParams['format']): string {
  const rounded = Math.round(value * 100) / 100;
  if (format === 'year') return String(rounded);
  return formatNumber(rounded, decimalsOf([rounded]));
}

function setupTimeline(params: TimelineParams, context: BoardContext): Painter {
  const { theme } = context;
  const values = params.events.map((event) => event.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const margin = (high - low) * 0.08 || 1;
  const base = params.range ?? ([low - margin, high + margin] as const);
  const times = params.events.map((event, index) =>
    context.resolve(event.at, params.start + index * params.stagger),
  );
  const views = params.views.map((view) => ({
    at: context.resolve(view.at, 0),
    range: view.range,
  }));
  const now =
    typeof params.now === 'object'
      ? {
          ...params.now,
          start: context.resolve(params.now.start, 0),
          end: context.resolve(params.now.end, 1),
        }
      : params.now;
  const labelScale = context.textScale(2);
  const captionScale = context.textScale(1);
  const widths = params.events.map(
    (event) =>
      Math.max(textWidth(event.label, labelScale), textWidth(event.caption, captionScale)) +
      context.px(6),
  );
  const rowHeight =
    textHeight(1, labelScale) +
    (params.events.some((e) => e.caption) ? textHeight(1, captionScale) + context.px(4) : 0) +
    context.px(10);
  return (raster, t, area) => {
    const [from, to] = visibleRange(base, views, t);
    const left = area.x + context.px(10);
    const right = area.x + area.width - context.px(10);
    const axisY = Math.round(area.y + area.height / 2);
    const xOf = (value: number): number => Math.round(linear(value, from, to, left, right));
    const axisK = easeInOutCubic(ramp(t, Math.max(0, Math.min(...times) - 0.7), 0.6));
    paintAxis(raster, context, { left, right, axisY, from, to, k: axisK, format: params.format });
    const xs = values.map(xOf);
    const rows = stackLabels(xs, widths, context.px(6));
    raster.clipped(area.x, area.y, area.width, area.height, () => {
      paintNow(raster, context, now, { times, values, xOf, axisY, area, t });
      params.events.forEach((event, index) => {
        const k = ramp(t, times[index] ?? 0, POP_TIME);
        if (k <= 0) return;
        const x = xs[index] ?? 0;
        const row = rows[index]?.row ?? 0;
        const above = row % 2 === 0;
        const level = Math.floor(row / 2);
        const reach = context.px(above ? 18 : 26) + level * rowHeight;
        const tipY = above ? axisY - reach : axisY + reach;
        raster.line(x, axisY, x, axisY + (tipY - axisY) * k, theme.dim, { dash: [2, 1] });
        const diamond = context.px(4);
        const color = index === latest(times, t) ? theme.hot : theme.accent;
        raster.polygon(
          [
            [
              [x - diamond, axisY],
              [x, axisY - diamond],
              [x + diamond, axisY],
              [x, axisY + diamond],
            ],
          ],
          color,
        );
        if (k < 1) return;
        const lines = event.caption.length > 0 ? 2 : 1;
        const blockHeight =
          textHeight(1, labelScale) + (lines > 1 ? textHeight(1, captionScale) + context.px(4) : 0);
        const top = above ? tipY - blockHeight - context.px(3) : tipY + context.px(3);
        drawText(raster, [event.label], x, top, {
          scale: labelScale,
          color: theme.ink,
          align: 'center',
          plate: theme.paper,
          pad: context.px(2),
        });
        if (lines > 1) {
          drawText(raster, [event.caption], x, top + textHeight(1, labelScale) + context.px(4), {
            scale: captionScale,
            color: theme.dim,
            align: 'center',
            plate: theme.paper,
            pad: context.px(1),
          });
        }
      });
    });
  };
}

function latest(times: readonly number[], t: number): number {
  let best = -1;
  times.forEach((time, index) => {
    if (time <= t && (best < 0 || time >= (times[best] ?? 0))) best = index;
  });
  return best;
}

function paintAxis(
  raster: Raster,
  context: BoardContext,
  axis: {
    left: number;
    right: number;
    axisY: number;
    from: number;
    to: number;
    k: number;
    format: TimelineParams['format'];
  },
): void {
  const { theme } = context;
  const { left, right, axisY } = axis;
  raster.rect(left, axisY - 1, Math.round((right - left) * axis.k), context.px(2), theme.ink);
  if (axis.k < 1) return;
  const step = niceStep(
    axis.to - axis.from,
    Math.max(2, Math.floor((right - left) / context.px(90))),
  );
  const first = Math.ceil(axis.from / step) * step;
  const scale = context.textScale(1);
  for (let value = first; value <= axis.to; value += step) {
    const x = Math.round(linear(value, axis.from, axis.to, left, right));
    raster.rect(x, axisY - context.px(4), 1, context.px(9), theme.ink);
    const minor = Math.round(linear(value + step / 2, axis.from, axis.to, left, right));
    if (minor < right) raster.rect(minor, axisY - context.px(2), 1, context.px(5), theme.dim);
    drawText(raster, [tickLabel(value, axis.format)], x, axisY + context.px(7), {
      scale,
      color: theme.dim,
      align: 'center',
    });
  }
}

function paintNow(
  raster: Raster,
  context: BoardContext,
  now: 'follow' | 'none' | { from: number; to: number; start: number; end: number },
  frame: {
    times: readonly number[];
    values: readonly number[];
    xOf: (value: number) => number;
    axisY: number;
    area: Area;
    t: number;
  },
): void {
  if (now === 'none') return;
  let value: number;
  if (now === 'follow') {
    const index = latest(frame.times, frame.t);
    if (index < 0) return;
    value = frame.values[index] ?? 0;
  } else {
    if (frame.t < now.start) return;
    value =
      now.from +
      (now.to - now.from) * easeInOutCubic(ramp(frame.t, now.start, now.end - now.start));
  }
  const x = frame.xOf(value);
  const { theme } = context;
  raster.line(x, frame.area.y, x, frame.area.y + frame.area.height, theme.hot, { dash: [3, 3] });
  const size = context.px(5);
  raster.polygon(
    [
      [
        [x - size, frame.area.y],
        [x + size + 1, frame.area.y],
        [x + 0.5, frame.area.y + size + 1],
      ],
    ],
    theme.hot,
  );
}

export const blueprintTimeline = defineBoard({
  name: 'blueprintTimeline',
  description:
    'Blueprint timeline: events ({ value: 1993, label, caption, at }) pop in along a horizontal axis at their own times or phrases, labels stack above/below without overlap, `views` zoom/pan the visible range on cue, a now-marker follows the latest event (or sweeps). Full-frame 2D board: call update(t) every frame.',
  params: timelineParams.extend(boardParams),
  setup: (params, context) => setupTimeline(params, context),
});
