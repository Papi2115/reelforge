/**
 * Tiny 3x5 pixel font for prop screens (LCD digits, phone clock, code) and voxel lettering on
 * paper. Upper-case only (input is upper-cased); unknown characters draw as '?'.
 */

const GLYPH_ROWS: Readonly<Record<string, string>> = {
  '0': '111 101 101 101 111',
  '1': '010 110 010 010 111',
  '2': '111 001 111 100 111',
  '3': '111 001 111 001 111',
  '4': '101 101 111 001 001',
  '5': '111 100 111 001 111',
  '6': '111 100 111 101 111',
  '7': '111 001 010 010 010',
  '8': '111 101 111 101 111',
  '9': '111 101 111 001 111',
  A: '010 101 111 101 101',
  B: '110 101 110 101 110',
  C: '011 100 100 100 011',
  D: '110 101 101 101 110',
  E: '111 100 110 100 111',
  F: '111 100 110 100 100',
  G: '011 100 101 101 011',
  H: '101 101 111 101 101',
  I: '111 010 010 010 111',
  J: '001 001 001 101 010',
  K: '101 101 110 101 101',
  L: '100 100 100 100 111',
  M: '101 111 111 101 101',
  N: '110 101 101 101 101',
  O: '010 101 101 101 010',
  P: '110 101 110 100 100',
  Q: '010 101 101 110 011',
  R: '110 101 110 101 101',
  S: '011 100 010 001 110',
  T: '111 010 010 010 010',
  U: '101 101 101 101 111',
  V: '101 101 101 101 010',
  W: '101 101 111 111 101',
  X: '101 101 010 101 101',
  Y: '101 101 010 010 010',
  Z: '111 001 010 100 111',
  ' ': '000 000 000 000 000',
  '.': '000 000 000 000 010',
  ',': '000 000 000 010 100',
  ':': '000 010 000 010 000',
  '-': '000 000 111 000 000',
  '+': '000 010 111 010 000',
  '=': '000 111 000 111 000',
  '%': '101 001 010 100 101',
  '/': '001 001 010 100 100',
  $: '011 110 010 011 110',
  '!': '010 010 010 000 010',
  '?': '111 001 010 000 010',
  '#': '101 111 101 111 101',
  '*': '000 101 010 101 000',
  '(': '001 010 010 010 001',
  ')': '100 010 010 010 100',
  '<': '001 010 100 010 001',
  '>': '100 010 001 010 100',
  _: '000 000 000 000 111',
  "'": '010 010 000 000 000',
};

export const GLYPH_WIDTH = 3;
export const GLYPH_HEIGHT = 5;
/** Horizontal advance (glyph + 1 gap) and line advance (glyph + 1 gap), in font pixels. */
export const GLYPH_ADVANCE = 4;
export const LINE_ADVANCE = 6;

/** Characters the font draws (others draw as '?'). */
export const FONT_CHARACTERS = Object.keys(GLYPH_ROWS).join('');

function glyphBits(char: string): readonly string[] {
  const rows = GLYPH_ROWS[char] ?? GLYPH_ROWS['?'] ?? '';
  return rows.split(' ');
}

export interface TextBlock {
  readonly lines: readonly string[];
  /** Size of the drawn block at scale 1, in font pixels. */
  readonly width: number;
  readonly height: number;
}

export function textBlock(text: string): TextBlock {
  const lines = text.toUpperCase().split('\n');
  const longest = Math.max(...lines.map((line) => Array.from(line).length));
  return {
    lines,
    width: Math.max(0, longest * GLYPH_ADVANCE - 1),
    height: lines.length * LINE_ADVANCE - 1,
  };
}

/** Largest integer scale (>= 1) at which `block` fits into width x height. */
export function fitScale(block: TextBlock, width: number, height: number): number {
  let scale = 1;
  while ((scale + 1) * block.width <= width && (scale + 1) * block.height <= height) scale += 1;
  return scale;
}

export type TextAlign = 'left' | 'center' | 'right';

/**
 * Calls `plot(x, y)` for every lit font pixel of `text` laid out in the box (x0, y0, width) with
 * y growing downwards; lines are aligned within the box.
 */
export function drawText(
  text: string,
  box: { readonly x: number; readonly y: number; readonly width: number },
  scale: number,
  align: TextAlign,
  plot: (x: number, y: number) => void,
): void {
  textBlock(text).lines.forEach((line, lineIndex) => {
    const chars = Array.from(line);
    const lineWidth = Math.max(0, chars.length * GLYPH_ADVANCE - 1) * scale;
    const free = box.width - lineWidth;
    const left = box.x + (align === 'left' ? 0 : align === 'right' ? free : Math.floor(free / 2));
    const top = box.y + lineIndex * LINE_ADVANCE * scale;
    chars.forEach((char, charIndex) => {
      glyphBits(char).forEach((bits, row) => {
        Array.from(bits).forEach((bit, column) => {
          if (bit !== '1') return;
          const gx = left + (charIndex * GLYPH_ADVANCE + column) * scale;
          const gy = top + row * scale;
          for (let dy = 0; dy < scale; dy += 1) {
            for (let dx = 0; dx < scale; dx += 1) plot(gx + dx, gy + dy);
          }
        });
      });
    });
  });
}
