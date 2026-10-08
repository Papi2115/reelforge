/**
 * HUD materials of the Game B2 world at native 640x360: woodgrain plates (the 1980s console
 * veneer, each plate a slightly different cut of one grain), black ribbed insets and the
 * dialogue box with its grain lip and speaker tab.
 */
import { Bmp } from '../core/bitmap.js';
import { drawText, textWidth } from '../core/font.js';
import { vnoise } from '../core/rand.js';
import { C } from '../palette.js';
import { SCREEN_H, SCREEN_W } from '../view/output.js';

let grain: Uint8Array | undefined;

/** The veneer: one woodgrain for the whole screen, cut by each plate (built once). */
function veneer(): Uint8Array {
  if (grain !== undefined) return grain;
  const out = new Uint8Array(SCREEN_W * SCREEN_H);
  for (let y = 0; y < SCREEN_H; y += 1)
    for (let x = 0; x < SCREEN_W; x += 1) {
      const g = Math.sin(y * 0.9 + vnoise(x * 0.07, y * 0.22, 1, 5) * 5.5 + x * 0.015);
      out[y * SCREEN_W + x] = g > 0.6 ? C.BROWN : g < -0.86 ? C.TAN : C.WOOD;
    }
  grain = out;
  return out;
}

function woodRect(b: Bmp, x0: number, y0: number, x1: number, y1: number): void {
  const wood = veneer();
  for (let y = Math.max(0, y0); y < Math.min(b.h, y1); y += 1)
    for (let x = Math.max(0, x0); x < Math.min(b.w, x1); x += 1)
      b.d[y * b.w + x] = wood[(y % SCREEN_H) * SCREEN_W + (x % SCREEN_W)] ?? C.WOOD;
}

/** Woodgrain plate with a chamfered black edge. */
export function plate(b: Bmp, xIn: number, yIn: number, w: number, h: number): void {
  const x = Math.round(xIn);
  const y = Math.round(yIn);
  woodRect(b, x + 1, y + 1, x + w - 1, y + h - 1);
  b.rect(x + 1, y + 1, w - 2, 1, C.TAN);
  b.rect(x + 1, y + h - 2, w - 2, 1, C.UMBER);
  b.rect(x + w - 2, y + 1, 1, h - 2, C.UMBER);
  b.rect(x + 1, y, w - 2, 1, C.VOID);
  b.rect(x + 1, y + h - 1, w - 2, 1, C.VOID);
  b.rect(x, y + 1, 1, h - 2, C.VOID);
  b.rect(x + w - 1, y + 1, 1, h - 2, C.VOID);
}

/** Black ribbed inset (the console's ribbed top). */
export function inset(b: Bmp, x: number, y: number, w: number, h: number): void {
  for (let yy = 0; yy < h; yy += 1) b.rect(x, y + yy, w, 1, yy % 3 === 2 ? C.SHADOW : C.VOID);
  b.rect(x, y, w, 1, C.CHAR);
}

/** The dialogue / narration box: dark body, grain lip, speaker on a small plate. */
export function dialogueBox(
  b: Bmp,
  x: number,
  y: number,
  w: number,
  h: number,
  speaker: string,
): void {
  b.rect(x, y, w, h, C.SHADOW);
  b.frame(x - 1, y - 1, w + 2, h + 2, C.VOID);
  woodRect(b, x, y, x + w, y + Math.min(4, h));
  b.rect(x, y + 4, w, 1, C.UMBER);
  b.rect(x + w - 1, y + 5, 1, h - 5, C.CHAR);
  if (speaker !== '') {
    const tab = textWidth(speaker) + 14;
    plate(b, x + 9, y - 13, tab, 15);
    drawText(b, speaker, x + 16, y - 9, C.BULB);
  }
}

/** Typing caret blink (a pure function of t). */
export function caretOn(t: number): boolean {
  return (t * 3.3) % 1 < 0.6;
}
