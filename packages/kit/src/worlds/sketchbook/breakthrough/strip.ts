/**
 * `page.strip(spec)`: an accordion timeline (docs/worlds/sketchbook-v2 shot 8). A taped paper strip
 * lies across the page under a fixed view; the left hand drags it right to left whenever the next
 * event is out of view while the writing hand writes the events in order; the panels already read
 * fold into a zigzag pleat stack at the left (older pleats tighter, cast shadow); a paper clip
 * marks the strip's end. The marks live in strip coordinates and are drawn with their panel, so a
 * folded face hides what is behind it; the writing hand follows them through hand proxies.
 */
import { KitError } from '../../../errors.js';
import type { Resolver } from '../../../looks/blueprint/timing.js';
import type { ActiveMark } from '../draw/ink.js';
import { drawMarks, markShape } from '../draw/ink.js';
import type { Mark } from '../draw/marks.js';
import { rnd } from '../draw/math.js';
import { xformPts, type Point, type Xform } from '../draw/paths.js';
import type { SketchPage } from '../page/model.js';
import { paintClip } from '../traces.js';
import { stripShape, type StripShape } from './strip-geometry.js';
import { dragHandAt, paintDragHand, paintThumbprint } from './strip-hands.js';
import { planStrip, slideAt, type StripPlan } from './strip-plan.js';
import { checkStrip, type StripOptions } from './strip-schema.js';

export interface StripHandle {
  /** The first label starts. */
  readonly at: number;
  /** The last mark ends. */
  readonly end: number;
  /** When each event's label starts and its last mark ends. */
  readonly events: readonly { readonly at: number; readonly end: number }[];
}

export interface StripDeps {
  readonly page: SketchPage;
  readonly resolve: Resolver;
  readonly seed: number;
  readonly call: string;
}

const PACE_RANGE = [0.7, 1.8] as const;

function plan(o: StripOptions, deps: StripDeps): StripPlan {
  const start = deps.resolve(o.at, 0.18);
  const creases = (u0: number, u1: number): readonly number[] =>
    stripShape(u0, u1, o.y, deps.seed).creases;
  const natural = planStrip(o, start, 1, deps.seed, creases);
  if (o.until === undefined) return natural;
  const until = deps.resolve(o.until, natural.end);
  const pace = (until - start) / (natural.end - start);
  if (pace < PACE_RANGE[0] || pace > PACE_RANGE[1]) {
    const [lo, hi] = PACE_RANGE.map((k) => (start + (natural.end - start) * k).toFixed(1));
    throw new KitError(
      'invalid-params',
      `${deps.call}: ${String(o.events.length)} events take ~${(natural.end - start).toFixed(1)} s from ${start.toFixed(1)} s; until must be ${lo ?? ''}-${hi ?? ''} s (got ${until.toFixed(1)}), or use fewer events`,
    );
  }
  return planStrip(o, start, pace, deps.seed, creases);
}

/** Tapes over the strip (u, v, w, h, deg, seed): a pair on the first join, then every other one. */
function tapesOf(shape: StripShape, p: StripPlan, seed: number): number[][] {
  const joins = shape.creases.filter((u) => u > 300 && u < p.u1 - 60);
  const out: number[][] = [];
  joins.forEach((u, i) => {
    if (out.length >= 4 || (i > 0 && i % 2 === 1)) return;
    const deg = rnd(6, 11, seed, i, 1) * (i % 4 === 0 ? 1 : -1);
    const top = i % 4 === 2;
    out.push([u, top ? 16 : 169, rnd(50, 60, seed, i, 2), 18, deg, seed + 61 + i]);
    if (i === 0) out.push([u, 16, rnd(50, 58, seed, i, 3), 18, -deg * 0.8, seed + 60]);
  });
  return out;
}

export function addStrip(o: StripOptions, deps: StripDeps): StripHandle {
  const { page, seed } = deps;
  checkStrip(o, deps.call);
  const p = plan(o, deps);
  const shape = stripShape(p.u0, p.u1, o.y, seed);
  const slide = (t: number): number => slideAt(p.pulls, t);
  const mapAt = (t: number): Xform => shape.mapper(shape.layout(slide(t)));
  // Marks grouped by the panel they sit on (painted with it).
  const byPanel: Mark[][] = Array.from({ length: shape.n }, () => []);
  for (const mark of p.marks) {
    const pts = mark.type === 'stroke' ? markShape(mark, mark.t0).pts : mark.poly;
    let [a, z] = [Infinity, -Infinity];
    for (let i = 0; i < pts.length; i += 2) {
      a = Math.min(a, pts[i] ?? a);
      z = Math.max(z, pts[i] ?? z);
    }
    byPanel[shape.panelOf((a + z) / 2)]?.push(mark);
  }
  // The writing hand follows proxies: the same marks in page px where the strip is at t.
  const proxies = new Map<Mark, Mark>();
  for (const mark of p.marks) {
    if (!mark.held || mark.type !== 'stroke') continue;
    proxies.set(mark, {
      ...mark,
      source: (t) => {
        const own = mark.source ? mark.source(t) : mark.shape;
        return { pts: xformPts(own.pts, mapAt(t)), corners: own.corners };
      },
    });
  }
  page.addHandMarks([...proxies.values()]);
  p.pulls.forEach((pull, i) => {
    if (pull.g0 === undefined) return;
    let last = pull;
    for (let k = i + 1; p.pulls[k]?.g0 === undefined && p.pulls[k]; k += 1)
      last = p.pulls[k] ?? last;
    page.addBusy(pull.g0, last.d1 + 0.22);
  });
  const tapes = tapesOf(shape, p, seed);
  const grip = (pull: { u: number; v: number }, t: number): Point => mapAt(t)(pull.u, pull.v);
  const press = p.pulls.at(-1);
  page.addLayer({
    key: Number.NEGATIVE_INFINITY,
    from: Number.NEGATIVE_INFINITY,
    draw: (canvas, t) => {
      const s = canvas.width / 960;
      const layout = shape.layout(slide(t));
      const xf = shape.mapper(layout);
      const toCanvas: Xform = (u, v) => {
        const [x, y] = xf(u, v);
        return [x * s, y * s];
      };
      const newest: { active: ActiveMark | null } = { active: null };
      shape.draw(canvas, layout, (k) => {
        const drawn = drawMarks(canvas, byPanel[k] ?? [], t, toCanvas);
        const { active } = newest;
        if (drawn && (!active || drawn.mark.t0 >= active.mark.t0)) newest.active = drawn;
      });
      if (press && t >= press.d1 + 0.05)
        paintThumbprint(canvas, xf, press.u + 3, press.v - 6, 24, seed + 66);
      for (const tape of tapes)
        if ((tape[0] ?? 0) - layout.S > 120) shape.tape(canvas, layout, tape);
      const [cx, cy] = xf(p.u1 - 34, -16);
      paintClip(canvas, page.toScreen, cx, cy, 5, 1.15);
      const hand = dragHandAt(p.pulls, t, grip);
      if (hand) paintDragHand(canvas, hand);
      const current = newest.active;
      if (!current) return null;
      const proxy = proxies.get(current.mark);
      return proxy ? { mark: proxy, tip: current.tip } : null;
    },
  });
  return { at: p.events[0]?.at ?? 0, end: p.end, events: p.events };
}
