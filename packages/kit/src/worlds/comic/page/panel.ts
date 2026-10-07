/**
 * One panel of the Comic page: a quad (fixed, morphing or a function of t), its entrance (cut,
 * slam, slide, pop; a pencil rough before it), its exit, its own clock (time offset, rate, hold)
 * and camera (pan/zoom of its content inside the mask: "camera = panel moves"), and the painters
 * of its content. Everything is a pure function of page time.
 */
import { lerp, rndInt, seg, track, type EaseName } from '../draw/math.js';
import type { Screen } from '../draw/paint.js';
import { Place } from '../draw/place.js';
import { PAGE_HEIGHT, PAGE_WIDTH } from '../style.js';
import type { ComicPen } from './pen.js';
import type { Quad } from './layouts.js';

export type Painter = (g: ComicPen, t: number) => void;

export type EnterKind = 'cut' | 'slam' | 'slide' | 'pop';
export type Side = 'left' | 'right' | 'top' | 'bottom';

export interface Enter {
  readonly at: number;
  readonly kind: EnterKind;
  readonly from: Side;
  readonly dur: number;
  /** Pencil layout of the panel before `at`. */
  readonly rough: boolean;
}

export interface Morph {
  readonly to: Quad;
  readonly at: number;
  readonly dur: number;
  readonly ease: EaseName;
}

export interface CameraKey {
  readonly at: number;
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
  readonly ease: EaseName;
}

export interface Clock {
  readonly offset: number;
  readonly rate: number;
  /** Page time from which the content holds still. */
  readonly hold: number;
}

export interface PanelStyle {
  readonly key: string;
  /** Border width in px (0 = borderless). */
  readonly border: number;
  /** Border boil amplitude. */
  readonly boil: number;
  /** Blue-line pencils overshooting the corners. */
  readonly pencils: boolean;
  /** Colour plate offset [dx, dy] (never zero). */
  readonly mis: readonly [number, number];
  /** Print screen of this panel's halftones (a flashback beat); default the page's. */
  readonly screen?: Readonly<Screen> | undefined;
}

/** Where the panel frame is at t: offset and scale about its centre (no camera). */
export interface Frame {
  readonly dx: number;
  readonly dy: number;
  readonly k: number;
  readonly cx: number;
  readonly cy: number;
}

/** Colour-plate offset of a panel: 1-2 px, never zero, seeded. */
export function misFor(key: string): [number, number] {
  let dx = rndInt(key, 11, -2, 2);
  const dy = rndInt(key, 12, -1, 2);
  if (dx === 0 && dy === 0) dx = 1;
  return [dx, dy];
}

function centroid(quad: readonly number[]): [number, number] {
  let x = 0;
  let y = 0;
  for (let i = 0; i < quad.length; i += 2) {
    x += quad[i] ?? 0;
    y += quad[i + 1] ?? 0;
  }
  const n = quad.length / 2 || 1;
  return [x / n, y / n];
}

export class PanelModel {
  readonly painters: Painter[] = [];
  readonly roughs: Painter[] = [];
  readonly morphs: Morph[] = [];
  cameraKeys: CameraKey[] = [];
  clock: Clock = { offset: 0, rate: 1, hold: Number.POSITIVE_INFINITY };
  enter: Enter | undefined;
  until = Number.POSITIVE_INFINITY;
  readonly order: number;

  constructor(
    private readonly shape: Quad | ((t: number) => Quad),
    readonly style: PanelStyle,
    order: number,
  ) {
    this.order = order;
  }

  /** First page time the panel is inked (its pencil rough may show before). */
  get from(): number {
    return this.enter?.at ?? Number.NEGATIVE_INFINITY;
  }

  visible(t: number): boolean {
    return t >= this.from && t < this.until;
  }

  roughVisible(t: number): boolean {
    return this.enter?.rough === true && t < this.from && t < this.until;
  }

  /** The quad at rest (morphs applied, no entrance motion), page coordinates. */
  restQuad(t: number): number[] {
    let quad: number[] = typeof this.shape === 'function' ? [...this.shape(t)] : [...this.shape];
    for (const morph of this.morphs) {
      const p = seg(t, morph.at, morph.at + morph.dur, morph.ease);
      if (p <= 0) continue;
      quad = quad.map((value, i) => lerp(value, morph.to[i] ?? value, p));
    }
    return quad;
  }

  frame(t: number): Frame {
    const [cx, cy] = centroid(this.restQuad(t));
    const enter = this.enter;
    if (enter === undefined || t < enter.at) return { dx: 0, dy: 0, k: 1, cx, cy };
    const { at, dur } = enter;
    if (enter.kind === 'slam') {
      const k = track(
        [
          [at, 1.14],
          [at + dur, 1, 'outBack'],
        ],
        t,
      );
      return { dx: 0, dy: 0, k, cx, cy };
    }
    if (enter.kind === 'pop') {
      const k = track(
        [
          [at, 1.25],
          [at + dur * 0.5, 0.97, 'outQuad'],
          [at + dur, 1, 'inOutSine'],
        ],
        t,
      );
      return { dx: 0, dy: 0, k, cx, cy };
    }
    if (enter.kind === 'slide') {
      // Starts just off the page on its side, shoves in with an overshoot.
      const rest = 1 - seg(t, at, at + dur, 'outBack');
      const quad = this.restQuad(t);
      const xs = quad.filter((_, i) => i % 2 === 0);
      const ys = quad.filter((_, i) => i % 2 === 1);
      const distance = {
        left: -(Math.max(...xs) + 4),
        right: PAGE_WIDTH - Math.min(...xs) + 4,
        top: -(Math.max(...ys) + 4),
        bottom: PAGE_HEIGHT - Math.min(...ys) + 4,
      }[enter.from];
      const horizontal = enter.from === 'left' || enter.from === 'right';
      const d = distance * rest;
      return { dx: horizontal ? d : 0, dy: horizontal ? 0 : d, k: 1, cx, cy };
    }
    return { dx: 0, dy: 0, k: 1, cx, cy };
  }

  /** The panel quad at t in page coordinates (entrance motion applied). */
  quad(t: number): number[] {
    const frame = this.frame(t);
    return this.restQuad(t).map((value, i) =>
      i % 2 === 0
        ? frame.cx + (value - frame.cx) * frame.k + frame.dx
        : frame.cy + (value - frame.cy) * frame.k + frame.dy,
    );
  }

  /** Page coordinates of a page point carried by the panel frame (slam/slide), not its camera. */
  carry(x: number, y: number, t: number): [number, number] {
    const f = this.frame(t);
    return [f.cx + (x - f.cx) * f.k + f.dx, f.cy + (y - f.cy) * f.k + f.dy];
  }

  /** Content time of the panel at page time t. */
  localTime(t: number): number {
    return (Math.min(t, this.clock.hold) - this.clock.offset) * this.clock.rate;
  }

  /** Content placement relative to the page placement: frame motion, then the panel camera. */
  contentPlace(page: Place, t: number): Place {
    const f = this.frame(t);
    let place = new Place(
      page.s * f.k,
      page.x(f.cx * (1 - f.k) + f.dx),
      page.y(f.cy * (1 - f.k) + f.dy),
    );
    if (this.cameraKeys.length > 0) {
      const tc = Math.min(t, this.clock.hold);
      const keys = this.cameraKeys;
      const x = track(
        keys.map((key) => [key.at, key.x, key.ease] as const),
        tc,
      );
      const y = track(
        keys.map((key) => [key.at, key.y, key.ease] as const),
        tc,
      );
      const zoom = track(
        keys.map((key) => [key.at, key.zoom, key.ease] as const),
        tc,
      );
      place = place.at(f.cx - x * zoom, f.cy - y * zoom, zoom);
    }
    return place;
  }

  /** Content point (x, y) of the panel -> page coordinates at t (aim a balloon tail at it). */
  toPage(x: number, y: number, t: number): [number, number] {
    const place = this.contentPlace(new Place(1, 0, 0), t);
    return [place.x(x), place.y(y)];
  }
}
