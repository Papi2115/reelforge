/**
 * Handwriting for the whiteboard: the kit's own 5x7 caps font (fx/font.ts, CC0) written with the
 * marker glyph by glyph. Every glyph's cells are put in pen order (connected strokes from the top
 * left, branches resumed where they leave), rows are sheared into a slight slant and glyphs bob
 * a pixel off the baseline by a seeded hash, so the lettering reads as written, not typeset.
 */
import { hashCell } from '../../env/shared.js';
import { GLYPH_ROWS, layoutLine, normalizeText, type VoxelGlyph } from '../../fx/font.js';
import type { Box, Point } from './geometry.js';

type Cell = readonly [number, number];

/** Neighbour order: continue down/right first (how caps are written), diagonals last. */
const STEPS: readonly Cell[] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [-1, 1],
  [0, -1],
  [-1, 0],
  [1, -1],
  [-1, -1],
];

const orderCache = new WeakMap<VoxelGlyph, Cell[][]>();

/** Ink cells of a glyph as pen paths (column, row), cached per glyph. */
export function glyphStrokes(glyph: VoxelGlyph): Cell[][] {
  const cached = orderCache.get(glyph);
  if (cached) return cached;
  const ink = (column: number, row: number): boolean =>
    column >= 0 &&
    column < glyph.width &&
    row >= 0 &&
    row < GLYPH_ROWS &&
    glyph.bits[row * glyph.width + column] === 1;
  const seen = new Set<number>();
  const key = (column: number, row: number): number => row * glyph.width + column;
  const unseenNeighbour = (cell: Cell, preferred?: Cell): Cell | undefined => {
    const steps = preferred ? [preferred, ...STEPS] : STEPS;
    for (const [dx, dy] of steps) {
      const next: Cell = [cell[0] + dx, cell[1] + dy];
      if (ink(next[0], next[1]) && !seen.has(key(next[0], next[1]))) return next;
    }
    return undefined;
  };
  const strokes: Cell[][] = [];
  for (;;) {
    let start: Cell | undefined;
    let branch: Cell | undefined;
    for (const stroke of strokes) {
      for (const cell of stroke) {
        if (!branch && unseenNeighbour(cell)) branch = cell;
      }
    }
    if (!branch) {
      for (let row = 0; row < GLYPH_ROWS && !start; row += 1) {
        for (let column = 0; column < glyph.width && !start; column += 1) {
          if (ink(column, row) && !seen.has(key(column, row))) start = [column, row];
        }
      }
    }
    const first = branch ?? start;
    if (!first) break;
    const stroke: Cell[] = [first];
    seen.add(key(first[0], first[1]));
    let direction: Cell | undefined;
    let current = first;
    for (;;) {
      const next = unseenNeighbour(current, direction);
      if (!next) break;
      direction = [next[0] - current[0], next[1] - current[1]];
      seen.add(key(next[0], next[1]));
      stroke.push(next);
      current = next;
    }
    strokes.push(stroke);
  }
  orderCache.set(glyph, strokes);
  return strokes;
}

export interface HandStyle {
  /** Cell size in raster px (2 = 14-px caps). */
  readonly scale: number;
  /** Shear 0..1 (1 = the top row leans 1.5 cells right). */
  readonly slant: number;
  /** Seed of the baseline bob. */
  readonly seed: number;
}

export interface WrittenGlyph {
  readonly char: string;
  /** Pen paths (top-left corners of cells, raster px). */
  readonly paths: Point[][];
  readonly box: Box;
}

export interface WrittenLine {
  readonly glyphs: readonly WrittenGlyph[];
  readonly box: Box;
  /** Boxes of the words (space separated), in order. */
  readonly words: readonly Box[];
}

/** Width in raster px of a line written at `scale` (slant included). */
export function writtenWidth(text: string, style: Pick<HandStyle, 'scale' | 'slant'>): number {
  const layout = layoutLine(normalizeText(text));
  return layout.width * style.scale + slantShift(0, style);
}

export function writtenHeight(style: Pick<HandStyle, 'scale'>): number {
  return GLYPH_ROWS * style.scale + 1;
}

function slantShift(row: number, style: Pick<HandStyle, 'scale' | 'slant'>): number {
  const top = Math.round(style.scale * 1.5 * style.slant);
  return Math.round(((GLYPH_ROWS - 1 - row) / (GLYPH_ROWS - 1)) * top);
}

function union(boxes: readonly Box[]): Box {
  const x0 = Math.min(...boxes.map((box) => box.x));
  const y0 = Math.min(...boxes.map((box) => box.y));
  const x1 = Math.max(...boxes.map((box) => box.x + box.width));
  const y1 = Math.max(...boxes.map((box) => box.y + box.height));
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/** Writes one line with its top-left corner at (x, y). */
export function writeLine(text: string, x: number, y: number, style: HandStyle): WrittenLine {
  const layout = layoutLine(normalizeText(text));
  const { scale } = style;
  const glyphs: WrittenGlyph[] = [];
  const words: Box[] = [];
  let word: Box[] = [];
  const closeWord = (): void => {
    if (word.length > 0) words.push(union(word));
    word = [];
  };
  layout.glyphs.forEach((placed, index) => {
    if (!placed.glyph) {
      closeWord();
      return;
    }
    const roll = hashCell(index, text.length, 3, style.seed);
    const bob = scale < 2 ? 0 : roll < 0.22 ? -1 : roll > 0.84 ? 1 : 0;
    const left = Math.round(x + placed.x * scale);
    const top = Math.round(y + bob);
    const paths = glyphStrokes(placed.glyph).map((stroke) =>
      stroke.map(
        ([column, row]) =>
          [left + column * scale + slantShift(row, style), top + row * scale] as const,
      ),
    );
    const box = {
      x: left,
      y: top,
      width: placed.glyph.width * scale + slantShift(0, style),
      height: GLYPH_ROWS * scale,
    };
    glyphs.push({ char: placed.char, paths, box });
    word.push(box);
  });
  closeWord();
  const box =
    glyphs.length > 0
      ? union(glyphs.map((glyph) => glyph.box))
      : { x: Math.round(x), y: Math.round(y), width: 0, height: GLYPH_ROWS * scale };
  return { glyphs, box, words };
}
