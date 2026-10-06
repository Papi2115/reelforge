/**
 * A Sketchbook page as data: the stock, then layers in the order they reach the page (static
 * things first, then by the time they appear: marks by their start, slapped-on sheets by their
 * landing), then the hand. `render(canvas, t)` repaints everything for t, so the page is a pure
 * function of time; nothing is remembered between frames.
 */
import { createHandTrack, type Box, type HandTrack, type PenState } from '../draw/hand.js';
import { drawMark, type ActiveMark } from '../draw/ink.js';
import type { InkCanvas } from '../draw/canvas.js';
import type { Mark } from '../draw/marks.js';
import { stock, type StockName } from '../draw/paper.js';
import { drawPen } from '../draw/pen.js';
import type { Point, Xform } from '../draw/paths.js';
import { PAGE_WIDTH } from '../style.js';

export interface PageSettings {
  readonly width: number;
  readonly height: number;
  readonly stock: StockName;
  /** Show the writing hand. */
  readonly pen: boolean;
  /** Where the hand rests in long pauses (page px); null = it leaves the page. */
  readonly rest: Point | null;
  readonly restGap: number;
}

/** Something painted onto the page: marks, sheets, tape, stains. */
export interface Layer {
  /** Sort key: when it reaches the page (-Infinity = it was there before the shot). */
  readonly key: number;
  /** First time it is visible. */
  readonly from: number;
  draw(canvas: InkCanvas, t: number): ActiveMark | null;
}

/**
 * A stretch where the writing hand follows a script instead of the marks (it lifts a pop-up flap,
 * pulls a tab); `state` null = no writing hand then (another hand works the page).
 */
export interface HandScript {
  readonly from: number;
  readonly to: number;
  state(t: number): PenState | null;
}

interface Ordered {
  readonly layer: Layer;
  readonly order: number;
}

export class SketchPage {
  readonly settings: PageSettings;
  /** Screen px per page px. */
  readonly scale: number;
  readonly toScreen: Xform;
  private readonly layers: Ordered[] = [];
  private readonly held: Mark[] = [];
  private readonly clear: Box[] = [];
  private readonly scripts: HandScript[] = [];
  private readonly busy: (readonly [number, number])[] = [];
  private sorted: readonly Layer[] | undefined;
  private track: HandTrack | undefined;

  constructor(settings: PageSettings) {
    this.settings = settings;
    this.scale = settings.width / PAGE_WIDTH;
    const scale = this.scale;
    this.toScreen = (x, y) => [x * scale, y * scale];
  }

  /** Adds a layer; later additions with the same key draw on top. */
  addLayer(layer: Layer): void {
    this.layers.push({ layer, order: this.layers.length });
    this.sorted = undefined;
  }

  /** Adds marks drawn straight onto the page (each is its own layer, keyed by its start). */
  addMarks(marks: readonly Mark[]): void {
    for (const mark of marks) {
      if (mark.held) this.held.push(mark);
      const xf = this.toScreen;
      this.addLayer({
        key: mark.t0,
        from: mark.t0,
        draw: (canvas, t) => {
          const tip = drawMark(canvas, mark, t, xf);
          return tip && mark.held ? { mark, tip } : null;
        },
      });
    }
    this.track = undefined;
  }

  /**
   * Held marks a layer draws itself (on a moving strip): the hand writes them like page marks.
   * Their shape (or `source`) must give page px, the layer returns them as its active mark.
   */
  addHandMarks(marks: readonly Mark[]): void {
    this.held.push(...marks.filter((mark) => mark.held));
    this.track = undefined;
  }

  /** The writing hand follows `script` between its from and to (and leaves the marks for it). */
  addHandScript(script: HandScript): void {
    this.scripts.push(script);
    this.addBusy(script.from, script.to);
  }

  /** The writing hand stays off the page from `from` to `to` (another hand works it). */
  addBusy(from: number, to: number): void {
    this.busy.push([from, to]);
    this.track = undefined;
  }

  /** A page box the hand keeps off (the subject). */
  keepClear(box: Box): void {
    this.clear.push(box);
    this.track = undefined;
  }

  /** When the last held mark ends (0 without marks). */
  doneAt(): number {
    return this.held.reduce((end, mark) => Math.max(end, mark.t0 + mark.dur), 0);
  }

  private layersInOrder(): readonly Layer[] {
    if (!this.sorted) {
      this.sorted = [...this.layers]
        .sort((a, b) => a.layer.key - b.layer.key || a.order - b.order)
        .map((entry) => entry.layer);
    }
    return this.sorted;
  }

  private handTrack(): HandTrack {
    if (!this.track) {
      const s = this.scale;
      this.track = createHandTrack(
        this.held,
        {
          keepClear: this.clear.map(([x, y, w, h]) => [x * s, y * s, w * s, h * s] as const),
          rest: this.settings.rest ? this.toScreen(...this.settings.rest) : null,
          restGap: this.settings.restGap,
          scale: s,
          width: this.settings.width,
          busy: this.busy,
        },
        this.toScreen,
      );
    }
    return this.track;
  }

  render(canvas: InkCanvas, t: number): void {
    canvas.data.set(stock(this.settings.stock, canvas.width, canvas.height));
    let active: ActiveMark | null = null;
    for (const layer of this.layersInOrder()) {
      if (t < layer.from) continue;
      const drawn = layer.draw(canvas, t);
      if (drawn && (!active || drawn.mark.t0 >= active.mark.t0)) active = drawn;
    }
    if (!this.settings.pen) return;
    const script = this.scripts.find((candidate) => t >= candidate.from && t < candidate.to);
    const state = script ? script.state(t) : this.handTrack().state(t, active);
    if (state) drawPen(canvas, state, this.scale);
  }
}
