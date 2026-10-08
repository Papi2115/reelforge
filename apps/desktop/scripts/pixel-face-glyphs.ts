/**
 * Glyphs of the app's pixel title face (PLAN.md#13.12, U13): the engine's CC0 "Forge Display"
 * bitmap font (packages/engine/src/text/font-display.ts, ADR-005) as rectangle outlines. A code
 * point is drawn exactly as `ctx.text` draws it: through the font's `normalize` (lower case as the
 * capitals, typographic quotes and dashes as their plain look-alikes, "…" as three dots), so the
 * face covers only what the engine font can draw; anything else falls back to the system face.
 */
import type { BitmapFont } from '@reelforge/engine';

/** Font units per bitmap pixel; the em is EM_PIXELS pixels (cap height 7 = 0.7 em). */
export const UNITS_PER_PIXEL = 100;
export const EM_PIXELS = 10;

/** Code points offered to the face: printable ASCII, Polish letters and common typography. */
export const PIXEL_FACE_CODE_POINTS: readonly number[] = [
  ...Array.from({ length: 0x7e - 0x20 + 1 }, (_, index) => 0x20 + index),
  0xa0, // no-break space
  ...Array.from('·ÓóĄąĆćĘęŁłŃńŚśŹźŻż–—‘’‚“”„…€', (char) => char.codePointAt(0) ?? 0),
].sort((a, b) => a - b);

/** An ink rectangle in bitmap pixels; `top`/`bottom` are rows relative to the cap line. */
export interface PixelRect {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

export interface PixelFaceGlyph {
  /** The engine characters this glyph draws (one glyph per distinct normalized text). */
  readonly text: string;
  readonly codePoints: readonly number[];
  /** Advance in bitmap pixels (the engine's advance: glyph width + spacing). */
  readonly advance: number;
  readonly rects: readonly PixelRect[];
}

/** Ink cells of `text` laid out like `ctx.text` lays out a line, keyed `column,row`. */
function inkCells(font: BitmapFont, text: string): { cells: Set<string>; advance: number } {
  const cells = new Set<string>();
  let pen = 0;
  for (const char of text) {
    if (char !== ' ') {
      const glyph = font.glyph(char);
      for (let y = 0; y < glyph.height; y += 1) {
        for (let x = 0; x < glyph.width; x += 1) {
          if (glyph.bits[y * glyph.width + x] === 1)
            cells.add(`${String(pen + x)},${String(glyph.top + y)}`);
        }
      }
    }
    pen += font.advance(char);
  }
  return { cells, advance: pen };
}

/**
 * Horizontal runs of each row, merged downwards while a run repeats in the next row: few,
 * non-overlapping rectangles whose union is exactly the ink.
 */
export function inkRects(cells: ReadonlySet<string>): PixelRect[] {
  const rows = new Map<number, number[]>();
  for (const key of cells) {
    const [column = 0, row = 0] = key.split(',').map(Number);
    rows.set(row, [...(rows.get(row) ?? []), column]);
  }
  interface OpenRect {
    readonly left: number;
    readonly right: number;
    readonly top: number;
  }
  const rects: PixelRect[] = [];
  let open = new Map<string, OpenRect>();
  let previousRow = 0;
  for (const row of [...rows.keys()].sort((a, b) => a - b)) {
    const next = new Map<string, OpenRect>();
    for (const run of rowRuns(rows.get(row) ?? [])) {
      const key = `${String(run.left)}-${String(run.right)}`;
      const continued = row === previousRow + 1 ? open.get(key) : undefined;
      next.set(key, continued ?? { ...run, top: row });
    }
    for (const [key, rect] of open) {
      if (next.get(key) !== rect) rects.push({ ...rect, bottom: previousRow + 1 });
    }
    open = next;
    previousRow = row;
  }
  for (const rect of open.values()) rects.push({ ...rect, bottom: previousRow + 1 });
  return rects.sort((a, b) => a.top - b.top || a.left - b.left);
}

function rowRuns(columns: readonly number[]): { left: number; right: number }[] {
  const runs: { left: number; right: number }[] = [];
  for (const column of [...columns].sort((a, b) => a - b)) {
    const last = runs.at(-1);
    if (last?.right === column) last.right = column + 1;
    else runs.push({ left: column, right: column + 1 });
  }
  return runs;
}

/** The glyphs of the face in a fixed order (first code point), deduplicated by drawn text. */
export function pixelFaceGlyphs(font: BitmapFont): PixelFaceGlyph[] {
  const byText = new Map<string, number[]>();
  for (const codePoint of PIXEL_FACE_CODE_POINTS) {
    const text = font.normalize(String.fromCodePoint(codePoint));
    if (text.length === 0 || !Array.from(text).every((char) => font.has(char))) continue;
    byText.set(text, [...(byText.get(text) ?? []), codePoint]);
  }
  return [...byText].map(([text, codePoints]) => {
    const { cells, advance } = inkCells(font, text);
    return { text, codePoints, advance, rects: inkRects(cells) };
  });
}

/** The replacement box of the engine font (its glyph for a character it lacks). */
export function notdefGlyph(font: BitmapFont): PixelFaceGlyph {
  const missing = '\u0001';
  const { cells, advance } = inkCells(font, missing);
  return { text: missing, codePoints: [], advance, rects: inkRects(cells) };
}
