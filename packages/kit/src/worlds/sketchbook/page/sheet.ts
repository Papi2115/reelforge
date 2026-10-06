/**
 * Inserts on a Sketchbook page: a sheet of paper (printed calendar, index card, note) taped into
 * the notebook or slapped on mid-shot (falls from a lift with a growing shadow, lands with a tiny
 * squash and a beat later gets its tape). Its printed content (type lettering, ruled grid) lives in
 * the sheet's local coordinates and moves with it.
 */
import type { InkCanvas } from '../draw/canvas.js';
import { drawMark } from '../draw/ink.js';
import { writeMarks, type Mark } from '../draw/marks.js';
import { ease, seg } from '../draw/math.js';
import { dropShadow, paintSheet, printLine } from '../draw/paper.js';
import {
  ellipsePts,
  placement,
  xformPts,
  type Placement,
  type Point,
  type Xform,
} from '../draw/paths.js';
import { HARD, INK, SOFT } from '../inks.js';
import { paintTape } from '../traces.js';
import type { Layer } from './model.js';

/** Printed things are always complete and never boil. */
const PRINTED_T = 1e6;
const SLAP_FALL = 0.2;
const SLAP_SETTLE = 0.28;
const TAPE_DELAY = 0.3;

export interface SheetSpec {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly deg: number;
  /** Landing time of a slapped-on sheet; undefined = taped in before the shot. */
  readonly at: number | undefined;
  readonly holes: boolean;
  readonly seed: number;
}

interface SheetTape {
  readonly u: number;
  readonly v: number;
  readonly w: number;
  readonly h: number;
  readonly deg: number;
  readonly seed: number;
}

interface PrintedLine {
  readonly from: Point;
  readonly to: Point;
  readonly color: number;
}

export interface CalendarSpec {
  readonly title: string;
  readonly days: number;
  /** Column (0-6) of day 1. */
  readonly firstColumn: number;
  readonly u: number;
  readonly v: number;
  readonly cell: number;
  readonly titleSize: number;
  readonly numberSize: number;
}

export class Sheet {
  readonly spec: SheetSpec;
  /** Where the sheet lies once it has landed. */
  readonly landed: Placement;
  private readonly printed: Mark[] = [];
  private readonly lines: PrintedLine[] = [];
  private readonly tapes: SheetTape[] = [];

  constructor(spec: SheetSpec) {
    this.spec = spec;
    this.landed = placement(spec.x, spec.y, spec.deg);
  }

  /** The sheet's placement at t (lifted and falling before a slapped sheet lands). */
  placementAt(t: number): Placement {
    const { spec } = this;
    if (spec.at === undefined) return this.landed;
    const k = seg(t, spec.at - SLAP_FALL, spec.at);
    const s = ease('in', k);
    const land = seg(t, spec.at, spec.at + SLAP_SETTLE);
    const scale = k < 1 ? 1.3 - 0.3 * s : 1 - 0.035 * Math.sin(land * Math.PI) * (1 - land);
    return placement(spec.x + (1 - s) * 90, spec.y - (1 - s) * 140, spec.deg - (1 - s) * 9, scale);
  }

  /** Local -> page at t. */
  frameAt(t: number): Xform {
    return this.placementAt(t).toPage;
  }

  /** A local point on the landed sheet, in page px. */
  point(u: number, v: number): Point {
    return this.landed.toPage(u, v);
  }

  print(
    text: string,
    u: number,
    v: number,
    size: number,
    width: number,
    seed: number,
    track = 0,
  ): void {
    writeMarks(this.printed, text, {
      x: u,
      y: v,
      size,
      hand: 'type',
      tool: 'fine',
      width,
      seed,
      track,
      t0: -5,
      t1: -4.9,
      held: false,
      boil: 0,
      fps: 1,
    });
  }

  rule(from: Point, to: Point, color: number = INK.GRAPH_L): void {
    this.lines.push({ from, to, color });
  }

  tape(u: number, v: number, w: number, h: number, deg: number, seed: number): void {
    this.tapes.push({ u, v, w, h, deg, seed });
  }

  /** A printed month grid; returns the local centre of a day's cell. */
  calendar(spec: CalendarSpec): (day: number) => Point {
    const { u, v, cell } = spec;
    this.print(spec.title, u, v - 18, spec.titleSize, 2, this.spec.seed, 0.5);
    const position = (day: number): readonly [number, number] => {
      const index = day - 1 + spec.firstColumn;
      return [Math.floor(index / 7), index % 7];
    };
    for (let day = 1; day <= spec.days; day += 1) {
      const [row, column] = position(day);
      this.print(
        String(day),
        u + column * cell + 5,
        v + row * cell + spec.numberSize + 6,
        spec.numberSize,
        1,
        this.spec.seed + day,
      );
    }
    const rows = position(spec.days)[0] + 1;
    for (let r = 0; r <= rows; r += 1)
      this.rule([u, v + r * cell - 4], [u + 7 * cell, v + r * cell - 4]);
    for (let c = 0; c <= 7; c += 1)
      this.rule([u + c * cell, v - 4], [u + c * cell, v - 4 + rows * cell]);
    return (day) => {
      const [row, column] = position(day);
      return [u + column * cell + cell / 2, v + row * cell + cell / 2];
    };
  }

  /** The sheet as one page layer. */
  layer(toScreen: Xform): Layer {
    const { spec } = this;
    const slapped = spec.at !== undefined;
    return {
      key: spec.at ?? Number.NEGATIVE_INFINITY,
      from: spec.at === undefined ? Number.NEGATIVE_INFINITY : spec.at - SLAP_FALL,
      draw: (canvas, t) => {
        this.paint(canvas, t, toScreen, slapped);
        return null;
      },
    };
  }

  private paint(canvas: InkCanvas, t: number, toScreen: Xform, slapped: boolean): void {
    const { spec } = this;
    const place = this.placementAt(t);
    const xf: Xform = (u, v) => {
      const [x, y] = place.toPage(u, v);
      return toScreen(x, y);
    };
    const [ox] = toScreen(0, 0);
    const [ux] = toScreen(1, 0);
    const s = ux - ox;
    const lift = slapped && spec.at !== undefined ? 1 - seg(t, spec.at - SLAP_FALL, spec.at) : 0;
    dropShadow(
      canvas,
      xf,
      spec.w,
      spec.h,
      (3 + lift * 24) * s,
      (5 + lift * 30) * s,
      lift > 0.3 ? SOFT : HARD,
    );
    paintSheet(canvas, place, toScreen, spec.w, spec.h, {
      fill: INK.PAPER,
      fibre: INK.FIBRE,
      fibreOffset: spec.seed % 997,
    });
    for (const line of this.lines) printLine(canvas, xf, line.from, line.to, line.color);
    if (spec.holes) {
      for (const u of [spec.w * 0.2, spec.w * 0.8])
        canvas.fillPoly(xformPts(ellipsePts(u, 16, 5, 5, 10), xf), INK.SHADE);
    }
    for (const mark of this.printed) drawMark(canvas, mark, PRINTED_T, xf);
    if (slapped && spec.at !== undefined && t < spec.at + TAPE_DELAY) return;
    for (const tape of this.tapes) {
      const [x, y] = place.toPage(tape.u, tape.v);
      paintTape(canvas, toScreen, x, y, tape.w, tape.h, tape.deg, tape.seed);
    }
  }
}
