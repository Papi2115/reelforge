/**
 * The final plan of the one writing hand, made at the page's first frame over every task (the
 * marks of one page call). Rules (docs/worlds/README.md, "One writing hand"):
 * - a `parallel` task never takes the hand: its ink appears by itself, at its own time;
 * - every other held mark is drawn by the hand, its nib on the mark's tip; nothing writes itself;
 * - the hero task keeps its time (explicit `hero: true`, else the largest in-shot text, the later
 *   one on a tie); the breakthrough choreography (`exact` marks, other hands) keeps its time too;
 * - every other mark that would need the hand while it is busy far away (or could not get there
 *   at hand speed) waits until the hand is free and has travelled there: a task can be paused
 *   for the hero and resumes after it. Waiting only ever moves marks later;
 * - except secondary text (a write that is not the hero) that would wait more than MAX_SLIP: it
 *   appears by itself on time (an ink bloom, draw/appear.ts), never written without the hand.
 * The call-time queue (hand-queue.ts) already moved most tasks; this pass settles the rest.
 */
import { distance, HAND_SPEED } from '../draw/hand-room.js';
import { markEnds } from '../draw/hand.js';
import { markTip } from '../draw/ink.js';
import { fitMarks, type Mark } from '../draw/marks.js';
import { identity, type Point } from '../draw/paths.js';
import { appearMarks } from '../draw/appear.js';
import { MAX_SLIP, NEAR } from './hand-queue.js';

export type TaskTiming = 'queue' | 'parallel' | 'exact';

/** The marks of one page call that need the hand, and how they may be timed. */
export interface HandTask {
  readonly marks: readonly Mark[];
  readonly timing: TaskTiming;
  /** The scene marked it as the shot's hero (it keeps its time). */
  readonly hero: boolean;
  /** Cap height of a write (0 = not text): the default hero is the largest text. */
  readonly text: number;
}

export interface HandPlan {
  /** The final timing of every mark the plan moved (keyed by the mark as added). */
  readonly moved: ReadonlyMap<Mark, Mark>;
  /** The marks the hand draws (final timing). */
  readonly drawn: ReadonlySet<Mark>;
  /** First marks of moved stretches: the hand travels to them in the air. */
  readonly queued: ReadonlySet<Mark>;
}

/** Leaving the page before another hand works it / coming back after (s). */
const LEAVE = 0.6;
const ENTER = 0.45;
const EPS = 1e-6;
/** The fastest a task is squeezed to end before the shot's end rule (share of its pace). */
const MIN_PACE = 0.4;

/** A stretch the hand is busy (page px ends; null = off the page). */
interface Slot {
  readonly from: number;
  readonly to: number;
  readonly start: Point | null;
  readonly end: Point | null;
  readonly task: number;
  readonly mark: Mark | null;
}

/** Time the hand needs to get from a to b at hand speed (a short hop is a twitch: free). */
function reach(a: Point, b: Point): number {
  const d = distance(a, b);
  return d <= NEAR ? 0 : d / HAND_SPEED;
}

/** Two marks whose tips stay this close while both are drawn may overlap: a twitch. */
function twitch(a: Mark, b: Mark): boolean {
  const from = Math.max(a.t0, b.t0);
  const to = Math.min(a.t0 + a.dur, b.t0 + b.dur);
  for (let k = 0; k <= 4; k += 1) {
    const t = from + ((to - from) * k) / 4 - (k === 4 ? EPS : 0);
    const [p, q] = [markTip(a, t, identity), markTip(b, t, identity)];
    if (p && q && distance(p, q) > NEAR) return false;
  }
  return true;
}

/** Does the hand on `slot` stop it from drawing `mark` (starting at s, from ps to pe)? */
function blocks(slot: Slot, task: number, mark: Mark, s: number, ps: Point, pe: Point): boolean {
  const e = s + mark.dur;
  if (slot.task === task) return false;
  if (!slot.start || !slot.end || !slot.mark) {
    return e + LEAVE > slot.from + EPS && s + EPS < slot.to + ENTER;
  }
  const before = e + reach(pe, slot.start) <= slot.from + EPS;
  const after = slot.to + reach(slot.end, ps) <= s + EPS;
  if (before || after) return false;
  const overlap = s < slot.to && e > slot.from;
  return !(overlap && twitch({ ...mark, t0: s }, slot.mark));
}

/** When the hand can start at `ps` once `slot` is done. */
function freeAfter(slot: Slot, ps: Point): number {
  return slot.end ? slot.to + reach(slot.end, ps) : slot.to + ENTER;
}

const startOf = (marks: readonly Mark[]): number =>
  marks.reduce((first, mark) => Math.min(first, mark.t0), Infinity);

/**
 * The default hero: the largest in-shot text task (on a tie the later one); -1 = none. A task
 * the scene marked `hero` wins over it.
 */
export function heroTask(tasks: readonly HandTask[]): number {
  let best = -1;
  tasks.forEach((task, index) => {
    if (task.timing !== 'queue' || task.text <= 0 || startOf(task.marks) < 0) return;
    const current = tasks[best];
    if (
      !current ||
      task.text > current.text ||
      (task.text === current.text && startOf(task.marks) >= startOf(current.marks))
    ) {
      best = index;
    }
  });
  return best;
}

/** Times a task's marks (in their order) after the hand's slots; `delay` = the most any waits. */
function place(
  task: HandTask,
  index: number,
  slots: readonly Slot[],
): { marks: Mark[]; delay: number } {
  let delay = 0;
  let most = 0;
  const final = new Map<Mark, Mark>();
  for (const mark of [...task.marks].sort((a, b) => a.t0 - b.t0)) {
    const [ps, pe] = markEnds(mark, identity);
    let s = mark.t0 + delay;
    for (;;) {
      const hit = slots.find((slot) => blocks(slot, index, mark, s, ps, pe));
      if (!hit) break;
      s = Math.max(s + EPS, freeAfter(hit, ps));
    }
    delay = s - mark.t0;
    most = Math.max(most, delay);
    const placed = delay > EPS ? { ...mark, t0: s } : mark;
    final.set(mark, placed);
  }
  return { marks: task.marks.map((mark) => final.get(mark) ?? mark), delay: most };
}

/**
 * A task running past `cut` (the shot's last FINAL s, when the hand leaves the subject) is
 * written faster to end by then, if that keeps at least MIN_PACE of its pace.
 */
function beforeCut(marks: Mark[], cut: number): Mark[] {
  const start = startOf(marks);
  const end = marks.reduce((last, mark) => Math.max(last, mark.t0 + mark.dur), -Infinity);
  if (end <= cut || (cut - start) / (end - start) < MIN_PACE) return marks;
  const fitted = [...marks];
  fitMarks(fitted, 0, start, cut);
  return fitted;
}

/**
 * Plans the hand over every task; `busy` = stretches another hand (or a script) works the page,
 * `cut` = when the shot's end rule sends the hand away.
 */
export function planHand(
  tasks: readonly HandTask[],
  busy: readonly (readonly [number, number])[],
  cut = Infinity,
): HandPlan {
  const slots: Slot[] = busy.map(([from, to]) => ({
    from,
    to,
    start: null,
    end: null,
    task: -1,
    mark: null,
  }));
  // Busy stretches are slots of no task (-1), exact marks slots of their own task.
  const moved = new Map<Mark, Mark>();
  const drawn = new Set<Mark>();
  const queued = new Set<Mark>();
  const slotOf = (mark: Mark, task: number): Slot => {
    const [start, end] = markEnds(mark, identity);
    return { from: mark.t0, to: mark.t0 + mark.dur, start, end, task, mark };
  };
  tasks.forEach((task, index) => {
    if (task.timing !== 'exact') return;
    for (const mark of task.marks) {
      slots.push(slotOf(mark, index));
      drawn.add(mark);
    }
  });
  const explicit = tasks.some((task) => task.hero && task.timing === 'queue');
  const fallback = explicit ? -1 : heroTask(tasks);
  const isHero = (task: HandTask, index: number): boolean =>
    task.timing === 'queue' && (explicit ? task.hero : index === fallback);
  const order = tasks
    .map((task, index) => ({ task, index }))
    .filter(({ task }) => task.timing === 'queue' && task.marks.length > 0)
    .sort(
      (a, b) =>
        Number(isHero(b.task, b.index)) - Number(isHero(a.task, a.index)) ||
        startOf(a.task.marks) - startOf(b.task.marks) ||
        a.index - b.index,
    );
  for (const { task, index } of order) {
    const placed = place(task, index, slots);
    // Secondary text the hand cannot get to in time appears by itself, on time.
    if (task.text > 0 && !isHero(task, index) && placed.delay > MAX_SLIP) {
      const shown = appearMarks(task.marks, 'bloom', startOf(task.marks));
      task.marks.forEach((mark, k) => moved.set(mark, shown[k] ?? mark));
      continue;
    }
    let wasMoved = false;
    const squeezed = beforeCut(placed.marks, cut);
    const fits = squeezed.every((mark) => {
      const [ps, pe] = markEnds(mark, identity);
      return !slots.some((slot) => blocks(slot, index, mark, mark.t0, ps, pe));
    });
    (fits ? squeezed : placed.marks).forEach((final, k) => {
      const mark = task.marks[k];
      if (!mark) return;
      if (final !== mark) {
        moved.set(mark, final);
        if (!wasMoved) queued.add(final);
        wasMoved = true;
      } else wasMoved = false;
      slots.push(slotOf(final, index));
      drawn.add(final);
    });
  }
  return { moved, drawn, queued };
}
