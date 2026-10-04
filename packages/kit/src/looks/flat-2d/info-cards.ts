/**
 * Infographic layouts with big numbers: `ring` (1-3 donut gauges filling clockwise to value / max,
 * the number counting in the hole), `versus` (two cards sliding in from the sides with a VS badge
 * popping between them, the winner's number in its colour) and `stat` (1-3 stat cards with a big
 * count-up number, an icon and a caption).
 */
import type { BoardContext, Box } from './board.js';
import { drawIcon, type IconStyle } from './icons.js';
import {
  countUp,
  paintCard,
  paintTitle,
  valueText,
  type InfoLayout,
  type InfoSettings,
  type Scheduled,
} from './info-common.js';
import { placeRings, shapeRings } from './geometry.js';
import type { Point } from './raster.js';
import { drawText, fitScale, textHeight } from './text.js';
import { easeOutBack, easeOutCubic, ramp } from './timing.js';

/** Ring band from the top, clockwise over `share` (0..1) of the turn. */
function arcBand(cx: number, cy: number, outer: number, inner: number, share: number): Point[] {
  const steps = Math.max(2, Math.ceil(96 * share));
  const angle = (index: number): number => -Math.PI / 2 + (index / steps) * share * Math.PI * 2;
  const along = (radius: number, index: number): Point => [
    cx + Math.cos(angle(index)) * radius,
    cy + Math.sin(angle(index)) * radius,
  ];
  const outside = Array.from({ length: steps + 1 }, (_, index) => along(outer, index));
  const inside = Array.from({ length: steps + 1 }, (_, index) => along(inner, steps - index));
  return [...outside, ...inside];
}

function cardBoxes(count: number, context: BoardContext, top: number): Box[] {
  const { px } = context;
  const gap = px(24);
  const width = Math.min(
    px(count === 1 ? 400 : 250),
    Math.floor((px(560) - gap * (count - 1)) / count),
  );
  const height = Math.min(px(count === 1 ? 220 : 200), context.height - top - px(40));
  const left = Math.round((context.width - (width * count + gap * (count - 1))) / 2);
  const y = Math.round(top + (context.height - px(30) - top - height) / 2);
  return Array.from({ length: count }, (_, index) => ({
    x: left + index * (width + gap),
    y,
    width,
    height,
  }));
}

export function ringLayout(
  items: readonly Scheduled[],
  settings: InfoSettings,
  context: BoardContext,
): InfoLayout {
  const { theme, px, textScale } = context;
  const pitch = Math.floor(px(560) / items.length);
  const outer = Math.min(px(70), Math.floor(pitch / 2) - px(14));
  const inner = outer - Math.max(px(10), Math.round(outer * 0.26));
  const cy = px(settings.title.length > 0 ? 180 : 165);
  const anchors: Record<string, Box> = {};
  const placed = items.map((entry) => {
    const cx = Math.round(context.width / 2 + (entry.index - (items.length - 1) / 2) * pitch);
    anchors[`item:${String(entry.index)}`] = {
      x: cx - outer,
      y: cy - outer,
      width: outer * 2,
      height: outer * 2,
    };
    return { entry, cx };
  });
  return {
    anchors,
    paint: (raster, t) => {
      paintTitle(raster, context, settings.title, t);
      for (const { entry, cx } of placed) {
        if (t < entry.at) continue;
        const zoom = Math.max(0, easeOutBack(ramp(t, entry.at, 0.35)));
        const band = {
          w: outer * 2 * zoom,
          h: outer * 2 * zoom,
          round: 0,
          thickness: (outer - inner) * zoom,
        };
        raster.polygon(placeRings(shapeRings('ring', band), cx, cy, 1, 0), theme.shade);
        const target = Math.max(0, Math.min(1, (entry.item.value ?? 0) / settings.max));
        const share = target * easeOutCubic(ramp(t, entry.at + 0.25, settings.duration));
        if (share > 0.002) raster.polygon([arcBand(cx, cy, outer, inner, share)], entry.color);
        if (zoom < 1) continue;
        const value = countUp(entry.item.value ?? 0, t, entry.at + 0.25, settings.duration);
        const text = valueText(value, settings);
        const scale = fitScale(text, inner * 1.6, textScale(4), true);
        drawText(raster, [text], cx, cy, {
          scale,
          color: theme.ink,
          bold: true,
          align: 'center',
          valign: 'middle',
        });
        drawText(raster, [entry.item.label], cx, cy + outer + px(14), {
          scale: textScale(2),
          color: theme.ink,
          align: 'center',
        });
      }
    },
  };
}

export function versusLayout(
  items: readonly Scheduled[],
  settings: InfoSettings,
  context: BoardContext,
): InfoLayout {
  const { theme, px, textScale } = context;
  const top = px(settings.title.length > 0 ? 70 : 30);
  const boxes = cardBoxes(2, context, top).map((box, index) => ({
    ...box,
    x: index === 0 ? box.x - px(12) : box.x + px(12),
  }));
  const values = items.map((entry) => entry.item.value ?? 0);
  const winner =
    settings.highlight ??
    (values.length === 2 && values[0] !== values[1]
      ? (values[0] ?? 0) > (values[1] ?? 0)
        ? 0
        : 1
      : undefined);
  const lastAt = Math.max(...items.map((entry) => entry.at));
  const anchors: Record<string, Box> = {};
  boxes.forEach((box, index) => {
    anchors[`item:${String(index)}`] = box;
  });
  anchors['vs'] = { x: context.width / 2 - px(24), y: top + px(80), width: px(48), height: px(48) };
  return {
    anchors,
    paint: (raster, t) => {
      paintTitle(raster, context, settings.title, t);
      items.forEach((entry, index) => {
        const box = boxes[index];
        if (box === undefined || t < entry.at) return;
        const k = easeOutCubic(ramp(t, entry.at, 0.45));
        const slide = Math.round((1 - k) * px(220) * (index === 0 ? -1 : 1));
        const card = { ...box, x: box.x + slide };
        paintCard(raster, context, card, theme.card);
        raster.rect(card.x, card.y, card.width, px(6), entry.color);
        const cx = card.x + card.width / 2;
        const style: IconStyle = {
          cell: textScale(3),
          main: theme.light,
          accent: theme.dark,
          badge: 'circle',
          badgeColor: entry.color,
        };
        if (entry.item.icon !== undefined) {
          drawIcon(raster, theme, entry.item.icon, cx, card.y + px(52), style);
        }
        const value = countUp(entry.item.value ?? 0, t, lastAt + 0.4, settings.duration);
        const text = valueText(value, settings);
        const scale = fitScale(text, card.width - px(24), textScale(5), true);
        const won = winner === index && t >= lastAt + 0.4 + settings.duration;
        drawText(raster, [text], cx, card.y + px(112), {
          scale,
          color: won ? entry.color : theme.light,
          bold: true,
          align: 'center',
        });
        drawText(raster, [entry.item.label], cx, card.y + card.height - px(26), {
          scale: textScale(2),
          color: theme.muted,
          align: 'center',
        });
      });
      const vs = ramp(t, lastAt + 0.2, 0.35);
      if (vs > 0) {
        const zoom = Math.max(0, easeOutBack(vs));
        const r = px(26) * zoom;
        const cx = context.width / 2;
        const cy = top + px(104);
        raster.ellipse(cx + px(3), cy + px(3), r, r, theme.shade);
        raster.ellipse(cx, cy, r, r, theme.primary);
        drawText(raster, ['VS'], cx, cy, {
          scale: textScale(2),
          color: theme.dark,
          bold: true,
          align: 'center',
          valign: 'middle',
          zoom,
        });
      }
    },
  };
}

export function statLayout(
  items: readonly Scheduled[],
  settings: InfoSettings,
  context: BoardContext,
): InfoLayout {
  const { theme, px, textScale } = context;
  const top = px(settings.title.length > 0 ? 70 : 30);
  const boxes = cardBoxes(items.length, context, top);
  const anchors: Record<string, Box> = {};
  boxes.forEach((box, index) => {
    anchors[`item:${String(index)}`] = box;
  });
  const digits = textScale(items.length === 1 ? 8 : 5);
  return {
    anchors,
    paint: (raster, t) => {
      paintTitle(raster, context, settings.title, t);
      items.forEach((entry, index) => {
        const box = boxes[index];
        if (box === undefined || t < entry.at) return;
        const k = easeOutCubic(ramp(t, entry.at, 0.4));
        const card = { ...box, y: box.y + Math.round((1 - k) * px(40)) };
        raster.faded(Math.min(1, k * 3), () => {
          paintCard(raster, context, card, theme.card);
          raster.rect(card.x, card.y, px(6), card.height, entry.color);
        });
        const cx = card.x + card.width / 2;
        let y = card.y + px(20);
        if (entry.item.icon !== undefined) {
          const style: IconStyle = {
            cell: textScale(2),
            main: theme.light,
            accent: theme.dark,
            badge: 'circle',
            badgeColor: entry.color,
          };
          drawIcon(
            raster,
            theme,
            entry.item.icon,
            cx,
            y + px(26),
            style,
            Math.max(0, easeOutBack(k)),
          );
          y += px(62);
        }
        const value = countUp(entry.item.value ?? 0, t, entry.at + 0.2, settings.duration);
        const text = valueText(value, settings);
        const final = valueText(entry.item.value ?? 0, settings);
        const scale = fitScale(final, card.width - px(28), digits, true);
        const free = card.y + card.height - y - px(30);
        const numberY = y + Math.max(0, Math.round((free - textHeight(1, scale)) / 2));
        drawText(raster, [text], cx, numberY, {
          scale,
          color: entry.color,
          bold: true,
          align: 'center',
        });
        drawText(raster, [entry.item.label], cx, card.y + card.height - px(24), {
          scale: textScale(2),
          color: theme.light,
          align: 'center',
        });
      });
    },
  };
}
