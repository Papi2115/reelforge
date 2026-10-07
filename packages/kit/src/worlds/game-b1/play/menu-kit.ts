/**
 * Shared pieces of the B1 game-screen breakthroughs (inventory, shop, splits; PLAN.md#13.15 B1
 * rework): readable errors per call, caps text the B1 font can draw, the "hold at most 4 s after
 * the last beat" rule, uneven print times, the menu panel (tube black, a teal playfield frame, the
 * title typed at an irregular cadence), the playfield-blinds entrance over what the TV showed and
 * an overlay that paints with the 2600 painter (the film's sprites drawn by id). Pure functions
 * of t: nothing survives a frame but a scratch copy of the picture under the blinds.
 */
import { z } from 'zod';
import { KitError } from '../../../errors.js';
import type { IndexCanvas } from '../core/canvas.js';
import { missingGlyphs } from '../core/fonts.js';
import { EASES, hash, seg } from '../core/math.js';
import { C } from '../palette.js';
import type { Overlay } from '../screen/model.js';
import { TvPainter } from '../tv/painter.js';
import type { VocabLookup } from '../vocab/draw.js';

export interface Cue {
  readonly t: number;
  readonly name: string;
}

export const intentSchema = (what: string) =>
  z.string().min(12).max(160).describe(`What the ${what} claims, in the narration's terms`);

export const enterSchema = z
  .enum(['blinds', 'cut'])
  .default('blinds')
  .describe('blinds = the screen opens in playfield bands over the picture');

export const BLINDS_S = 0.42;

export type Fail = (message: string) => never;

export function failer(call: string): Fail {
  return (message: string): never => {
    throw new KitError('invalid-params', `kit.fx.b1Screen().${call}: ${message}`);
  };
}

/** CAPS text the Joy face can draw, at most `max` characters. */
export function capsText(fail: Fail, what: string, text: string, max: number): string {
  const upper = text.toUpperCase();
  const missing = missingGlyphs(upper, 'joy');
  if (missing.length > 0) fail(`${what} "${text}": the B1 font cannot draw ${missing.join(' ')}`);
  if (upper.length > max)
    fail(`${what} "${text}": ${String(upper.length)} characters, max ${String(max)}`);
  return upper;
}

/** The screen ends at most 4 s after its last beat (a still hold, never dead air). */
export function checkHold(fail: Fail, until: number, last: number, what: string): void {
  if (last >= until)
    fail(`${what} ${last.toFixed(2)} is after until (${until.toFixed(2)}): end it later`);
  if (until - last > 4)
    fail(
      `it holds ${(until - last).toFixed(1)} s after its last beat (max 4 s): end it sooner or add a beat`,
    );
}

/** Times things print at: uneven gaps of `gap` .. 1.6 x gap after `first`. */
export function printTimes(n: number, first: number, gap: number, seed: number): number[] {
  const out: number[] = [];
  let at = first;
  for (let i = 0; i < n; i += 1) {
    out.push(at);
    at += gap * (1 + hash(seed, i, 5) * 0.6);
  }
  return out;
}

/** Tube black, a teal frame of playfield blocks (one block a unit off), the typed title. */
export function drawPanel(g: TvPainter, title: string, titleAt: number, seed: number): void {
  g.rect(0, 0, 160, 180, 'tube');
  g.rect(4, 6, 152, 2, 'teal');
  g.rect(4, 172, 152, 2, 'tealDark');
  g.rect(4, 6, 1, 168, 'teal');
  g.rect(155, 6, 1, 168, 'tealDark');
  g.rect(4 + 4 * Math.floor(hash(seed, 1, 1) * 30), 5, 4, 1, 'teal');
  g.text(title, 10, 12, { colour: 'teal', size: 2, type: { at: titleAt, cps: 14 } });
}

/** A bracket cursor (four corners) around a box, gold. */
export function bracket(g: TvPainter, x: number, y: number, w: number, h: number, ink = 'gold') {
  for (const [cx, cy] of [
    [x - 1, y - 1],
    [x + w - 2, y - 1],
    [x - 1, y + h - 1],
    [x + w - 2, y + h - 1],
  ] as const) {
    g.rect(cx, cy, 3, 1, ink);
    g.rect(cx + (cx < x ? 0 : 2), cy + (cy < y ? 0 : -2), 1, 3, ink);
  }
}

/** A dashed outline (an empty slot). */
export function dashed(g: TvPainter, x: number, y: number, w: number, h: number, ink: string) {
  for (let i = 0; i < w; i += 4) {
    g.rect(x + i, y, 2, 1, ink);
    g.rect(x + i, y + h - 1, 2, 1, ink);
  }
  for (let j = 0; j < h; j += 4) {
    g.rect(x, y + j, 1, 2, ink);
    g.rect(x + w - 1, y + j, 1, 2, ink);
  }
}

/** A plus sign and an arrow drawn in blocks (the fonts have neither). */
export function plus(g: TvPainter, x: number, y: number, ink: string): void {
  g.rect(x, y + 3, 7, 2, ink);
  g.rect(x + 2, y, 3, 8, ink);
}

export function arrow(g: TvPainter, x: number, y: number, ink: string): void {
  g.rect(x, y + 3, 8, 2, ink);
  g.rect(x + 6, y + 1, 2, 6, ink);
  g.rect(x + 8, y + 2, 2, 4, ink);
  g.rect(x + 10, y + 3, 1, 2, ink);
}

/** Venetian blinds of 16 px bands opening top-down over `under` (k 0..1). */
function blinds(cv: IndexCanvas, under: Uint8Array, k: number, seed: number): void {
  const band = 16;
  for (let top = 0; top < cv.h; top += band) {
    const lag = hash(seed, top, 7) * 0.25;
    const open = Math.round(EASES.out(seg(k, lag, lag + 0.75)) * band);
    for (let y = top + open; y < Math.min(cv.h, top + band); y += 1)
      cv.d.set(under.subarray(y * cv.w, (y + 1) * cv.w), y * cv.w);
    if (open > 0 && open < band) cv.rect(0, top + open - 1, cv.w, 1, C.TEAL);
  }
}

/** An overlay that paints a game screen over the TV picture with the 2600 painter. */
export function menuOverlay(
  vocab: VocabLookup,
  span: {
    readonly at: number;
    readonly until: number;
    readonly enter: 'blinds' | 'cut';
    readonly seed: number;
  },
  paint: (g: TvPainter, t: number) => void,
): Overlay {
  let under: Uint8Array | undefined;
  return (cv, t) => {
    if (t < span.at || t >= span.until) return;
    const opening = span.enter === 'blinds' && t < span.at + BLINDS_S;
    if (opening) {
      under ??= new Uint8Array(cv.d.length);
      under.set(cv.d);
    }
    const g = new TvPainter(cv, t, 2, vocab);
    paint(g, t);
    g.flush();
    if (opening && under !== undefined) blinds(cv, under, (t - span.at) / BLINDS_S, span.seed);
  };
}
