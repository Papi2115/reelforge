/**
 * Infographic layouts made of lists: `icons` (a row or grid of icon badges with captions, joined
 * by a connector that draws on as the steps appear) and `progress` (labelled bars filling to their
 * values with the number counting up).
 */
import type { BoardContext, Box } from './board.js';
import { drawIcon, iconExtent, type IconStyle } from './icons.js';
import {
  countUp,
  paintTitle,
  valueText,
  type InfoLayout,
  type InfoSettings,
  type Scheduled,
} from './info-common.js';
import { drawText, textHeight, textWidth } from './text.js';
import { easeOutBack, easeOutCubic, ramp } from './timing.js';

const POP_S = 0.4;

/** Icon badges in a row (<= 4 items) or a grid, with captions and optional values. */
export function iconsLayout(
  items: readonly Scheduled[],
  settings: InfoSettings,
  context: BoardContext,
  columnsParam: number | undefined,
): InfoLayout {
  const { theme, px, textScale } = context;
  const columns = columnsParam ?? (items.length <= 4 ? items.length : Math.ceil(items.length / 2));
  const rows = Math.ceil(items.length / columns);
  const cell = textScale(rows > 1 ? 2 : columns <= 3 ? 4 : 3);
  const pitchX = Math.min(px(150), Math.floor(px(560) / columns));
  const pitchY = px(rows > 1 ? 120 : 150);
  const extent = iconExtent({ cell, badge: 'circle' });
  const hasValue = items.some((entry) => entry.item.value !== undefined);
  const block =
    (rows - 1) * pitchY +
    extent +
    px(10) +
    textHeight(1, textScale(2)) +
    (hasValue ? textHeight(1, textScale(3)) + px(6) : 0);
  const free = px(settings.title.length > 0 ? 80 : 30);
  const top = Math.round(free + (px(335) - free - block) / 2);
  const anchors: Record<string, Box> = {};
  const placed = items.map((entry) => {
    const column = entry.index % columns;
    const row = Math.floor(entry.index / columns);
    const inRow = Math.min(columns, items.length - row * columns);
    const cx = Math.round(context.width / 2 + (column - (inRow - 1) / 2) * pitchX);
    const style: IconStyle = {
      cell,
      main: theme.light,
      accent: theme.dark,
      badge: 'circle',
      badgeColor: entry.color,
    };
    const cy = top + row * pitchY + Math.round(extent / 2);
    anchors[`item:${String(entry.index)}`] = {
      x: cx - extent / 2,
      y: cy - extent / 2,
      width: extent,
      height: extent,
    };
    return { entry, cx, cy, style, extent, row };
  });
  return {
    anchors,
    paint: (raster, t) => {
      paintTitle(raster, context, settings.title, t);
      if (settings.connect) {
        placed.forEach((current, index) => {
          const next = placed[index + 1];
          if (next === undefined || next.row !== current.row) return;
          const k = easeOutCubic(
            ramp(t, current.entry.at + 0.1, Math.max(0.2, next.entry.at - current.entry.at)),
          );
          const x0 = current.cx + current.extent / 2 + px(6);
          const x1 = next.cx - next.extent / 2 - px(6);
          const reach = Math.round((x1 - x0) * k);
          for (let x = x0; x < x0 + reach; x += px(8)) {
            raster.rect(x, current.cy - px(2), Math.min(px(4), x0 + reach - x), px(4), theme.dim);
          }
        });
      }
      for (const { entry, cx, cy, style, extent } of placed) {
        if (t < entry.at) continue;
        const k = ramp(t, entry.at, POP_S);
        const zoom = Math.max(0, easeOutBack(k));
        drawIcon(raster, theme, entry.item.icon ?? 'star', cx, cy, style, zoom);
        const shown = ramp(t, entry.at + 0.15, 0.3);
        if (shown <= 0) continue;
        let y = cy + extent / 2 + px(10);
        raster.faded(shown, () => {
          if (entry.item.value !== undefined) {
            const value = countUp(entry.item.value, t, entry.at, settings.duration);
            drawText(raster, [valueText(value, settings)], cx, y, {
              scale: textScale(3),
              color: entry.color,
              bold: true,
              align: 'center',
            });
            y += textHeight(1, textScale(3)) + px(6);
          }
          drawText(raster, [entry.item.label], cx, y, {
            scale: textScale(2),
            color: theme.ink,
            align: 'center',
          });
        });
      }
    },
  };
}

/** Labelled horizontal bars filling to value / max, numbers counting up at the end. */
export function progressLayout(
  items: readonly Scheduled[],
  settings: InfoSettings,
  context: BoardContext,
): InfoLayout {
  const { theme, px, textScale } = context;
  const labelScale = textScale(2);
  const labelWidth = Math.max(...items.map((entry) => textWidth(entry.item.label, labelScale)));
  const barHeight = px(18);
  const pitch = px(items.length > 4 ? 44 : 54);
  const left = px(48);
  const trackX = left + labelWidth + px(16);
  const trackWidth = context.width - trackX - px(130);
  const titleSpace = settings.title.length > 0 ? px(70) : 0;
  const top = Math.round(titleSpace + (context.height - titleSpace - pitch * items.length) / 2);
  const anchors: Record<string, Box> = {};
  items.forEach((_entry, index) => {
    anchors[`item:${String(index)}`] = {
      x: trackX,
      y: top + index * pitch,
      width: trackWidth,
      height: barHeight,
    };
  });
  return {
    anchors,
    paint: (raster, t) => {
      paintTitle(raster, context, settings.title, t);
      items.forEach((entry, index) => {
        if (t < entry.at) return;
        const y = top + index * pitch;
        const shown = ramp(t, entry.at, 0.25);
        raster.faded(shown, () => {
          drawText(raster, [entry.item.label], trackX - px(12), y + barHeight / 2, {
            scale: labelScale,
            color: theme.ink,
            align: 'right',
            valign: 'middle',
          });
          raster.rect(trackX, y, trackWidth, barHeight, theme.shade);
        });
        const target = Math.max(0, Math.min(1, (entry.item.value ?? 0) / settings.max));
        const fill = Math.round(
          trackWidth * target * easeOutCubic(ramp(t, entry.at + 0.15, settings.duration)),
        );
        raster.rect(trackX, y, fill, barHeight, entry.color);
        if (fill > 0) {
          const value = countUp(entry.item.value ?? 0, t, entry.at + 0.15, settings.duration);
          drawText(
            raster,
            [valueText(value, settings)],
            trackX + fill + px(10),
            y + barHeight / 2,
            {
              scale: textScale(3),
              color: settings.highlight === index ? theme.primary : theme.ink,
              bold: true,
              valign: 'middle',
            },
          );
        }
      });
    },
  };
}
