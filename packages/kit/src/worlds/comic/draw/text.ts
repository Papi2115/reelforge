/**
 * Hand lettering of the Comic page: Inkhand glyphs on a hand-lettered baseline (every glyph may
 * ride +-jitter px, seeded), alternates for repeated letters, a "smart bold" that thickens stems
 * without closing counters, integer scales only (pixel lettering never resamples).
 */
import type { ComicCanvas, Paint } from './canvas.js';
import { FONTS, type FontName, type Glyph } from './fonts.js';
import { rnd } from './math.js';

export interface TextOptions {
  readonly scale?: number | undefined;
  /** Baseline wobble in px (default 1; digits ride steadier). */
  readonly jitter?: number | undefined;
  /** Pencil slant: px shift per 4 rows. */
  readonly slant?: number | undefined;
  readonly bold?: boolean | undefined;
  /** Characters shown (letter by letter reveal). */
  readonly reveal?: number | undefined;
  readonly key?: string | undefined;
}

function glyphFor(font: FontName, char: string, key: string, index: number): Glyph | undefined {
  const face = FONTS[font];
  const alternate = face.alternates.get(char);
  if (alternate && rnd(key, index * 7 + 3) < 0.45) return alternate;
  return face.glyphs.get(char) ?? face.glyphs.get('?');
}

/** Upper-cases text and keeps the characters the face can draw (others become spaces). */
export function letterable(text: string, font: FontName = 'hand'): string {
  const glyphs = FONTS[font].glyphs;
  return Array.from(text.toUpperCase())
    .map((char) => (glyphs.has(char) ? char : ' '))
    .join('');
}

/** Width in px of a line of text. */
export function measure(font: FontName, text: string, scale = 1, bold = false): number {
  const face = FONTS[font];
  const extra = bold ? scale : 0;
  let width = 0;
  for (const char of text) {
    if (char === ' ') width += face.space * scale;
    else width += (face.glyphs.get(char)?.w ?? 5) * scale + extra + face.spacing * scale;
  }
  return Math.max(0, width - face.spacing * scale);
}

/** Smart bold: a stem pixel thickens right only where a one-pixel gap survives. */
function boldBit(glyph: Glyph, x: number, y: number): boolean {
  const bit = (gx: number) => gx >= 0 && gx < glyph.w && glyph.bits[y * glyph.w + gx] === 1;
  if (bit(x)) return true;
  return bit(x - 1) && !bit(x + 1);
}

/** Draws one line of text with its top-left at (x, y). */
export function drawText(
  canvas: ComicCanvas,
  font: FontName,
  text: string,
  x: number,
  y: number,
  paint: Paint,
  options: TextOptions = {},
): void {
  const scale = Math.max(1, Math.round(options.scale ?? 1));
  const face = FONTS[font];
  const key = options.key ?? text;
  const jitter = options.jitter ?? 1;
  const shown = options.reveal ?? text.length;
  let cx = Math.round(x);
  let n = 0;
  let previousWidth = 5;
  for (const char of text) {
    if (n >= shown) break;
    n += 1;
    if (char === ' ') {
      cx += face.space * scale;
      continue;
    }
    const glyph = glyphFor(font, char, key, n);
    if (glyph === undefined) continue;
    const amp = /[0-9]/.test(char) ? 0.45 : 0.8;
    const dy = jitter !== 0 ? Math.round((rnd(key, n) * 2 - 1) * jitter * amp) : 0;
    // A glyph may tuck in a pixel, unless that would touch a narrow neighbour or a slanted one.
    const tuck = jitter !== 0 && !options.slant && previousWidth > 2;
    const dx = tuck && rnd(key, n + 50) < 0.15 ? -1 : 0;
    const gy = Math.round(y) + dy;
    const width = glyph.w + (options.bold === true ? 1 : 0);
    for (let row = 0; row < glyph.h; row += 1) {
      // Slant by the screen row (not the glyph row): neighbours on other baselines keep their gap.
      const lift = glyph.h - row - dy / scale;
      const slant = options.slant ? Math.round((lift / 4) * options.slant) : 0;
      for (let col = 0; col < width; col += 1) {
        const on =
          options.bold === true ? boldBit(glyph, col, row) : glyph.bits[row * glyph.w + col] === 1;
        if (on) canvas.rect(cx + dx + col * scale + slant, gy + row * scale, scale, scale, paint);
      }
    }
    cx += width * scale + face.spacing * scale;
    previousWidth = glyph.w;
  }
}
