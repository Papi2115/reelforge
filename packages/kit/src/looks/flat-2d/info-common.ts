/**
 * Shared parts of `kit.fx.flatInfographic`: the item schema, number formatting and the count-up,
 * the heading, cards and the scheduled entrance of each item.
 */
import { z } from 'zod';
import type { BoardContext, Box } from './board.js';
import { iconNameParam } from './icons.js';
import type { Pixel, Raster } from './raster.js';
import { drawText, fitScale, textHeight, textWidth } from './text.js';
import { easeOutCubic, ramp, whenParam } from './timing.js';

export const INFO_KINDS = ['icons', 'progress', 'ring', 'versus', 'stat'] as const;
export type InfoKind = (typeof INFO_KINDS)[number];

export const infoItem = z.object({
  label: z.string().max(24).default('').describe('Caption'),
  value: z.number().optional().describe('Number (progress/ring: of `max`; stat/versus: shown)'),
  icon: iconNameParam.optional(),
  color: z.string().optional().describe('Role or palette name (default: accents in turn)'),
  at: whenParam.optional().describe('When it appears (default: staggered)'),
});

export type InfoItem = z.output<typeof infoItem>;

/** What every infographic layout needs besides its items. */
export interface InfoSettings {
  readonly title: string;
  readonly prefix: string;
  readonly suffix: string;
  readonly decimals: number;
  readonly max: number;
  /** Count-up / fill length (s). */
  readonly duration: number;
  readonly connect: boolean;
  readonly highlight: number | undefined;
}

/** An item with its resolved entrance time and colour. */
export interface Scheduled {
  readonly item: InfoItem;
  readonly at: number;
  readonly color: Pixel;
  readonly index: number;
}

export type InfoPainter = (raster: Raster, t: number) => void;

export interface InfoLayout {
  readonly paint: InfoPainter;
  readonly anchors: Readonly<Record<string, Box>>;
}

const SERIES = ['primary', 'secondary', 'tertiary', 'good', 'gold'] as const;

export function schedule(
  items: readonly InfoItem[],
  context: BoardContext,
  start: number,
  stagger: number,
): Scheduled[] {
  return items.map((item, index) => ({
    item,
    index,
    at: context.resolve(item.at, start + index * stagger),
    color: context.theme.color(item.color ?? SERIES[index % SERIES.length] ?? 'primary'),
  }));
}

/** 1234567.8 -> "1,234,567.8" (`decimals` digits after the point). */
export function formatNumber(value: number, decimals: number): string {
  const fixed = Math.abs(value).toFixed(decimals);
  const [whole = '0', fraction] = fixed.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${value < 0 ? '-' : ''}${grouped}${fraction === undefined ? '' : `.${fraction}`}`;
}

/** The number shown at t while counting from 0 to `value` (eased over `duration`). */
export function countUp(value: number, t: number, at: number, duration: number): number {
  return value * easeOutCubic(ramp(t, at, duration));
}

/** Bold heading centred at the top with an accent rule; returns the y below it. */
export function paintTitle(
  raster: Raster,
  context: BoardContext,
  title: string,
  t: number,
): number {
  if (title.length === 0) return context.px(28);
  const scale = fitScale(title, context.px(560), context.textScale(3), true);
  const y = context.px(28);
  drawText(raster, [title], context.width / 2, y, {
    scale,
    color: context.theme.ink,
    bold: true,
    align: 'center',
  });
  const below = y + textHeight(1, scale) + context.px(8);
  const rule = Math.round(textWidth(title, scale, true) * easeOutCubic(ramp(t, 0.1, 0.5)));
  raster.rect(context.width / 2 - rule / 2, below, rule, context.px(3), context.theme.primary);
  return below + context.px(14);
}

/** Flat card with a drop shadow. */
export function paintCard(raster: Raster, context: BoardContext, box: Box, color: Pixel): void {
  const shadow = context.px(5);
  raster.rect(box.x + shadow, box.y + shadow, box.width, box.height, context.theme.shade);
  raster.rect(box.x, box.y, box.width, box.height, color);
}

/** Value text with prefix/suffix. */
export function valueText(value: number, settings: InfoSettings): string {
  return `${settings.prefix}${formatNumber(value, settings.decimals)}${settings.suffix}`;
}
