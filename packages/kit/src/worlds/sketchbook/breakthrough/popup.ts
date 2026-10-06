/**
 * `page.popup(spec)`: a pop-up card taped into the notebook (docs/worlds/sketchbook-v2 shot 5),
 * as a creative toolkit. A pencil hand lifts its kraft cover; standing pieces rise from the fold
 * with an anticipation dip, an overshoot and a settle (each on its own `at` if it has one); flat
 * mechanisms sit on the backdrop; then the red pen pulls a tab, ribbon, knob or lever, the pull's
 * progress drives the pieces the scene bound to it (`motions`, `drive`), and the pen marks what
 * moved. `intent` says what the motion shows. Builds the marks once, registers the hand's
 * scripts and adds one page layer that paints the card for any t.
 */
import { KitError } from '../../../errors.js';
import type { Resolver } from '../../../looks/blueprint/timing.js';
import { InkCanvas } from '../draw/canvas.js';
import { naturalAngle, type PenState } from '../draw/hand.js';
import { writeMarks, type Mark, type PenName } from '../draw/marks.js';
import { ease, lerp, seg } from '../draw/math.js';
import type { Point } from '../draw/paths.js';
import { INK } from '../inks.js';
import type { SketchPage } from '../page/model.js';
import { Lens } from './camera.js';
import { calloutMarks } from './popup-callout.js';
import { checkPopup } from './popup-check.js';
import { flatMarks, isFlat } from './popup-flats.js';
import { cardOf, eyeAt, foldAt, popupTimes } from './popup-geometry.js';
import {
  armSwing,
  backMarks,
  baseMarks,
  discMarks,
  frontMarks,
  smearOf,
  sunRays,
  tagArt,
} from './popup-marks.js';
import { driveProblem, pullAt, riseAt, statesAt, TAB_TRAVEL } from './popup-motion.js';
import { paintPopup, type PopupArt } from './popup-paint.js';
import type { PopupOptions } from './popup-schema.js';
import { tabGrip } from './popup-tab.js';

export interface PopupHandle {
  /** The pencil hand comes in. */
  readonly at: number;
  /** The card stands settled. */
  readonly open: number;
  /** The pull is done (the bound motions have played), or `open` without a pull. */
  readonly pulled: number;
  /** The last mark ends (the red callout after a pull, else `pulled`). */
  readonly end: number;
  /** Page px of an arm's vacated notch (callout `notch`), else null. */
  readonly notch: Point | null;
  /** What the motion shows (the spec's intent). */
  readonly intent: string;
}

export interface PopupDeps {
  readonly page: SketchPage;
  readonly resolve: Resolver;
  readonly seed: number;
  readonly call: string;
}

const rad = (deg: number): number => (deg * Math.PI) / 180;

function fail(call: string, message: string): never {
  throw new KitError('invalid-params', `${call}: ${message}`);
}

/** The piece the callout marks: the first motion's target, else the first piece drive moves. */
function calloutTarget(o: PopupOptions, t: number): number {
  const name =
    o.pull?.focus ?? o.pull?.motions[0]?.target ?? Object.keys(o.pull?.drive?.(1, t) ?? {})[0];
  return o.elements.findIndex((e) => 'id' in e && e.id !== undefined && e.id === name);
}

/** The hand's scripts: the pencil lifts the cover; the red pen takes the pull and pulls. */
function handScripts(page: SketchPage, art: PopupArt, loopStart: Point | null): void {
  const { times, card } = art;
  const scale = page.scale;
  const state = (p: Point, pen: PenName, lift: number): PenState => {
    const x = p[0] * scale;
    return {
      x,
      y: p[1] * scale,
      pen,
      color: pen === 'red' ? INK.RED : INK.GRAPHITE,
      lift,
      angle: naturalAngle(x, page.settings.width),
    };
  };
  const off = (p: Point): Point => [p[0] + 330, p[1] + 400];
  const mix = (a: Point, z: Point, k: number): Point => [lerp(a[0], z[0], k), lerp(a[1], z[1], k)];
  const edgeAt = (t: number, phi: number): Point =>
    new Lens(eyeAt(art.o, times, t)).proj(
      card.x1 - 50,
      card.yc + card.depth * Math.cos(rad(phi)),
      card.depth * Math.sin(rad(phi)),
    );
  page.addHandScript({
    from: times.open,
    to: times.letGo + 0.5,
    state: (t) => {
      const e0 = edgeAt(t, 0);
      const under: Point = [e0[0] + 6, e0[1] + 8];
      if (t < times.dip) {
        const k = ease('out', seg(t, times.open, times.dip));
        return state(mix(off(e0), under, k), 'pencil', 1 - 0.8 * k);
      }
      if (t < times.lift) {
        const k = ease('inOut', seg(t, times.dip, times.lift));
        return state(mix(under, [e0[0] + 1, e0[1] + 2], k), 'pencil', 0.2 * (1 - k));
      }
      if (t < times.letGo) return state(edgeAt(t, foldAt(times, t)), 'pencil', 0);
      const k = seg(t, times.letGo, times.letGo + 0.5);
      const r = edgeAt(t, foldAt(times, times.letGo));
      return state(mix(r, off(r), ease('in', k)), 'pencil', 0.2 + k);
    },
  });
  const pull = times.pull;
  const spec = art.o.pull;
  if (!pull || !spec) return;
  const tip = (t: number): Point => tabGrip(card, spec, art.travel(t) ?? 0);
  // Without a callout the pen lets go and leaves the page.
  const leave = loopStart === null;
  page.addHandScript({
    from: pull.enter,
    to: leave ? pull.loop + 0.4 : pull.loop,
    state: (t) => {
      const t0 = tip(pull.enter);
      if (t < pull.press) {
        const k = ease('out', seg(t, pull.enter, pull.press));
        return state(mix(off(t0), t0, k), 'red', 1 - k);
      }
      if (t < pull.done) return state(tip(t), 'red', 0);
      const done = tip(pull.done);
      if (t < pull.hover) return state(done, 'red', 0.15 * seg(t, pull.done, pull.hover));
      if (leave) {
        const away = ease('in', seg(t, pull.hover, pull.loop + 0.4));
        return state(mix(done, off(done), away), 'red', 0.15 + away);
      }
      const k = seg(t, pull.hover, pull.loop);
      return state(
        mix(done, loopStart, ease('inOut', k)),
        'red',
        0.15 + Math.sin(Math.PI * k) * 0.8,
      );
    },
  });
}

/** A counter's number as type marks (counter-local px), cached by text. */
function counterMarks(o: PopupOptions, seed: number) {
  const cache = new Map<string, Mark[]>();
  return (index: number, text: string): Mark[] => {
    const key = `${String(index)}:${text}`;
    const known = cache.get(key);
    if (known) return known;
    const e = o.elements[index];
    const marks: Mark[] = [];
    writeMarks(marks, text, {
      x: 0,
      y: 0,
      size: e?.kind === 'counter' ? e.size : 24,
      hand: 'type',
      tool: 'fine',
      boil: 0,
      width: 2,
      t0: -5,
      t1: -4.9,
      held: false,
      seed: seed + 700 + index,
    });
    cache.set(key, marks);
    return marks;
  };
}

export function addPopup(o: PopupOptions, deps: PopupDeps): PopupHandle {
  const { page, resolve, seed, call } = deps;
  checkPopup(o, call);
  const open = resolve(o.at, 0.36);
  const press = o.pull === undefined ? undefined : resolve(o.pull.at, open + 2.6);
  const times = popupTimes(open, press, o.pull?.dur);
  if (press !== undefined && press < times.land + 0.3) {
    fail(
      call,
      `pull.at (${press.toFixed(2)} s) must come after the card has settled (>= ${(times.land + 0.3).toFixed(2)} s)`,
    );
  }
  const drive = o.pull?.drive;
  const problem = drive && press !== undefined ? driveProblem(o, drive, press) : null;
  if (problem) fail(call, problem);
  const card = cardOf(o);
  const rises = o.elements.map((e, index) =>
    riseAt(e, index, 'at' in e && e.at !== undefined ? resolve(e.at, open) : undefined, seed),
  );
  const states = (t: number) => statesAt(o, seed, pullAt(o, times.pull, t), t);
  const art: PopupArt = {
    o,
    card,
    times,
    seed,
    baseMarks: baseMarks(o, card, seed),
    backMarks: backMarks(o, card, seed),
    frontMarks: frontMarks(o, seed),
    discMarks: discMarks(o, seed),
    tag: tagArt(o, card, seed),
    smear: smearOf(o, card, seed),
    rays: sunRays(o, seed),
    states,
    phiOf: (t, phi) => {
      const now = states(t);
      return (index) => {
        const f = (rises[index]?.(t) ?? 1) * (now[index]?.rise ?? 1);
        return f === 1 ? phi : Math.min(phi, 90) * f;
      };
    },
    travel: (t) => (times.pull ? pullAt(o, times.pull, t) * TAB_TRAVEL : null),
    flats: new Map(
      o.elements.flatMap((e, index) =>
        isFlat(e) ? [[index, flatMarks(e, seed + 600 + index * 13)] as const] : [],
      ),
    ),
    counter: counterMarks(o, seed),
  };
  const target = calloutTarget(o, press ?? 0);
  const targetElement = o.elements[target];
  const swing = targetElement ? armSwing(o, targetElement) : undefined;
  const red = calloutMarks(art, target, swing);
  if (red) page.addMarks(red.marks, 'exact');
  const first = red?.marks[0];
  const loopStart: Point | null =
    first?.type === 'stroke' ? [first.shape.pts[0] ?? 0, first.shape.pts[1] ?? 0] : null;
  handScripts(page, art, loopStart);
  let mask: InkCanvas | undefined;
  const toScreen = page.toScreen;
  page.addLayer({
    key: Number.NEGATIVE_INFINITY,
    from: Number.NEGATIVE_INFINITY,
    draw: (canvas, t) => {
      if (mask?.width !== canvas.width || mask.height !== canvas.height) {
        mask = new InkCanvas(canvas.width, canvas.height);
      }
      paintPopup(canvas, mask, art, t, toScreen);
      return null;
    },
  });
  const pulled = times.pull?.done ?? times.land;
  const end = red ? Math.max(...red.marks.map((mark) => mark.t0 + mark.dur)) : pulled;
  return { at: open, open: times.land, pulled, end, notch: red?.notch ?? null, intent: o.intent };
}
