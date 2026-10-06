/**
 * A Sketchbook page as data: the stock, then layers in the order they reach the page (static
 * things first, then by the time they appear: marks by their start, slapped-on sheets by their
 * landing), then the hand. `render(canvas, t)` repaints everything for t, so the page is a pure
 * function of time; nothing is remembered between frames. The page has one writing hand: marks
 * reach it as tasks through the hand queue (hand-queue.ts) and the hand plan (hand-plan.ts); a
 * task that starts before the shot is already on the page (done by t = 0, no hand).
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
import { appearMarks } from '../draw/appear.js';
import { fitMarks, type AppearKind, type Mark } from '../draw/marks.js';
import { stock, type StockName } from '../draw/paper.js';
import { drawPen } from '../draw/pen.js';
import type { Point, Xform } from '../draw/paths.js';
import { PAGE_WIDTH } from '../style.js';
import { HandQueue } from './hand-queue.js';
import { planHand, type HandPlan, type HandTask, type TaskTiming } from './hand-plan.js';

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
  readonly plan: HandPlan;
}

/** What a task is besides its marks (page call options). */
export interface TaskMeta {
  /** The scene's hero mark: it keeps its time, others wait for it. */
  readonly hero?: boolean | undefined;
  /** Cap height of a write (the default hero is the largest text). */
  readonly text?: number | undefined;
  /** How a `parallel` task appears without the hand (default bloom). */
  readonly appear?: AppearKind | undefined;
}

/** A held mark being drawn at t: its tip (screen px), and whether it goes without the hand. */
export interface InkProbe {
  readonly mark: Mark;
  readonly tip: Point;
  readonly parallel: boolean;
}

/** Where the hand and the ink are at t (tests: the one-hand invariants). */
export interface HandProbe {
  /** The writing hand (screen px), null = not on the page. */
  readonly pen: PenState | null;
  /** The mark the writing hand is drawing (null = gliding, resting or away). */
  readonly active: Mark | null;
  /** Other hands on the page (a strip's left hand). */
  readonly others: number;
  readonly drawing: readonly InkProbe[];
}

/** The in-shot marks of a task that go without the hand, appearing by themselves. */
function appearing(
  marks: readonly Mark[],
  timing: TaskTiming,
  kind: AppearKind = 'bloom',
): readonly Mark[] {
  const free = marks.filter((mark) => mark.t0 >= 0 && (timing === 'parallel' || !mark.held));
  if (free.length === 0) return marks;
  const start = free.reduce((first, mark) => Math.min(first, mark.t0), Infinity);
  const shown = appearMarks(free, kind, start);
  const of = new Map(free.map((mark, index) => [mark, shown[index] ?? mark]));
  return marks.map((mark) => of.get(mark) ?? mark);
}

/** A task that starts before the shot is on the page already: done by t = 0, without the hand. */
function beforeShot(marks: readonly Mark[]): readonly Mark[] {
  const start = marks.reduce((first, mark) => Math.min(first, mark.t0), Infinity);
  if (!(start < 0)) return marks;
  const list = [...marks];
  const end = list.reduce((last, mark) => Math.max(last, mark.t0 + mark.dur), -Infinity);
  if (end > 0) fitMarks(list, 0, start, start < -0.04 ? -0.02 : start / 2);
  return list.map((mark) => (mark.held ? { ...mark, held: false } : mark));
}

export class SketchPage {
  readonly settings: PageSettings;
  /** Screen px per page px. */
  readonly scale: number;
  readonly toScreen: Xform;
  private readonly layers: Ordered[] = [];
  private readonly held: Mark[] = [];
  /** The held marks of each hand task (one page call), in call order. */
  private readonly tasks: HandTask[] = [];
  private readonly parallel = new Set<Mark>();
  private readonly others: ((t: number) => boolean)[] = [];
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
   * see HandQueue.place; the hand plan may still move them later, for the hero); `parallel` =
   * never take the hand: the marks appear by themselves (`meta.appear`, an ink bloom by
   * default), never stroke by stroke; `exact` = the hand must draw them exactly then (a
   * breakthrough's choreography): others wait for them instead. On a page with the hand, a mark
   * the hand does not hold appears too: no ink writes itself.
   */
  addMarks(
    marks: readonly Mark[],
    timing: TaskTiming = 'queue',
    meta: TaskMeta = {},
  ): readonly Mark[] {
    let placed = timing === 'exact' ? marks : beforeShot(marks);
    if (this.settings.pen && timing !== 'exact') placed = appearing(placed, timing, meta.appear);
    if (this.settings.pen && timing === 'exact') this.queue.pinMarks(placed);
    else if (this.settings.pen) placed = this.queue.place(placed, timing === 'parallel');
    this.addTask(placed, timing, meta);
    const xf = this.toScreen;
    for (const mark of placed) {
      this.addLayer({
        key: mark.t0,
        from: mark.t0,
        draw: (canvas, t) => {
          const final = this.finalOf(mark);
          const tip = drawMark(canvas, final, t, xf);
          return tip && final.held ? { mark: final, tip } : null;
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
    this.addTask(marks, 'exact', {});
  }

  /** Another hand works the page while `visible(t)`: the writing hand is never there then. */
  addOtherHand(visible: (t: number) => boolean): void {
    this.others.push(visible);
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

  private addTask(marks: readonly Mark[], timing: TaskTiming, meta: TaskMeta): void {
    const held = marks.filter((mark) => mark.held);
    this.held.push(...held);
    if (timing === 'parallel') for (const mark of held) this.parallel.add(mark);
    else if (held.length > 0) {
      this.tasks.push({ marks: held, timing, hero: meta.hero ?? false, text: meta.text ?? 0 });
    }
    this.hand = undefined;
  }

  /** A mark as the hand plan timed it. */
  private finalOf(mark: Mark): Mark {
    if (!this.settings.pen) return mark;
    return this.handOf().plan.moved.get(mark) ?? mark;
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
      const end = this.settings.duration;
      const plan = planHand(this.tasks, this.busy, end === undefined ? Infinity : end - FINAL);
      const queued = new Set(plan.queued);
      for (const mark of this.queue.queued) queued.add(plan.moved.get(mark) ?? mark);
      const rules: HandRules = {
        keepClear: this.clear.map(([x, y, w, h]) => [x * s, y * s, w * s, h * s] as const),
        rest: this.settings.rest ? this.toScreen(...this.settings.rest) : null,
        restGap: this.settings.restGap,
        scale: s,
        width: this.settings.width,
        busy: this.busy,
        queued,
      };
      const track = createHandTrack([...plan.drawn], rules, this.toScreen);
      this.hand = { rules, track, plan };
    }
    return this.hand;
  }

  /** The newest mark the hand is drawing at t (what render finds in the layers). */
  private activeAt(t: number, hand: Hand): ActiveMark | null {
    let active: ActiveMark | null = null;
    for (const mark of hand.plan.drawn) {
      if (active && mark.t0 < active.mark.t0) continue;
      const tip = markTip(mark, t, this.toScreen);
      if (tip) active = { mark, tip };
    }
    return active;
  }

  private stateAt(t: number, active: ActiveMark | null, hand: Hand): PenState | null {
    const script = this.scripts.find((candidate) => t >= candidate.from && t < candidate.to);
    return script ? script.state(t) : hand.track.state(t, active);
  }

  /**
   * The hand at t; in the shot's last FINAL s it leaves for a clear rest spot or the page (once
   * it has finished a mark it is drawing then: ink never writes itself). Never while another
   * hand works the page (one hand at a time).
   */
  private handState(t: number, active: ActiveMark | null, hand: Hand): PenState | null {
    if (this.others.some((visible) => visible(t))) return null;
    const end = this.settings.duration;
    if (end === undefined) return this.stateAt(t, active, hand);
    let from = end - FINAL;
    for (const mark of hand.plan.drawn) {
      if (mark.t0 < end) from = Math.max(from, mark.t0 + mark.dur);
    }
    if (t < from) return this.stateAt(t, active, hand);
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
      if (
        drawn &&
        hand?.plan.drawn.has(drawn.mark) &&
        (!active || drawn.mark.t0 >= active.mark.t0)
      ) {
        active = drawn;
      }
    }
    if (!hand) return;
    const state = this.handState(t, active, hand);
    if (state) drawPen(canvas, state, this.scale);
  }

  /** The hand and the ink at t, without painting (the one-hand invariants in tests). */
  probe(t: number): HandProbe {
    const hand = this.settings.pen ? this.handOf() : undefined;
    const drawing: InkProbe[] = [];
    for (const mark of this.held) {
      const final = this.finalOf(mark);
      const tip = markTip(final, t, this.toScreen);
      if (tip) drawing.push({ mark: final, tip, parallel: this.parallel.has(mark) });
    }
    const active = hand ? this.activeAt(t, hand) : null;
    const pen = hand ? this.handState(t, active, hand) : null;
    return {
      pen,
      active: pen && active ? active.mark : null,
      others: this.others.filter((visible) => visible(t)).length,
      drawing,
    };
  }
}
