/**
 * The dialogue box of the Game B1 HUD (over the picture and the room, never scanlined): a black
 * plate with a tan rule that opens as its first letter lands, the speaker's name typed first in
 * gold, the line typed at an irregular, voiced cadence (spaces and punctuation breathe), a block
 * cursor that blinks while the box waits. CAPS, up to 3 lines.
 */
import type { IndexCanvas } from '../core/canvas.js';
import { joy, joyWidth } from '../core/fonts.js';
import { clamp01, sid, typed, typedEnd } from '../core/math.js';
import { C } from '../palette.js';

export interface DialogueSpec {
  readonly text: string;
  readonly speaker: string;
  readonly at: number;
  readonly until: number;
  readonly place: 'bottom' | 'top';
}

const LINE = 16;
const PAD = 10;

export function dialogueTiming(spec: Pick<DialogueSpec, 'text' | 'speaker' | 'at'>): number {
  const start = spec.at + (spec.speaker.length > 0 ? 0.25 : 0);
  return typedEnd(spec.text, start, sid(spec.text), 24);
}

export function drawDialogue(cv: IndexCanvas, spec: DialogueSpec, t: number): void {
  if (t < spec.at || t >= spec.until) return;
  const lines = spec.text.split('\n');
  const width = Math.max(...lines.map((line) => joyWidth(line, 2))) + PAD * 2 + 12;
  const height = lines.length * LINE + PAD * 2 - 4;
  const x = 40;
  const y = spec.place === 'top' ? 66 : 360 - 28 - height;
  const open = clamp01((t - spec.at) / 0.1);
  const close = clamp01((spec.until - t) / 0.12);
  const k = Math.min(open, close);
  const shownH = Math.max(2, Math.round(height * k));
  const top = y + Math.round((height - shownH) / 2);
  cv.rect(x + 3, top + 3, width, shownH, C.TUBE);
  cv.rect(x, top, width, shownH, C.VOID);
  cv.rect(x, top, width, 1, C.TAN);
  cv.rect(x, top + shownH - 1, width, 1, C.TAN);
  cv.rect(x, top, 1, shownH, C.TAN);
  cv.rect(x + width - 1, top, 1, shownH, C.TAN);
  if (k < 1) return;
  let start = spec.at;
  if (spec.speaker.length > 0) {
    const n = typed(spec.speaker, t, spec.at, sid(spec.speaker), 30);
    const name = spec.speaker.slice(0, n);
    if (name.length > 0) {
      cv.rect(x + 8, y - 8, joyWidth(name, 2) + 8, 16, C.VOID);
      joy(cv, name, x + 12, y - 5, 2, C.GOLD);
    }
    start += 0.25;
  }
  const n = typed(spec.text, t, start, sid(spec.text), 24);
  let left = n;
  let cursor = { x: x + PAD, y: y + PAD };
  lines.forEach((line, i) => {
    const part = line.slice(0, Math.max(0, left));
    const ly = y + PAD + i * LINE;
    if (part.length > 0) {
      const w = joy(cv, part, x + PAD, ly, 2, C.CREAM);
      cursor = { x: x + PAD + w + 3, y: ly };
    } else if (left >= 0 && i > 0 && left === 0) cursor = { x: x + PAD, y: ly };
    left -= line.length + 1;
  });
  const done = n >= spec.text.length;
  const blink = done ? Math.floor((t - dialogueTiming(spec)) * 2.4) % 2 === 0 : true;
  if (blink) cv.rect(cursor.x, cursor.y, 8, 12, done ? C.TAN : C.CREAM);
}
