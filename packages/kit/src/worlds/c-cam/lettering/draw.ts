/**
 * Draws the C-CAM ink lettering through an `InkSurface`. Every stroke becomes a ribbon whose width
 * swells and pinches along the arc (0.4x-1.9x of the base width, seeded value noise, the style's
 * ink line) and tapers at open ends; a very short stroke becomes a round dot. Each character is
 * drawn whole (all layers) before the next one, so a poster word is built letter by letter like
 * the films' `posterWord`: outline, extrusion, outline, fill, the next letter overlapping it.
 */
import { valueNoise } from './hash.js';
import { FACES, layoutText, type LaidStroke, type LaidText, type LayoutOptions } from './layout.js';
import type { InkSurface, Pt } from './types.js';

export interface InkLayer {
  readonly fill: string;
  /** Ink width relative to the base width (default 1). */
  readonly widthScale?: number | undefined;
  /** Offset in page px (extrusion). */
  readonly dx?: number | undefined;
  readonly dy?: number | undefined;
}

export interface DrawOptions extends LayoutOptions {
  readonly fill: string;
  /** Base ink width in px (default: the face's weight times the cap height). */
  readonly width?: number | undefined;
  /** Layers drawn back to front for every character; default: a single layer of `fill`. */
  readonly layers?: readonly InkLayer[] | undefined;
  /**
   * Scale of character `index` about its own centre (e.g. `thudScale`); 0 or less hides it.
   * Default: every character at 1.
   */
  readonly charScale?: ((index: number) => number) | undefined;
}

/** A stroke as the surface gets it; a closed ribbon repeats its first point at the end. */
export interface Ribbon {
  readonly points: readonly Pt[];
  readonly widths: readonly number[];
}

const SWELL_SLOW = 0.3; // noise periods along the arc, in cap heights
const SWELL_FAST = 0.09;
/** A stroke shorter than this (in cap heights) is a dot. */
const DOT_LENGTH = 0.12;
/** Diameter of a dot relative to the base ink width. */
const DOT_SIZE = 1.7;
const DOT_SAMPLES = 9;

/**
 * Catmull-Rom smoothing through the control points; `step` = target spacing in px. A corner pins
 * the tangent on both of its sides (a sharp turn). A closed stroke wraps around its seam (its
 * first point is a corner when either end is marked).
 */
export function smoothStroke(
  pts: readonly Pt[],
  corners: readonly boolean[],
  closed: boolean,
  step: number,
): Pt[] {
  const last = pts.length - 1;
  const loop = closed && last >= 2 ? last : 0;
  const wrap = (i: number): number =>
    loop > 0 ? ((i % loop) + loop) % loop : Math.max(0, Math.min(last, i));
  const at = (i: number): Pt => pts[wrap(i)] ?? { x: 0, y: 0 };
  const corner = (i: number): boolean => {
    const k = wrap(i);
    return corners[k] === true || (loop > 0 && k === 0 && corners[last] === true);
  };
  const out: Pt[] = [];
  for (let i = 0; i < last; i += 1) {
    const p1 = at(i);
    const p2 = at(i + 1);
    const p0 = corner(i) ? p1 : at(i - 1);
    const p3 = corner(i + 1) ? p2 : at(i + 2);
    const parts = Math.max(1, Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y) / step));
    for (let k = 0; k < parts; k += 1) {
      const t = k / parts;
      const t2 = t * t;
      const t3 = t2 * t;
      const blend = (a: number, b: number, c: number, d: number): number =>
        0.5 *
        (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: blend(p0.x, p1.x, p2.x, p3.x), y: blend(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  const end = out[0] !== undefined && loop > 0 ? out[0] : at(last);
  out.push(end);
  return out;
}

/** Arc length at every point of a polyline. */
function arcLengths(points: readonly Pt[]): number[] {
  const arcs: number[] = [];
  let arc = 0;
  points.forEach((point, i) => {
    const before = points[i - 1];
    if (before) arc += Math.hypot(point.x - before.x, point.y - before.y);
    arcs.push(arc);
  });
  return arcs;
}

/** A round dot centred on the stroke, along its direction, as a ribbon. */
function dotRibbon(points: readonly Pt[], diameter: number): Ribbon {
  const first = points[0] ?? { x: 0, y: 0 };
  const end = points[points.length - 1] ?? first;
  const length = Math.hypot(end.x - first.x, end.y - first.y);
  const ux = length > 0 ? (end.x - first.x) / length : 1;
  const uy = length > 0 ? (end.y - first.y) / length : 0;
  const cx = (first.x + end.x) / 2;
  const cy = (first.y + end.y) / 2;
  const radius = Math.max(diameter, length) / 2;
  const dot: Pt[] = [];
  const widths: number[] = [];
  for (let i = 0; i < DOT_SAMPLES; i += 1) {
    const u = (2 * i) / (DOT_SAMPLES - 1) - 1;
    dot.push({ x: cx + ux * u * radius, y: cy + uy * u * radius });
    widths.push(diameter * Math.sqrt(Math.max(0, 1 - u * u)));
  }
  return { points: dot, widths };
}

/**
 * The ribbon of one laid stroke at a base width. Interior widths stay within 0.4x-1.9x of the
 * base (for `swell` 1); open ends taper like the films' ink line (`taper` 1 = to 0.12x).
 */
export function strokeRibbon(
  stroke: LaidStroke,
  baseWidth: number,
  size: number,
  swell: number,
  taper: number,
): Ribbon {
  const points = smoothStroke(stroke.pts, stroke.corners, stroke.closed, Math.max(1, size * 0.06));
  const arcs = arcLengths(points);
  const total = arcs[arcs.length - 1] ?? 0;
  if (!stroke.closed && total < size * DOT_LENGTH) return dotRibbon(points, baseWidth * DOT_SIZE);
  const slow = Math.max(1, size * SWELL_SLOW);
  const fast = Math.max(1, size * SWELL_FAST);
  const widths = arcs.map((arc) => {
    const k = valueNoise(stroke.key, arc / slow);
    const modulated = 0.4 + 1.25 * k * k + 0.25 * valueNoise(stroke.key + 1013, arc / fast);
    const swollen = 1 + swell * (modulated - 1);
    const ends = stroke.closed ? 1 : Math.min(1, 0.12 + 2.2 * Math.sin((Math.PI * arc) / total));
    return baseWidth * swollen * (1 - taper * (1 - ends));
  });
  return { points, widths };
}

/** Scales a ribbon about a centre. */
function scaled(ribbon: Ribbon, cx: number, cy: number, scale: number): Ribbon {
  if (scale === 1) return ribbon;
  return {
    points: ribbon.points.map((p) => ({ x: cx + (p.x - cx) * scale, y: cy + (p.y - cy) * scale })),
    widths: ribbon.widths.map((w) => w * scale),
  };
}

/** Ribbons of a laid line grouped by character, in order. */
function ribbonsByChar(laid: LaidText, options: DrawOptions): Map<number, Ribbon[]> {
  const metrics = FACES[options.face];
  const base = options.width ?? metrics.weight * options.size;
  const groups = new Map<number, Ribbon[]>();
  for (const stroke of laid.strokes) {
    const ribbon = strokeRibbon(stroke, base, options.size, metrics.swell, metrics.taper);
    const group = groups.get(stroke.char);
    if (group) group.push(ribbon);
    else groups.set(stroke.char, [ribbon]);
  }
  return groups;
}

/** Centre of the control points of character `index`. */
function charCentre(laid: LaidText, index: number): Pt {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const stroke of laid.strokes) {
    if (stroke.char !== index) continue;
    for (const p of stroke.pts) {
      x0 = Math.min(x0, p.x);
      x1 = Math.max(x1, p.x);
      y0 = Math.min(y0, p.y);
      y1 = Math.max(y1, p.y);
    }
  }
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
}

/**
 * Draws a line of lettering; returns its layout (unscaled). The string comes first, as the
 * anti-slop text guard reads the first argument of a text call.
 */
export function drawText(text: string, surface: InkSurface, options: DrawOptions): LaidText {
  const laid = layoutText(text, options);
  const layers = options.layers ?? [{ fill: options.fill }];
  for (const [index, group] of ribbonsByChar(laid, options)) {
    const scale = options.charScale ? options.charScale(index) : 1;
    if (scale <= 0) continue;
    const centre = scale === 1 ? { x: 0, y: 0 } : charCentre(laid, index);
    const ribbons = group.map((ribbon) => scaled(ribbon, centre.x, centre.y, scale));
    for (const layer of layers) {
      const widthScale = layer.widthScale ?? 1;
      const dx = layer.dx ?? 0;
      const dy = layer.dy ?? 0;
      for (const ribbon of ribbons) {
        surface.ribbon(
          dx === 0 && dy === 0
            ? ribbon.points
            : ribbon.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
          widthScale === 1 ? ribbon.widths : ribbon.widths.map((w) => w * widthScale),
          layer.fill,
        );
      }
    }
  }
  return laid;
}

export interface PosterColours {
  readonly ink: string;
  readonly fill: string;
  readonly extrusion: string;
}

/** The films' poster look: bone fill, rust extrusion down-right, fat ink outline. */
export const POSTER_COLOURS: PosterColours = {
  ink: '#16120e',
  fill: '#cdbf94',
  extrusion: '#5c2616',
};

/**
 * Layers for `DrawOptions.layers` (the films' `posterWord`): an ink outline at the full extrusion
 * depth (0.07 of the size, down-right), rust steps every 2 px towards the letter, then the ink
 * outline and the fill on top.
 */
export function posterLayers(size: number, colours: PosterColours = POSTER_COLOURS): InkLayer[] {
  const depth = size * 0.07;
  const layers: InkLayer[] = [{ fill: colours.ink, widthScale: 1.55, dx: depth * 0.7, dy: depth }];
  for (let d = depth; d > 0; d -= 2) {
    layers.push({ fill: colours.extrusion, widthScale: 1.3, dx: d * 0.7, dy: d });
  }
  layers.push({ fill: colours.ink, widthScale: 1.55 }, { fill: colours.fill });
  return layers;
}
