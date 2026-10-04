/**
 * Palette-indexed pixel canvas of the retro-UI look and its drawing primitives (pure, no GL).
 * Every template paints into a canvas of colour-role indices (colors.ts, 0 = transparent) as a
 * pure function of t; surface.ts uploads it as a nearest-filtered texture, so every UI pixel is an
 * exact style colour before the post-fx pass. Text uses the kit's own bitmap fonts (CC0): `big` =
 * Forge Voxel 5x7 (fx/font.ts), `small` = the 3x5 screen font (props/font.ts).
 */
import { GLYPH_ROWS, glyphOf, layoutLine, normalizeText, wrapText } from '../../fx/font.js';
import { drawText as plotSmallText, GLYPH_ADVANCE, LINE_ADVANCE } from '../../props/font.js';
import { extraGlyph, SMALL_EXTRA } from './glyphs.js';

/** Index of a transparent pixel. */
export const CLEAR = 0;

export interface PixelCanvas {
  readonly width: number;
  readonly height: number;
  /** Row-major colour-role indices, row 0 = top. */
  readonly data: Uint8Array;
}

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** A point in canvas pixels (x right, y down). */
export type Point = readonly [number, number];

export function createCanvas(width: number, height: number): PixelCanvas {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  return { width: w, height: h, data: new Uint8Array(w * h) };
}

export function rect(x: number, y: number, w: number, h: number): Rect {
  return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
}

export function inset(area: Rect, by: number): Rect {
  return { x: area.x + by, y: area.y + by, w: area.w - by * 2, h: area.h - by * 2 };
}

export function centerOf(area: Rect): Point {
  return [area.x + area.w / 2, area.y + area.h / 2];
}

export function setPixel(canvas: PixelCanvas, x: number, y: number, color: number): void {
  const px = Math.floor(x);
  const py = Math.floor(y);
  if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) return;
  canvas.data[py * canvas.width + px] = color;
}

export function getPixel(canvas: PixelCanvas, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return CLEAR;
  return canvas.data[Math.floor(y) * canvas.width + Math.floor(x)] ?? CLEAR;
}

/** Calls `plot` for every pixel of `area` that lies on the canvas. */
function eachPixel(
  canvas: PixelCanvas,
  area: Rect,
  plot: (x: number, y: number, offset: number) => void,
): void {
  const x0 = Math.max(0, area.x);
  const y0 = Math.max(0, area.y);
  const x1 = Math.min(canvas.width, area.x + area.w);
  const y1 = Math.min(canvas.height, area.y + area.h);
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) plot(x, y, y * canvas.width + x);
  }
}

export function fillRect(canvas: PixelCanvas, area: Rect, color: number): void {
  eachPixel(canvas, area, (_x, _y, offset) => {
    canvas.data[offset] = color;
  });
}

export function strokeRect(canvas: PixelCanvas, area: Rect, color: number): void {
  if (area.w <= 0 || area.h <= 0) return;
  fillRect(canvas, { x: area.x, y: area.y, w: area.w, h: 1 }, color);
  fillRect(canvas, { x: area.x, y: area.y + area.h - 1, w: area.w, h: 1 }, color);
  fillRect(canvas, { x: area.x, y: area.y, w: 1, h: area.h }, color);
  fillRect(canvas, { x: area.x + area.w - 1, y: area.y, w: 1, h: area.h }, color);
}

/** Every other pixel of `area` (a 50 % checker): see-through shadows and dotted outlines. */
export function checkerRect(canvas: PixelCanvas, area: Rect, color: number, phase = 0): void {
  eachPixel(canvas, area, (x, y, offset) => {
    if (((x + y + phase) & 1) === 0) canvas.data[offset] = color;
  });
}

/** Dotted outline (every other pixel). */
export function dottedRect(canvas: PixelCanvas, area: Rect, color: number): void {
  if (area.w <= 0 || area.h <= 0) return;
  for (const edge of [
    { x: area.x, y: area.y, w: area.w, h: 1 },
    { x: area.x, y: area.y + area.h - 1, w: area.w, h: 1 },
    { x: area.x, y: area.y, w: 1, h: area.h },
    { x: area.x + area.w - 1, y: area.y, w: 1, h: area.h },
  ]) {
    checkerRect(canvas, edge, color);
  }
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5] as const;

/** Ordered-dither threshold of a pixel, in (0, 1). */
export function bayer(x: number, y: number): number {
  return ((BAYER4[(y & 3) * 4 + (x & 3)] ?? 0) + 0.5) / 16;
}

/** Colour of `ramp` (dark -> light) for a value in 0..1 at pixel (x, y), Bayer-dithered. */
export function ditherPick(x: number, y: number, value: number, ramp: readonly number[]): number {
  const steps = ramp.length - 1;
  if (steps <= 0) return ramp[0] ?? CLEAR;
  const scaled = Math.min(1, Math.max(0, value)) * steps;
  const base = Math.min(steps - 1, Math.floor(scaled));
  const index = scaled - base > bayer(x, y) ? base + 1 : base;
  return ramp[index] ?? CLEAR;
}

/** Fills `area` with a dithered field: `value(u, v)` in 0..1 over the area (u, v in 0..1). */
export function ditherFill(
  canvas: PixelCanvas,
  area: Rect,
  ramp: readonly number[],
  value: (u: number, v: number) => number,
): void {
  eachPixel(canvas, area, (x, y, offset) => {
    const u = (x - area.x + 0.5) / area.w;
    const v = (y - area.y + 0.5) / area.h;
    canvas.data[offset] = ditherPick(x, y, value(u, v), ramp);
  });
}

/** Copies the non-transparent pixels of `source` to (dx, dy), clipped to `clip` (default: all). */
export function blit(
  source: PixelCanvas,
  target: PixelCanvas,
  dx: number,
  dy: number,
  clip: Rect = { x: 0, y: 0, w: target.width, h: target.height },
): void {
  const area = { x: dx, y: dy, w: source.width, h: source.height };
  const x0 = Math.max(area.x, clip.x);
  const y0 = Math.max(area.y, clip.y);
  const x1 = Math.min(area.x + area.w, clip.x + clip.w);
  const y1 = Math.min(area.y + area.h, clip.y + clip.h);
  eachPixel(target, { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, (x, y, offset) => {
    const value = source.data[(y - dy) * source.width + (x - dx)] ?? CLEAR;
    if (value !== CLEAR) target.data[offset] = value;
  });
}

/** Draws `pattern` rows ('.' = skip, other characters looked up in `key`) at (x, y). */
export function drawSprite(
  canvas: PixelCanvas,
  pattern: readonly string[],
  key: Readonly<Record<string, number>>,
  x: number,
  y: number,
): void {
  pattern.forEach((row, rowIndex) => {
    Array.from(row).forEach((char, column) => {
      const color = key[char];
      if (color !== undefined) setPixel(canvas, x + column, y + rowIndex, color);
    });
  });
}

// ---------------------------------------------------------------------------------------------
// Text

export type FontName = 'big' | 'small';

export interface TextStyle {
  /** `big` = 5x7 caps (default), `small` = 3x5 caps. */
  readonly font?: FontName | undefined;
  /** Integer scale (default 1). */
  readonly scale?: number | undefined;
  /** Fixed 6-px cells (terminals); big font only. */
  readonly mono?: boolean | undefined;
  /** Wider vertical strokes; big font only. */
  readonly bold?: boolean | undefined;
}

/** Mono cell width of the big font (5-px glyph + 1-px gap). */
export const MONO_CELL = 6;

interface ResolvedStyle {
  readonly font: FontName;
  readonly scale: number;
  readonly mono: boolean;
  readonly bold: boolean;
}

function styleOf(style: TextStyle): ResolvedStyle {
  return {
    font: style.font ?? 'big',
    scale: Math.max(1, Math.round(style.scale ?? 1)),
    mono: style.mono ?? false,
    bold: style.bold ?? false,
  };
}

/** Left x (font pixels, scale 1) of every character of a normalized line, and the line width. */
export function charPositions(
  line: string,
  style: TextStyle = {},
): { xs: number[]; width: number } {
  const resolved = styleOf(style);
  const chars = Array.from(line);
  if (resolved.font === 'small') {
    return {
      xs: chars.map((_char, index) => index * GLYPH_ADVANCE),
      width: Math.max(0, chars.length * GLYPH_ADVANCE - 1),
    };
  }
  if (resolved.mono) {
    return {
      xs: chars.map((_char, index) => index * MONO_CELL),
      width: Math.max(0, chars.length * MONO_CELL - 1),
    };
  }
  const layout = layoutLine(line, resolved.bold);
  return { xs: layout.glyphs.map((glyph) => glyph.x), width: layout.width };
}

/** Upper case, accents stripped, typographic look-alikes substituted (both fonts are caps). */
export function normalize(text: string): string {
  return normalizeText(text);
}

/** Rendered width of one line in canvas pixels. */
export function textWidth(text: string, style: TextStyle = {}): number {
  return charPositions(normalize(text), style).width * styleOf(style).scale;
}

/** Cap height of a style in canvas pixels. */
export function textHeight(style: TextStyle = {}): number {
  const resolved = styleOf(style);
  return (resolved.font === 'small' ? 5 : GLYPH_ROWS) * resolved.scale;
}

/** Baseline-to-baseline distance in canvas pixels. */
export function lineHeight(style: TextStyle = {}): number {
  const resolved = styleOf(style);
  return (resolved.font === 'small' ? LINE_ADVANCE : GLYPH_ROWS + 3) * resolved.scale;
}

/** Draws one line (top-left at x, y); returns its width. */
export function drawText(
  canvas: PixelCanvas,
  text: string,
  x: number,
  y: number,
  color: number,
  style: TextStyle = {},
): number {
  const resolved = styleOf(style);
  const line = normalize(text).split('\n')[0] ?? '';
  const { scale } = resolved;
  const plot = (px: number, py: number): void => {
    fillRect(canvas, { x: px, y: py, w: scale, h: scale }, color);
  };
  if (resolved.font === 'small') {
    Array.from(line).forEach((char, index) => {
      const left = Math.round(x) + index * GLYPH_ADVANCE * scale;
      const extra = SMALL_EXTRA[char];
      if (extra === undefined) {
        plotSmallText(char, { x: left, y: Math.round(y), width: 0 }, scale, 'left', (px, py) => {
          setPixel(canvas, px, py, color);
        });
        return;
      }
      extra.forEach((row, rowIndex) => {
        Array.from(row).forEach((bit, column) => {
          if (bit === '#') plot(left + column * scale, Math.round(y) + rowIndex * scale);
        });
      });
    });
    return charPositions(line, resolved).width * scale;
  }
  const { xs, width } = charPositions(line, resolved);
  Array.from(line).forEach((char, index) => {
    const glyph = extraGlyph(char, resolved.bold) ?? glyphOf(char, resolved.bold);
    if (!glyph) return;
    const shift = resolved.mono ? Math.floor((5 - glyph.width) / 2) : 0;
    const left = Math.round(x) + ((xs[index] ?? 0) + shift) * scale;
    for (let row = 0; row < GLYPH_ROWS; row += 1) {
      for (let column = 0; column < glyph.width; column += 1) {
        if (glyph.bits[row * glyph.width + column] === 1) {
          plot(left + column * scale, Math.round(y) + row * scale);
        }
      }
    }
  });
  return width * scale;
}

/** Draws text horizontally centred on `cx`; returns the left x. */
export function drawTextCentered(
  canvas: PixelCanvas,
  text: string,
  cx: number,
  y: number,
  color: number,
  style: TextStyle = {},
): number {
  const left = Math.round(cx - textWidth(text, style) / 2);
  drawText(canvas, text, left, y, color, style);
  return left;
}

/** Word-wraps `text` into lines no wider than `maxWidth` canvas pixels (normalized, caps). */
export function wrap(
  text: string,
  maxWidth: number,
  maxLines: number,
  style: TextStyle = {},
): string[] {
  const resolved = styleOf(style);
  const width = Math.max(1, Math.floor(maxWidth / resolved.scale));
  if (resolved.font === 'big' && !resolved.mono)
    return wrapText(text, width, maxLines, resolved.bold);
  const cell = resolved.font === 'small' ? GLYPH_ADVANCE : MONO_CELL;
  const perLine = Math.max(1, Math.floor((width + 1) / cell));
  const lines: string[] = [];
  for (const paragraph of normalize(text).split('\n')) {
    let line = '';
    for (const word of paragraph.split(' ').filter((part) => part.length > 0)) {
      const candidate = line.length === 0 ? word : `${line} ${word}`;
      if (line.length > 0 && Array.from(candidate).length > perLine) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    lines.push(line);
  }
  return lines.slice(0, maxLines);
}

/**
 * A heading that stays inside `maxWidth`: `style` when it fits, else the same style at scale 1,
 * else cut with '..' at scale 1 (titles, mastheads, answers never run off their page).
 */
export function fitHeading(
  text: string,
  maxWidth: number,
  style: TextStyle,
): { readonly text: string; readonly style: TextStyle } {
  const line = normalize(text);
  if (textWidth(line, style) <= maxWidth) return { text: line, style };
  const small: TextStyle = { ...style, scale: 1 };
  return { text: clipText(line, maxWidth, small), style: small };
}

/** Cuts `text` so it fits `maxWidth` canvas pixels (adds '..' when cut). */
export function clipText(text: string, maxWidth: number, style: TextStyle = {}): string {
  const line = normalize(text);
  if (textWidth(line, style) <= maxWidth) return line;
  let chars = Array.from(line);
  while (chars.length > 0 && textWidth(`${chars.join('')}..`, style) > maxWidth) {
    chars = chars.slice(0, -1);
  }
  return `${chars.join('')}..`;
}
