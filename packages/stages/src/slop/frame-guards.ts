/**
 * The frame guards of docs/worlds/QUALITY.md §8, measured on rendered frames: clutter (competing
 * high-contrast elements, accent-colour share), symmetry with a centred hero, and the
 * same-composition signature of a shot's key frame. Measures only: guards.ts turns them into ⚠.
 * Thresholds are calibrated on the approved Sketchbook A/B/C, pop-up and strip goldens and the
 * voxel goldens (slop.frames.test.ts) and documented in QUALITY.md §8.
 */
import type { RgbaImage } from '@reelforge/engine/raster';
import {
  blockGrid,
  components,
  contrastMask,
  type BlockGrid,
  type Component,
} from './frame-grid.js';

/** A block whose colour differs this much from the background is content (frame-content.ts). */
export const CONTENT_THRESHOLD = 24;
/** … and this much: a high-contrast mark that competes for the eye (pencil texture does not). */
export const COMPETING_THRESHOLD = 64;
/** Marks closer than this many blocks are one element (a word, a figure). */
export const ELEMENT_MERGE = 2;
/** An element covers at least this share of the frame's blocks (smaller = texture). */
export const MIN_ELEMENT_SHARE = 0.002;
/** Pixels within this RGB distance (sum of channels) of the accent swatch count as accent. */
export const ACCENT_TOLERANCE = 30;
/** Mirrored blocks within this luma difference count as the same. */
export const MIRROR_TOLERANCE = 10;
/** Symmetry ignores this share of the width at each side (a sketchbook's spiral binding). */
export const EDGE_BAND = 0.08;
/** Content below this share of the frame: too little to judge symmetry or composition. */
export const MIN_JUDGED_CONTENT = 0.02;
/** Signature cells across/down (one cell = 5 x 5 blocks at 80 blocks across). */
export const SIGNATURE_COLUMNS = 16;
export const SIGNATURE_ROWS = 9;
/** Brightness steps between signature cells up to this (luma) are flat. */
export const SIGNATURE_MARGIN = 4;

export interface FrameMetrics {
  /** Competing high-contrast elements (connected groups above MIN_ELEMENT_SHARE). */
  readonly competing: number;
  /** Share of pixels in the accent colour (0..1; 0 without an accent). */
  readonly accentShare: number;
  /** Share of blocks that are content (0..1). */
  readonly content: number;
  /**
   * Left-right mirror similarity of the content between the edge bands: content blocks mirrored by
   * content of the same brightness, over the content of either side (0..1).
   */
  readonly mirror: number;
  /** Horizontal distance of the content centroid from the centre, share of the width (0..0.5). */
  readonly centroidOffset: number;
  /** Horizontal distance of the biggest central element's centre from the centre (0..0.5). */
  readonly heroOffset: number;
}

/** "#rrggbb" -> [r, g, b]; undefined for anything else. */
export function parseHex(hex: string | undefined): readonly [number, number, number] | undefined {
  if (hex === undefined || !/^#[0-9a-f]{6}$/i.test(hex)) return undefined;
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function accentShare(
  image: RgbaImage,
  accent: readonly [number, number, number] | undefined,
): number {
  if (accent === undefined) return 0;
  const pixels = image.width * image.height;
  let hits = 0;
  for (let offset = 0; offset < pixels * 4; offset += 4) {
    const distance =
      Math.abs((image.data[offset] ?? 0) - accent[0]) +
      Math.abs((image.data[offset + 1] ?? 0) - accent[1]) +
      Math.abs((image.data[offset + 2] ?? 0) - accent[2]);
    if (distance <= ACCENT_TOLERANCE) hits += 1;
  }
  return pixels === 0 ? 0 : hits / pixels;
}

function competingElements(grid: BlockGrid, mask: Uint8Array): Component[] {
  const minimum = Math.max(2, Math.round(MIN_ELEMENT_SHARE * grid.contrast.length));
  return components(mask, grid.columns, grid.rows, ELEMENT_MERGE).filter(
    (component) => component.blocks >= minimum,
  );
}

/** `mask` without its outer EDGE_BAND columns (binding, page edge, frame furniture). */
function centralMask(mask: Uint8Array, columns: number): Uint8Array {
  const band = Math.round(EDGE_BAND * columns);
  return mask.map((value, index) => {
    const column = index % columns;
    return column < band || column >= columns - band ? 0 : value;
  });
}

/**
 * Content blocks whose mirror block is content of the same brightness, over the content blocks of
 * either side: 1 = a perfect left-right mirror image.
 */
function mirrorScore(grid: BlockGrid, mask: Uint8Array): number {
  const { columns, rows, luma } = grid;
  let [same, either] = [0, 0];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const [here, there] = [row * columns + column, row * columns + (columns - 1 - column)];
      const [a, b] = [mask[here] === 1, mask[there] === 1];
      if (!a && !b) continue;
      either += 1;
      const close = Math.abs((luma[here] ?? 0) - (luma[there] ?? 0)) <= MIRROR_TOLERANCE;
      if (a && b && close) same += 1;
    }
  }
  return either === 0 ? 0 : same / either;
}

function centroidOffset(mask: Uint8Array, columns: number): number {
  let [sum, count] = [0, 0];
  mask.forEach((value, index) => {
    if (value !== 1) return;
    sum += (index % columns) + 0.5;
    count += 1;
  });
  return count === 0 ? 0.5 : Math.abs(sum / count / columns - 0.5);
}

function heroOffset(elements: readonly Component[], columns: number): number {
  const hero = elements.reduce<Component | undefined>(
    (best, entry) => (best === undefined || entry.blocks > best.blocks ? entry : best),
    undefined,
  );
  if (hero === undefined) return 0.5;
  return Math.abs((hero.minColumn + hero.maxColumn + 1) / 2 / columns - 0.5);
}

export function frameMetrics(
  image: RgbaImage,
  accent: readonly [number, number, number] | undefined,
): FrameMetrics {
  const grid = blockGrid(image);
  const content = contrastMask(grid, CONTENT_THRESHOLD);
  const competing = contrastMask(grid, COMPETING_THRESHOLD);
  const centre = centralMask(content, grid.columns);
  const marked = content.reduce((sum, value) => sum + value, 0);
  return {
    competing: competingElements(grid, competing).length,
    accentShare: accentShare(image, accent),
    content: content.length === 0 ? 0 : marked / content.length,
    mirror: mirrorScore(grid, centre),
    centroidOffset: centroidOffset(centre, grid.columns),
    heroOffset: heroOffset(
      competingElements(grid, centralMask(competing, grid.columns)),
      grid.columns,
    ),
  };
}

/** Mean luma of the signature cells (row-major). */
function cellLuma(grid: BlockGrid): Float32Array {
  const sums = new Float32Array(SIGNATURE_COLUMNS * SIGNATURE_ROWS);
  const totals = new Float32Array(sums.length);
  for (let row = 0; row < grid.rows; row += 1) {
    const cellRow = Math.min(SIGNATURE_ROWS - 1, Math.floor((row * SIGNATURE_ROWS) / grid.rows));
    for (let column = 0; column < grid.columns; column += 1) {
      const cellColumn = Math.min(
        SIGNATURE_COLUMNS - 1,
        Math.floor((column * SIGNATURE_COLUMNS) / grid.columns),
      );
      const cell = cellRow * SIGNATURE_COLUMNS + cellColumn;
      sums[cell] = (sums[cell] ?? 0) + (grid.luma[row * grid.columns + column] ?? 0);
      totals[cell] = (totals[cell] ?? 0) + 1;
    }
  }
  return sums.map((sum, cell) => sum / Math.max(1, totals[cell] ?? 1));
}

/**
 * Perceptual layout hash of a frame: the brightness steps between neighbouring cells of a 16 x 9
 * grid as trits (−1 darker, 0 flat, +1 brighter; steps under SIGNATURE_MARGIN are flat), so an
 * empty page is all 0 whatever its paper grain and the marks decide the hash.
 */
export function compositionSignature(image: RgbaImage): Int8Array {
  const luma = cellLuma(blockGrid(image));
  const trits: number[] = [];
  const step = (from: number, to: number): void => {
    const delta = (luma[to] ?? 0) - (luma[from] ?? 0);
    trits.push(Math.abs(delta) <= SIGNATURE_MARGIN ? 0 : Math.sign(delta));
  };
  for (let row = 0; row < SIGNATURE_ROWS; row += 1) {
    for (let column = 0; column < SIGNATURE_COLUMNS; column += 1) {
      const cell = row * SIGNATURE_COLUMNS + column;
      if (column + 1 < SIGNATURE_COLUMNS) step(cell, cell + 1);
      if (row + 1 < SIGNATURE_ROWS) step(cell, cell + SIGNATURE_COLUMNS);
    }
  }
  return Int8Array.from(trits);
}

/**
 * Distance of two signatures: the share of differing steps among the steps that are not flat in
 * both (0 = the same layout, 1 = nothing in common); two flat signatures are 1 (nothing to compare).
 */
export function signatureDistance(first: Int8Array, second: Int8Array): number {
  let [differ, judged] = [0, 0];
  for (let index = 0; index < Math.min(first.length, second.length); index += 1) {
    const [a, b] = [first[index] ?? 0, second[index] ?? 0];
    if (a === 0 && b === 0) continue;
    judged += 1;
    if (a !== b) differ += 1;
  }
  return judged === 0 ? 1 : differ / judged;
}
