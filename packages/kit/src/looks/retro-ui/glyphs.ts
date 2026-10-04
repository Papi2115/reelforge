/**
 * Glyphs the kit's bitmap fonts lack, drawn by the retro-UI canvas instead of the fallback box /
 * '?': backslash (DOS paths), pipe, quotes, brackets... (authored here, CC0 like the fonts).
 */
import { GLYPH_ROWS } from '../../fx/font.js';

/** 3x5 glyphs the screen font lacks (it would draw '?'). */
export const SMALL_EXTRA: Readonly<Record<string, readonly string[]>> = {
  '\\': ['#..', '#..', '.#.', '..#', '..#'],
  '"': ['#.#', '#.#', '...', '...', '...'],
  ';': ['...', '.#.', '...', '.#.', '#..'],
  '&': ['.#.', '#.#', '.#.', '#.#', '.##'],
  '@': ['###', '#.#', '#.#', '#..', '###'],
  '[': ['##.', '#..', '#..', '#..', '##.'],
  ']': ['.##', '..#', '..#', '..#', '.##'],
  '|': ['.#.', '.#.', '.#.', '.#.', '.#.'],
};

/** 5x7 glyphs the big font lacks (it would draw a box). */
const BIG_EXTRA: Readonly<Record<string, string>> = {
  '\\': '#..../#..../.#.../..#../...#./....#/....#',
  '|': '..#../..#../..#../..#../..#../..#../..#..',
};

const extraCache = new Map<string, { readonly width: number; readonly bits: Uint8Array }>();

export function extraGlyph(
  char: string,
  bold: boolean,
): { readonly width: number; readonly bits: Uint8Array } | undefined {
  const source = BIG_EXTRA[char];
  if (source === undefined) return undefined;
  const key = `${bold ? 'b' : 'r'}${char}`;
  const cached = extraCache.get(key);
  if (cached) return cached;
  const rows = source.split('/');
  const width = 5 + (bold ? 1 : 0);
  const bits = new Uint8Array(width * GLYPH_ROWS);
  rows.forEach((row, y) => {
    for (let column = 0; column < width; column += 1) {
      const ink = row[column] === '#' || (bold && column > 0 && row[column - 1] === '#');
      if (ink) bits[y * width + column] = 1;
    }
  });
  const glyph = { width, bits };
  extraCache.set(key, glyph);
  return glyph;
}
