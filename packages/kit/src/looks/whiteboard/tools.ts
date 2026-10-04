/**
 * What a whiteboard template's setup works with: the theme, the scale, the safe area, the time
 * resolver and two mark makers — `pen()` turns polylines in 640x360-frame pixels into a marker
 * mark (scaled, wobbled by the board seed, rasterised) and `write()` turns text into handwriting.
 * A template returns its drawing as entries (what `stroke(i)` addresses) of timed items.
 */
import type { Pixel, Raster } from '../blueprint/raster.js';
import type { Resolver, When } from '../blueprint/timing.js';
import {
  strokePixels,
  transform,
  wobble,
  type Box,
  type Point,
  type Polyline,
} from './geometry.js';
import type { MarkShape } from './marks.js';
import type { Theme } from './theme.js';
import { writeLine, writtenHeight, writtenWidth, type WrittenLine } from './writing.js';

/** One timed mark of a drawing. */
export interface Item {
  readonly shape: MarkShape;
  /** Pinned start (seconds or phrase); default: after the previous item. */
  readonly at?: When | undefined;
  readonly duration?: number | undefined;
  /** Pause before this item when auto-timed (default: the board's gap). */
  readonly gap?: number | undefined;
}

/** One addressable thing on the board (`stroke(i)`): a doodle, a node, a written line... */
export interface Entry {
  /** Prefix of its named points (`point('idea')`, `point('idea.top')`). */
  readonly name?: string | undefined;
  readonly items: readonly Item[];
  /** Extra named points (raster px), prefixed with the name like the side points. */
  readonly points?: Readonly<Record<string, Point>> | undefined;
  /** Extra named points (raster px) under their own names (`word:3`). */
  readonly globals?: Readonly<Record<string, Point>> | undefined;
}

export interface Drawing {
  readonly entries: readonly Entry[];
}

export interface PenOptions {
  readonly color?: string | undefined;
  /** Marker width, 640x360-frame pixels (default: the board's). */
  readonly width?: number | undefined;
  /** Wobble amplitude, 640x360-frame pixels (default: the board's). */
  readonly wobble?: number | undefined;
  /** Distinguishes the wobble of strokes (any stable number). */
  readonly key: number;
}

export type Align = 'left' | 'center' | 'right';

export interface WriteOptions {
  readonly color?: string | undefined;
  /** Cell size in raster px (see `cell`). */
  readonly scale: number;
  readonly align?: Align | undefined;
  /** Vertical reference of y: top (default) or middle of the line. */
  readonly valign?: 'top' | 'middle' | undefined;
  readonly slant?: number | undefined;
  readonly key: number;
}

export interface Written {
  readonly shape: MarkShape;
  readonly line: WrittenLine;
}

export interface WhiteboardContext {
  readonly theme: Theme;
  /** Raster px per 640x360-frame pixel. */
  readonly s: number;
  readonly seed: number;
  readonly width: number;
  readonly height: number;
  /** Safe area inside the board, below the title (raster px). */
  readonly area: Box;
  readonly resolve: Resolver;
  /** Name of the template call, for errors. */
  readonly call: string;
  /** Reference px -> raster px (rounded). */
  px(value: number): number;
  /** Text cell size for a reference cell size (at least 1). */
  cell(reference: number): number;
  ink(name?: string): Pixel;
  /** A marker mark from polylines in 640x360-frame pixels. */
  pen(paths: readonly Polyline[], options: PenOptions): MarkShape;
  /** A marker mark from polylines already in raster px. */
  penRaster(paths: readonly Polyline[], options: PenOptions): MarkShape;
  /** Handwriting at raster (x, y). */
  write(text: string, x: number, y: number, options: WriteOptions): Written;
  textWidth(text: string, scale: number): number;
  textHeight(scale: number): number;
  /** Entries of the board title (scheduled first; not counted by stroke(i)). */
  titleEntries(): readonly Entry[];
}

interface ToolsInput {
  readonly theme: Theme;
  readonly s: number;
  readonly seed: number;
  readonly params: {
    readonly color: string;
    readonly width: number;
    readonly wobble: number;
    readonly title: string;
  };
  readonly raster: Raster;
  readonly area: Box;
  readonly board: Box;
  readonly resolve: Resolver;
  readonly call: string;
}

const SLANT = 0.45;

export function createTools(input: ToolsInput): WhiteboardContext {
  const { theme, s, seed, params } = input;
  const ink = (name?: string): Pixel => theme.color(name ?? params.color);
  const penRaster = (paths: readonly Polyline[], options: PenOptions): MarkShape => {
    const amplitude = (options.wobble ?? params.wobble) * s;
    return {
      paths: paths.map((path, index) =>
        strokePixels(wobble(path, amplitude, seed + options.key * 131 + index * 17)),
      ),
      color: ink(options.color),
      nib: { kind: 'pen', size: Math.max(1, Math.round((options.width ?? params.width) * s)) },
    };
  };
  const write = (text: string, x: number, y: number, options: WriteOptions): Written => {
    const slant = options.slant ?? SLANT;
    const style = { scale: options.scale, slant, seed: seed + options.key * 977 };
    const width = writtenWidth(text, style);
    const align = options.align ?? 'left';
    const left = align === 'left' ? x : align === 'right' ? x - width : x - width / 2;
    const top = options.valign === 'middle' ? y - writtenHeight(style) / 2 : y;
    const line = writeLine(text, Math.round(left), Math.round(top), style);
    return {
      line,
      shape: {
        paths: line.glyphs.flatMap((glyph) => glyph.paths),
        color: ink(options.color),
        nib: { kind: 'cell', size: options.scale },
      },
    };
  };
  let area = input.area;
  const title: Entry[] = [];
  if (params.title.length > 0) {
    const scale = Math.max(2, Math.round(3 * s));
    const x = input.area.x - Math.round(6 * s);
    const y = input.board.y + Math.round(14 * s);
    const written = write(params.title, x, y, { scale, key: 9001 });
    const box = written.line.box;
    const underline = penRaster(
      [
        [
          [box.x - 2 * s, box.y + box.height + 5 * s],
          [box.x + box.width * 0.55, box.y + box.height + 7 * s],
          [box.x + box.width + 6 * s, box.y + box.height + 4 * s],
        ],
      ],
      { key: 9002 },
    );
    title.push({
      name: 'title',
      items: [{ shape: written.shape }, { shape: underline, gap: 0.05 }],
    });
    const below = box.y + box.height + Math.round(18 * s);
    area = {
      ...area,
      y: Math.max(area.y, below),
      height: area.y + area.height - Math.max(area.y, below),
    };
  }
  return {
    theme,
    s,
    seed,
    width: input.raster.width,
    height: input.raster.height,
    area,
    resolve: input.resolve,
    call: input.call,
    px: (value) => Math.round(value * s),
    cell: (reference) => Math.max(1, Math.round(reference * s)),
    ink,
    pen: (paths, options) => penRaster(transform(paths, s, [0, 0]), options),
    penRaster,
    write,
    textWidth: (text, scale) => writtenWidth(text, { scale, slant: SLANT }),
    textHeight: (scale) => writtenHeight({ scale }),
    titleEntries: () => title,
  };
}
