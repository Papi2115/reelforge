/**
 * The pixel-art DSL of the Game B2 open layer: a sprite, texture or icon written as text rows,
 * one character per pixel, with a legend that names the world's colours (`g: 'leaf.2'`,
 * `o: 'void'`); `.` and space are transparent unless the legend says otherwise. Frames (2-4) for
 * creatures, flames and water; `mirror: true` = the rows are the left half. Errors name the
 * asset, frame, row and column so the runtime Claude can fix them.
 */
import { Bmp } from '../core/bitmap.js';
import { T } from '../palette.js';
import { colourRef, colourRefHelp } from './ramps.js';

export interface PixelArt {
  readonly rows?: readonly string[] | undefined;
  readonly frames?: readonly (readonly string[])[] | undefined;
  readonly legend: Readonly<Record<string, string>>;
  readonly mirror?: boolean | undefined;
}

export interface ArtLimits {
  readonly maxW: number;
  readonly maxH: number;
  /** Exact square size (textures 16 / 32 / 64). */
  readonly square?: number | undefined;
}

export type ArtResult =
  | { readonly ok: true; readonly frames: readonly Bmp[] }
  | { readonly ok: false; readonly errors: readonly string[] };

export const MAX_FRAMES = 4;
const CLEAR = new Set(['clear', 'none']);

function legendIndices(
  where: string,
  legend: PixelArt['legend'],
  errors: string[],
): Map<string, number> {
  const out = new Map<string, number>([
    ['.', T],
    [' ', T],
  ]);
  for (const [ch, ref] of Object.entries(legend)) {
    if (ch.length !== 1) {
      errors.push(`${where}.legend: key ${JSON.stringify(ch)} must be one character`);
      continue;
    }
    if (CLEAR.has(ref)) {
      out.set(ch, T);
      continue;
    }
    const index = colourRef(ref);
    if (index === undefined) errors.push(`${where}.legend "${ch}": ${colourRefHelp(ref)}`);
    else out.set(ch, index);
  }
  return out;
}

/** The characters of a row in reverse order (ASCII rows). */
function reversed(row: string): string {
  let out = '';
  for (let i = row.length - 1; i >= 0; i -= 1) out += row.charAt(i);
  return out;
}

function frameRows(art: PixelArt, where: string, errors: string[]): (readonly string[])[] {
  if (art.rows !== undefined && art.frames !== undefined) {
    errors.push(`${where}: give rows or frames, not both`);
    return [];
  }
  const list = art.frames ?? (art.rows === undefined ? [] : [art.rows]);
  if (list.length === 0)
    errors.push(`${where}: needs rows: ['..', ...] (or frames: [[...], [...]])`);
  if (list.length > MAX_FRAMES)
    errors.push(`${where}: ${String(list.length)} frames, at most ${String(MAX_FRAMES)}`);
  return list
    .slice(0, MAX_FRAMES)
    .map((rows) => (art.mirror === true ? rows.map((row) => row + reversed(row)) : rows));
}

/** Checks the size of every frame; returns [w, h] of frame 0 or undefined after errors. */
function frameSize(
  frames: readonly (readonly string[])[],
  where: string,
  limits: ArtLimits,
  errors: string[],
): readonly [number, number] | undefined {
  const first = frames[0];
  if (first === undefined) return undefined;
  const w = first[0]?.length ?? 0;
  const h = first.length;
  const before = errors.length;
  frames.forEach((rows, f) => {
    const at = frames.length > 1 ? `${where}.frames[${String(f)}]` : `${where}.rows`;
    if (rows.length !== h)
      errors.push(`${at}: ${String(rows.length)} rows, expected ${String(h)} like frame 0`);
    rows.forEach((row, y) => {
      if (row.length !== w)
        errors.push(
          `${at}[${String(y)}]: ${String(row.length)} pixels wide, expected ${String(w)} like row 0`,
        );
    });
  });
  if (limits.square !== undefined && (w !== limits.square || h !== limits.square))
    errors.push(
      `${where}: a ${String(limits.square)}x${String(limits.square)} texture needs ${String(limits.square)} rows of ${String(limits.square)} pixels (got ${String(w)}x${String(h)})`,
    );
  if (w < 1 || h < 1 || w > limits.maxW || h > limits.maxH)
    errors.push(
      `${where}: ${String(w)}x${String(h)} pixels, allowed 1-${String(limits.maxW)} wide and 1-${String(limits.maxH)} tall`,
    );
  return errors.length > before ? undefined : [w, h];
}

/** Compiles the rows of every frame into indexed bitmaps (255 = transparent). */
export function compileArt(art: PixelArt, where: string, limits: ArtLimits): ArtResult {
  const errors: string[] = [];
  const colours = legendIndices(where, art.legend, errors);
  const frames = frameRows(art, where, errors);
  const size = frameSize(frames, where, limits, errors);
  if (size === undefined || errors.length > 0) return { ok: false, errors };
  const [w, h] = size;
  const bitmaps = frames.map((rows, f) => {
    const b = new Bmp(w, h);
    rows.forEach((row, y) => {
      for (let x = 0; x < w; x += 1) {
        const ch = row.charAt(x);
        const index = colours.get(ch);
        if (index === undefined) {
          const at = frames.length > 1 ? `${where}.frames[${String(f)}]` : `${where}.rows`;
          errors.push(`${at}[${String(y)}]: "${ch}" at x=${String(x)} is not in the legend`);
        } else b.d[y * w + x] = index;
      }
    });
    return b;
  });
  const unique = [...new Set(errors)].slice(0, 12);
  return unique.length > 0 ? { ok: false, errors: unique } : { ok: true, frames: bitmaps };
}

/** Repeats a 16 / 32 px tile to the raycaster's 64x64 texture. */
export function tileTo64(tile: Bmp): Bmp {
  const out = new Bmp(64, 64);
  for (let y = 0; y < 64; y += 1)
    for (let x = 0; x < 64; x += 1)
      out.d[y * 64 + x] = tile.d[(y % tile.h) * tile.w + (x % tile.w)] ?? T;
  return out;
}

/** A copy with a 1 px transparent margin (room for the outline). */
export function padded(src: Bmp): Bmp {
  const out = new Bmp(src.w + 2, src.h + 2);
  out.blit(src, 1, 1);
  return out;
}
