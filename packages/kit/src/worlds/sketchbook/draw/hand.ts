/**
 * The visible writing hand: where the pen tip is (on the mark being drawn, gliding between marks,
 * entering and leaving the page), which pen it holds and how high it hovers, plus the "hand rests
 * here" rule (docs/worlds/DECISIONS.md): the hand turns its wrist so palm and pen keep off the
 * page's keep-clear boxes (the subject), never parks over them between marks, and goes to its rest
 * spot (off the page by default) during long pauses. Pure in t; drawn by pen.ts.
 */
import type { Mark } from './marks.js';
import type { ActiveMark } from './ink.js';
import { markShape } from './ink.js';
import { at, clamp01, ease, lerp } from './math.js';
import type { Point, Xform } from './paths.js';
import type { PenName } from './marks.js';

/** A screen rectangle [x, y, w, h]. */
export type Box = readonly [number, number, number, number];

export interface HandRules {
  /** Screen boxes the hand must not cover while it can avoid it (focal subject). */
  readonly keepClear: readonly Box[];
  /** Where the hand rests in long pauses (screen px); null = it leaves the page. */
  readonly rest: Point | null;
  /** Pauses longer than this (s) send the hand to its rest spot. */
  readonly restGap: number;
  /** Screen px per page px (hand size). */
  readonly scale: number;
  /** Frame width (the wrist angle drifts a little across the page). */
  readonly width: number;
  /**
   * Stretches [from, to] (s) when the writing hand is busy elsewhere (it lifts a pop-up flap,
   * the other hand drags a strip): a pause that touches one sends the hand off, never across.
   */
  readonly busy?: readonly (readonly [number, number])[];
}

export interface PenState {
  readonly x: number;
  readonly y: number;
  readonly pen: PenName;
  readonly color: number;
  /** 0 = touching the paper, 1+ = lifted (bigger shadow offset). */
  readonly lift: number;
  /** Angle of the pen body from the tip (degrees, 0 = to the right, 90 = down). */
  readonly angle: number;
}

interface TrackEntry {
  readonly mark: Mark;
  readonly start: Point;
  readonly end: Point;
  /** Wrist turn (degrees) away from the natural angle while drawing this mark. */
  readonly turn: number;
}

const ENTER = 0.42;
const EXIT = 0.4;
/** Wrist turns tried, in order of preference (degrees from the natural angle). */
const TURNS = [0, -16, 16, -30, 30, -44] as const;

/** Sample points of the hand silhouette (pen body + palm) in pen space (u along the pen). */
const SILHOUETTE: readonly Point[] = (() => {
  const points: Point[] = [];
  for (let u = 20; u <= 250; u += 23) points.push([u, 0]);
  for (let u = 100; u <= 220; u += 20) for (let v = -6; v <= 62; v += 17) points.push([u, v]);
  return points;
})();

/** The pen's resting angle at screen x (degrees from the tip, drifting across the frame). */
export function naturalAngle(x: number, width: number): number {
  return 50 + (x / width) * 14;
}

function overlap(tip: Point, angle: number, rules: HandRules): number {
  if (rules.keepClear.length === 0) return 0;
  const a = (angle * Math.PI) / 180;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  let count = 0;
  for (const [u, v] of SILHOUETTE) {
    const x = tip[0] + (u * ca - v * sa) * rules.scale;
    const y = tip[1] + (u * sa + v * ca) * rules.scale;
    for (const [bx, by, bw, bh] of rules.keepClear) {
      if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) count += 1;
    }
  }
  return count;
}

/** The wrist turn for a mark drawn from `start` to `end`: the least cover of the keep-clear boxes. */
export function wristTurn(start: Point, end: Point, rules: HandRules): number {
  let best = 0;
  let bestScore = Infinity;
  for (const turn of TURNS) {
    const score =
      overlap(start, naturalAngle(start[0], rules.width) + turn, rules) +
      overlap(end, naturalAngle(end[0], rules.width) + turn, rules);
    if (score < bestScore) {
      best = turn;
      bestScore = score;
    }
    if (score === 0) break;
  }
  return best;
}

function bounds(points: readonly number[]): [Point, Point] {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < points.length; i += 2) {
    x0 = Math.min(x0, at(points, i));
    x1 = Math.max(x1, at(points, i));
    y0 = Math.min(y0, at(points, i + 1));
    y1 = Math.max(y1, at(points, i + 1));
  }
  return [
    [x0 + (x1 - x0) * 0.2, y0 + (y1 - y0) * 0.2],
    [x0 + (x1 - x0) * 0.8, y0 + (y1 - y0) * 0.8],
  ];
}

function markEnds(mark: Mark, xf: Xform): [Point, Point] {
  if (mark.type === 'fill') {
    const [a, z] = bounds(mark.source ? mark.source(mark.t0) : mark.poly);
    return [xf(a[0], a[1]), xf(z[0], z[1])];
  }
  const first = markShape(mark, mark.t0).pts;
  const last = markShape(mark, mark.t0 + mark.dur).pts;
  return [xf(at(first, 0), at(first, 1)), xf(at(last, last.length - 2), at(last, last.length - 1))];
}

function lerpPoint(a: Point, b: Point, k: number): Point {
  return [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
}

export interface HandTrack {
  /** Pen state at t (null = no hand on the page). */
  state(t: number, active: ActiveMark | null): PenState | null;
}

/** Precomputes the hand's path over the held marks (sorted by start). */
export function createHandTrack(marks: readonly Mark[], rules: HandRules, xf: Xform): HandTrack {
  const entries: TrackEntry[] = marks
    .filter((mark) => mark.held)
    .sort((a, b) => a.t0 - b.t0)
    .map((mark) => {
      const [start, end] = markEnds(mark, xf);
      return { mark, start, end, turn: wristTurn(start, end, rules) };
    });
  const away = (p: Point): Point =>
    rules.rest ?? [p[0] + 330 * rules.scale, p[1] + 400 * rules.scale];
  const make = (p: Point, entry: TrackEntry, lift: number, turn = entry.turn): PenState => ({
    x: p[0],
    y: p[1],
    pen: entry.mark.pen,
    color: entry.mark.color,
    lift,
    angle: naturalAngle(p[0], rules.width) + turn,
  });
  const enter = (t: number, next: TrackEntry): PenState | null => {
    if (t < next.mark.t0 - ENTER) return rules.rest ? make(rules.rest, next, 1, 0) : null;
    const k = ease('out', (t - (next.mark.t0 - ENTER)) / ENTER);
    const from = away(next.start);
    return make(lerpPoint(from, next.start, k), next, 1 - k, next.turn * k);
  };
  const leave = (t: number, entry: TrackEntry, endT: number): PenState | null => {
    const k = (t - endT - 0.15) / EXIT;
    if (k < 0) return make(entry.end, entry, ease('out', clamp01((t - endT) / 0.15)) * 0.6);
    const target = away(entry.end);
    if (k >= 1) return rules.rest ? make(target, entry, 1, 0) : null;
    const along = ease('in', k);
    return make(lerpPoint(entry.end, target, along), entry, 0.6 + k, entry.turn * (1 - along));
  };
  return {
    state(t, active) {
      const first = entries[0];
      if (!first) return null;
      if (active) {
        const entry = entries.find((candidate) => candidate.mark === active.mark) ?? first;
        return make(active.tip, entry, 0);
      }
      let index = -1;
      for (let k = 0; k < entries.length; k += 1)
        if ((entries[k]?.mark.t0 ?? Infinity) <= t) index = k;
      if (index < 0) return enter(t, first);
      const current = entries[index] ?? first;
      const endT = current.mark.t0 + current.mark.dur;
      if (t < endT) return make(current.end, current, 0);
      const next = entries[index + 1];
      if (!next) return leave(t, current, endT);
      const gap = next.mark.t0 - endT;
      // The rest rule: long pauses, or hovering that would cover the subject, send the hand away.
      const hoverAngle = naturalAngle(current.end[0], rules.width) + current.turn;
      const hoverCovers = overlap(current.end, hoverAngle, rules) > 0;
      const busy = (rules.busy ?? []).some(([from, to]) => from < next.mark.t0 && to > endT);
      if (busy || gap > rules.restGap || (hoverCovers && gap > 2 * (ENTER + 0.15))) {
        if (t >= next.mark.t0 - ENTER) return enter(t, next);
        return leave(t, current, endT);
      }
      const k = (t - endT) / gap;
      if (current.mark.pen !== next.mark.pen) {
        if (k < 0.5) {
          return make(
            lerpPoint(current.end, away(current.end), ease('in', k * 2)),
            current,
            0.5 + k,
          );
        }
        const back = ease('out', (k - 0.5) * 2);
        return make(lerpPoint(away(next.start), next.start, back), next, 1 - (k - 0.5) * 2);
      }
      const glide = ease('inOut', k);
      return make(
        lerpPoint(current.end, next.start, glide),
        next,
        Math.sin(Math.PI * k) * Math.min(1, gap * 2.5),
        lerp(current.turn, next.turn, glide),
      );
    },
  };
}
