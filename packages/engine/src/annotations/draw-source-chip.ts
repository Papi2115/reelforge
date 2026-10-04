/**
 * Source chip (PLAN.md#12.18, ADR-016): a small "SOURCE: NAME" plate in a corner of the safe
 * area, with an optional tiny reference number, crediting the source of a claim shown on B-roll.
 * The layer draws chips after every other mark (spotlights excepted), so the chip takes the first
 * corner that covers no text card or annotation; only when every corner is taken does it pick the
 * least covered one. Names never show URLs (a URL becomes its host) and are cut at a word.
 */
import { DISPLAY_FONT } from '../text/font-display.js';
import { MONO_FONT } from '../text/font-mono.js';
import type { PixelRect } from '../text/types.js';
import type { AnnotationDraw, AnnotationEnv } from './env.js';
import { drawLabel, measureLabel } from './label.js';
import type { ParsedSourceChip, SourceChipCorner } from './options.js';
import { bestSpot } from './placement.js';
import { grow, wipePaint } from './raster.js';

/** Corners tried by `auto`, in order (credits sit bottom right, like a news lower corner). */
export const SOURCE_CHIP_AUTO_ORDER = [
  'bottom-right',
  'bottom-left',
  'top-right',
  'top-left',
] as const satisfies readonly SourceChipCorner[];

const URL = /\bhttps?:\/\/(?:[^@/\s]*@)?([^/:?#\s]+)\S*/gi;
/** Pixels kept free around the chip when testing whether a corner is taken. */
const AIR = 2;

/** The name as the chip shows it: URLs become hosts, one line, at most `maxChars` (cut at a word). */
export function chipName(name: string, maxChars: number): string {
  const plain = name
    .replace(URL, (_url, host: string) => host.toLowerCase().replace(/^www\./, ''))
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= maxChars) return plain;
  const cut = plain.slice(0, Math.max(1, maxChars - 3));
  const space = cut.lastIndexOf(' ');
  const word = space >= cut.length / 2 ? cut.slice(0, space) : cut;
  return `${word.replace(/[\s,;:.-]+$/, '')}...`;
}

function cornerRect(area: PixelRect, corner: SourceChipCorner, w: number, h: number): PixelRect {
  const left = area.x + 1;
  const right = area.x + area.w - w - 1;
  const top = area.y + 1;
  const bottom = area.y + area.h - h - 1;
  switch (corner) {
    case 'top-left':
      return { x: left, y: top, w, h };
    case 'top-right':
      return { x: right, y: top, w, h };
    case 'bottom-left':
      return { x: left, y: bottom, w, h };
    case 'bottom-right':
    case 'auto':
      return { x: right, y: bottom, w, h };
  }
}

function overlaps(first: PixelRect, second: PixelRect): boolean {
  return (
    first.x < second.x + second.w &&
    second.x < first.x + first.w &&
    first.y < second.y + second.h &&
    second.y < first.y + first.h
  );
}

/** The chip's rect: the preferred corner, else the first free one, else the least covered. */
export function placeSourceChip(
  area: PixelRect,
  occupied: readonly PixelRect[],
  corner: SourceChipCorner,
  w: number,
  h: number,
): PixelRect {
  const order = [
    ...(corner === 'auto' ? [] : [corner]),
    ...SOURCE_CHIP_AUTO_ORDER.filter((candidate) => candidate !== corner),
  ];
  const candidates = order.map((candidate) => cornerRect(area, candidate, w, h));
  const free = candidates.find(
    (rect) => !occupied.some((taken) => overlaps(grow(rect, AIR), taken)),
  );
  return free ?? candidates[bestSpot(candidates, area, occupied)] ?? candidates[0] ?? area;
}

export function drawSourceChip(env: AnnotationEnv, options: ParsedSourceChip): AnnotationDraw {
  const scale = options.scale ?? env.labelScale;
  const name = chipName(options.name, options.maxChars);
  const label = options.label.trim();
  const text = label === '' ? name : `${label}: ${name}`;
  const main = measureLabel(text, DISPLAY_FONT, scale, env.width);
  const tag =
    options.index === undefined
      ? undefined
      : measureLabel(String(options.index), MONO_FONT, Math.max(1, scale - 1), env.width, {
          x: 3,
          y: Math.max(1, Math.floor((main.h - MONO_FONT.capHeight * Math.max(1, scale - 1)) / 2)),
        });
  const tagW = tag?.w ?? 0;
  const rect = placeSourceChip(env.safeArea, env.occupied, options.corner, tagW + main.w, main.h);
  const box = grow(rect, 1);
  const result = { box, extent: box, textScale: scale };
  if (!env.phase.visible) return result;
  const paint = wipePaint(env.paint, box, env.phase.wipe, env.height);
  const plate = env.resolveColor(options.plate, 'plate');
  if (tag !== undefined) {
    drawLabel(
      env.surface,
      tag,
      { x: rect.x, y: rect.y, w: tag.w, h: main.h },
      { text: plate, plate: env.color, rim: env.outline },
      paint,
      env.phase.pop,
    );
  }
  drawLabel(
    env.surface,
    main,
    { x: rect.x + tagW, y: rect.y, w: main.w, h: main.h },
    {
      text: env.resolveColor(options.textColor, 'textColor'),
      plate,
      rim: env.outline,
      bar: tag === undefined ? env.color : undefined,
    },
    paint,
    env.phase.pop,
  );
  return result;
}
