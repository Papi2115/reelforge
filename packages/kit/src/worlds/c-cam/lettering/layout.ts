/**
 * Layout of the C-CAM ink lettering: pure functions from (text, options) to page-space strokes.
 * Wobble, glyph rotation and glyph scale come from an integer hash of (text up to the character,
 * index, seed): the same input always gives the same strokes, and a prefix of a string lays out
 * exactly like the start of the whole string (letters appearing one by one never move). No clock,
 * no RNG, no DOM.
 *
 * ON-SCREEN TEXT CALLS (for the anti-slop text-provenance guard, `packages/stages/src/slop/*`):
 * the C-CAM world's `textMethods` are `drawText`, `layoutText` and `wrapText`, each with the
 * on-screen string as its first argument. List them when the world is registered.
 */
import { glyphOf } from './glyphs.js';
import { FNV_START, fnvStep, rnd } from './hash.js';
import type { FaceName, Pt } from './types.js';

export interface FaceMetrics {
  /** Slant: x shift per unit of height above the baseline. */
  readonly slant: number;
  /** Per-point wander in glyph units. */
  readonly jitter: number;
  /** Baseline wobble per glyph in glyph units. */
  readonly baseline: number;
  /** Per-glyph rotation range in degrees (+-). */
  readonly rotation: number;
  /** Per-glyph scale range (+-, fraction). Advance widths are not affected. */
  readonly scaleVariance: number;
  /** Space between glyphs and the width of a space, in glyph units. */
  readonly gap: number;
  readonly space: number;
  /** Line height in cap heights. */
  readonly lineHeight: number;
  /** Nominal ink width as a fraction of the cap height. */
  readonly weight: number;
  /** 0..1: how much of the 0.4x-1.9x ink swell is applied. */
  readonly swell: number;
  /** 0..1: how much open ends taper. */
  readonly taper: number;
}

export const FACES: Readonly<Record<FaceName, FaceMetrics>> = {
  hand: {
    slant: 0.06,
    jitter: 0.14,
    baseline: 0.5,
    rotation: 1.6,
    scaleVariance: 0.05,
    gap: 1.6,
    space: 3.6,
    lineHeight: 1.7,
    weight: 0.075,
    swell: 1,
    taper: 1,
  },
  poster: {
    slant: 0,
    jitter: 0.08,
    baseline: 0.3,
    rotation: 2.4,
    scaleVariance: 0.02,
    gap: 3,
    space: 4.6,
    lineHeight: 1.45,
    weight: 0.19,
    swell: 0.35,
    taper: 0.3,
  },
};

export interface LayoutOptions {
  readonly face: FaceName;
  /** Cap height in page px. */
  readonly size: number;
  /** Anchor on the baseline (page px); see `align`. */
  readonly x: number;
  readonly y: number;
  readonly seed: number;
  /** Extra space between glyphs, in glyph units. */
  readonly track?: number | undefined;
  /** Rotation of the whole line about the anchor, degrees. */
  readonly rot?: number | undefined;
  readonly align?: 'left' | 'center' | 'right' | undefined;
  /** 0 = neat, 1 = the face's own wobble (default), more = sloppier. */
  readonly wobble?: number | undefined;
  /**
   * Width used for `center`/`right` (default: the text's own). Pass the width of the whole string
   * when a prefix is shown (letters appearing one by one) so the letters already there stay put.
   */
  readonly alignWidth?: number | undefined;
}

export interface LaidStroke {
  /** Control points in page px; the drawing smooths them (corners excepted). */
  readonly pts: readonly Pt[];
  readonly corners: readonly boolean[];
  /** The last point repeats the first (a loop: no end taper). */
  readonly closed: boolean;
  /** Index of the character in the string (code points, as `for...of` counts them). */
  readonly char: number;
  /** Integer key of this stroke (prefix of the text, index, seed, stroke): seeds the ink swell. */
  readonly key: number;
}

export interface LaidText {
  readonly strokes: readonly LaidStroke[];
  /** Advance width in page px (jitter-free: equals `measureText`). */
  readonly width: number;
}

/** Advance of a drawable character in glyph units. */
function advanceOf(face: FaceName, char: string): number {
  return glyphOf(face, char)?.width ?? 0;
}

/** Advance width of a single-line string in page px. Independent of seed and wobble. */
export function measureText(text: string, size: number, face: FaceName, track = 0): number {
  const metrics = FACES[face];
  let units = 0;
  let trailingGap = 0;
  for (const char of text) {
    if (char === ' ') {
      units += metrics.space;
      trailingGap = 0;
    } else if (glyphOf(face, char)) {
      units += advanceOf(face, char) + metrics.gap + track;
      trailingGap = metrics.gap + track;
    }
  }
  return ((units - trailingGap) * size) / 10;
}

/**
 * Greedy word wrap at spaces (and `\n`). Runs of spaces inside a line are kept; the spaces at a
 * break are dropped. A word wider than the limit stays whole on its own line.
 */
export function wrapText(
  text: string,
  maxWidth: number,
  size: number,
  face: FaceName,
  track = 0,
): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    let spaces = '';
    for (const token of paragraph.split(/( +)/)) {
      if (token === '') continue;
      if (token.startsWith(' ')) {
        spaces = token;
        continue;
      }
      const candidate = line === '' ? token : `${line}${spaces}${token}`;
      if (line !== '' && measureText(candidate, size, face, track) > maxWidth) {
        lines.push(line);
        line = token;
      } else {
        line = candidate;
      }
      spaces = '';
    }
    lines.push(line);
  }
  return lines;
}

/** Lays one line of text out as page-space strokes; unknown characters are skipped. */
export function layoutText(text: string, options: LayoutOptions): LaidText {
  const metrics = FACES[options.face];
  const wobble = options.wobble ?? 1;
  const unit = options.size / 10;
  const seed = options.seed | 0;
  const track = options.track ?? 0;
  const width = measureText(text, options.size, options.face, track);
  const alignWidth = options.alignWidth ?? width;
  const originX =
    options.align === 'center' ? -alignWidth / 2 : options.align === 'right' ? -alignWidth : 0;
  const rot = ((options.rot ?? 0) * Math.PI) / 180;
  const cr = Math.cos(rot);
  const sr = Math.sin(rot);
  const strokes: LaidStroke[] = [];
  let pen = originX;
  let drift = 0;
  let key = FNV_START;
  let index = -1;
  for (const char of text) {
    index += 1;
    key = fnvStep(key, char.codePointAt(0) ?? 0);
    if (char === ' ') {
      pen += metrics.space * unit;
      continue;
    }
    const glyph = glyphOf(options.face, char);
    if (!glyph) continue;
    // The glyph's own key: the text up to here, the seed and the index (prefix-stable).
    const glyphKey = fnvStep(fnvStep(key, seed), index);
    const scale = 1 + rnd(-1, 1, glyphKey, 1) * metrics.scaleVariance * wobble;
    drift = (drift + rnd(-1, 1, glyphKey, 2) * metrics.baseline * wobble * 0.5) * 0.7;
    const spin = (rnd(-1, 1, glyphKey, 3) * metrics.rotation * wobble * Math.PI) / 180;
    const gc = Math.cos(spin);
    const gs = Math.sin(spin);
    const centre = (glyph.width * scale) / 2;
    const wander = metrics.jitter * wobble;
    glyph.strokes.forEach((stroke, si) => {
      const pts: Pt[] = stroke.pts.map((point, p) => {
        let gx = point.x * scale + rnd(-wander, wander, glyphKey, 4, si, p);
        let gy = 10 + (point.y - 10) * scale + rnd(-wander, wander, glyphKey, 5, si, p);
        const rx = gx - centre;
        const ry = gy - 10;
        gx = centre + rx * gc - ry * gs;
        gy = 10 + rx * gs + ry * gc;
        const lx = pen + (gx + (10 - gy) * metrics.slant) * unit;
        const ly = (gy - 10 + drift) * unit;
        return { x: options.x + lx * cr - ly * sr, y: options.y + lx * sr + ly * cr };
      });
      // A closed stroke keeps its end on its start whatever the wander did.
      const first = pts[0];
      if (stroke.closed && first !== undefined) pts[pts.length - 1] = first;
      strokes.push({
        pts,
        corners: stroke.corners,
        closed: stroke.closed,
        char: index,
        key: fnvStep(glyphKey, si + 1),
      });
    });
    pen += (glyph.width + metrics.gap + track) * unit;
  }
  return { strokes, width };
}

/**
 * Bounding box [x0, y0, x1, y1] of the stroke centre lines of characters [from, to) of a laid-out
 * line (ink width not included; all infinite when no stroke is in the range).
 */
export function textSpan(
  laid: LaidText,
  from = 0,
  to = Number.POSITIVE_INFINITY,
): readonly [number, number, number, number] {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const stroke of laid.strokes) {
    if (stroke.char < from || stroke.char >= to) continue;
    for (const point of stroke.pts) {
      x0 = Math.min(x0, point.x);
      x1 = Math.max(x1, point.x);
      y0 = Math.min(y0, point.y);
      y1 = Math.max(y1, point.y);
    }
  }
  return [x0, y0, x1, y1];
}
