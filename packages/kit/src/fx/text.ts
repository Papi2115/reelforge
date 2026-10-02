/**
 * Voxel text for the effects: whole labels as one greedy mesh, and glyph sets (one template
 * mesh per character, cloned per occurrence) for text that changes with t (counters, tickers,
 * typewriters). Text stands in the x/y plane facing +z; the font is fx/font.ts.
 */
import type * as THREE from 'three';
import type { KitTools } from '../registry.js';
import type { Vec3 } from '../types.js';
import type { VoxelObject } from '../voxel/mesh.js';
import type { VoxelColor } from '../voxel/model.js';
import {
  GLYPH_ROWS,
  glyphOf,
  layoutLine,
  normalizeText,
  wrapText,
  type VoxelGlyph,
} from './font.js';

export type TextAlign = 'left' | 'center' | 'right';

export interface VoxelTextStyle {
  /** Cap height in units (7 voxels). */
  readonly height: number;
  readonly color: VoxelColor;
  readonly bold?: boolean | undefined;
  /** Extrusion depth in voxels (default 2). */
  readonly depth?: number | undefined;
}

export interface TextBlockOptions extends VoxelTextStyle {
  readonly align?: TextAlign | undefined;
  /** Where the local origin sits vertically: block centre (default), bottom or top edge. */
  readonly anchor?: 'center' | 'bottom' | 'top' | undefined;
  /** Empty voxel rows between lines (default 3). */
  readonly lineGap?: number | undefined;
}

/** Text height in units -> voxel size. */
export function voxelSizeFor(height: number): number {
  return height / GLYPH_ROWS;
}

/** Width of a block of lines in units (the widest line). */
export function textWidth(lines: readonly string[], style: VoxelTextStyle): number {
  const widest = Math.max(
    0,
    ...lines.map((line) => layoutLine(normalizeText(line), style.bold === true).width),
  );
  return widest * voxelSizeFor(style.height);
}

/** Height of a block of lines in units. */
export function textHeight(lineCount: number, style: VoxelTextStyle, lineGap = 3): number {
  const rows = lineCount * GLYPH_ROWS + Math.max(0, lineCount - 1) * lineGap;
  return rows * voxelSizeFor(style.height);
}

/** Smallest label height fitLabel goes down to (units). */
export const MIN_LABEL_HEIGHT = 0.12;

/**
 * Lines (at most 2, word-wrapped) and the largest text height <= maxHeight at which `text`
 * fits into `width` units; MIN_LABEL_HEIGHT when nothing fits.
 */
export function fitLabel(
  text: string,
  width: number,
  maxHeight: number,
): { lines: string[]; height: number } {
  for (let height = maxHeight; height >= MIN_LABEL_HEIGHT; height *= 0.9) {
    const lines = wrapText(text, Math.floor(width / voxelSizeFor(height)), 2);
    if (textWidth(lines, { height, color: 'text' }) <= width) return { lines, height };
  }
  const columns = Math.floor(width / voxelSizeFor(MIN_LABEL_HEIGHT));
  return { lines: wrapText(text, columns, 2), height: MIN_LABEL_HEIGHT };
}

export interface LabelRow {
  /** Text height of every label of the row (one size, so the row reads evenly). */
  readonly height: number;
  /** Width a label may take. */
  readonly width: number;
  /** Odd labels sit one row further out, so each label may span two pitches. */
  readonly staggered: boolean;
}

/**
 * Size of a row of labels spaced `pitch` apart: the largest height <= maxHeight at which every
 * label fits its pitch; when that is under 75 % of maxHeight, labels alternate between two
 * rows and get two pitches each.
 */
export function fitLabelRow(labels: readonly string[], pitch: number, maxHeight: number): LabelRow {
  const fitAll = (width: number): number =>
    Math.min(maxHeight, ...labels.map((label) => fitLabel(label, width, maxHeight).height));
  const single = { height: fitAll(pitch * 0.92), width: pitch * 0.92, staggered: false };
  if (single.height >= maxHeight * 0.75 || labels.length < 2) return single;
  const double = { height: fitAll(pitch * 1.84), width: pitch * 1.84, staggered: true };
  return double.height > single.height ? double : single;
}

/** Distance a staggered label moves out: two lines and a gap. */
export function staggerStep(height: number): number {
  return textHeight(2, { height, color: 'text' }) + height;
}

function stamp(
  voxels: [number, number, number, number][],
  glyph: VoxelGlyph,
  left: number,
  top: number,
  depth: number,
): void {
  for (let row = 0; row < GLYPH_ROWS; row += 1) {
    for (let column = 0; column < glyph.width; column += 1) {
      if (glyph.bits[row * glyph.width + column] !== 1) continue;
      for (let z = 0; z < depth; z += 1) voxels.push([left + column, top - row, z, 1]);
    }
  }
}

/**
 * Lines of text as one greedy voxel mesh. The local origin is at the `align` edge
 * (left/centre/right) and the `anchor` height of the block, at mid depth.
 */
export function textBlock(
  tools: KitTools,
  lines: readonly string[],
  options: TextBlockOptions,
): VoxelObject {
  const bold = options.bold === true;
  const depth = options.depth ?? 2;
  const gap = options.lineGap ?? 3;
  const layouts = lines.map((line) => layoutLine(normalizeText(line), bold));
  const width = Math.max(1, ...layouts.map((layout) => layout.width));
  const height = layouts.length * GLYPH_ROWS + Math.max(0, layouts.length - 1) * gap;
  const align = options.align ?? 'center';
  const voxels: [number, number, number, number][] = [];
  layouts.forEach((layout, index) => {
    const shift =
      align === 'left' ? 0 : align === 'right' ? width - layout.width : (width - layout.width) >> 1;
    const top = height - 1 - index * (GLYPH_ROWS + gap);
    for (const placed of layout.glyphs) {
      if (placed.glyph) stamp(voxels, placed.glyph, shift + placed.x, top, depth);
    }
  });
  const model = tools.voxel.fromGrid({ size: [width, Math.max(1, height), depth], voxels }, [
    options.color,
  ]);
  const anchor = options.anchor ?? 'center';
  const pivot: Vec3 = [
    align === 'left' ? 0 : align === 'right' ? width : width / 2,
    anchor === 'bottom' ? 0 : anchor === 'top' ? height : height / 2,
    depth / 2,
  ];
  return tools.voxel.mesh(model, {
    voxelSize: voxelSizeFor(options.height),
    pivot,
    ao: 0,
    mode: 'greedy',
  });
}

export interface GlyphSet {
  readonly voxelSize: number;
  /** A new mesh of a normalized `char`, bottom-left corner at the origin; undefined = space. */
  mesh(char: string): THREE.Object3D | undefined;
  /** Glyph width in units (0 for a space). */
  width(char: string): number;
}

/**
 * Glyph templates of one style: each character is meshed once and cloned per use (clones
 * share the geometry). Glyph meshes have their bottom-left corner at the origin, mid depth.
 */
export function glyphSet(tools: KitTools, style: VoxelTextStyle): GlyphSet {
  const bold = style.bold === true;
  const depth = style.depth ?? 2;
  const voxelSize = voxelSizeFor(style.height);
  const templates = new Map<string, THREE.Object3D>();
  const template = (char: string): THREE.Object3D | undefined => {
    const glyph = glyphOf(char, bold);
    if (!glyph) return undefined;
    let found = templates.get(char);
    if (!found) {
      const voxels: [number, number, number, number][] = [];
      stamp(voxels, glyph, 0, GLYPH_ROWS - 1, depth);
      const model = tools.voxel.fromGrid({ size: [glyph.width, GLYPH_ROWS, depth], voxels }, [
        style.color,
      ]);
      const object = tools.voxel.mesh(model, {
        voxelSize,
        pivot: [0, 0, depth / 2],
        ao: 0,
        mode: 'greedy',
      });
      found = object.children[0];
      if (!found) return undefined;
      templates.set(char, found);
    }
    return found;
  };
  return {
    voxelSize,
    mesh: (char) => template(char)?.clone(),
    width: (char) => (glyphOf(char, bold)?.width ?? 0) * voxelSize,
  };
}
