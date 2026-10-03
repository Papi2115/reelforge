/**
 * Text labels of annotations (callout bodies, pin labels, arrow/bracket/dimension values): a
 * pixel-font block on an optional plate with a 1 px rim, laid out once and drawn at any place.
 * Pop animations grow the plate from its centre; the text appears once the plate is nearly full.
 */
import { drawBlock, shadowOffset, uniformLooks } from '../text/draw.js';
import type { BitmapFont } from '../text/font.js';
import { inkBox, layoutText, type TextLayout } from '../text/layout.js';
import type { Paint, Rgb8, TextSurface } from '../text/surface.js';
import type { PixelRect } from '../text/types.js';

export const LABEL_PAD_X = 4;
export const LABEL_PAD_Y = 3;
/** Plate share below which a popping label shows no text yet. */
const TEXT_FROM_POP = 0.85;

export interface LabelGeometry {
  readonly layout: TextLayout;
  readonly scale: number;
  /** Plate size (ink + padding), pixels. */
  readonly w: number;
  readonly h: number;
  /** Ink box of the block laid out at (0, 0). */
  readonly ink: PixelRect;
  readonly padX: number;
  readonly padY: number;
}

export function measureLabel(
  text: string,
  font: BitmapFont,
  scale: number,
  maxWidth: number,
  pad: { readonly x: number; readonly y: number } = { x: LABEL_PAD_X, y: LABEL_PAD_Y },
): LabelGeometry {
  const units = Math.max(1, Math.floor((maxWidth - 2 * pad.x) / scale));
  const layout = layoutText(font.normalize(text), font, units);
  const ink = inkBox(layout, 'left', scale, 0, 0);
  return {
    layout,
    scale,
    w: ink.w + 2 * pad.x,
    h: ink.h + 2 * pad.y,
    ink,
    padX: pad.x,
    padY: pad.y,
  };
}

export interface LabelColors {
  readonly text: Rgb8;
  readonly plate: Rgb8 | undefined;
  /** Plate rim, or the text shadow when there is no plate. */
  readonly rim: Rgb8 | undefined;
  /** Optional accent bar on the left edge of the plate. */
  readonly bar?: Rgb8 | undefined;
}

/** Pops `rect` about its centre by `pop` (0..~1.1). */
export function popRect(rect: PixelRect, pop: number): PixelRect {
  if (pop === 1) return rect;
  const w = Math.max(0, Math.round(rect.w * pop));
  const h = Math.max(0, Math.round(rect.h * pop));
  return {
    x: rect.x + Math.round((rect.w - w) / 2),
    y: rect.y + Math.round((rect.h - h) / 2),
    w,
    h,
  };
}

/** Draws the label with its plate at `rect` (the rest place, size from `measureLabel`). */
export function drawLabel(
  surface: TextSurface,
  geometry: LabelGeometry,
  rect: PixelRect,
  colors: LabelColors,
  paint: Paint,
  pop = 1,
): void {
  const plate = popRect(rect, pop);
  if (plate.w <= 0 || plate.h <= 0) return;
  if (colors.plate) {
    if (colors.rim)
      surface.fillRect(
        { x: plate.x - 1, y: plate.y - 1, w: plate.w + 2, h: plate.h + 2 },
        colors.rim,
        paint,
      );
    surface.fillRect(plate, colors.plate, paint);
    if (colors.bar)
      surface.fillRect(
        { x: plate.x, y: plate.y, w: Math.min(2, plate.w), h: plate.h },
        colors.bar,
        paint,
      );
  }
  if (pop < TEXT_FROM_POP) return;
  const left = rect.x + geometry.padX - geometry.ink.x;
  const top = rect.y + geometry.padY - geometry.ink.y;
  const looks = uniformLooks(
    geometry.layout,
    { dx: 0, dy: 0, scale: geometry.scale, color: colors.text },
    Infinity,
  );
  const shadow =
    colors.plate === undefined && colors.rim
      ? { color: colors.rim, offset: shadowOffset(geometry.scale) }
      : undefined;
  drawBlock(
    surface,
    { layout: geometry.layout, align: 'left', scale: geometry.scale, left, top },
    looks,
    paint,
    shadow,
  );
}
