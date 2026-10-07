/**
 * `g`, the drawing context a panel's painter gets (and `page.draw`): panel-content coordinates
 * (page coordinates unless the panel has a camera), the key plate (`g`: ink lines) and the colour
 * plate (`g.plate`: fills printed 1-2 px out of register), halftone/dither paints, line boil at
 * 10 fps, seeded randomness. Pure: what it draws is a function of t and its arguments.
 */
import { KitError } from '../../../errors.js';
import { INK, inkOfSwatch, SWATCH_NAMES } from '../inks.js';
import type { ComicCanvas, Paint, Pts } from '../draw/canvas.js';
import { bigLetter } from '../draw/letters.js';
import { motionTrail, speedLines } from '../draw/marks.js';
import { rnd, rndRange } from '../draw/math.js';
import { dither, halftone, layer, type Screen } from '../draw/paint.js';
import type { Place } from '../draw/place.js';
import { boil, capsulePts, ellipsePts, rotPts } from '../draw/shapes.js';
import { drawText, letterable, measure } from '../draw/text.js';
import { digits, ground, type GroundOptions } from './pen-art.js';
import { standing, type StandingArgs } from './pen-title.js';

/** A colour by swatch name ('ink', 'cyanDeep', ...), a palette index or a per-pixel function. */
export type PaintArg = string | number | ((x: number, y: number) => number);

/** A level 0..1, constant or a function of the pen's local coordinates. */
export type LevelArg = number | ((lx: number, ly: number) => number);

export interface PenContext {
  readonly canvas: ComicCanvas;
  readonly boilFrame: number;
  readonly screen: Readonly<Screen>;
}

/** One part of a blob silhouette: a capsule `c: [x0, y0, x1, y1, r]` or an ellipse `e`. */
export interface BlobPart {
  readonly c?: readonly [number, number, number, number, number] | undefined;
  readonly e?: readonly [number, number, number, number] | undefined;
  readonly fill?: PaintArg | undefined;
}

/** Options of `g.text`: reveal = letters shown (lettered in), slant = pencil slant. */
export interface TextArgs {
  readonly color?: PaintArg;
  readonly scale?: number;
  readonly bold?: boolean;
  readonly jitter?: number;
  readonly reveal?: number;
  readonly slant?: number;
}

export function inkIndex(color: string | number, where: string): number {
  if (typeof color === 'number') {
    if (Number.isInteger(color) && color >= 0 && color < SWATCH_NAMES.length) return color;
    throw new KitError('invalid-params', `${where}: palette index ${String(color)} out of range`);
  }
  const index = inkOfSwatch(color);
  if (index === undefined) {
    throw new KitError(
      'invalid-params',
      `${where}: unknown colour "${color}"; comic inks: ${SWATCH_NAMES.join(', ')}`,
    );
  }
  return index;
}

export function toPaint(paint: PaintArg, where: string): Paint {
  return typeof paint === 'function' ? paint : inkIndex(paint, where);
}

export class ComicPen {
  /** Local time of the panel (seconds). */
  readonly t: number;
  readonly place: Place;
  private readonly mis: readonly [number, number];
  private readonly ctx: PenContext;
  private readonly isPlate: boolean;

  constructor(
    ctx: PenContext,
    place: Place,
    mis: readonly [number, number],
    t: number,
    isPlate = false,
  ) {
    this.ctx = ctx;
    this.place = place;
    this.mis = mis;
    this.t = t;
    this.isPlate = isPlate;
  }

  /** Scale of local units to screen px. */
  get s(): number {
    return this.place.s;
  }

  /** The colour plate: same coordinates, printed out of register by the panel's offset. */
  get plate(): ComicPen {
    if (this.isPlate) return this;
    return new ComicPen(this.ctx, this.place.shift(...this.mis), this.mis, this.t, true);
  }

  /** Child pen: local origin at (x, y), scaled by k. */
  at(x: number, y: number, k = 1): ComicPen {
    return new ComicPen(this.ctx, this.place.at(x, y, k), this.mis, this.t, this.isPlate);
  }

  shift(dx: number, dy: number): ComicPen {
    return new ComicPen(this.ctx, this.place.shift(dx, dy), this.mis, this.t, this.isPlate);
  }

  x(lx: number): number {
    return this.place.x(lx);
  }

  y(ly: number): number {
    return this.place.y(ly);
  }

  /** Line width growing with zoom (screen px, >= 1). */
  w(base = 1): number {
    return this.place.w(base);
  }

  color(name: string | number): number {
    return inkIndex(name, 'g.color');
  }

  /** A paint whose value depends on local coordinates: fn(lx, ly) -> colour index or -1. */
  local(fn: (lx: number, ly: number) => number): (x: number, y: number) => number {
    const { s, ox, oy } = this.place;
    return (x, y) => fn((x + 0.5 - ox) / s, (y + 0.5 - oy) / s);
  }

  /** Halftone dots of `ink` (tone 0..1, may vary over local coordinates) over `on` (or clear). */
  tone(
    ink: string | number,
    level: LevelArg,
    options: { cell?: number; angle?: number; on?: PaintArg; ox?: number } = {},
  ): (x: number, y: number) => number {
    const { s, ox, oy } = this.place;
    const tone =
      typeof level === 'number'
        ? level
        : (x: number, y: number) => level((x + 0.5 - ox) / s, (y + 0.5 - oy) / s);
    const dots = halftone(
      inkIndex(ink, 'g.tone'),
      tone,
      { cell: options.cell, angle: options.angle, ox: options.ox },
      this.ctx.screen,
    );
    return options.on === undefined ? dots : layer(dots, toPaint(options.on, 'g.tone on'));
  }

  /** Ordered dither: level 0 = a, 1 = b ('none' or -1 = transparent). */
  dither(a: string | number, b: string | number, level: number): (x: number, y: number) => number {
    const ink = (c: string | number) => (c === 'none' || c === -1 ? -1 : inkIndex(c, 'g.dither'));
    return dither(ink(a), ink(b), level);
  }

  /** Faint pencil (layout lines, margin roughs): dithered pencil grey at `level`. */
  pencil(level = 0.45): (x: number, y: number) => number {
    return dither(-1, INK.PENCIL, level);
  }

  layer(...paints: readonly PaintArg[]): (x: number, y: number) => number {
    return layer(...paints.map((paint) => toPaint(paint, 'g.layer')));
  }

  poly(pts: Pts, paint: PaintArg): void {
    this.ctx.canvas.poly(this.place.map(pts), toPaint(paint, 'g.poly'));
  }

  rect(x: number, y: number, w: number, h: number, paint: PaintArg): void {
    this.poly([x, y, x + w, y, x + w, y + h, x, y + h], paint);
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, paint: PaintArg): void {
    const { place } = this;
    this.ctx.canvas.ellipse(
      place.x(cx),
      place.y(cy),
      rx * place.s,
      ry * place.s,
      toPaint(paint, 'g.ellipse'),
    );
  }

  /** A straight line; w in screen px (default grows with zoom). */
  line(x0: number, y0: number, x1: number, y1: number, paint: PaintArg, w?: number): void {
    const { place } = this;
    const width = w ?? place.w(1);
    const paintIndex = toPaint(paint, 'g.line');
    this.ctx.canvas.line(place.x(x0), place.y(y0), place.x(x1), place.y(y1), paintIndex, width);
  }

  polyline(pts: Pts, paint: PaintArg, options: { w?: number; closed?: boolean } = {}): void {
    const width = options.w ?? this.place.w(1);
    const where = 'g.polyline';
    this.ctx.canvas.polyline(this.place.map(pts), toPaint(paint, where), width, options.closed);
  }

  /** An ink line with line boil (closed by default): the key plate's hand-inked outline. */
  ink(
    pts: Pts,
    options: { closed?: boolean; w?: number; boil?: number; color?: PaintArg; key?: string } = {},
  ): void {
    const key = options.key ?? `ink${String(pts.length)}:${String(pts[0])},${String(pts[1])}`;
    const mapped = boil(this.place.map(pts), key, options.boil ?? 1, this.ctx.boilFrame);
    const paint = toPaint(options.color ?? INK.INK, 'g.ink');
    this.ctx.canvas.polyline(mapped, paint, options.w ?? this.place.w(1), options.closed ?? true);
  }

  /** The first share p of a polyline (strokes that draw on); w in screen px. */
  strokeOn(pts: Pts, p: number, paint: PaintArg, w = 1): void {
    this.ctx.canvas.strokeOn(this.place.map(pts), p, toPaint(paint, 'g.strokeOn'), w);
  }

  /** Runs `draw` with writes limited to a polygon (local), inside the current clip. */
  clip(pts: Pts, draw: () => void): void {
    const { canvas } = this.ctx;
    const mask = canvas.maskPoly(this.place.map(pts));
    try {
      canvas.withClip(mask, draw);
    } finally {
      canvas.release(mask);
    }
  }

  /**
   * One silhouette from capsules and ellipses (a hand, a glove, a body): every part is inked a
   * little larger first, then filled, so overlaps merge into one shape with a single outline.
   */
  blob(
    parts: readonly BlobPart[],
    fill: PaintArg,
    options: { angle?: number; about?: readonly [number, number]; key?: string } = {},
  ): void {
    const [cx, cy] = options.about ?? [0, 0];
    const angle = options.angle ?? 0;
    const key = options.key ?? 'blob';
    const shape = (part: BlobPart, grow: number): number[] => {
      if (part.c) {
        const [x0, y0, x1, y1, r] = part.c;
        return capsulePts(x0, y0, x1, y1, r + grow);
      }
      const [ex, ey, rx, ry] = part.e ?? [0, 0, 0, 0];
      return ellipsePts(ex, ey, rx + grow, ry + grow, 20);
    };
    const place = (pts: Pts) => this.place.map(angle === 0 ? pts : rotPts(pts, cx, cy, angle));
    const grow = 1.4 / this.place.s;
    const { canvas, boilFrame } = this.ctx;
    parts.forEach((part, i) => {
      canvas.poly(boil(place(shape(part, grow)), `${key}${String(i)}`, 0.4, boilFrame), INK.INK);
    });
    for (const part of parts) {
      canvas.poly(place(shape(part, 0)), toPaint(part.fill ?? fill, 'g.blob'));
    }
  }

  /** Speed lines behind a subject at (x, y) moving along (dx, dy); they stop `gap` before it. */
  speedLines(options: {
    x: number;
    y: number;
    dx: number;
    dy: number;
    count?: number;
    length?: number;
    spread?: number;
    gap?: number;
    color?: PaintArg;
    key?: string;
  }): void {
    const { place } = this;
    speedLines(this.ctx.canvas, {
      x: place.x(options.x),
      y: place.y(options.y),
      dx: options.dx,
      dy: options.dy,
      count: options.count ?? 12,
      length: (options.length ?? 70) * place.s,
      spread: (options.spread ?? 30) * place.s,
      gap: (options.gap ?? 40) * place.s,
      paint: toPaint(options.color ?? 'cyan', 'g.speedLines'),
      key: options.key ?? 'speed',
      phase: this.t,
    });
  }

  /** Motion trail along the path a subject took (oldest point first), stopping before it. */
  trail(
    pts: Pts,
    options: {
      color?: PaintArg;
      lines?: number;
      spacing?: number;
      gap?: number;
      key?: string;
    } = {},
  ): void {
    motionTrail(this.ctx.canvas, this.place.map(pts), {
      paint: toPaint(options.color ?? 'ink', 'g.trail'),
      lines: options.lines ?? 3,
      spacing: (options.spacing ?? 4) * this.place.s,
      gap: (options.gap ?? 10) * this.place.s,
      key: options.key ?? 'trail',
    });
  }

  /** Small hand lettering (labels inside the art) with its top-left at local (x, y). */
  text(text: string, x: number, y: number, options: TextArgs = {}): void {
    const paint = toPaint(options.color ?? 'ink', 'g.text');
    const { scale, bold, reveal, slant } = options;
    const look = { scale, bold, reveal, slant, jitter: options.jitter ?? 0, key: text };
    drawText(
      this.ctx.canvas,
      'hand',
      letterable(text),
      this.place.x(x),
      this.place.y(y),
      paint,
      look,
    );
  }

  /** Width in screen px of `g.text`. */
  textWidth(text: string, scale = 1, bold = false): number {
    return measure('hand', letterable(text), scale, bold);
  }

  /** One big display letter (onomatopoeia inside a panel), centred on local (x, y). */
  bigLetter(
    char: string,
    x: number,
    y: number,
    options: {
      size?: number;
      angle?: number;
      fill?: PaintArg;
      outline?: number;
      extrude?: readonly [number, number];
      mis?: readonly [number, number];
      key?: string;
    } = {},
  ): void {
    bigLetter(
      this.ctx.canvas,
      letterable(char, 'display'),
      this.place.x(x),
      this.place.y(y),
      (options.size ?? 4) * this.place.s,
      options.angle ?? 0,
      toPaint(options.fill ?? 'yellow', 'g.bigLetter'),
      { outline: options.outline, extrude: options.extrude, mis: options.mis, key: options.key },
    );
  }

  /**
   * Ground under a curved horizon (halftone thickening toward the viewer, seeded craters, an
   * inked edge); returns the horizon y at x.
   */
  ground(options: GroundOptions): (x: number) => number {
    return ground(this, options);
  }

  /** Seven-segment digits (displays, clocks, counters); top left at local (x, y). */
  digits(
    text: string,
    x: number,
    y: number,
    options?: { w?: number; h?: number; color?: PaintArg },
  ) {
    digits(this, text, x, y, options);
  }

  /** Block letters standing in the picture, lit from the left (a spread's title). */
  standing(text: string, options: StandingArgs): void {
    const ink = (color: string | number | undefined) =>
      color === undefined ? undefined : inkIndex(color, 'g.standing');
    const inks = { face: ink(options.face), side: ink(options.side), shadow: ink(options.shadow) };
    standing(this, this.ctx.canvas, this.ctx.screen, text, { ...options, ...inks });
  }

  ellipsePts(cx: number, cy: number, rx: number, ry: number, steps = 18): number[] {
    return ellipsePts(cx, cy, rx, ry, steps);
  }

  /** Seeded [0, 1) by key and index (never Math.random in a scene). */
  rnd(key: string, index: number): number {
    return rnd(key, index);
  }

  range(key: string, index: number, min: number, max: number): number {
    return rndRange(key, index, min, max);
  }
}
