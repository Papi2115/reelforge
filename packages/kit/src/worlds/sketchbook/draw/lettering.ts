/**
 * The three hands of the Sketchbook lettering (plus TYPE for printed matter): one skeleton set
 * written with different slant, jitter, baseline drift, per-glyph rotation and spacing. PRINT is
 * neat ballpoint print, SCRAWL quick slanted handwriting, MARKER condensed caps with a chisel nib,
 * TYPE printed calendars (no jitter, no boil). Every variation is seeded by (seed, char index).
 */
import { glyphOf } from './glyphs.js';
import { at, rnd } from './math.js';
import type { Pts } from './paths.js';

export const HAND_NAMES = ['print', 'scrawl', 'marker', 'type'] as const;
export type HandName = (typeof HAND_NAMES)[number];

interface HandStyle {
  readonly slant: number;
  readonly jitter: number;
  readonly baseline: number;
  readonly gap: number;
  readonly space: number;
  readonly widthVariance: number;
  readonly rotation: number;
  readonly squeeze: number;
}

const HANDS: Readonly<Record<HandName, HandStyle>> = {
  print: {
    slant: 0.04,
    jitter: 0.13,
    baseline: 0.35,
    gap: 1.75,
    space: 3.6,
    widthVariance: 0.04,
    rotation: 0.9,
    squeeze: 1,
  },
  scrawl: {
    slant: 0.24,
    jitter: 0.3,
    baseline: 0.9,
    gap: 1.05,
    space: 3.0,
    widthVariance: 0.11,
    rotation: 2.6,
    squeeze: 1,
  },
  marker: {
    slant: 0.07,
    jitter: 0.22,
    baseline: 0.6,
    gap: 1.5,
    space: 3.8,
    widthVariance: 0.07,
    rotation: 2.2,
    squeeze: 0.84,
  },
  type: {
    slant: 0,
    jitter: 0,
    baseline: 0,
    gap: 1.6,
    space: 3.4,
    widthVariance: 0,
    rotation: 0,
    squeeze: 1,
  },
};

export interface TextLayout {
  /** Left end of the baseline (page px). */
  readonly x: number;
  readonly y: number;
  /** Cap height in page px. */
  readonly size: number;
  readonly hand: HandName;
  /** Rotation of the whole line (degrees). */
  readonly rot?: number | undefined;
  readonly seed: number;
  /** Extra spacing between glyphs (cap units). */
  readonly track?: number | undefined;
}

export interface LaidStroke {
  readonly pts: Pts;
  readonly corners: readonly boolean[];
  /** Index of the character in the string. */
  readonly char: number;
}

export interface LaidText {
  readonly strokes: readonly LaidStroke[];
  /** Advance width in page px. */
  readonly width: number;
}

/** Lays a string out as page-space strokes (unknown characters are skipped). */
export function layoutText(text: string, options: TextLayout): LaidText {
  const hand = HANDS[options.hand];
  const unit = options.size / 10;
  const seed = options.seed | 0;
  const track = options.track ?? 0;
  const rot = ((options.rot ?? 0) * Math.PI) / 180;
  const cr = Math.cos(rot);
  const sr = Math.sin(rot);
  const strokes: LaidStroke[] = [];
  let pen = 0;
  let drift = 0;
  for (let ci = 0; ci < text.length; ci += 1) {
    const char = text.charAt(ci);
    if (char === ' ') {
      pen += (hand.space + rnd(-0.4, 0.5, seed, ci, 7) * (hand.jitter > 0 ? 1 : 0)) * unit;
      continue;
    }
    const glyph = glyphOf(char);
    if (!glyph) continue;
    const widthScale =
      hand.squeeze * (1 + rnd(-hand.widthVariance, hand.widthVariance, seed, ci, 1));
    drift = (drift + rnd(-hand.baseline, hand.baseline, seed, ci, 2) * 0.5) * 0.7;
    const glyphRot = (rnd(-hand.rotation, hand.rotation, seed, ci, 3) * Math.PI) / 180;
    const gc = Math.cos(glyphRot);
    const gs = Math.sin(glyphRot);
    const jitter = hand.jitter * (char >= '0' && char <= '9' ? 0.55 : 1);
    const centre = (glyph.width * widthScale) / 2;
    glyph.strokes.forEach((stroke, si) => {
      const pts: Pts = [];
      for (let p = 0; p < stroke.pts.length; p += 2) {
        let gx = at(stroke.pts, p) * widthScale + rnd(-jitter, jitter, seed, ci, si * 31 + p, 4);
        let gy = at(stroke.pts, p + 1) + rnd(-jitter, jitter, seed, ci, si * 31 + p, 5);
        // Per-glyph rotation about the glyph's baseline centre.
        const rx = gx - centre;
        const ry = gy - 10;
        gx = centre + rx * gc - ry * gs;
        gy = 10 + rx * gs + ry * gc;
        const lx = pen + (gx + (10 - gy) * hand.slant) * unit;
        const ly = (gy - 10) * unit + drift * unit;
        pts.push(options.x + lx * cr - ly * sr, options.y + lx * sr + ly * cr);
      }
      strokes.push({ pts, corners: stroke.corners, char: ci });
    });
    pen += (glyph.width * widthScale + hand.gap + track) * unit;
  }
  return { strokes, width: pen - (hand.gap + track) * unit };
}

/** Advance width of a string in page px. */
export function textWidth(text: string, size: number, hand: HandName, seed = 0): number {
  return layoutText(text, { x: 0, y: 0, size, hand, seed }).width;
}

/** Bounding box [x0, y0, x1, y1] of characters [from, to) of a laid-out string. */
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
    for (let i = 0; i < stroke.pts.length; i += 2) {
      x0 = Math.min(x0, at(stroke.pts, i));
      x1 = Math.max(x1, at(stroke.pts, i));
      y0 = Math.min(y0, at(stroke.pts, i + 1));
      y1 = Math.max(y1, at(stroke.pts, i + 1));
    }
  }
  return [x0, y0, x1, y1];
}
