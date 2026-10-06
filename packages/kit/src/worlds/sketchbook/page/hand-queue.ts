/**
 * One writing hand per page: the queue of hand tasks (the marks of one page call: a write, a
 * figure, an arrow, ...). Two steps, both deterministic:
 * - `HandQueue.place` (in build, call by call): a task that would start while the hand is busy
 *   far away (another task, a strip, a scripted stretch) waits until the hand has finished and
 *   travelled there, if that slips it by <= MAX_SLIP s; its marks move as a whole and the page
 *   call returns the new times. Otherwise it keeps its time here. A `parallel` task never takes
 *   the hand: it keeps its time and does not hold up anyone.
 * - `planHand` (hand-plan.ts, at the first frame, over every task): settles what is left; nothing
 *   but a `parallel` task is drawn without the hand.
 */
import { distance, HAND_SPEED } from '../draw/hand-room.js';
import { markEnds } from '../draw/hand.js';
import type { Mark } from '../draw/marks.js';
import { identity, type Point } from '../draw/paths.js';

/** The longest a task waits for the hand (s). */
export const MAX_SLIP = 0.6;
/** Hand jumps up to this far (page px) between overlapping tasks are a twitch, not a glitch. */
export const NEAR = 80;
/** Lifting, travelling and setting down again: the fixed part of a move (s). */
const SETTLE = 0.12;
/** Entering from or leaving to off the page (s). */
const OFF_PAGE = 0.45;

/** A stretch the hand is busy: [from, to] s, where it starts and ends (null = off the page). */
interface Claim {
  readonly from: number;
  readonly to: number;
  readonly start: Point | null;
  readonly end: Point | null;
  /** The task's held marks with their ends (page px), by start. */
  readonly marks: readonly (readonly [Mark, Point, Point])[];
}

/** Time to travel from a to b (s); null = off the page. */
export function travelTime(a: Point | null, b: Point | null): number {
  if (!a || !b) return OFF_PAGE;
  return SETTLE + distance(a, b) / HAND_SPEED;
}

/** Where the hand is at t while on the claim (the end of its latest started mark). */
function handOn(claim: Claim, t: number): Point | null {
  let at = claim.start;
  for (const [mark, start, end] of claim.marks) {
    if (mark.t0 > t) break;
    at = t < mark.t0 + mark.dur ? start : end;
  }
  return at;
}

/** The claim of a task (page px): from its first held mark to its last one. */
function claimOf(marks: readonly Mark[]): Claim | null {
  const held = marks.filter((mark) => mark.held).sort((a, b) => a.t0 - b.t0);
  const first = held[0];
  if (!first) return null;
  const ends = held.map((mark) => [mark, ...markEnds(mark, identity)] as const);
  let last = first;
  let end: Point | null = null;
  for (const [mark, , point] of ends) {
    if (end === null || mark.t0 + mark.dur >= last.t0 + last.dur) [last, end] = [mark, point];
  }
  return { from: first.t0, to: last.t0 + last.dur, start: ends[0]?.[1] ?? null, end, marks: ends };
}

function shifted(marks: readonly Mark[], by: number): Mark[] {
  return by === 0 ? [...marks] : marks.map((mark) => ({ ...mark, t0: mark.t0 + by }));
}

export class HandQueue {
  private readonly claims: Claim[] = [];
  /** The first held mark of every task the queue moved (the hand travels to it in the air). */
  readonly queued = new Set<Mark>();

  /** The hand is busy from `from` to `to` (another hand works the page, a scripted stretch). */
  pin(from: number, to: number): void {
    this.claims.push({ from, to, start: null, end: null, marks: [] });
  }

  /** Marks the hand must draw exactly when they are (a strip's writing). */
  pinMarks(marks: readonly Mark[]): void {
    const claim = claimOf(marks);
    if (claim) this.claims.push(claim);
  }

  /**
   * Queues a task: returns its marks, moved later as a whole when the hand is busy far away
   * then (by at most MAX_SLIP s), else unchanged (`parallel`: never moved, never in the way).
   */
  place(marks: readonly Mark[], parallel: boolean): Mark[] {
    const task = claimOf(marks);
    if (!task || parallel) return [...marks];
    const slip = this.slipOf(task);
    const placed = shifted(marks, slip <= MAX_SLIP ? slip : 0);
    const claim = claimOf(placed);
    if (claim) this.claims.push(claim);
    const first = claim?.marks[0]?.[0];
    if (first && slip > 0 && slip <= MAX_SLIP) this.queued.add(first);
    return placed;
  }

  private slipOf(task: Claim): number {
    const length = task.to - task.from;
    let from = task.from;
    let moved = false;
    for (;;) {
      const start = from;
      const hit = this.claims.find((claim) => {
        const at = handOn(claim, Math.max(start, claim.from));
        if (at && task.start && distance(at, task.start) <= NEAR) return false;
        const lead = moved ? travelTime(claim.end, task.start) : 0;
        const tail = moved ? travelTime(task.end, claim.start) : 0;
        return start < claim.to + lead && start + length + tail > claim.from;
      });
      if (!hit) return from - task.from;
      from = Math.max(from, hit.to + travelTime(hit.end, task.start));
      moved = true;
      if (from - task.from > MAX_SLIP) return Infinity;
    }
  }
}
