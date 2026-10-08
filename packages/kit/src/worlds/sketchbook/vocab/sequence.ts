/**
 * Pen operations -> timed marks for the one writing hand (PLAN.md#13.15a): strokes in drawing
 * order at the pen's pace (a little brisker than lettering), uneven seeded pauses, and travel
 * time between two strokes far apart (the hand never teleports). Attached drawings redraw their
 * points through the frame (a hat on a head, a tool in a hand).
 */
import { fillMark, fitMarks, strokeMark, type Mark } from '../draw/marks.js';
import { at, rnd } from '../draw/math.js';
import { xformPts, type Pts } from '../draw/paths.js';
import type { PageFrame } from '../page/motion.js';
import type { Op } from './compile.js';

export interface SequenceOptions {
  readonly t0: number;
  readonly seed: number;
  /** Pace multiplier (1 = the doodle pace). */
  readonly speed: number;
  readonly fps: number;
  readonly held: boolean;
  /** Page px per target unit (travel times). */
  readonly unit: number;
  readonly frame?: PageFrame | undefined;
}

/**
 * The hand's drawing pace for doodles (page px/s), whatever the nib: about the brisk lettering
 * pace, so a hero drawing takes 1-2 s of a 4-9 s shot.
 */
const DOODLE_SPEED = 1400;
/** Page px per second the hand travels between strokes. */
const REACH = 2400;

/** The vertex of a polygon furthest back (-1) or ahead (1) along a fill's hatch sweep. */
function sweepEnd(poly: Pts, dir: 1 | -1, side: -1 | 1): readonly [number, number] {
  let best: readonly [number, number] = [at(poly, 0), at(poly, 1)];
  let score = Infinity;
  for (let i = 0; i + 1 < poly.length; i += 2) {
    const value = -side * (at(poly, i) + at(poly, i + 1) * dir);
    if (value < score) {
      score = value;
      best = [at(poly, i), at(poly, i + 1)];
    }
  }
  return best;
}

/** Where the hand starts an op (a fill starts where its hatch sweep starts). */
function firstPoint(op: Op): readonly [number, number] {
  return op.kind === 'stroke' ? [at(op.pts, 0), at(op.pts, 1)] : sweepEnd(op.poly, op.dir, -1);
}

function lastPoint(op: Op): readonly [number, number] {
  const pts = op.kind === 'stroke' ? op.pts : op.poly;
  return op.kind === 'stroke'
    ? [at(pts, pts.length - 2), at(pts, pts.length - 1)]
    : sweepEnd(op.poly, op.dir, 1);
}

function area(poly: Pts): number {
  let sum = 0;
  const n = poly.length >> 1;
  for (let i = 0, j = n - 1; i < n; j = i, i += 1) {
    sum += at(poly, 2 * j) * at(poly, 2 * i + 1) - at(poly, 2 * i) * at(poly, 2 * j + 1);
  }
  return Math.abs(sum / 2);
}

/**
 * The hand outlines the whole drawing first, then colours it in (fills in their own order), so
 * a many-part drawing does not stop for the crayon after every line.
 */
export function sequenceOps(all: readonly Op[], o: SequenceOptions): Mark[] {
  const ops = [
    ...all.filter((op) => op.kind === 'stroke'),
    ...all.filter((op) => op.kind === 'fill'),
  ];
  const marks: Mark[] = [];
  let t = o.t0;
  let previous: Op | undefined;
  const source = (pts: Pts) =>
    o.frame ? (tt: number) => xformPts(pts, (o.frame as PageFrame).at(tt)) : undefined;
  ops.forEach((op, index) => {
    if (previous) {
      const [ax, ay] = lastPoint(previous);
      const [bx, by] = firstPoint(op);
      const travel = (Math.hypot(bx - ax, by - ay) * o.unit) / REACH;
      const dabs =
        op.kind === 'stroke' &&
        op.dab === true &&
        previous.kind === 'stroke' &&
        previous.dab === true;
      const quick = dabs || (op.kind === 'fill' && previous.kind === 'fill');
      t +=
        (quick ? rnd(0.004, 0.014, o.seed, index, 1) : rnd(0.008, 0.035, o.seed, index, 1)) /
          o.speed +
        travel;
    }
    const seed = o.seed + index * 17;
    if (op.kind === 'stroke') {
      const pts = op.pts;
      const shape = source(pts);
      const mark = strokeMark(pts, {
        tool: op.tool,
        color: op.color,
        width: op.width,
        t0: t,
        seed,
        corners: op.corners,
        smooth: op.smooth,
        speed: DOODLE_SPEED * o.speed * (op.pace ?? 1),
        ...(op.dab === true ? { dur: 0.02 / o.speed } : {}),
        fps: o.fps,
        held: o.held,
        source: shape ? (tt) => ({ pts: shape(tt), corners: op.corners }) : undefined,
      });
      marks.push(mark);
      t = mark.t0 + mark.dur;
    } else {
      const size = area(op.poly) * o.unit * o.unit;
      const dur = Math.min(0.35, Math.max(0.035, size / 120_000)) / o.speed;
      marks.push(
        fillMark(op.poly, {
          color: op.color,
          t0: t,
          dur,
          seed,
          spacing: op.spacing,
          dir: op.dir,
          dense: op.dense,
          held: o.held,
          source: source(op.poly),
        }),
      );
      t += dur;
    }
    previous = op;
  });
  return marks;
}

/** A drawing is never squeezed below this share of its own pace (the hand would hop). */
const MIN_PACE = 0.5;

/**
 * Fits the marks to end at `until` (the scene's budget), but never faster than MIN_PACE of their
 * natural pace: the hand still has to travel between strokes. Returns the marks (in place).
 */
export function fitDrawing(marks: Mark[], until: number | undefined): Mark[] {
  if (until === undefined || marks.length === 0) return marks;
  const start = Math.min(...marks.map((mark) => mark.t0));
  const natural = Math.max(...marks.map((mark) => mark.t0 + mark.dur)) - start;
  fitMarks(marks, 0, start, start + Math.max(until - start, natural * MIN_PACE));
  return marks;
}
