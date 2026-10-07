/**
 * The talking parts of the Game B2 HUD: dialogue lines (a speaker on a plate) and narration (no
 * speaker) typed with the irregular typewriter, the choice box (options struck out by hand, a
 * cursor with an overshoot, a press nudge) and quest/item toasts that type in and backspace out.
 */
import { handStroke, type Bmp } from '../core/bitmap.js';
import { drawLines, drawText, textWidth, typedCount } from '../core/font.js';
import { EASES, lerp, seg } from '../core/rand.js';
import { C } from '../palette.js';
import { caretOn, dialogueBox, plate } from './plate.js';

export interface Line {
  readonly text: string;
  readonly speaker: string;
  readonly at: number;
  readonly until: number;
  /** Reveal time of every character. */
  readonly times: readonly number[];
}

export interface Toast {
  readonly head: string;
  readonly body: string;
  readonly at: number;
  readonly until: number;
  readonly times: readonly number[];
}

export interface ChoiceStep {
  readonly at: number;
  readonly cursor?: number | undefined;
  readonly strike?: number | undefined;
  readonly pick?: number | undefined;
}

export interface Choice {
  readonly speaker: string;
  readonly options: readonly string[];
  readonly at: number;
  readonly until: number;
  readonly steps: readonly ChoiceStep[];
}

const BOX_X = 28;
const BOX_BOTTOM = 312;
const LINE_GAP = 19;
const CHAIN = 0.35;

/** The line on screen at t (chained lines keep the box open between them). */
export function drawDialogue(b: Bmp, lines: readonly Line[], t: number, quietFrom: number): void {
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line === undefined) continue;
    const previous = lines[i - 1];
    const next = lines[i + 1];
    const chainIn = previous !== undefined && line.at - previous.until < CHAIN;
    const chainOut = next !== undefined && next.at - line.until < CHAIN;
    const end = chainOut ? next.at : line.until + 0.12;
    // The box finishes opening as the first character lands: never an empty box on screen.
    const openAt = chainIn ? line.at : Math.max(line.at, (line.times[0] ?? line.at) - 0.14);
    if (t < openAt || t >= end || t >= quietFrom) continue;
    const parts = line.text.split('\n');
    const textW = Math.max(...parts.map((part) => textWidth(part, 2)));
    const w = Math.max(230, textW + 34);
    const hFull = 22 + parts.length * LINE_GAP;
    const open = chainIn ? 1 : EASES.outBack(seg(t, openAt, openAt + 0.14));
    const close = chainOut ? 0 : seg(t, line.until, line.until + 0.12);
    const h = Math.max(3, Math.round(hFull * open * (1 - close)));
    const y = BOX_BOTTOM - hFull + Math.round((hFull - h) / 2);
    dialogueBox(b, BOX_X, y, w, h, h > hFull - 4 ? line.speaker : '');
    if (h < hFull - 2) return;
    const n = typedCount(line.times, t);
    const caret = drawLines(b, line.text, BOX_X + 16, y + 13, C.PAPER, 2, LINE_GAP, n);
    if (t < line.until && caretOn(t)) b.rect(caret.x + 2, caret.y, 3, 14, C.BULB);
    return;
  }
}

function stepState(choice: Choice, t: number): { cursor: number; from: number; moved: number } {
  let cursor = 0;
  let from = 0;
  let moved = Number.NEGATIVE_INFINITY;
  for (const step of choice.steps) {
    if (step.cursor === undefined || t < step.at) continue;
    from = cursor;
    cursor = step.cursor;
    moved = step.at;
  }
  return { cursor, from, moved };
}

/** The choice box: options typed big, struck options crossed by hand, the picked one lit. */
export function drawChoice(b: Bmp, choice: Choice, t: number): void {
  if (t < choice.at || t >= choice.until) return;
  const open =
    EASES.outBack(seg(t, choice.at, choice.at + 0.14)) *
    (1 - seg(t, choice.until - 0.15, choice.until));
  const hFull = 19 + choice.options.length * 21;
  const widest = Math.max(...choice.options.map((option) => textWidth(option, 2)));
  const w = Math.max(250, widest + 64);
  const h = Math.max(3, Math.round(hFull * open));
  const y = BOX_BOTTOM - hFull + Math.round((hFull - h) / 2);
  dialogueBox(b, BOX_X, y, w, h, h > hFull - 4 ? choice.speaker : '');
  if (h < hFull - 2) return;
  const picked = choice.steps.find((step) => step.pick !== undefined && t >= step.at)?.pick;
  choice.options.forEach((option, i) => {
    const yy = y + 13 + i * 21 + (i === 1 ? 1 : 0);
    const strike = choice.steps.find((step) => step.strike === i && t >= step.at);
    const colour = picked === i ? C.BULB : strike !== undefined ? C.SLATE : C.PAPER;
    drawText(b, option, BOX_X + 34, yy, colour, 2);
    if (strike !== undefined) {
      const tw = textWidth(option, 2);
      handStroke(
        b,
        [BOX_X + 30, yy + 8, BOX_X + 36 + tw * 0.5, yy + 6, BOX_X + 40 + tw, yy + 7],
        C.CLAY,
        300 + i,
        2,
        seg(t, strike.at, strike.at + 0.2),
        true,
      );
    }
  });
  const { cursor, from, moved } = stepState(choice, t);
  const u = EASES.outBack(seg(t, moved, moved + 0.16));
  const cy = lerp(y + 13 + from * 21, y + 13 + cursor * 21, u);
  const press = choice.steps.some(
    (step) =>
      (step.pick !== undefined || step.strike !== undefined) &&
      t > step.at - 0.3 &&
      t < step.at - 0.2,
  )
    ? 3
    : 0;
  drawText(b, '>', BOX_X + 14 + press, cy, C.BULB, 2);
}

/** Quest / item toasts under the minimap: pop with an overshoot, type in, backspace out. */
export function drawToasts(b: Bmp, toasts: readonly Toast[], t: number, top: number): void {
  for (const toast of toasts) {
    if (t < toast.at || t >= toast.until) continue;
    const back = seg(t, toast.until - 0.45, toast.until - 0.1);
    const n = Math.floor(typedCount(toast.times, t) * (1 - back));
    const body = toast.body.slice(0, n);
    const w = Math.max(textWidth(toast.head), textWidth(toast.body)) + 16;
    const x = 624 - w;
    const pop =
      EASES.outBack(seg(t, toast.at, toast.at + 0.2)) *
      (1 - seg(t, toast.until - 0.12, toast.until));
    if (pop <= 0.02) continue;
    const h = Math.round(28 * pop);
    plate(b, x, top, w, Math.max(4, h));
    if (h < 26) continue;
    b.rect(x + 3, top + 13, w - 6, 12, C.VOID);
    const loud = toast.head.startsWith('NEW') || toast.head.startsWith('QUEST');
    drawText(b, toast.head, x + 7, top + 4, loud ? C.BULB : C.PAPER);
    drawText(b, body, x + 7, top + 16, C.PAPER);
    if (n < toast.body.length && caretOn(t))
      b.rect(x + 8 + textWidth(body), top + 16, 2, 7, C.BULB);
  }
}
