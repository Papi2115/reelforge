/**
 * A whiteboard drawing over time: scheduled marks inked onto the surface, the hand (or marker)
 * at the head of the mark being drawn and travelling between marks, and eraser passes that wipe
 * everything drawn before them with a ragged, dithered front (leaving a faint ghost, like a real
 * board). Everything is a pure function of t; the surface is painted once and restored per frame.
 */
import { hashCell } from '../../env/shared.js';
import { bayerOn, Raster, type Snapshot } from '../blueprint/raster.js';
import type { Box, Point } from './geometry.js';
import { noise1 } from './geometry.js';
import { drawMark, markEnds, penState, markProgress, type Mark } from './marks.js';
import { drawSleeve, drawSprite, type PenKind, type Sprite } from './sprites.js';
import type { Theme } from './theme.js';

export type EraseDirection = 'right' | 'left' | 'down';

export interface ErasePass {
  readonly start: number;
  readonly duration: number;
  readonly direction: EraseDirection;
}

export interface DrawingSetup {
  readonly raster: Raster;
  readonly theme: Theme;
  readonly s: number;
  readonly seed: number;
  readonly surface: Snapshot;
  /** Board box (raster px): where the eraser works. */
  readonly board: Box;
  readonly marks: readonly Mark[];
  readonly erases: readonly ErasePass[];
  readonly pen: PenKind;
  readonly penSprite: Sprite;
  readonly eraserSprite: Sprite;
}

/** Longest pause the pen travels through without leaving the board (s). */
const TRAVEL_MAX = 1.2;
const LEAVE = 0.4;
const ARRIVE = 0.45;
/** Width of the eraser's dithered front (reference px) and how far it wanders. */
const ERASE_EDGE = 16;
const ERASE_RAGGED = 10;
const SCRUBS = 4.5;
/** Coverage of the ghost an erased mark leaves. */
const GHOST = 0.06;

function easeInOut(k: number): number {
  const clamped = k <= 0 ? 0 : k >= 1 ? 1 : k;
  return (1 - Math.cos(clamped * Math.PI)) / 2;
}

function lerp(a: Point, b: Point, k: number): Point {
  const e = easeInOut(k);
  return [a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e];
}

/** Erase pass whose window contains t, if any. */
function activeErase(erases: readonly ErasePass[], t: number): ErasePass | undefined {
  return erases.find((pass) => t >= pass.start && t < pass.start + pass.duration);
}

/** Index of the erase pass that wipes a mark (the first one starting after the mark started). */
function eraseOf(erases: readonly ErasePass[], mark: Mark): number {
  return erases.findIndex((pass) => pass.start > mark.start);
}

interface EraseFront {
  /** Coverage 0..1 of the wipe at a pixel. */
  level(x: number, y: number): number;
  /** Centre of the eraser (raster px). */
  readonly eraser: Point;
}

function eraseFront(setup: DrawingSetup, pass: ErasePass, t: number): EraseFront {
  const { board, s, seed } = setup;
  const k = easeInOut((t - pass.start) / pass.duration);
  const edge = ERASE_EDGE * s;
  const vertical = pass.direction === 'down';
  const span = vertical ? board.height : board.width;
  const travel = -edge * 2 + (span + edge * 4) * k;
  const front = pass.direction === 'left' ? span - travel : travel;
  const scrub = (Math.sin(k * SCRUBS * Math.PI * 2) * 0.5 + 0.5) * 0.8 + 0.1;
  const eraser: Point = vertical
    ? [board.x + board.width * scrub, board.y + front]
    : [board.x + front, board.y + board.height * scrub];
  return {
    eraser,
    level: (x, y) => {
      const along = vertical ? y - board.y : x - board.x;
      const across = vertical ? x / s : y / s;
      const ragged = front + noise1(seed, 9, across / 18) * ERASE_RAGGED * s;
      const distance = pass.direction === 'left' ? along - ragged : ragged - along;
      return distance / edge;
    },
  };
}

/** Where the pen is and in which ink at t (undefined = off the board). */
function penAt(setup: DrawingSetup, t: number): { head: Point; ink: number } | undefined {
  const { marks, raster, s } = setup;
  let previous: Mark | undefined;
  let next: Mark | undefined;
  let active: Mark | undefined;
  for (const mark of marks) {
    const end = mark.start + mark.duration;
    if (t >= mark.start && t < end && (!active || mark.start >= active.start)) active = mark;
    if (end <= t && (!previous || end >= previous.start + previous.duration)) previous = mark;
    if (mark.start > t && (!next || mark.start < next.start)) next = mark;
  }
  if (active) {
    const head = penState(active, markProgress(active, t)).head ?? markEnds(active).first;
    return { head, ink: active.color };
  }
  const rest: Point = [raster.width * 0.82, raster.height + 40 * s];
  const ended = previous ? previous.start + previous.duration : -Infinity;
  if (previous && next && next.start - ended <= TRAVEL_MAX) {
    const k = (t - ended) / (next.start - ended);
    return { head: lerp(markEnds(previous).last, markEnds(next).first, k), ink: next.color };
  }
  if (previous && t - ended < LEAVE) {
    return { head: lerp(markEnds(previous).last, rest, (t - ended) / LEAVE), ink: previous.color };
  }
  if (next && next.start - t < ARRIVE) {
    const k = 1 - (next.start - t) / ARRIVE;
    return { head: lerp(rest, markEnds(next).first, k), ink: next.color };
  }
  return undefined;
}

/** Inks marks through an erase pass (into `scratch`, then copied where not wiped). */
function drawErased(
  setup: DrawingSetup,
  scratch: Raster,
  marks: readonly Mark[],
  front: EraseFront | undefined,
  t: number,
): void {
  const { raster, theme } = setup;
  scratch.clear();
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const mark of marks) {
    drawMark(scratch, mark, t);
    x0 = Math.min(x0, mark.bounds.x);
    y0 = Math.min(y0, mark.bounds.y);
    x1 = Math.max(x1, mark.bounds.x + mark.bounds.width);
    y1 = Math.max(y1, mark.bounds.y + mark.bounds.height);
  }
  for (let y = Math.max(0, Math.floor(y0)); y < Math.min(raster.height, y1); y += 1) {
    for (let x = Math.max(0, Math.floor(x0)); x < Math.min(raster.width, x1); x += 1) {
      const color = scratch.get(x, y);
      if (color === 0) continue;
      const wiped = front === undefined || bayerOn(x, y, front.level(x, y));
      if (!wiped) raster.set(x, y, color);
      else if (bayerOn(x, y, GHOST) && hashCell(x >> 2, y >> 2, 11, setup.seed) < 0.6) {
        raster.set(x, y, theme.grain);
      }
    }
  }
}

/** A drawing's per-frame renderer. */
export function createDrawing(setup: DrawingSetup): {
  render(t: number): void;
  /** Pen head after the last render (raster px), undefined while off the board. */
  head(): Point | undefined;
} {
  const scratch =
    setup.erases.length > 0 ? new Raster(setup.raster.width, setup.raster.height) : undefined;
  let lastHead: Point | undefined;
  return {
    head: () => lastHead,
    render(t) {
      const { raster, erases, marks, theme } = setup;
      raster.restore(setup.surface);
      const byPass = new Map<number, Mark[]>();
      for (const mark of marks) {
        if (t <= mark.start) continue;
        const pass = eraseOf(erases, mark);
        const passStart = erases[pass]?.start ?? Infinity;
        if (pass < 0 || t < passStart) {
          drawMark(raster, mark, t);
          continue;
        }
        const list = byPass.get(pass) ?? [];
        list.push(mark);
        byPass.set(pass, list);
      }
      for (const [index, list] of byPass) {
        const pass = erases[index];
        if (!pass || !scratch) continue;
        const running = t < pass.start + pass.duration;
        drawErased(setup, scratch, list, running ? eraseFront(setup, pass, t) : undefined, t);
      }
      const erasing = activeErase(erases, t);
      lastHead = undefined;
      if (erasing) {
        const { eraser } = eraseFront(setup, erasing, t);
        drawSprite(raster, setup.eraserSprite, eraser[0], eraser[1], theme, theme.black);
        return;
      }
      const pen = setup.pen === 'none' ? undefined : penAt(setup, t);
      if (!pen) return;
      lastHead = pen.head;
      if (setup.pen === 'hand') drawSleeve(raster, pen.head[0], pen.head[1], setup.s, theme);
      drawSprite(raster, setup.penSprite, pen.head[0], pen.head[1], theme, pen.ink);
    },
  };
}
