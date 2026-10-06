/**
 * Plans an accordion timeline (docs/worlds/sketchbook-v2/js/accordion.js, shot 8) from its events:
 * where each sits on the strip (hand-placed by year: the long stretches squeezed, the busy ones
 * stretched), the pencil construction (an axis ruled panel by panel, hand-ruled ticks), the
 * written events, and the drags: whenever the next event is out of view the left hand drags the
 * strip (two fast back-to-back pulls for a long way, one with an overshoot for a short one). A
 * held beat (>= 0.5 s, the pen hovering) comes before the highlighted event.
 */
import { loopRecipe, sunRecipe } from '../draw/doodles.js';
import { DEFAULT_EXPRESSION, DEFAULT_POSE, figureMarks } from '../draw/figures.js';
import { HAND_SPEED } from '../draw/hand-room.js';
import { textWidth } from '../draw/lettering.js';
import { fitMarks, strokeMark, writeMarks, type Mark, type ToolName } from '../draw/marks.js';
import { ease, rnd, seg } from '../draw/math.js';
import type { Point } from '../draw/paths.js';
import { recipeMarks } from './shapes.js';
import { AXIS, construction } from './strip-construction.js';
import { noteLines, type StripEvent, type StripOptions } from './strip-schema.js';

/** u of the first event; the view's right limit (page x). */
const FIRST_U = 282;
const VIEW_RIGHT = 880;

export interface Pull {
  /** The hand arrives (undefined = it follows the previous pull). */
  readonly g0: number | undefined;
  readonly p0: number;
  readonly d0: number;
  readonly d1: number;
  readonly D: number;
  readonly ease: (x: number) => number;
  /** Anticipation (px back before the drag). */
  readonly ant: number;
  /** Grip on the strip (u, v). */
  readonly u: number;
  readonly v: number;
}

export interface StripPlan {
  readonly u0: number;
  readonly u1: number;
  readonly marks: Mark[];
  readonly pulls: Pull[];
  readonly events: { readonly at: number; readonly end: number }[];
  readonly end: number;
}

export function slideAt(pulls: readonly Pull[], t: number): number {
  let s = 0;
  for (const p of pulls) {
    s += p.D * p.ease(seg(t, p.d0, p.d1));
    if (p.ant) s -= p.ant * Math.sin(Math.PI * seg(t, p.p0, p.d0 + 0.08));
  }
  return s;
}

interface Sized {
  readonly event: StripEvent;
  readonly hero: boolean;
  readonly size: number;
  readonly lines: readonly string[];
  readonly width: number;
}

function sizeEvents(o: StripOptions, seed: number): Sized[] {
  const sizes = [40, 32, 36, 28] as const;
  return o.events.map((event, index) => {
    const hero = index === o.highlight;
    const size = hero ? 52 : (sizes[Math.floor(rnd(0, 4, seed, index, 3))] ?? 36);
    const lines = noteLines(event);
    const noteW = Math.max(
      0,
      ...lines.map((line, k) =>
        textWidth(line, hero && k === 0 ? 30 : 17, hero && k === 0 ? 'scrawl' : 'print'),
      ),
    );
    const doodle = event.doodle === 'none' ? 0 : 46;
    return {
      event,
      hero,
      size,
      lines,
      width: Math.max(textWidth(event.label, size, 'print') + 12, noteW + doodle + 14),
    };
  });
}

/** u of every event: spaced by year when given (square-root squeeze), else evenly. */
function placeEvents(sized: readonly Sized[], seed: number): number[] {
  const years = sized.map((entry) => entry.event.year);
  const gaps = sized.slice(1).map((_, i) => {
    const [a, b] = [years[i], years[i + 1]];
    return a === undefined || b === undefined ? 1 : b - a;
  });
  const mean = gaps.reduce((sum, gap) => sum + gap, 0) / Math.max(1, gaps.length);
  const out = [FIRST_U];
  gaps.forEach((gap, i) => {
    const before = sized[i];
    const raw =
      years[0] === undefined ? 340 + rnd(-20, 20, seed, i, 4) : 380 * Math.sqrt(gap / mean);
    const least = Math.max(250, (before?.width ?? 0) + 56);
    out.push((out.at(-1) ?? FIRST_U) + Math.min(700, Math.max(least, raw)));
  });
  return out;
}

interface Pen {
  readonly label: ToolName;
  readonly note: ToolName;
}

/** One event written from t; returns its marks' end. */
function writeEvent(
  marks: Mark[],
  entry: Sized,
  u: number,
  t: number,
  pace: number,
  pen: Pen,
  seed: number,
): number {
  const { hero, size, lines, event } = entry;
  const from = marks.length;
  const len = hero ? 15 : rnd(9, 12, seed, 2);
  // The hand needs time to get from the label's end down to the axis tick: the label is written
  // that much faster, so the event keeps its length (never a hop).
  const labelY = hero ? 76 : 70;
  const travel = Math.hypot(textWidth(event.label, size, 'print') + 8, AXIS - len - labelY);
  const extra = Math.max(0, travel / HAND_SPEED - 0.04 * pace);
  const labelEnd = t + (0.1 + 0.06 * event.label.length + (hero ? 0.12 : 0)) * pace - extra;
  writeMarks(marks, event.label, {
    x: u + 8,
    y: labelY,
    size,
    hand: 'print',
    tool: pen.label,
    width: hero ? 3 : 2,
    rot: rnd(-2.5, -1, seed, 1),
    seed: seed + 1,
    t0: t,
    t1: labelEnd,
    fps: 10,
  });
  let at = labelEnd + 0.04 * pace + extra;
  marks.push(
    strokeMark([u + 0.6, AXIS - len, u - 0.4, AXIS + len], {
      tool: hero ? 'felt' : pen.label,
      width: hero ? 3 : 2,
      t0: at,
      dur: 0.04 * pace,
      smooth: false,
      seed: seed + 3,
      fps: 10,
    }),
  );
  at += 0.1 * pace;
  let noteEnd = at;
  lines.forEach((line, k) => {
    const red = hero && k === 0;
    if (red) at += 0.22 * pace;
    const end = at + (0.06 + 0.017 * line.length + (red ? 0.1 : 0)) * pace;
    writeMarks(
      marks,
      line,
      red
        ? {
            x: u + 12,
            y: 146,
            size: 30,
            hand: 'scrawl',
            tool: 'red',
            width: 3,
            rot: -4,
            seed: seed + 4,
            t0: at,
            t1: end,
            fps: 10,
          }
        : {
            x: u + 10 + k * 2,
            y: hero ? 146 + 26 * k : 134 + 24 * k,
            size: 17,
            hand: 'print',
            tool: pen.note,
            width: 1,
            rot: k === 1 ? 1 : 0,
            seed: seed + 5 + k,
            t0: at,
            t1: end,
            fps: 10,
          },
    );
    noteEnd = end;
    at = end + 0.05 * pace;
  });
  if (event.doodle !== 'none') {
    const firstLine = lines[0];
    const x =
      u +
      18 +
      (firstLine === undefined
        ? textWidth(event.label, size, 'print')
        : textWidth(firstLine, hero ? 30 : 17, hero ? 'scrawl' : 'print')) +
      8;
    const y = firstLine === undefined ? 60 : 126;
    const start = marks.length;
    const t0 = noteEnd + 0.04 * pace;
    if (event.doodle === 'sun')
      marks.push(
        ...recipeMarks(sunRecipe(x + 6, y, 7, seed, 7, 0.45), {
          tool: 'fine',
          t0,
          seed: seed + 6,
          held: true,
          fps: 10,
        }),
      );
    else if (event.doodle === 'loop')
      marks.push(
        ...recipeMarks(
          loopRecipe(
            u + 8 + textWidth(event.label, size, 'print') / 2,
            (hero ? 76 : 70) - size / 2,
            textWidth(event.label, size, 'print') / 2 + 14,
            size / 2 + 12,
            seed,
          ),
          { tool: 'pencil', t0, seed: seed + 6, held: true, fps: 10 },
        ),
      );
    else {
      const figure = figureMarks({
        x: x + 12,
        y: y + 34,
        h: 46,
        t0,
        seed: seed + 6,
        tool: 'fine',
        fps: 10,
        belly: 0,
        brows: false,
        pose: () => DEFAULT_POSE,
        expression: () => DEFAULT_EXPRESSION,
      });
      marks.push(...figure.marks);
    }
    fitMarks(marks, start, t0, t0 + (event.doodle === 'figure' ? 0.55 : 0.14) * pace);
  }
  return Math.max(...marks.slice(from).map((mark) => mark.t0 + mark.dur));
}

/** The whole strip at a pace (1 = natural): marks in strip coordinates, drags, event times. */
export function planStrip(
  o: StripOptions,
  start: number,
  pace: number,
  seed: number,
  creasesOf: (u0: number, u1: number) => readonly number[],
): StripPlan {
  const sized = sizeEvents(o, seed);
  const us = placeEvents(sized, seed);
  const lastU = us.at(-1) ?? FIRST_U;
  const u1 = lastU + Math.max(280, (sized.at(-1)?.width ?? 0) + 110);
  const u0 = -760;
  const marks = construction(o, us, creasesOf(u0, u1), u1, seed);
  const pen: Pen =
    o.pen === 'bic' ? { label: 'bic', note: 'bic' } : { label: 'felt', note: 'fine' };
  const pulls: Pull[] = [];
  const events: { at: number; end: number }[] = [];
  let S = 0;
  let t = start;
  let lastEnd = start;
  sized.forEach((entry, i) => {
    const u = us[i] ?? 0;
    const visible = u - S >= 230 && u - S + entry.width <= VIEW_RIGHT;
    if (i > 0 && !visible) {
      const near = u - (us[i - 1] ?? 0) <= 360;
      const target = Math.min(near ? 560 : 330, VIEW_RIGHT - entry.width);
      const D = Math.max(60, u - S - target);
      const g0 = lastEnd + 0.32 * pace;
      const grip = (k: number): Point => [rnd(640, 770, seed, i, k), rnd(162, 170, seed, i, k + 1)];
      const add = (pull: Omit<Pull, 'u' | 'v'>, at: Point): void => {
        const before = slideAt(pulls, pull.p0);
        pulls.push({ ...pull, u: at[0] + before, v: at[1] });
      };
      if (D > 600) {
        const p0 = g0 + 0.18 * pace;
        const d1 = p0 + 0.32 * pace;
        add(
          { g0, p0, d0: p0 + 0.05 * pace, d1, D: D * 0.52, ease: (x) => ease('sine', x), ant: 3 },
          grip(1),
        );
        const q0 = d1 + 0.12 * pace;
        add(
          {
            g0: undefined,
            p0: q0,
            d0: q0 + 0.02 * pace,
            d1: q0 + 0.32 * pace,
            D: D * 0.48,
            ease: (x) => ease('out', x),
            ant: 0,
          },
          grip(3),
        );
      } else {
        const p0 = g0 + 0.18 * pace;
        add(
          {
            g0,
            p0,
            d0: p0 + 0.05 * pace,
            d1: p0 + 0.36 * pace,
            D,
            ease: (x) => ease('back', x, 1.3),
            ant: 4,
          },
          grip(5),
        );
      }
      S += D;
      // The left hand lifts off (0.22 s) before the writing hand comes in: one hand at a time.
      t = (pulls.at(-1)?.d1 ?? t) + 0.22 + 0.3 * pace;
    }
    if (entry.hero) t += 0.5 * pace;
    const end = writeEvent(marks, entry, u, t, pace, pen, seed + 811 + i * 10);
    events.push({ at: t, end });
    lastEnd = end;
    t = end + 0.16 * pace;
  });
  return { u0, u1, marks, pulls, events, end: lastEnd };
}
