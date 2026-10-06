/**
 * `page.popup(spec)`: a pop-up card taped into the notebook (docs/worlds/sketchbook-v2 shot 5).
 * A pencil hand lifts its kraft cover; blocks, cut-outs and hinged arms rise from the fold with an
 * anticipation dip, an overshoot past upright and a settle; optionally the red pen pulls a tab, one
 * arm swings off its pencilled notch, and the red loop + arrow mark the gap. Builds the marks once
 * (pencil construction, printed fronts, the tag, the felt drawings), registers the hand's scripts
 * and adds one page layer that paints the card for any t.
 */
import { KitError } from '../../../errors.js';
import type { Resolver } from '../../../looks/blueprint/timing.js';
import { InkCanvas } from '../draw/canvas.js';
import { arrowRecipe, loopRecipe } from '../draw/doodles.js';
import { naturalAngle, type PenState } from '../draw/hand.js';
import type { Mark, PenName } from '../draw/marks.js';
import { ease, lerp, rnd, seg } from '../draw/math.js';
import type { Point, Pts } from '../draw/paths.js';
import { INK } from '../inks.js';
import type { SketchPage } from '../page/model.js';
import { Lens } from './camera.js';
import {
  cardGeo,
  cardOf,
  eyeAt,
  foldAt,
  popupTimes,
  TAB_OUT,
  TAB_TRAVEL,
  tabAt,
  tabY,
  type PopupTimes,
} from './popup-geometry.js';
import {
  backMarks,
  baseMarks,
  discMarks,
  frontMarks,
  smearOf,
  sunRays,
  tagArt,
} from './popup-marks.js';
import { paintPopup, type PopupArt } from './popup-paint.js';
import { checkPopup, type PopupOptions } from './popup-schema.js';
import { recipeMarks } from './shapes.js';

export interface PopupHandle {
  /** The pencil hand comes in. */
  readonly at: number;
  /** The card stands settled. */
  readonly open: number;
  /** The last mark ends (the red arrow after a pull, else `open`). */
  readonly end: number;
  /** Page px of the pulled arm's empty notch (null without a pull). */
  readonly notch: Point | null;
}

export interface PopupDeps {
  readonly page: SketchPage;
  readonly resolve: Resolver;
  readonly seed: number;
  readonly call: string;
}

const rad = (deg: number): number => (deg * Math.PI) / 180;

function angleFn(o: PopupOptions, times: PopupTimes, pulled: number): (t: number) => number[] {
  const arms = o.elements.flatMap((element, index) =>
    element.kind === 'arm' ? [{ element, index }] : [],
  );
  return (t) =>
    arms.map(({ element, index }) => {
      if (index !== pulled || element.swing === undefined) return element.angle;
      return element.angle - ((element.angle - element.swing) * tabAt(times, t)) / TAB_TRAVEL;
    });
}

/** The red loop round the empty notch and the arrow along the drift, on the settled card. */
function redMarks(art: PopupArt, pulled: number): { marks: Mark[]; notch: Point } | null {
  const pull = art.times.pull;
  const element = art.o.elements[pulled];
  if (!pull || element?.kind !== 'arm' || element.swing === undefined) return null;
  const lens = new Lens(eyeAt(art.o, art.times, art.times.land + 1));
  const g = cardGeo(lens, art.card, art.o.elements, 90, art.angles(art.times.land));
  const arm = g.arms.find((candidate) => candidate.index === pulled);
  if (!arm) return null;
  const k = arm.radius / 24;
  const notch = g.back.xf(arm.centre[0], arm.centre[1]);
  const seed = art.seed + 551;
  const loop = recipeMarks(loopRecipe(notch[0] + 1, notch[1], 38 * k, 35 * k, seed, 1.12, -0.9), {
    tool: 'red',
    width: 3,
    t0: pull.loop,
    dur: 0.28,
    seed,
    held: true,
    fps: 10,
  });
  const [a0, a1] = [element.angle, element.swing];
  const sign = Math.sign(a0 - a1) || 1;
  const from = a0 - sign * 14;
  const to = a1 + sign * 15;
  const drift: Pts = [];
  const radius = element.length + 4;
  for (let i = 0; i <= 8; i += 1) {
    const a = rad(from + (i / 8) * (to - from));
    drift.push(
      ...g.back.xf(
        arm.pivot[0] + radius * Math.sin(a),
        arm.pivot[1] + radius * Math.cos(a) + rnd(-0.8, 0.8, seed, i),
      ),
    );
  }
  const arrow = recipeMarks(arrowRecipe(drift, 13, 0.5, 0.06, 'out'), {
    tool: 'red',
    width: 3,
    t0: pull.arrow,
    dur: 0.2,
    seed: seed + 1,
    held: true,
    fps: 10,
  });
  return { marks: [...loop, ...arrow], notch };
}

/** The hand's scripts: the pencil lifts the cover; the red pen presses and pulls the tab. */
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
  if (!pull || !loopStart) return;
  const tip = (t: number): Point => [card.x0 - TAB_OUT - tabAt(times, t) + 4, tabY(card)];
  page.addHandScript({
    from: pull.enter,
    to: pull.loop,
    state: (t) => {
      const t0 = tip(pull.enter);
      if (t < pull.press) {
        const k = ease('out', seg(t, pull.enter, pull.press));
        return state(mix(off(t0), t0, k), 'red', 1 - k);
      }
      if (t < pull.done) return state(tip(t), 'red', 0);
      const done = tip(pull.done);
      if (t < pull.hover) return state(done, 'red', 0.15 * seg(t, pull.done, pull.hover));
      const k = seg(t, pull.hover, pull.loop);
      return state(
        mix(done, loopStart, ease('inOut', k)),
        'red',
        0.15 + Math.sin(Math.PI * k) * 0.8,
      );
    },
  });
}

export function addPopup(o: PopupOptions, deps: PopupDeps): PopupHandle {
  const { page, resolve, seed, call } = deps;
  const pulled = checkPopup(o, call);
  const open = resolve(o.at, 0.36);
  const press = o.pull === undefined ? undefined : resolve(o.pull.at, open + 2.6);
  const times = popupTimes(open, press);
  if (press !== undefined && press < times.land + 0.3) {
    throw new KitError(
      'invalid-params',
      `${call}: pull.at (${press.toFixed(2)} s) must come after the card has settled (>= ${(times.land + 0.3).toFixed(2)} s)`,
    );
  }
  const card = cardOf(o);
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
    angles: angleFn(o, times, pulled),
    tabEnd: (t) => (times.pull ? card.x0 - TAB_OUT - tabAt(times, t) : null),
  };
  const red = redMarks(art, pulled);
  if (red) page.addMarks(red.marks);
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
  const end = red ? Math.max(...red.marks.map((mark) => mark.t0 + mark.dur)) : times.land;
  return { at: open, open: times.land, end, notch: red?.notch ?? null };
}
