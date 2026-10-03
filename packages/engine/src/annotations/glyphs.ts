/** Pixel glyphs of badge marks (check, cross), in the same Glyph shape as the fonts. CC0, ours. */
import type { Glyph } from '../text/font.js';

function bitmapGlyph(rows: readonly string[]): Glyph {
  const width = Math.max(...rows.map((row) => row.length));
  const bits = new Uint8Array(width * rows.length);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x += 1) if (row[x] === '#') bits[y * width + x] = 1;
  });
  return { width, top: 0, height: rows.length, bits, inkTop: 0, inkBottom: rows.length - 1 };
}

export const CHECK_GLYPH = bitmapGlyph([
  '......##',
  '.....##.',
  '##..##..',
  '.####...',
  '..##....',
]);

export const CROSS_GLYPH = bitmapGlyph(['##...##', '.##.##.', '..###..', '.##.##.', '##...##']);
