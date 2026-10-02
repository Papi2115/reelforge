/**
 * "Forge Voxel 5x7": the kit's own bitmap font for voxel text (labels, counters, tickers),
 * authored in this repo (CC0, docs/licenses.md). Caps only, 7 rows, 1-voxel strokes; `bold`
 * widens every vertical stroke by one voxel (chunky counter digits). Lower case is drawn with
 * the capitals, accented letters with their base letter.
 */

export const GLYPH_ROWS = 7;
/** Empty columns between glyphs. */
export const GLYPH_SPACING = 1;
const SPACE_WIDTH = 3;

const GLYPHS: Readonly<Record<string, string>> = {
  A: '.###./#...#/#...#/#####/#...#/#...#/#...#',
  B: '####./#...#/#...#/####./#...#/#...#/####.',
  C: '.###./#...#/#..../#..../#..../#...#/.###.',
  D: '####./#...#/#...#/#...#/#...#/#...#/####.',
  E: '#####/#..../#..../####./#..../#..../#####',
  F: '#####/#..../#..../####./#..../#..../#....',
  G: '.###./#...#/#..../#.###/#...#/#...#/.####',
  H: '#...#/#...#/#...#/#####/#...#/#...#/#...#',
  I: '###/.#./.#./.#./.#./.#./###',
  J: '..###/...#./...#./...#./#..#./#..#./.##..',
  K: '#...#/#..#./#.#../##.../#.#../#..#./#...#',
  L: '#..../#..../#..../#..../#..../#..../#####',
  M: '#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#',
  N: '#...#/##..#/##..#/#.#.#/#..##/#..##/#...#',
  O: '.###./#...#/#...#/#...#/#...#/#...#/.###.',
  P: '####./#...#/#...#/####./#..../#..../#....',
  Q: '.###./#...#/#...#/#...#/#.#.#/#..#./.##.#',
  R: '####./#...#/#...#/####./#.#../#..#./#...#',
  S: '.####/#..../#..../.###./....#/....#/####.',
  T: '#####/..#../..#../..#../..#../..#../..#..',
  U: '#...#/#...#/#...#/#...#/#...#/#...#/.###.',
  V: '#...#/#...#/#...#/#...#/#...#/.#.#./..#..',
  W: '#...#/#...#/#...#/#.#.#/#.#.#/##.##/#...#',
  X: '#...#/#...#/.#.#./..#../.#.#./#...#/#...#',
  Y: '#...#/#...#/.#.#./..#../..#../..#../..#..',
  Z: '#####/....#/...#./..#../.#.../#..../#####',
  '0': '.###./#...#/#...#/#...#/#...#/#...#/.###.',
  '1': '..#../.##../..#../..#../..#../..#../.###.',
  '2': '.###./#...#/....#/...#./..#../.#.../#####',
  '3': '#####/...#./..#../...#./....#/#...#/.###.',
  '4': '...#./..##./.#.#./#..#./#####/...#./...#.',
  '5': '#####/#..../####./....#/....#/#...#/.###.',
  '6': '..##./.#.../#..../####./#...#/#...#/.###.',
  '7': '#####/....#/...#./..#../.#.../.#.../.#...',
  '8': '.###./#...#/#...#/.###./#...#/#...#/.###.',
  '9': '.###./#...#/#...#/.####/....#/...#./.##..',
  '.': './././././#/#',
  ',': '../../../../.#/.#/#.',
  ':': './#/#/././#/#',
  ';': '../.#/.#/../.#/.#/#.',
  '!': '#/#/#/#/#/./#',
  '?': '.###./#...#/....#/...#./..#../...../..#..',
  "'": '#/#/././././.',
  '"': '#.#/#.#/.../.../.../.../...',
  '-': '..../..../..../####/..../..../....',
  '+': '...../..#../..#../#####/..#../..#../.....',
  '=': '..../..../####/..../####/..../....',
  '/': '....#/....#/...#./..#../.#.../#..../#....',
  '(': '.#/#./#./#./#./#./.#',
  ')': '#./.#/.#/.#/.#/.#/#.',
  '[': '##/#./#./#./#./#./##',
  ']': '##/.#/.#/.#/.#/.#/##',
  '%': '##..#/##..#/...#./..#../.#.../#..##/#..##',
  $: '..#../.####/#.#../.###./..#.#/####./..#..',
  '€': '..###/.#.../####./.#.../####./.#.../..###',
  '£': '..##./.#..#/.#.../###../.#.../.#.../#####',
  '#': '.#.#./.#.#./#####/.#.#./#####/.#.#./.#.#.',
  '&': '.##../#..#./#.#../.#.../#.#.#/#..#./.##.#',
  '*': '...../#.#.#/.###./#####/.###./#.#.#/.....',
  '<': '...#/..#./.#../#.../.#../..#./...#',
  '>': '#.../.#../..#./...#/..#./.#../#...',
  _: '...../...../...../...../...../...../#####',
  '@': '.###./#...#/#.###/#.#.#/#.###/#..../.####',
  '·': './././#/././.',
  '•': '../../##/##/../../..',
  '×': '...../#...#/.#.#./..#../.#.#./#...#/.....',
  '→': '...../..#../...#./#####/...#./..#../.....',
  '←': '...../..#../.#.../#####/.#.../..#../.....',
  '↑': '..#../.###./#.#.#/..#../..#../..#../..#..',
  '↓': '..#../..#../..#../..#../#.#.#/.###./..#..',
};

/** Ink of a character the font lacks. */
const FALLBACK = '#####/#...#/#...#/#...#/#...#/#...#/#####';

/** Typographic characters drawn with a look-alike, letters without their own glyph. */
const SUBSTITUTES: Readonly<Record<string, string>> = {
  '‘': "'",
  '’': "'",
  '“': '"',
  '”': '"',
  '„': '"',
  '–': '-',
  '—': '-',
  '…': '...',
  Ł: 'L',
  Ø: 'O',
  ß: 'SS',
  '\t': ' ',
};

export interface VoxelGlyph {
  readonly width: number;
  /** width x GLYPH_ROWS cells, row 0 = top row, 1 = ink. */
  readonly bits: Uint8Array;
}

function parseGlyph(source: string, bold: boolean): VoxelGlyph {
  const rows = source.split('/');
  const plain = rows[0]?.length ?? 0;
  if (rows.length !== GLYPH_ROWS || rows.some((row) => row.length !== plain)) {
    throw new Error(`voxel font: glyph ${source} must be ${String(GLYPH_ROWS)} equal rows`);
  }
  const width = plain + (bold ? 1 : 0);
  const bits = new Uint8Array(width * GLYPH_ROWS);
  rows.forEach((row, y) => {
    for (let x = 0; x < width; x += 1) {
      const ink = row[x] === '#' || (bold && x > 0 && row[x - 1] === '#');
      if (ink) bits[y * width + x] = 1;
    }
  });
  return { width, bits };
}

const cache = new Map<string, VoxelGlyph>();

/** Upper case, accents stripped, typographic look-alikes substituted, newlines kept. */
export function normalizeText(text: string): string {
  let result = '';
  for (const char of text) {
    const upper = char.toUpperCase();
    const mapped = SUBSTITUTES[upper] ?? SUBSTITUTES[char];
    if (mapped !== undefined) {
      result += mapped;
    } else if (GLYPHS[upper] !== undefined || upper === ' ' || upper === '\n') {
      result += upper;
    } else {
      const stripped = upper.normalize('NFD').replace(/\p{M}/gu, '');
      result += stripped.length > 0 ? stripped : upper;
    }
  }
  return result;
}

/** Glyph of a normalized character (the fallback box for unknown ones); undefined = space. */
export function glyphOf(char: string, bold = false): VoxelGlyph | undefined {
  if (char === ' ') return undefined;
  const key = `${bold ? 'b' : 'r'}${char}`;
  let glyph = cache.get(key);
  if (!glyph) {
    glyph = parseGlyph(GLYPHS[char] ?? FALLBACK, bold);
    cache.set(key, glyph);
  }
  return glyph;
}

export function hasGlyph(char: string): boolean {
  return char === ' ' || GLYPHS[char] !== undefined;
}

export interface PlacedGlyph {
  readonly char: string;
  /** Left column in voxels from the start of the line. */
  readonly x: number;
  readonly glyph: VoxelGlyph | undefined;
}

export interface LineLayout {
  readonly glyphs: readonly PlacedGlyph[];
  /** Width in voxels (no trailing spacing). */
  readonly width: number;
}

/** Glyph positions of one normalized line. */
export function layoutLine(line: string, bold = false): LineLayout {
  const glyphs: PlacedGlyph[] = [];
  let x = 0;
  let width = 0;
  for (const char of line) {
    const glyph = glyphOf(char, bold);
    glyphs.push({ char, x, glyph });
    const advance = glyph ? glyph.width : SPACE_WIDTH + (bold ? 1 : 0);
    if (glyph) width = x + glyph.width;
    x += advance + GLYPH_SPACING;
  }
  return { glyphs, width };
}

/** Width in voxels of a (raw) single line of text. */
export function measureLine(text: string, bold = false): number {
  return layoutLine(normalizeText(text), bold).width;
}

/**
 * Greedy word wrap of `text` into at most `maxLines` lines no wider than `maxWidth` voxels
 * (a single over-long word stays on its own line).
 */
export function wrapText(text: string, maxWidth: number, maxLines: number, bold = false): string[] {
  const lines: string[] = [];
  for (const paragraph of normalizeText(text).split('\n')) {
    let line = '';
    for (const word of paragraph.split(' ').filter((part) => part.length > 0)) {
      const candidate = line.length === 0 ? word : `${line} ${word}`;
      if (line.length > 0 && layoutLine(candidate, bold).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    lines.push(line);
  }
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = [kept[maxLines - 1], ...lines.slice(maxLines)].join(' ');
  return kept;
}
