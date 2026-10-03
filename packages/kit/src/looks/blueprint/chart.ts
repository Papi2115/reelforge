/**
 * `kit.fx.blueprintChart`: bar, line, area and horizontal-bar charts drawn as a technical
 * figure. Data comes from a pasted CSV string or arrays; every datum appears at its own time
 * (`at`: seconds or spoken phrases, or an `at`/`say` column of the CSV), so bars and points land
 * on the words that name them. Values count up while their bar grows.
 */
import { z } from 'zod';
import { KitError } from '../../errors.js';
import { boardParams, defineBoard, type BoardContext, type Painter } from './board.js';
import { CHART_TYPES, chartLayout, type ChartLayout } from './chart-layout.js';
import { chartDataFromArrays, chartDataFromCsv, type ChartData } from './csv.js';
import type { Area } from './paper.js';
import { PATTERNS, type Pixel, type Raster } from './raster.js';
import { decimalsOf, formatCompact, formatNumber } from './scale.js';
import { drawText, textWidth } from './text.js';
import { easeOutCubic, ramp, whenParam, type When } from './timing.js';

const chartParams = z.object({
  csv: z
    .string()
    .optional()
    .describe(
      'Pasted CSV/TSV: optional header, first column = labels, other columns = series; an `at` (seconds) or `say` (phrase) column times each row',
    ),
  values: z.array(z.number()).max(40).optional().describe('One series of numbers (instead of csv)'),
  series: z
    .array(z.object({ name: z.string().max(20), values: z.array(z.number()).max(40) }))
    .max(4)
    .optional()
    .describe('Several named series (instead of csv/values)'),
  labels: z
    .array(z.string().max(24))
    .max(40)
    .optional()
    .describe('Category labels for values/series'),
  type: z
    .enum(CHART_TYPES)
    .default('bar')
    .describe('bar, line, area or hbar (ranking with long labels)'),
  at: z
    .array(whenParam)
    .max(40)
    .optional()
    .describe('Reveal time of each datum (seconds or phrases)'),
  start: z.number().default(0.4).describe('Reveal of the first datum when no times are given'),
  stagger: z.number().min(0).default(0.35).describe('Seconds between data without own times'),
  grow: z.number().min(0).default(0.5).describe('Seconds a bar/segment takes to grow'),
  min: z.number().optional().describe('Value axis minimum (default: 0 for bars, auto for lines)'),
  max: z.number().optional().describe('Value axis maximum (default: auto)'),
  prefix: z.string().max(4).default('').describe('Before values, e.g. "$"'),
  suffix: z.string().max(6).default('').describe('After values, e.g. "%" or "M"'),
  decimals: z.int().min(0).max(3).optional().describe('Value decimals (default: as in the data)'),
  valueLabels: z.boolean().default(true).describe('Letter each value next to its bar/point'),
  unit: z.string().max(20).default('').describe('Caption of the value axis, e.g. "UNITS SOLD"'),
  color: z.string().optional().describe('Palette name of a single series (default accent)'),
  highlight: z
    .object({
      item: z.union([z.int().min(0), z.string()]).describe('Datum index or label'),
      at: whenParam,
    })
    .optional()
    .describe('Marks one datum in the hot colour from `at` on (the punchline)'),
});

type ChartParams = z.output<typeof chartParams>;

function chartData(params: ChartParams): ChartData {
  if (params.csv !== undefined) return chartDataFromCsv(params.csv);
  return chartDataFromArrays(params);
}

interface ChartState {
  readonly data: ChartData;
  readonly times: readonly number[];
  readonly highlight: { readonly index: number; readonly at: number } | undefined;
  readonly decimals: number;
  readonly colors: readonly Pixel[];
}

function prepare(params: ChartParams, context: BoardContext): ChartState {
  const data = chartData(params);
  const rowTimes: readonly (When | undefined)[] = params.at ?? data.at ?? [];
  const times = data.labels.map((_, index) =>
    context.resolve(rowTimes[index], params.start + index * params.stagger),
  );
  let highlight: ChartState['highlight'];
  if (params.highlight) {
    const { item } = params.highlight;
    const index =
      typeof item === 'number' ? item : data.labels.findIndex((label) => label === item);
    if (index < 0 || index >= data.labels.length) {
      throw new KitError(
        'invalid-params',
        `kit.fx.blueprintChart(): highlight item ${JSON.stringify(item)} is not a datum (labels: ${data.labels.join(', ')})`,
      );
    }
    highlight = { index, at: context.resolve(params.highlight.at, 0) };
  }
  const values = data.series
    .flatMap((series) => series.values)
    .filter((v): v is number => v !== null);
  const { theme } = context;
  const colors =
    data.series.length === 1 && params.color !== undefined
      ? [theme.color(params.color)]
      : theme.series;
  return { data, times, highlight, decimals: params.decimals ?? decimalsOf(values), colors };
}

function paintAxes(
  raster: Raster,
  context: BoardContext,
  layout: ChartLayout,
  horizontal: boolean,
  k: number,
): void {
  const { theme } = context;
  const { plot, scale } = layout;
  for (const tick of scale.ticks) {
    const at = Math.round(layout.position(tick));
    const label = formatCompact(tick);
    if (horizontal) {
      raster.line(at, plot.y, at, plot.y + plot.height, theme.grid, { dash: [1, 2], progress: k });
      drawText(raster, [label], at, plot.y + plot.height + context.px(4), {
        scale: layout.tickScale,
        color: theme.dim,
        align: 'center',
      });
    } else {
      raster.line(plot.x, at, plot.x + plot.width, at, theme.dim, { dash: [1, 2], progress: k });
      drawText(raster, [label], plot.x - context.px(6), at, {
        scale: layout.tickScale,
        color: theme.dim,
        align: 'right',
        valign: 'middle',
      });
    }
  }
  const base = Math.round(layout.position(Math.max(scale.min, Math.min(scale.max, 0))));
  if (horizontal) {
    raster.line(base, plot.y, base, plot.y + plot.height * k, theme.ink, { width: 1 });
  } else {
    raster.line(plot.x, plot.y + plot.height, plot.x, plot.y + plot.height * (1 - k), theme.ink);
    raster.line(plot.x, base, plot.x + plot.width * k, base, theme.ink);
  }
}

function paintBar(
  raster: Raster,
  x: number,
  y0: number,
  y1: number,
  width: number,
  color: Pixel,
  solid: boolean,
  paper: Pixel,
): void {
  const top = Math.min(y0, y1);
  const height = Math.abs(y1 - y0);
  if (height < 1) return;
  if (!solid) raster.rect(x, top, width, height, paper);
  raster.rect(x, top, width, height, color, solid ? undefined : PATTERNS.checker);
  raster.frame(x, top, width, height, color);
}

function paintHbar(
  raster: Raster,
  x0: number,
  x1: number,
  y: number,
  height: number,
  color: Pixel,
  solid: boolean,
  paper: Pixel,
): void {
  const left = Math.min(x0, x1);
  const width = Math.abs(x1 - x0);
  if (width < 1) return;
  if (!solid) raster.rect(left, y, width, height, paper);
  raster.rect(left, y, width, height, color, solid ? undefined : PATTERNS.checker);
  raster.frame(left, y, width, height, color);
}

function paintLegend(
  raster: Raster,
  context: BoardContext,
  state: ChartState,
  area: Area,
  scale: number,
): void {
  let x = area.x + area.width;
  for (let index = state.data.series.length - 1; index >= 0; index -= 1) {
    const name = state.data.series[index]?.name ?? '';
    const width = textWidth(name, scale);
    x -= width;
    drawText(raster, [name], x, area.y, { scale, color: context.theme.ink });
    const box = context.px(7);
    x -= box + context.px(4);
    raster.rect(
      x,
      area.y,
      box,
      box,
      state.colors[index % state.colors.length] ?? context.theme.accent,
    );
    x -= context.px(14);
  }
}

function createPainter(params: ChartParams, context: BoardContext): Painter {
  const state = prepare(params, context);
  const { theme } = context;
  const horizontal = params.type === 'hbar';
  let cached: { area: Area; layout: ChartLayout } | undefined;
  const layoutFor = (area: Area): ChartLayout => {
    if (
      cached?.area.width !== area.width ||
      cached.area.height !== area.height ||
      cached.area.y !== area.y
    ) {
      const layout = chartLayout(state.data, area, {
        ...params,
        s: context.s,
        decimals: state.decimals,
      });
      cached = { area, layout };
    }
    return cached.layout;
  };
  return (raster, t, area) => {
    const layout = layoutFor(area);
    const first = Math.min(...state.times);
    const axes = easeOutCubic(ramp(t, Math.max(0, first - 0.7), 0.6));
    if (layout.legend > 0) paintLegend(raster, context, state, area, layout.tickScale);
    paintAxes(raster, context, layout, horizontal, axes);
    if (params.unit.length > 0) {
      drawText(
        raster,
        [params.unit],
        layout.plot.x + context.px(4),
        layout.plot.y - context.px(2),
        {
          scale: layout.tickScale,
          color: theme.dim,
          valign: 'bottom',
        },
      );
    }
    const base = layout.position(Math.max(layout.scale.min, Math.min(layout.scale.max, 0)));
    const seriesCount = state.data.series.length;
    state.data.labels.forEach((label, index) => {
      const k = easeOutCubic(ramp(t, state.times[index] ?? 0, params.grow));
      const centre = layout.centres[index] ?? 0;
      if (k > 0 && index % layout.labelStep === 0) {
        raster.faded(Math.min(1, k * 2), () => {
          if (horizontal) {
            drawText(raster, [label], layout.plot.x - context.px(12), centre, {
              scale: layout.labelScale,
              color: theme.ink,
              align: 'right',
              valign: 'middle',
            });
          } else {
            drawText(raster, [label], centre, layout.plot.y + layout.plot.height + context.px(8), {
              scale: layout.labelScale,
              color: theme.ink,
              align: 'center',
            });
          }
        });
      }
      if (k <= 0) return;
      const hot = state.highlight?.index === index && t >= state.highlight.at;
      state.data.series.forEach((series, seriesIndex) => {
        const value = series.values[index];
        if (value === null || value === undefined) return;
        const color = hot
          ? theme.hot
          : (state.colors[seriesIndex % state.colors.length] ?? theme.accent);
        const end = base + (layout.position(value) - base) * k;
        const text = formatNumber(value * k, state.decimals, params.prefix, params.suffix);
        if (params.type === 'bar' || horizontal) {
          const offset = (seriesIndex - (seriesCount - 1) / 2) * layout.barWidth;
          const along = Math.round(centre + offset - layout.barWidth / 2);
          if (horizontal)
            paintHbar(raster, base, end, along, layout.barWidth, color, hot, theme.paper);
          else paintBar(raster, along + 1, base, end, layout.barWidth - 2, color, hot, theme.paper);
          if (!params.valueLabels) return;
          const labelScale = hot
            ? layout.valueScale + (layout.valueScale > 1 ? 0 : 1)
            : layout.valueScale;
          if (horizontal) {
            drawText(raster, [text], end + context.px(6), along + layout.barWidth / 2, {
              scale: labelScale,
              color: hot ? theme.hot : theme.ink,
              valign: 'middle',
            });
          } else {
            drawText(
              raster,
              [text],
              along + layout.barWidth / 2,
              Math.min(base, end) - context.px(5),
              {
                scale: labelScale,
                color: hot ? theme.hot : theme.ink,
                align: 'center',
                valign: 'bottom',
                plate: theme.paper,
                pad: 1,
              },
            );
          }
        }
      });
    });
    if (params.type === 'line' || params.type === 'area')
      paintLines(raster, context, state, layout, params, t, base);
  };
}

function paintLines(
  raster: Raster,
  context: BoardContext,
  state: ChartState,
  layout: ChartLayout,
  params: ChartParams,
  t: number,
  base: number,
): void {
  const { theme } = context;
  state.data.series.forEach((series, seriesIndex) => {
    const color = state.colors[seriesIndex % state.colors.length] ?? theme.accent;
    const points: [number, number][] = [];
    series.values.forEach((value, index) => {
      if (value === null) return;
      const begin = state.times[index] ?? 0;
      const k = ramp(t, begin, params.grow);
      if (k <= 0) return;
      const x = layout.centres[index] ?? 0;
      const y = layout.position(value);
      const previous = points.at(-1);
      if (previous && k < 1)
        points.push([previous[0] + (x - previous[0]) * k, previous[1] + (y - previous[1]) * k]);
      else points.push([x, y]);
    });
    if (points.length === 0) return;
    if (params.type === 'area' && points.length > 1) {
      const last = points.at(-1) ?? [0, 0];
      const firstPoint = points[0] ?? [0, 0];
      raster.polygon([[...points, [last[0], base], [firstPoint[0], base]]], color, PATTERNS.dots);
    }
    raster.polyline(points, color, { width: Math.max(1, context.px(2)) });
    series.values.forEach((value, index) => {
      if (value === null) return;
      const k = ramp(t, state.times[index] ?? 0, params.grow);
      if (k < 1) return;
      const x = layout.centres[index] ?? 0;
      const y = layout.position(value);
      const hot = state.highlight?.index === index && t >= state.highlight.at;
      const size = context.px(hot ? 9 : 6) | 1;
      raster.dot(x, y, size, hot ? theme.hot : theme.ink);
      raster.dot(x, y, Math.max(1, size - 2), hot ? theme.hot : color);
      const last = index === series.values.length - 1;
      if (!params.valueLabels || (state.data.series.length > 1 && !last && !hot)) return;
      drawText(
        raster,
        [formatNumber(value, state.decimals, params.prefix, params.suffix)],
        x,
        y - context.px(8),
        {
          scale: hot ? layout.valueScale + 1 : layout.valueScale,
          color: hot ? theme.hot : theme.ink,
          align: 'center',
          valign: 'bottom',
          plate: theme.paper,
          pad: 1,
        },
      );
    });
  });
}

export const blueprintChart = defineBoard({
  name: 'blueprintChart',
  description:
    'Blueprint data chart (bar, line, area, hbar) from a pasted CSV string or arrays; each datum appears on its own time or spoken phrase (`at`, or an `at`/`say` CSV column with anchor: ctx.anchor), values count up, `highlight` marks the punchline datum. Full-frame 2D board: call update(t) every frame.',
  params: chartParams.extend(boardParams),
  setup: (params, context) => createPainter(params, context),
});
