/**
 * Flat-2d icons: the 16x16 bitmaps (icon-bitmaps-*.ts) drawn at an integer cell size in palette
 * roles, optionally on a flat badge with a drop shadow, and `kit.fx.flatIcons`, a board of
 * free-placed icons that enter on their cues (or the whole set as a labelled sheet).
 */
import { z } from 'zod';
import { KitError } from '../../errors.js';
import {
  boardParams,
  defineBoard,
  type BoardContext,
  type BoardContent,
  type Box,
} from './board.js';
import { ICONS_A } from './icon-bitmaps-a.js';
import { ICONS_B } from './icon-bitmaps-b.js';
import { ICON_CELLS, type IconBitmap } from './icon-types.js';
import { motionFields, motionPose, resolveMotion, type Pose } from './motion.js';
import type { Pixel, Raster } from './raster.js';
import { drawText } from './text.js';
import type { Theme } from './theme.js';

export const ICONS: Readonly<Record<string, IconBitmap>> = { ...ICONS_A, ...ICONS_B };
export const ICON_NAMES = Object.keys(ICONS) as [string, ...string[]];

export const iconNameParam = z.enum(ICON_NAMES).describe('Icon name');

export const BADGES = ['circle', 'square', 'none'] as const;
export type Badge = (typeof BADGES)[number];

export interface IconStyle {
  /** Screen pixels per icon cell. */
  readonly cell: number;
  readonly main: Pixel;
  readonly accent: Pixel;
  readonly badge: Badge;
  readonly badgeColor: Pixel;
}

/** Edge of an icon's badge (or of the icon itself without a badge) in pixels. */
export function iconExtent(style: Pick<IconStyle, 'cell' | 'badge'>): number {
  const size = ICON_CELLS * style.cell;
  return style.badge === 'none' ? size : Math.round(size * 1.45);
}

function cellColor(char: string, style: IconStyle, theme: Theme): Pixel | undefined {
  switch (char) {
    case '#':
      return style.main;
    case '+':
      return style.accent;
    case '*':
      return theme.gold;
    case 'o':
      return theme.light;
    case 'x':
      return theme.dark;
    default:
      return undefined;
  }
}

/** Draws icon `name` centred on (cx, cy); `zoom` scales it about its centre (pop-ins). */
export function drawIcon(
  raster: Raster,
  theme: Theme,
  name: string,
  cx: number,
  cy: number,
  style: IconStyle,
  zoom = 1,
): void {
  const bitmap = ICONS[name];
  if (bitmap === undefined || zoom <= 0) return;
  const extent = iconExtent(style) * zoom;
  const shadow = Math.max(1, Math.round(style.cell * 0.75));
  if (style.badge === 'circle') {
    raster.ellipse(cx + shadow, cy + shadow, extent / 2, extent / 2, theme.shade);
    raster.ellipse(cx, cy, extent / 2, extent / 2, style.badgeColor);
  } else if (style.badge === 'square') {
    const half = extent / 2;
    raster.rect(cx - half + shadow, cy - half + shadow, extent, extent, theme.shade);
    raster.rect(cx - half, cy - half, extent, extent, style.badgeColor);
  }
  const size = ICON_CELLS * style.cell;
  const left = Math.round(cx - size / 2);
  const top = Math.round(cy - size / 2);
  const map = (value: number, center: number): number =>
    Math.round(center + (value - center) * zoom);
  bitmap.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x += 1) {
      const color = cellColor(row[x] ?? '.', style, theme);
      if (color === undefined) continue;
      const x0 = map(left + x * style.cell, cx);
      const y0 = map(top + y * style.cell, cy);
      raster.rect(
        x0,
        y0,
        map(left + (x + 1) * style.cell, cx) - x0,
        map(top + (y + 1) * style.cell, cy) - y0,
        color,
      );
    }
  });
}

/** Draws an element with a pose: offset, dither coverage and zoom (icons do not rotate). */
export function withPose(
  raster: Raster,
  pose: Pose,
  draw: (dx: number, dy: number, zoom: number) => void,
): void {
  if (!pose.visible) return;
  raster.faded(pose.level, () => {
    draw(Math.round(pose.dx), Math.round(pose.dy), pose.scale);
  });
}

const iconItem = z.object({
  name: iconNameParam,
  x: z.number().default(320).describe('Centre x in 640x360-frame pixels'),
  y: z.number().default(180).describe('Centre y in 640x360-frame pixels'),
  scale: z.int().min(1).max(10).default(4).describe('Pixels per icon cell (4 = 64-px icon)'),
  color: z.string().optional().describe('Main colour (role or palette name; default per icon)'),
  accent: z.string().optional().describe('Accent colour (default per icon)'),
  badge: z.enum(BADGES).default('circle').describe('Flat badge behind the icon'),
  badgeColor: z.string().default('card').describe('Badge colour (role or palette name)'),
  label: z.string().max(18).default('').describe('Caption under the icon'),
  ...motionFields,
});

const iconsParams = z
  .object({
    icons: z.array(iconItem).max(12).default([]).describe('Icons to place (at most ~6 on screen)'),
    sheet: z
      .boolean()
      .default(false)
      .describe('Show every icon of the set in a labelled grid (reference sheet)'),
    start: z.number().default(0.3).describe('First entrance when an icon has no `at` (s)'),
    stagger: z.number().min(0).default(0.2).describe('Seconds between default entrances'),
  })
  .extend(boardParams('dots'));

type IconsParams = z.output<typeof iconsParams>;

function sheetItems(): IconsParams['icons'] {
  const columns = 9;
  return ICON_NAMES.map((name, index) => ({
    name,
    x: 52 + (index % columns) * 67,
    y: 58 + Math.floor(index / columns) * 112,
    scale: 3,
    badge: 'none' as const,
    badgeColor: 'card',
    label: name.toUpperCase(),
    at: 0,
    enter: 'none' as const,
  }));
}

function setupIcons(params: IconsParams, context: BoardContext): BoardContent {
  const { theme, px, resolve } = context;
  const items = params.sheet ? sheetItems() : params.icons;
  if (items.length === 0) {
    throw new KitError('invalid-params', `${context.call}: give icons [...] or sheet: true`);
  }
  const anchors: Record<string, Box> = {};
  const placed = items.map((item, index) => {
    const bitmap = ICONS[item.name];
    const cell = context.textScale(item.scale);
    const style: IconStyle = {
      cell,
      main: theme.color(item.color ?? bitmap?.main ?? 'primary'),
      accent: theme.color(item.accent ?? bitmap?.accent ?? 'secondary'),
      badge: item.badge,
      badgeColor: theme.color(item.badgeColor),
    };
    const extent = iconExtent(style);
    const cx = px(item.x);
    const cy = px(item.y);
    const box = { x: cx - extent / 2, y: cy - extent / 2, width: extent, height: extent };
    anchors[`icon:${String(index)}`] = box;
    anchors[`icon:${item.name}`] ??= box;
    const motion = resolveMotion(item, index, resolve, {
      at: params.start + index * params.stagger,
      enter: 'pop',
      duration: 0.4,
      distance: px(60),
    });
    return { item, style, cx, cy, extent, motion };
  });
  return {
    anchors,
    paint: (raster, t) => {
      for (const { item, style, cx, cy, extent, motion } of placed) {
        withPose(raster, motionPose(t, motion), (dx, dy, zoom) => {
          drawIcon(raster, theme, item.name, cx + dx, cy + dy, style, zoom);
          if (item.label.length === 0) return;
          drawText(raster, [item.label], cx + dx, cy + dy + extent / 2 + px(10), {
            scale: context.textScale(params.sheet ? 1 : 2),
            color: theme.ink,
            align: 'center',
          });
        });
      }
    },
  };
}

export const flatIcons = defineBoard({
  name: 'flatIcons',
  description:
    'Flat 2D pixel icons (16x16 cells: person, gear, lightbulb, lock, cloud, phone, chart, star, arrow, check, cross, heart, clock, globe, magnifier, document, envelope, battery, wifi, coin, rocket, shield, camera, play, bolt, flag) on flat badges, placed freely and entering on cues (pop, slide, drop...). Full-frame 2D board: call update(t) every frame.',
  params: iconsParams,
  targets: 'icon:<i> (each icon in order), icon:<name>',
  setup: (params, context) => setupIcons(params, context),
});
