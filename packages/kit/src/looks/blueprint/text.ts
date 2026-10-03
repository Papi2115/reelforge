/**
 * Pixel lettering for the blueprint raster: the kit's own 5x7 caps font (fx/font.ts, CC0) drawn
 * at integer scales, the way technical drawings are lettered. Labels can sit on a knock-out
 * plate (the paper colour around the ink) so grid lines never cross the text.
 */
import { GLYPH_ROWS, layoutLine, normalizeText, wrapText } from '../../fx/font.js';
import type { Pixel, Raster } from './raster.js';

export type TextAlign = 'left' | 'center' | 'right';

export interface TextStyle {
  /** Integer scale: 1 = 7-px caps, 2 = 14-px caps. */
  readonly scale: number;
  readonly color: Pixel;
  readonly align?: TextAlign | undefined;
  /** Vertical reference of `y`: top (default), middle or bottom of the block. */
  readonly valign?: 'top' | 'middle' | 'bottom' | undefined;
  /** Knock-out plate colour behind the block (with `pad` px margin). */
  readonly plate?: Pixel | undefined;
  readonly pad?: number | undefined;
  /** Characters shown (typewriter reveal; default all). */
  readonly chars?: number | undefined;
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
export function textWidth(text: string, scale: number): number {
  return layoutLine(normalizeText(text)).width * scale;
}

/** Height in pixels of `lines` lines at `scale`. */
export function textHeight(lines: number, scale: number): number {
  return (lines * GLYPH_ROWS + Math.max(0, lines - 1) * LINE_GAP) * scale;
}

/** Word-wraps `text` to `maxWidth` px at `scale` (at most `maxLines` lines). */
export function wrapLines(text: string, maxWidth: number, scale: number, maxLines = 2): string[] {
  return wrapText(text, Math.max(1, Math.floor(maxWidth / scale)), maxLines);
}

/** Box of a text block drawn at (x, y) with `style` (before the plate margin). */
export function textBox(lines: readonly string[], x: number, y: number, style: TextStyle): TextBox {
  const width = Math.max(0, ...lines.map((line) => textWidth(line, style.scale)));
  const height = textHeight(lines.length, style.scale);
  const align = style.align ?? 'left';
  const left = align === 'left' ? x : align === 'right' ? x - width : x - Math.floor(width / 2);
  const valign = style.valign ?? 'top';
  const top = valign === 'top' ? y : valign === 'bottom' ? y - height : y - Math.floor(height / 2);
  return { x: Math.round(left), y: Math.round(top), width, height };
}

/** Draws lines of text; returns the inked box (plate included). */
export function drawText(
  raster: Raster,
  lines: readonly string[],
  x: number,
  y: number,
  style: TextStyle,
): TextBox {
  const box = textBox(lines, x, y, style);
  const pad = style.pad ?? style.scale;
  if (style.plate !== undefined) {
    raster.rect(box.x - pad, box.y - pad, box.width + pad * 2, box.height + pad * 2, style.plate);
  }
  const align = style.align ?? 'left';
  let budget = style.chars ?? Infinity;
  lines.forEach((line, index) => {
    const layout = layoutLine(normalizeText(line));
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
          raster.rect(
            left + column * style.scale,
            top + row * style.scale,
            style.scale,
            style.scale,
            style.color,
          );
        }
      }
    }
    budget -= 1;
  });
  return style.plate === undefined
    ? box
    : {
        x: box.x - pad,
        y: box.y - pad,
        width: box.width + pad * 2,
        height: box.height + pad * 2,
      };
}

/** Largest scale <= `maxScale` at which `text` fits `maxWidth` on one line (at least 1). */
export function fitScale(text: string, maxWidth: number, maxScale: number): number {
  for (let scale = maxScale; scale > 1; scale -= 1) {
    if (textWidth(text, scale) <= maxWidth) return scale;
  }
  return 1;
}
