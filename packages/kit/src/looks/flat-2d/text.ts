/**
 * Pixel lettering for the flat-2d raster: the kit's own 5x7 caps font (fx/font.ts, CC0) at
 * integer scales, bold for display type (one extra column per stroke). `zoom` scales a block
 * about its centre for pop-ins: glyph cells stay whole pixels, so text never blurs.
 */
import { GLYPH_ROWS, layoutLine, normalizeText, wrapText } from '../../fx/font.js';
import type { Pixel, Raster } from './raster.js';

export type TextAlign = 'left' | 'center' | 'right';

export interface TextStyle {
  /** Integer scale: 1 = 7-px caps, 2 = 14-px caps. */
  readonly scale: number;
  readonly color: Pixel;
  readonly bold?: boolean | undefined;
  readonly align?: TextAlign | undefined;
  /** Vertical reference of `y`: top (default), middle or bottom of the block. */
  readonly valign?: 'top' | 'middle' | 'bottom' | undefined;
  /** Characters shown (typewriter reveal; default all). */
  readonly chars?: number | undefined;
  /** Scale about the block centre (pop-ins; default 1). */
  readonly zoom?: number | undefined;
}

/** Empty rows between lines (unscaled). */
const LINE_GAP = 3;

export interface TextBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Width in pixels of one line at `scale`. */
export function textWidth(text: string, scale: number, bold = false): number {
  return layoutLine(normalizeText(text), bold).width * scale;
}

/** Height in pixels of `lines` lines at `scale`. */
export function textHeight(lines: number, scale: number): number {
  return (lines * GLYPH_ROWS + Math.max(0, lines - 1) * LINE_GAP) * scale;
}

/** Word-wraps `text` to `maxWidth` px at `scale` (at most `maxLines` lines). */
export function wrapLines(
  text: string,
  maxWidth: number,
  scale: number,
  maxLines = 2,
  bold = false,
): string[] {
  return wrapText(text, Math.max(1, Math.floor(maxWidth / scale)), maxLines, bold);
}

/** Box of a text block drawn at (x, y) with `style` (zoom not applied). */
export function textBox(lines: readonly string[], x: number, y: number, style: TextStyle): TextBox {
  const width = Math.max(0, ...lines.map((line) => textWidth(line, style.scale, style.bold)));
  const height = textHeight(lines.length, style.scale);
  const align = style.align ?? 'left';
  const left = align === 'left' ? x : align === 'right' ? x - width : x - Math.floor(width / 2);
  const valign = style.valign ?? 'top';
  const top = valign === 'top' ? y : valign === 'bottom' ? y - height : y - Math.floor(height / 2);
  return { x: Math.round(left), y: Math.round(top), width, height };
}

/** Draws lines of text; returns the box (before zoom). */
export function drawText(
  raster: Raster,
  lines: readonly string[],
  x: number,
  y: number,
  style: TextStyle,
): TextBox {
  const box = textBox(lines, x, y, style);
  const zoom = style.zoom ?? 1;
  if (zoom <= 0) return box;
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  const map = (value: number, center: number): number =>
    Math.round(center + (value - center) * zoom);
  const align = style.align ?? 'left';
  const bold = style.bold ?? false;
  let budget = style.chars ?? Infinity;
  lines.forEach((line, index) => {
    const layout = layoutLine(normalizeText(line), bold);
    const width = layout.width * style.scale;
    const shift =
      align === 'left' ? 0 : align === 'right' ? box.width - width : (box.width - width) >> 1;
    const top = box.y + index * (GLYPH_ROWS + LINE_GAP) * style.scale;
    for (const placed of layout.glyphs) {
      if (budget <= 0) return;
      budget -= 1;
      const glyph = placed.glyph;
      if (!glyph) continue;
      const left = box.x + shift + placed.x * style.scale;
      for (let row = 0; row < GLYPH_ROWS; row += 1) {
        for (let column = 0; column < glyph.width; column += 1) {
          if (glyph.bits[row * glyph.width + column] !== 1) continue;
          const x0 = left + column * style.scale;
          const y0 = top + row * style.scale;
          if (zoom === 1) {
            raster.rect(x0, y0, style.scale, style.scale, style.color);
            continue;
          }
          const sx = map(x0, centerX);
          const sy = map(y0, centerY);
          raster.rect(
            sx,
            sy,
            map(x0 + style.scale, centerX) - sx,
            map(y0 + style.scale, centerY) - sy,
            style.color,
          );
        }
      }
    }
    budget -= 1;
  });
  return box;
}

/** Largest scale <= `maxScale` at which `text` fits `maxWidth` on one line (at least 1). */
export function fitScale(text: string, maxWidth: number, maxScale: number, bold = false): number {
  for (let scale = maxScale; scale > 1; scale -= 1) {
    if (textWidth(text, scale, bold) <= maxWidth) return scale;
  }
  return 1;
}
