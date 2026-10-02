/**
 * Bitmap pixel fonts authored in this repo (CC0, docs/licenses.md). Glyphs are written as rows of
 * `#` (ink) and `.` (empty) separated by `/`, starting at the cap line: row 0 = top of a capital,
 * rows `capHeight..` are descenders. Accented letters are composed from a base glyph and a mark
 * (acute, dot above, ogonek), so every diacritic sits at the same place in every letter.
 */
import type { FontName } from './types.js';

export interface Glyph {
  readonly width: number;
  /** Row of the first bitmap row relative to the cap line (negative = above the capitals). */
  readonly top: number;
  readonly height: number;
  /** width*height cells, 1 = ink, row-major. */
  readonly bits: Uint8Array;
  /** First and last inked row relative to the cap line (inclusive); 0/-1 for a blank glyph. */
  readonly inkTop: number;
  readonly inkBottom: number;
}

export interface BitmapFont {
  readonly name: FontName;
  /** Rows of a capital letter. */
  readonly capHeight: number;
  /** Rows reserved above the cap line (accents of capitals). */
  readonly ascent: number;
  /** Rows reserved below the baseline (descenders, ogonek, comma). */
  readonly descent: number;
  /** ascent + capHeight + descent: distance between consecutive lines. */
  readonly lineHeight: number;
  /** Advance of a character in font units (glyph width + spacing, or the fixed cell width). */
  advance(char: string): number;
  /** Glyph of a character; the replacement box when the font has no such glyph. */
  glyph(char: string): Glyph;
  has(char: string): boolean;
  /** Maps text to the characters this font draws (e.g. upper-case for a caps-only font). */
  normalize(text: string): string;
}

export type MarkName = 'acute' | 'dot' | 'ogonek';

export interface FontSpec {
  readonly name: FontName;
  readonly capHeight: number;
  readonly ascent: number;
  readonly descent: number;
  /** Empty columns between glyphs (proportional fonts). */
  readonly spacing: number;
  /** Advance of a space after the previous glyph's advance (proportional fonts). */
  readonly spaceAdvance: number;
  /** Every character advances by this many columns (monospaced fonts). */
  readonly fixedAdvance?: number;
  /** Caps-only font: lower-case input is drawn with the capitals. */
  readonly upperOnly: boolean;
  readonly glyphs: Readonly<Record<string, string>>;
  /** Mark bitmaps; acute/dot are placed above the base, ogonek below it at the right edge. */
  readonly marks: Readonly<Record<MarkName, string>>;
  readonly composed: Readonly<Record<string, readonly [base: string, mark: MarkName]>>;
  /** Replacement glyph for characters the font does not have. */
  readonly fallback: string;
}

/** Typographic characters drawn with their plain ASCII look-alikes. */
const CHARACTER_SUBSTITUTES: Readonly<Record<string, string>> = {
  '‘': "'",
  '’': "'",
  '‚': ',',
  '“': '"',
  '”': '"',
  '„': '"',
  '–': '-',
  '…': '...',
  ' ': ' ',
  '\t': ' ',
};

interface Bitmap {
  readonly width: number;
  readonly rows: readonly string[];
}

function parseRows(source: string, label: string): Bitmap {
  const rows = source.split('/');
  const width = rows[0]?.length ?? 0;
  for (const row of rows) {
    if (row.length !== width || !/^[#.]+$/.test(row)) {
      throw new Error(`font glyph ${label}: rows must be equally long strings of "#" and "."`);
    }
  }
  return { width, rows };
}

function glyphFromRows(width: number, top: number, rows: readonly string[]): Glyph {
  const bits = new Uint8Array(width * rows.length);
  let inkTop: number | undefined;
  let inkBottom = -1;
  rows.forEach((row, rowIndex) => {
    for (let column = 0; column < width; column += 1) {
      if (row[column] !== '#') continue;
      bits[rowIndex * width + column] = 1;
      inkTop ??= top + rowIndex;
      inkBottom = top + rowIndex;
    }
  });
  return { width, top, height: rows.length, bits, inkTop: inkTop ?? 0, inkBottom };
}

function baseGlyph(spec: FontSpec, char: string, source: string): Glyph {
  const { width, rows } = parseRows(source, JSON.stringify(char));
  const maxRows = spec.capHeight + spec.descent;
  if (rows.length < spec.capHeight || rows.length > maxRows) {
    throw new Error(
      `font ${spec.name} glyph ${JSON.stringify(char)}: needs ${String(spec.capHeight)}..${String(maxRows)} rows`,
    );
  }
  return glyphFromRows(width, 0, rows);
}

/** Overlays `mark` onto `base` at (column, row) in font units relative to the base glyph. */
function overlay(base: Glyph, mark: Bitmap, column: number, row: number): Glyph {
  const top = Math.min(base.top, row);
  const bottom = Math.max(base.top + base.height, row + mark.rows.length);
  const grid = Array.from({ length: bottom - top }, () => new Array<string>(base.width).fill('.'));
  for (let y = 0; y < base.height; y += 1) {
    for (let x = 0; x < base.width; x += 1) {
      const line = grid[base.top - top + y];
      if (line && base.bits[y * base.width + x] === 1) line[x] = '#';
    }
  }
  mark.rows.forEach((markRow, y) => {
    for (let x = 0; x < mark.width; x += 1) {
      const line = grid[row - top + y];
      const target = column + x;
      if (line && markRow[x] === '#' && target >= 0 && target < base.width) line[target] = '#';
    }
  });
  return glyphFromRows(
    base.width,
    top,
    grid.map((line) => line.join('')),
  );
}

function composeGlyph(spec: FontSpec, base: Glyph, markName: MarkName): Glyph {
  const mark = parseRows(spec.marks[markName], markName);
  if (markName === 'ogonek') {
    return overlay(base, mark, base.width - mark.width, spec.capHeight);
  }
  // One empty row between the mark and the top of the letter (capital or x-height).
  const row = base.inkTop - 1 - mark.rows.length;
  if (row < -spec.ascent) {
    throw new Error(`font ${spec.name}: ${markName} does not fit into the ascent`);
  }
  return overlay(base, mark, Math.ceil((base.width - mark.width) / 2), row);
}

function substitute(text: string): string {
  let result = '';
  for (const char of text) result += CHARACTER_SUBSTITUTES[char] ?? char;
  return result;
}

export function compileFont(spec: FontSpec): BitmapFont {
  const glyphs = new Map<string, Glyph>();
  for (const [char, source] of Object.entries(spec.glyphs)) {
    glyphs.set(char, baseGlyph(spec, char, source));
  }
  for (const [char, [baseChar, mark]] of Object.entries(spec.composed)) {
    const base = glyphs.get(baseChar);
    if (!base) throw new Error(`font ${spec.name}: ${char} is composed from missing ${baseChar}`);
    glyphs.set(char, composeGlyph(spec, base, mark));
  }
  const fallback = baseGlyph(spec, 'fallback', spec.fallback);
  const lookup = (char: string): Glyph | undefined => glyphs.get(char);
  return {
    name: spec.name,
    capHeight: spec.capHeight,
    ascent: spec.ascent,
    descent: spec.descent,
    lineHeight: spec.ascent + spec.capHeight + spec.descent,
    advance(char) {
      if (spec.fixedAdvance !== undefined) return spec.fixedAdvance;
      if (char === ' ') return spec.spaceAdvance;
      return (lookup(char) ?? fallback).width + spec.spacing;
    },
    glyph: (char) => lookup(char) ?? fallback,
    has: (char) => char === ' ' || glyphs.has(char),
    normalize(text) {
      const plain = substitute(text);
      if (!spec.upperOnly) return plain;
      let upper = '';
      for (const char of plain) {
        const mapped = char.toUpperCase();
        upper += mapped.length === 1 ? mapped : char;
      }
      return upper;
    },
  };
}
