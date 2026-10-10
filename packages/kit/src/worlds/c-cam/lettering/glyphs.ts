/**
 * Stroke skeletons of the C-CAM ink lettering (CC0 1.0, own work, docs/licenses.md; nothing is
 * traced from a font). Two faces share one coordinate system: the cap height is 10 units on the
 * stroke centre line, the baseline is y = 10 (y grows downwards), the x-height of the hand is 4.5
 * and its descender 13.6. The data lives in `glyphs-hand.ts` and `glyphs-poster.ts` as
 * `width: strokes` where strokes are separated by `|`, points are `x,y` and a trailing `!` marks
 * a corner (the smoothing splits there).
 *
 * The poster face has capitals only: lower case maps to its capital.
 */
import { HAND_RAW } from './glyphs-hand.js';
import { POSTER_RAW } from './glyphs-poster.js';
import type { FaceName, Pt } from './types.js';

export interface GlyphStroke {
  readonly pts: readonly Pt[];
  readonly corners: readonly boolean[];
  /** The first and the last point coincide: no end taper. */
  readonly closed: boolean;
}

export interface Glyph {
  /** Advance width in glyph units. */
  readonly width: number;
  readonly strokes: readonly GlyphStroke[];
}

type RawTable = Readonly<Record<string, readonly [number, string]>>;

function parseStroke(source: string): GlyphStroke {
  const pts: Pt[] = [];
  const corners: boolean[] = [];
  for (const token of source.trim().split(/\s+/)) {
    const [x = 0, y = 0] = token.replace('!', '').split(',').map(Number);
    pts.push({ x, y });
    corners.push(token.endsWith('!'));
  }
  const first = pts[0];
  const last = pts[pts.length - 1];
  const closed =
    pts.length > 2 &&
    first !== undefined &&
    last !== undefined &&
    first.x === last.x &&
    first.y === last.y;
  return { pts, corners, closed };
}

function parseTable(raw: RawTable): ReadonlyMap<string, Glyph> {
  return new Map(
    Object.entries(raw).map(([char, [width, source]]) => [
      char,
      { width, strokes: source.split('|').map(parseStroke) },
    ]),
  );
}

const TABLES: Readonly<Record<FaceName, ReadonlyMap<string, Glyph>>> = {
  hand: parseTable(HAND_RAW),
  poster: parseTable(POSTER_RAW),
};

/** The glyph of a character in a face (poster: lower case falls back to the capital). */
export function glyphOf(face: FaceName, char: string): Glyph | undefined {
  const table = TABLES[face];
  return table.get(char) ?? (face === 'poster' ? table.get(char.toUpperCase()) : undefined);
}

/** True when the face can draw the character (a space counts). */
export function hasGlyph(face: FaceName, char: string): boolean {
  return char === ' ' || glyphOf(face, char) !== undefined;
}

/** Characters a face can draw directly (space excluded, no fallback). */
export function faceChars(face: FaceName): string {
  return [...TABLES[face].keys()].join('');
}
