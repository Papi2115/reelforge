/**
 * A coarse block view of a rendered frame for the anti-slop frame guards (docs/worlds/QUALITY.md
 * §8): ~80 blocks across (8 px at 640 wide = one Bayer period, so the voxel styles' dithering
 * averages out), each block's mean colour, the frame's background (per-channel median block) and
 * how far every block stands out from it. Pure functions of the pixels: deterministic.
 */
import type { RgbaImage } from '@reelforge/engine/raster';

/** Blocks across a frame (block size = width / this, at least 8 px). */
export const GRID_COLUMNS = 80;

export interface BlockGrid {
  readonly columns: number;
  readonly rows: number;
  /** Block size in pixels. */
  readonly block: number;
  /** Largest channel difference of each block's mean colour from the background (0..255). */
  readonly contrast: Float32Array;
  /** Mean luma of each block (0..255, Rec. 601 weights). */
  readonly luma: Float32Array;
}

export function blockSizeFor(width: number): number {
  return Math.max(8, Math.round(width / GRID_COLUMNS));
}

function median(values: Float32Array): number {
  const sorted = Float32Array.from(values).sort();
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

export function blockGrid(image: RgbaImage): BlockGrid {
  const block = blockSizeFor(image.width);
  const columns = Math.floor(image.width / block);
  const rows = Math.floor(image.height / block);
  const count = columns * rows;
  const [reds, greens, blues] = [
    new Float32Array(count),
    new Float32Array(count),
    new Float32Array(count),
  ];
  const area = block * block;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      let [red, green, blue] = [0, 0, 0];
      for (let y = 0; y < block; y += 1) {
        const offset = ((row * block + y) * image.width + column * block) * 4;
        for (let x = 0; x < block; x += 1) {
          red += image.data[offset + x * 4] ?? 0;
          green += image.data[offset + x * 4 + 1] ?? 0;
          blue += image.data[offset + x * 4 + 2] ?? 0;
        }
      }
      const index = row * columns + column;
      reds[index] = red / area;
      greens[index] = green / area;
      blues[index] = blue / area;
    }
  }
  const [backRed, backGreen, backBlue] = [median(reds), median(greens), median(blues)];
  const contrast = new Float32Array(count);
  const luma = new Float32Array(count);
  for (let index = 0; index < count; index += 1) {
    const [red, green, blue] = [reds[index] ?? 0, greens[index] ?? 0, blues[index] ?? 0];
    contrast[index] = Math.max(
      Math.abs(red - backRed),
      Math.abs(green - backGreen),
      Math.abs(blue - backBlue),
    );
    luma[index] = 0.299 * red + 0.587 * green + 0.114 * blue;
  }
  return { columns, rows, block, contrast, luma };
}

/** 1 where a block stands out from the background by more than `threshold`. */
export function contrastMask(grid: BlockGrid, threshold: number): Uint8Array {
  return Uint8Array.from(grid.contrast, (value) => (value > threshold ? 1 : 0));
}

export interface Component {
  /** Marked blocks of the component (before merging gaps). */
  readonly blocks: number;
  readonly minColumn: number;
  readonly maxColumn: number;
  readonly minRow: number;
  readonly maxRow: number;
}

/** `mask` grown by `radius` blocks (8-neighbourhood, square). */
function dilate(mask: Uint8Array, columns: number, rows: number, radius: number): Uint8Array {
  if (radius <= 0) return mask;
  const grown = new Uint8Array(mask.length);
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      if (mask[row * columns + column] !== 1) continue;
      for (let y = Math.max(0, row - radius); y <= Math.min(rows - 1, row + radius); y += 1) {
        for (
          let x = Math.max(0, column - radius);
          x <= Math.min(columns - 1, column + radius);
          x += 1
        )
          grown[y * columns + x] = 1;
      }
    }
  }
  return grown;
}

/**
 * Connected groups of marked blocks; marks closer than `merge` blocks join one group (a word's
 * letters, a figure's strokes). Sizes count only the original marks. Row-major order.
 */
export function components(
  mask: Uint8Array,
  columns: number,
  rows: number,
  merge: number,
): Component[] {
  const grown = dilate(mask, columns, rows, merge);
  const label = new Int32Array(mask.length).fill(-1);
  const found: Component[] = [];
  for (let start = 0; start < grown.length; start += 1) {
    if (grown[start] !== 1 || label[start] !== -1) continue;
    const id = found.length;
    const stack = [start];
    label[start] = id;
    let [blocks, minColumn, maxColumn, minRow, maxRow] = [0, columns, -1, rows, -1];
    while (stack.length > 0) {
      const index = stack.pop() ?? 0;
      const [row, column] = [Math.floor(index / columns), index % columns];
      if (mask[index] === 1) {
        blocks += 1;
        minColumn = Math.min(minColumn, column);
        maxColumn = Math.max(maxColumn, column);
        minRow = Math.min(minRow, row);
        maxRow = Math.max(maxRow, row);
      }
      for (let y = Math.max(0, row - 1); y <= Math.min(rows - 1, row + 1); y += 1) {
        for (let x = Math.max(0, column - 1); x <= Math.min(columns - 1, column + 1); x += 1) {
          const next = y * columns + x;
          if (grown[next] === 1 && label[next] === -1) {
            label[next] = id;
            stack.push(next);
          }
        }
      }
    }
    found.push({ blocks, minColumn, maxColumn, minRow, maxRow });
  }
  return found.filter((component) => component.blocks > 0);
}
