/**
 * Layout of the blueprint charts (pure, unit-tested): plot rectangle, value scale, datum
 * positions and text sizes that fit, for vertical charts (bar, line, area) and horizontal bars.
 */
import type { ChartData } from './csv.js';
import type { Area } from './paper.js';
import { formatCompact, formatNumber, niceScale, type NiceScale } from './scale.js';
import { textHeight, textWidth } from './text.js';

export const CHART_TYPES = ['bar', 'line', 'area', 'hbar'] as const;
export type ChartType = (typeof CHART_TYPES)[number];

export interface ChartLayoutOptions {
  readonly type: ChartType;
  /** Raster px per reference px. */
  readonly s: number;
  readonly min?: number | undefined;
  readonly max?: number | undefined;
  readonly decimals: number;
  readonly prefix: string;
  readonly suffix: string;
}

export interface ChartLayout {
  readonly plot: Area;
  readonly scale: NiceScale;
  /** Centre of each datum along the category axis (x for vertical charts, y for hbar). */
  readonly centres: readonly number[];
  /** Pixels per datum along the category axis. */
  readonly band: number;
  /** Thickness of one bar (grouped bars share the band). */
  readonly barWidth: number;
  readonly labelScale: number;
  /** Every n-th category label is shown (crowded axes). */
  readonly labelStep: number;
  readonly valueScale: number;
  readonly tickScale: number;
  /** Legend row height (0 for one series). */
  readonly legend: number;
  /** Value -> pixel along the value axis. */
  position(value: number): number;
}

function scaleFor(s: number, reference: number): number {
  return Math.max(1, Math.round(reference * s));
}

function valueRange(data: ChartData, type: ChartType): [number, number] {
  const values = data.series
    .flatMap((series) => series.values)
    .filter((v): v is number => v !== null);
  const low = Math.min(...values);
  const high = Math.max(...values);
  // Bars grow from zero; lines may float.
  if (type === 'bar' || type === 'hbar' || type === 'area')
    return [Math.min(0, low), Math.max(0, high)];
  const pad = (high - low) * 0.1 || Math.abs(high) * 0.1 || 1;
  return [low - pad, high + pad];
}

/** Largest text scale (2 or 1) at which the widest of `texts` fits `room`; and the label step. */
function fitLabels(
  texts: readonly string[],
  room: number,
  s: number,
): { scale: number; step: number } {
  const big = scaleFor(s, 2);
  const widest = (scale: number): number =>
    Math.max(0, ...texts.map((text) => textWidth(text, scale)));
  for (const scale of [big, scaleFor(s, 1)]) {
    if (widest(scale) <= room) return { scale, step: 1 };
  }
  const small = scaleFor(s, 1);
  return { scale: small, step: Math.max(1, Math.ceil(widest(small) / Math.max(1, room))) };
}

export function chartLayout(data: ChartData, area: Area, options: ChartLayoutOptions): ChartLayout {
  const { s, type } = options;
  const count = data.labels.length;
  const [low, high] = valueRange(data, type);
  const scale = niceScale(low, high, 4, { min: options.min, max: options.max });
  const tickScale = scaleFor(s, 1);
  const legend = data.series.length > 1 ? textHeight(1, tickScale) + Math.round(10 * s) : 0;
  const values = data.series
    .flatMap((series) => series.values)
    .filter((v): v is number => v !== null);
  const valueTexts = values.map((v) =>
    formatNumber(v, options.decimals, options.prefix, options.suffix),
  );
  const gap = Math.round(6 * s);
  if (type === 'hbar') {
    const ticks = textHeight(1, tickScale) + gap;
    const band = (area.height - legend - ticks) / Math.max(1, count);
    const labels = fitLabels(data.labels, area.width * 0.3, s);
    const rowFits = textHeight(1, labels.scale) <= band * 0.8;
    const labelScale = rowFits ? labels.scale : scaleFor(s, 1);
    const labelWidth = Math.max(...data.labels.map((label) => textWidth(label, labelScale)));
    const valueScale = textHeight(1, scaleFor(s, 2)) <= band * 0.8 ? scaleFor(s, 2) : tickScale;
    const valueWidth = Math.max(0, ...valueTexts.map((text) => textWidth(text, valueScale)));
    const plot = {
      x: area.x + labelWidth + gap * 2,
      y: area.y + legend,
      width: area.width - labelWidth - valueWidth - gap * 4,
      height: area.height - legend - ticks,
    };
    return {
      plot,
      scale,
      centres: data.labels.map((_, index) => plot.y + band * (index + 0.5)),
      band,
      barWidth: Math.max(2, Math.floor((band * 0.6) / data.series.length)),
      labelScale,
      labelStep: 1,
      valueScale,
      tickScale,
      legend,
      position: (value) => plot.x + ((value - scale.min) / (scale.max - scale.min)) * plot.width,
    };
  }
  const tickWidth = Math.max(
    ...scale.ticks.map((tick) => textWidth(formatCompact(tick), tickScale)),
  );
  const left = area.x + tickWidth + gap * 2;
  const band = (area.x + area.width - left) / Math.max(1, count);
  const labels = fitLabels(data.labels, band * 0.92, s);
  const big = scaleFor(s, 2);
  const valueScale =
    type === 'bar' && Math.max(0, ...valueTexts.map((text) => textWidth(text, big))) <= band * 1.05
      ? big
      : tickScale;
  const top = area.y + legend + textHeight(1, valueScale) + gap;
  const bottom = area.y + area.height - textHeight(1, labels.scale) - gap * 2;
  const plot = { x: left, y: top, width: area.x + area.width - left, height: bottom - top };
  return {
    plot,
    scale,
    centres: data.labels.map((_, index) => plot.x + band * (index + 0.5)),
    band,
    barWidth: Math.max(2, Math.floor((band * 0.62) / data.series.length)),
    labelScale: labels.scale,
    labelStep: labels.step,
    valueScale,
    tickScale,
    legend,
    position: (value) =>
      plot.y + plot.height - ((value - scale.min) / (scale.max - scale.min)) * plot.height,
  };
}
