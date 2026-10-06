/**
 * The visible writing hand: where the pen tip is (on the mark being drawn, gliding between marks,
 * entering and leaving the page), which pen it holds and how high it hovers, plus the "hand rests
 * here" rule (docs/worlds/DECISIONS.md): the hand turns its wrist so palm and pen keep off the
 * page's keep-clear boxes (the subject), bends its glides around a subject it is not drawing,
 * never parks over one in a pause (it goes to a clear margin spot, its rest spot or off the page)
 * and goes to its rest spot (off the page by default) during long pauses. Pure in t; drawn by
 * pen.ts. Which marks the hand draws at all is decided before (page/hand-queue.ts).
 */
import type { Mark } from './marks.js';
import type { ActiveMark } from './ink.js';
import { markShape } from './ink.js';
import { at, clamp01, ease, lerp } from './math.js';
import type { Point, Xform } from './paths.js';
import type { PenName } from './marks.js';
import {
  bentPoint,
  cover,
  distance,
  glideBend,
  HAND_SPEED,
  naturalAngle,
  restSpot,
  type Box,
  type Room,
} from './hand-room.js';

export { naturalAngle, type Box };

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
  /**
   * First marks of tasks the hand queue moved: the hand travels to them in the air (a pen swap
   * on the way), not off the page and back.
   */
  readonly queued?: ReadonlySet<Mark>;
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
/** A pause this long (s) never leaves the hand over a subject (the hold rule). */
export const HOLD = 0.4;
/** Wrist turns tried, in order of preference (degrees from the natural angle). */
const TURNS = [0, -16, 16, -30, 30, -44] as const;

/** The wrist turn for a mark drawn from `start` to `end`: the least cover of the keep-clear boxes. */
export function wristTurn(start: Point, end: Point, rules: HandRules): number {
  let best = 0;
  let bestScore = Infinity;
  const covers = (p: Point, turn: number): number =>
    cover(p, naturalAngle(p[0], rules.width) + turn, rules.keepClear, rules.scale);
  for (const turn of TURNS) {
    const score = covers(start, turn) + covers(end, turn);
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

/** Where the hand starts and ends a mark (through `xf`). */
export function markEnds(mark: Mark, xf: Xform): [Point, Point] {
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

/** The end-of-shot rule: for the shot's last FINAL s the hand is not over the page's subject. */
export const FINAL = 0.4;
/** How long the hand takes to get to its rest spot or off the page then (s). */
const RETREAT = 0.35;

/**
 * The hand `elapsed` s into the end-of-shot rule, from `from`: it lifts and goes to its rest spot
 * (the scene's spot when clear, else the nearest clear margin spot) or, with no rest spot, down
 * off the bottom of the frame (`height` screen px); null once it is gone.
 */
export function retreat(
  from: PenState,
  elapsed: number,
  rules: HandRules,
  height: number,
): PenState | null {
  const tip: Point = [from.x, from.y];
  const room: Room = { boxes: rules.keepClear, scale: rules.scale, width: rules.width };
  const spot = rules.rest ? restSpot(tip, rules.rest, room) : null;
  const below = height + 30 * rules.scale;
  const target: Point = spot ?? [from.x + (below - from.y) * 0.8, below];
  const k = elapsed / RETREAT;
  if (k >= 1 && !spot) return null;
  const e = ease('inOut', k);
  return {
    ...from,
    x: lerp(from.x, target[0], e),
    y: lerp(from.y, target[1], e),
    lift: lerp(from.lift, spot ? 0.6 : 1.2, e),
    angle: lerp(from.angle, naturalAngle(target[0], rules.width), e),
  };
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
  const room: Room = { boxes: rules.keepClear, scale: rules.scale, width: rules.width };
  // The scene's rest spot when the hand there keeps off the subject, else a clear margin spot.
  const rest = rules.rest ? restSpot(rules.rest, rules.rest, room) : null;
  const away = (p: Point): Point => rest ?? [p[0] + 330 * rules.scale, p[1] + 400 * rules.scale];
  const make = (p: Point, entry: TrackEntry, lift: number, turn = entry.turn): PenState => ({
    x: p[0],
    y: p[1],
    pen: entry.mark.pen,
    color: entry.mark.color,
    lift,
    angle: naturalAngle(p[0], rules.width) + turn,
  });
  const covers = (p: Point, turn: number): boolean =>
    cover(p, naturalAngle(p[0], rules.width) + turn, rules.keepClear, rules.scale) > 0;
  const enter = (t: number, next: TrackEntry): PenState | null => {
    if (t < next.mark.t0 - ENTER) return rest ? make(rest, next, 1, 0) : null;
    const k = ease('out', (t - (next.mark.t0 - ENTER)) / ENTER);
    const from = away(next.start);
    return make(lerpPoint(from, next.start, k), next, 1 - k, next.turn * k);
  };
  const leave = (t: number, entry: TrackEntry, endT: number): PenState | null => {
    const k = (t - endT - 0.15) / EXIT;
    if (k < 0) return make(entry.end, entry, ease('out', clamp01((t - endT) / 0.15)) * 0.6);
    const target = away(entry.end);
    if (k >= 1) return rest ? make(target, entry, 1, 0) : null;
    const along = ease('in', k);
    return make(lerpPoint(entry.end, target, along), entry, 0.6 + k, entry.turn * (1 - along));
  };
  /** The hold rule: out to a clear spot and back within the pause (undefined = no room). */
  const hold = (t: number, from: TrackEntry, to: TrackEntry, endT: number, gap: number) => {
    const spot = restSpot(from.end, rest, room);
    const reach = 0.4 * gap * HAND_SPEED * rules.scale;
    if (!spot || distance(from.end, spot) > reach || distance(spot, to.start) > reach) {
      return undefined;
    }
    const k = (t - endT) / gap;
    if (k < 0.4) {
      const e = ease('sine', k / 0.4);
      return make(lerpPoint(from.end, spot, e), from, 0.6 * e, from.turn * (1 - e));
    }
    if (k < 0.6) return make(spot, k < 0.5 ? from : to, 0.6, 0);
    const e = ease('sine', (k - 0.6) / 0.4);
    return make(lerpPoint(spot, to.start, e), to, 0.6 * (1 - e), to.turn * e);
  };
  const bends: number[] = [];
  const bendOf = (index: number, from: TrackEntry, to: TrackEntry, gap: number): number => {
    const known = bends[index];
    if (known !== undefined) return known;
    const angle = (p: Point, k: number): number =>
      naturalAngle(p[0], rules.width) + lerp(from.turn, to.turn, k);
    const bend = glideBend(from.end, to.start, angle, gap, room);
    bends[index] = bend;
    return bend;
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
      const hoverCovers = covers(current.end, current.turn);
      const busy = (rules.busy ?? []).some(([from, to]) => from < next.mark.t0 && to > endT);
      if (busy || gap > rules.restGap || (hoverCovers && gap > 2 * (ENTER + 0.15))) {
        if (t >= next.mark.t0 - ENTER) return enter(t, next);
        return leave(t, current, endT);
      }
      if (gap >= HOLD && (hoverCovers || covers(next.start, next.turn))) {
        const held = hold(t, current, next, endT, gap);
        if (held) return held;
      }
      const k = (t - endT) / gap;
      const swap = current.mark.pen !== next.mark.pen;
      const queued = rules.queued?.has(next.mark) === true;
      if (swap && !queued) {
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
      const glide = ease(queued ? 'sine' : 'inOut', k);
      return make(
        bentPoint(current.end, next.start, bendOf(index, current, next, gap), glide),
        swap && k < 0.5 ? current : next,
        Math.sin(Math.PI * k) * (swap ? 1 : Math.min(1, gap * 2.5)),
        lerp(current.turn, next.turn, glide),
      );
    },
  };
}
