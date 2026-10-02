/**
 * Text layout in font units: normalization, greedy word wrap (long words are broken by character)
 * and pixel geometry of the laid-out block at an integer scale. Kerning-free and deterministic.
 */
import type { BitmapFont, Glyph } from './font.js';
import type { PixelRect, TextMetrics } from './types.js';

export type TextAlign = 'left' | 'center' | 'right';

export interface LayoutGlyph {
  readonly glyph: Glyph;
  /** Font units from the start of the word. */
  readonly x: number;
}

export interface LayoutWord {
  readonly text: string;
  /** Index of the space-separated source token (pieces of a broken word share it). */
  readonly token: number;
  readonly line: number;
  /** Font units from the start of the line. */
  readonly x: number;
  readonly width: number;
  readonly glyphs: readonly LayoutGlyph[];
}

export interface LayoutLine {
  readonly text: string;
  readonly width: number;
}

export interface TextLayout {
  readonly font: BitmapFont;
  readonly lines: readonly LayoutLine[];
  /** Words in reading order (a word broken across lines is several words). */
  readonly words: readonly LayoutWord[];
  /** Widest line, font units. */
  readonly width: number;
}

interface MeasuredWord {
  readonly text: string;
  /** Inked width: from the first glyph to the end of the last one. */
  readonly width: number;
  /** Where the next character would start (width + the last glyph's spacing). */
  readonly advance: number;
  readonly glyphs: readonly LayoutGlyph[];
}

function measureWord(text: string, font: BitmapFont): MeasuredWord {
  const glyphs: LayoutGlyph[] = [];
  let cursor = 0;
  let width = 0;
  for (const char of text) {
    const glyph = font.glyph(char);
    glyphs.push({ glyph, x: cursor });
    width = cursor + glyph.width;
    cursor += font.advance(char);
  }
  return { text, width, advance: cursor, glyphs };
}

/** Splits a word wider than `maxWidth` into chunks that fit (at least one character each). */
function breakWord(text: string, font: BitmapFont, maxWidth: number): MeasuredWord[] {
  const chunks: MeasuredWord[] = [];
  let current = '';
  for (const char of text) {
    const candidate = current + char;
    if (current !== '' && measureWord(candidate, font).width > maxWidth) {
      chunks.push(measureWord(current, font));
      current = char;
    } else {
      current = candidate;
    }
  }
  if (current !== '') chunks.push(measureWord(current, font));
  return chunks;
}

/**
 * Lays out `text` (already normalized for the font) with lines at most `maxWidth` font units wide.
 * `\n` starts a new line; runs of spaces collapse to one. Words are separated by a space advance
 * after the previous word's advance, so a monospaced font stays on its cell grid.
 */
export function layoutText(text: string, font: BitmapFont, maxWidth = Infinity): TextLayout {
  const space = font.advance(' ');
  const lines: LayoutLine[] = [];
  const words: LayoutWord[] = [];
  let lineWords: LayoutWord[] = [];
  let lineWidth = 0;
  let cursor = 0;
  let token = 0;
  const flush = (): void => {
    words.push(...lineWords);
    lines.push({ text: lineWords.map((word) => word.text).join(' '), width: lineWidth });
    lineWords = [];
    lineWidth = 0;
    cursor = 0;
  };
  for (const paragraph of text.split('\n')) {
    const texts = paragraph.split(' ').filter((part) => part !== '');
    for (const text of texts) {
      const measured = measureWord(text, font);
      const pieces = measured.width > maxWidth ? breakWord(text, font, maxWidth) : [measured];
      for (const piece of pieces) {
        if (lineWords.length > 0 && cursor + space + piece.width > maxWidth) flush();
        const x = lineWords.length === 0 ? 0 : cursor + space;
        lineWords.push({
          text: piece.text,
          token,
          line: lines.length,
          x,
          width: piece.width,
          glyphs: piece.glyphs,
        });
        lineWidth = x + piece.width;
        cursor = x + piece.advance;
      }
      token += 1;
    }
    flush();
  }
  return { font, lines, words, width: Math.max(0, ...lines.map((line) => line.width)) };
}

/** Block size in pixels: widest line x (lines * line height). */
export function blockSize(layout: TextLayout, scale: number): { w: number; h: number } {
  return { w: layout.width * scale, h: layout.lines.length * layout.font.lineHeight * scale };
}

/** Pixel offset of a line inside its block for an alignment. */
export function lineOffset(
  layout: TextLayout,
  line: number,
  align: TextAlign,
  scale: number,
): number {
  const free = (layout.width - (layout.lines[line]?.width ?? 0)) * scale;
  if (align === 'left') return 0;
  return align === 'right' ? free : Math.floor(free / 2);
}

/** Pixel y of the cap line of `line`, relative to the block top. */
export function capLine(layout: TextLayout, line: number, scale: number): number {
  return (line * layout.font.lineHeight + layout.font.ascent) * scale;
}

/** Bounding box of every inked pixel of the block placed at (left, top). */
export function inkBox(
  layout: TextLayout,
  align: TextAlign,
  scale: number,
  left: number,
  top: number,
): PixelRect {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const word of layout.words) {
    const lineX = left + lineOffset(layout, word.line, align, scale) + word.x * scale;
    const cap = top + capLine(layout, word.line, scale);
    for (const { glyph, x } of word.glyphs) {
      if (glyph.inkBottom < glyph.inkTop) continue;
      x0 = Math.min(x0, lineX + x * scale);
      x1 = Math.max(x1, lineX + (x + glyph.width) * scale);
      y0 = Math.min(y0, cap + glyph.inkTop * scale);
      y1 = Math.max(y1, cap + (glyph.inkBottom + 1) * scale);
    }
  }
  if (x0 === Infinity) return { x: left, y: top, w: 0, h: 0 };
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function measureLayout(layout: TextLayout, scale: number): TextMetrics {
  const { w, h } = blockSize(layout, scale);
  return { w, h, lines: layout.lines.map((line) => line.text) };
}
