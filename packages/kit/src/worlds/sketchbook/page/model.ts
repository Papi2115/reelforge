/**
 * A Sketchbook page as data: the stock, then layers in the order they reach the page (static
 * things first, then by the time they appear: marks by their start, slapped-on sheets by their
 * landing), then the hand. `render(canvas, t)` repaints everything for t, so the page is a pure
 * function of time; nothing is remembered between frames. The page has one writing hand: marks
 * reach it as tasks through the hand queue (hand-queue.ts).
 */
import {
  createHandTrack,
  retreat,
  FINAL,
  type Box,
  type HandRules,
  type HandTrack,
  type PenState,
} from '../draw/hand.js';
import { drawMark, markTip, type ActiveMark } from '../draw/ink.js';
import type { InkCanvas } from '../draw/canvas.js';
import type { Mark } from '../draw/marks.js';
import { stock, type StockName } from '../draw/paper.js';
import { drawPen } from '../draw/pen.js';
import type { Point, Xform } from '../draw/paths.js';
import { PAGE_WIDTH } from '../style.js';
import { handDrawn, HandQueue } from './hand-queue.js';

export interface PageSettings {
  readonly width: number;
  readonly height: number;
  readonly stock: StockName;
  /** Show the writing hand. */
  readonly pen: boolean;
  /** Where the hand rests in long pauses (page px); null = it leaves the page. */
  readonly rest: Point | null;
  readonly restGap: number;
  /** Shot length in page time (s): the hand clears the subject for its last FINAL s. */
  readonly duration?: number | undefined;
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

interface Hand {
  readonly rules: HandRules;
  readonly track: HandTrack;
  /** The held marks the hand draws (the others appear without it). */
  readonly drawn: ReadonlySet<Mark>;
}

export class SketchPage {
  readonly settings: PageSettings;
  /** Screen px per page px. */
  readonly scale: number;
  readonly toScreen: Xform;
  private readonly layers: Ordered[] = [];
  private readonly held: Mark[] = [];
  /** The held marks of each hand task (one page call), in call order. */
  private readonly tasks: (readonly Mark[])[] = [];
  private readonly queue = new HandQueue();
  private readonly clear: Box[] = [];
  private readonly scripts: HandScript[] = [];
  private readonly busy: (readonly [number, number])[] = [];
  private sorted: readonly Layer[] | undefined;
  private hand: Hand | undefined;

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

  /**
   * Adds the marks of one hand task, drawn straight onto the page (each is its own layer, keyed
   * by its start). With the hand shown they queue for it and come back as placed (maybe later,
   * see HandQueue.place); `parallel` = never wait for the hand, `exact` = the hand must draw them
   * exactly then (a breakthrough's choreography): others wait for them instead.
   */
  addMarks(
    marks: readonly Mark[],
    timing: 'queue' | 'parallel' | 'exact' = 'queue',
  ): readonly Mark[] {
    let placed: readonly Mark[] = marks;
    if (this.settings.pen && timing === 'exact') this.queue.pinMarks(marks);
    else if (this.settings.pen) placed = this.queue.place(marks, timing === 'parallel');
    this.addTask(placed);
    const xf = this.toScreen;
    for (const mark of placed) {
      this.addLayer({
        key: mark.t0,
        from: mark.t0,
        draw: (canvas, t) => {
          const tip = drawMark(canvas, mark, t, xf);
          return tip && mark.held ? { mark, tip } : null;
        },
      });
    }
    return placed;
  }

  /**
   * Held marks a layer draws itself (on a moving strip): the hand writes them like page marks,
   * exactly when they are. Their shape (or `source`) must give page px, the layer returns them
   * as its active mark.
   */
  addHandMarks(marks: readonly Mark[]): void {
    this.queue.pinMarks(marks);
    this.addTask(marks);
  }

  /** The writing hand follows `script` between its from and to (and leaves the marks for it). */
  addHandScript(script: HandScript): void {
    this.scripts.push(script);
    this.addBusy(script.from, script.to);
  }

  /** The writing hand stays off the page from `from` to `to` (another hand works it). */
  addBusy(from: number, to: number): void {
    this.busy.push([from, to]);
    this.queue.pin(from, to);
    this.hand = undefined;
  }

  /** A page box the hand keeps off (the subject). */
  keepClear(box: Box): void {
    this.clear.push(box);
    this.hand = undefined;
  }

  /** When the last held mark ends (0 without marks). */
  doneAt(): number {
    return this.held.reduce((end, mark) => Math.max(end, mark.t0 + mark.dur), 0);
  }

  private addTask(marks: readonly Mark[]): void {
    const held = marks.filter((mark) => mark.held);
    this.held.push(...held);
    if (held.length > 0) this.tasks.push(held);
    this.hand = undefined;
  }

  private layersInOrder(): readonly Layer[] {
    if (!this.sorted) {
      this.sorted = [...this.layers]
        .sort((a, b) => a.layer.key - b.layer.key || a.order - b.order)
        .map((entry) => entry.layer);
    }
    return this.sorted;
  }

  private handOf(): Hand {
    if (!this.hand) {
      const s = this.scale;
      const rules: HandRules = {
        keepClear: this.clear.map(([x, y, w, h]) => [x * s, y * s, w * s, h * s] as const),
        rest: this.settings.rest ? this.toScreen(...this.settings.rest) : null,
        restGap: this.settings.restGap,
        scale: s,
        width: this.settings.width,
        busy: this.busy,
        queued: this.queue.queued,
      };
      const drawn = handDrawn(this.tasks, this.toScreen, s);
      const track = createHandTrack(
        this.held.filter((mark) => drawn.has(mark)),
        rules,
        this.toScreen,
      );
      this.hand = { rules, track, drawn };
    }
    return this.hand;
  }

  /** The newest mark the hand is drawing at t (what render finds in the layers). */
  private activeAt(t: number, hand: Hand): ActiveMark | null {
    let active: ActiveMark | null = null;
    for (const mark of this.held) {
      if (!hand.drawn.has(mark) || (active && mark.t0 < active.mark.t0)) continue;
      const tip = markTip(mark, t, this.toScreen);
      if (tip) active = { mark, tip };
    }
    return active;
  }

  private stateAt(t: number, active: ActiveMark | null, hand: Hand): PenState | null {
    const script = this.scripts.find((candidate) => t >= candidate.from && t < candidate.to);
    return script ? script.state(t) : hand.track.state(t, active);
  }

  /** The hand at t; in the shot's last FINAL s it leaves for a clear rest spot or the page. */
  private handState(t: number, active: ActiveMark | null, hand: Hand): PenState | null {
    const end = this.settings.duration;
    if (end === undefined || t < end - FINAL) return this.stateAt(t, active, hand);
    const from = end - FINAL;
    const state = this.stateAt(from, this.activeAt(from, hand), hand);
    return state && retreat(state, t - from, hand.rules, this.settings.height);
  }

  render(canvas: InkCanvas, t: number): void {
    canvas.data.set(stock(this.settings.stock, canvas.width, canvas.height));
    const hand = this.settings.pen ? this.handOf() : undefined;
    let active: ActiveMark | null = null;
    for (const layer of this.layersInOrder()) {
      if (t < layer.from) continue;
      const drawn = layer.draw(canvas, t);
      if (drawn && hand?.drawn.has(drawn.mark) && (!active || drawn.mark.t0 >= active.mark.t0)) {
        active = drawn;
      }
    }
    if (!hand) return;
    const state = this.handState(t, active, hand);
    if (state) drawPen(canvas, state, this.scale);
  }
}
