/**
 * The film HUD of the Game B1 world, drawn over everything (never scanlined), and never decor
 * (QUALITY.md §6): YEAR = the story's date (odometer roll with lag and overshoot; the old year stays
 * as a CRT burn-in ghost), a score counter = a number from the story, cartridge slots = film
 * progress (one cartridge per shot when slots = shots), a checkpoint flag = a chapter, hearts =
 * lives of the one thing really under threat.
 */
import type { IndexCanvas } from '../core/canvas.js';
import { joy, joyWidth, score, scoreCells, scoreGlyph } from '../core/fonts.js';
import { clamp01, EASES, hash, lerp, typed } from '../core/math.js';
import { C, GHOST } from '../palette.js';

export interface YearKey {
  readonly at: number;
  readonly year: string;
}

export interface ScoreSpec {
  readonly at: number;
  readonly until: number;
  readonly label: string;
  readonly keys: readonly (readonly [number, number])[];
}

export interface ProgressSpec {
  readonly at: number;
  readonly from: number;
  readonly to: number;
  readonly slots: number;
}

export interface CheckpointSpec {
  readonly at: number;
  readonly until: number;
  readonly label: string;
}

export interface LivesSpec {
  readonly at: number;
  readonly until: number;
  readonly label: string;
  readonly max: number;
  readonly keys: readonly (readonly [number, number])[];
}

const YX = 40;
const YY = 22;
const CELL = [3, 2] as const;
const GAPS = [4, 3, 4, 3, 4, 3, 5, 3, 4];

function yearState(keys: readonly YearKey[], t: number) {
  let cur: string | undefined;
  let prev: string | undefined;
  let since = 99;
  for (const key of keys)
    if (t >= key.at) {
      prev = cur;
      cur = key.year;
      since = t - key.at;
    }
  return { cur, prev, since };
}

/** Year odometer: digits that changed roll (big jumps spin), the old year burns in. */
export function drawYear(cv: IndexCanvas, keys: readonly YearKey[], t: number): void {
  const { cur, prev, since } = yearState(keys, t);
  if (cur === undefined) return;
  const [cw, ch] = CELL;
  const step = 5 * cw;
  const h = 5 * ch;
  if (prev !== undefined)
    Array.from(prev).forEach((d, i) => {
      if (d !== cur[i]) ghostGlyph(cv, d, YX + i * step, YY);
    });
  const flash = since < 0.7 && prev !== undefined;
  const col = flash ? C.GOLD : C.TAN;
  const big = prev !== undefined && Math.abs(Number(cur) - Number(prev)) > 5;
  const forward = prev === undefined || Number(cur) > Number(prev);
  Array.from(cur).forEach((d, i) => {
    const x = YX + i * step;
    const from = prev?.[i];
    const lag = [0, 0.07, 0.12, 0.04][i] ?? 0;
    const dur = big ? 0.42 + i * 0.09 : 0.26;
    const k = from !== undefined && from !== d ? clamp01((since - lag) / dur) : 1;
    if (k >= 1) {
      score(cv, d, x, YY, cw, ch, col);
      return;
    }
    let showFrom = big ? String((Number(d) + 7) % 10) : (from ?? d);
    let showTo = d;
    if (big && k < 0.75) {
      const n = Math.floor(k * 14);
      showFrom = String((Number(d) + 10 - (n % 10)) % 10);
      showTo = String((Number(showFrom) + 1) % 10);
    }
    const e = big ? EASES.out(k) : EASES.outBack(k);
    const off = Math.round((big && k < 0.75 ? (k * 14) % 1 : e) * (h + 2)) * (forward ? 1 : -1);
    const window = [YY - 1, YY + h + 1] as const;
    scoreGlyph(cv, showFrom, x, YY - off, CELL, col, window);
    scoreGlyph(cv, showTo, x, YY - off + (forward ? h + 2 : -(h + 2)), CELL, col, window);
  });
}

/** Burn-in ghost: lifts the dark glass under a glyph one step. */
function ghostGlyph(cv: IndexCanvas, glyph: string, x: number, y: number): void {
  scoreCells(glyph, x, y, CELL[0], CELL[1], (rx, ry, w, h) => {
    cv.remap(rx, ry, w, h, GHOST);
  });
}

/** A number from the story: label + Score Block value; a change pops and flashes gold. */
export function drawScore(cv: IndexCanvas, spec: ScoreSpec, t: number): void {
  if (t < spec.at || t >= spec.until) return;
  let value: number | undefined;
  let since = 99;
  for (const [at, v] of spec.keys)
    if (t >= at) {
      since = value === undefined ? 99 : t - at;
      value = v;
    }
  if (value === undefined) return;
  const x = 196;
  const lw = joy(cv, spec.label, x, YY - 1, 2, C.TAN);
  const pop = since < 0.06 ? -2 : 0;
  score(
    cv,
    String(Math.round(value)),
    x + lw + 10,
    YY + pop,
    CELL[0],
    CELL[1],
    since < 0.5 ? C.GOLD : C.CREAM,
  );
}

/** Cartridge slots = film progress: full slots behind, the current one fills orange. */
export function drawProgress(
  cv: IndexCanvas,
  spec: ProgressSpec,
  t: number,
  duration: number,
): void {
  if (t < spec.at) return;
  const n = spec.slots;
  const gaps = Array.from(
    { length: n - 1 },
    (_, i) => GAPS[i] ?? 3 + Math.floor(hash(n, i, 4) * 3),
  );
  let x = 640 - 40 - n * 8 - gaps.reduce((a, b) => a + b, 0);
  const y = 23;
  const share = lerp(spec.from, spec.to, clamp01(t / duration));
  for (let i = 0; i < n; i += 1) {
    const k = clamp01(share * n - i);
    const line = k > 0 ? C.TAN : C.GREY_D;
    cv.rect(x + 1, y, 6, 1, line);
    cv.rect(x, y + 1, 1, 9, line);
    cv.rect(x + 7, y + 1, 1, 9, line);
    cv.rect(x, y + 10, 8, 1, line);
    if (k >= 1) {
      cv.rect(x + 1, y + 1, 6, 9, C.TAN);
      cv.rect(x + 2 + (i === 2 ? 1 : 0), y + 4, 4, 3, C.CREAM);
    } else if (k > 0) {
      const fh = Math.round(9 * k);
      cv.rect(x + 1, y + 10 - fh, 6, fh, C.ORANGE);
    }
    x += 8 + (gaps[i] ?? 0);
  }
}

/** The x of the current progress slot (where a checkpoint flag pops). */
function currentSlotX(spec: ProgressSpec, t: number, duration: number): number {
  const n = spec.slots;
  const share = lerp(spec.from, spec.to, clamp01(t / duration));
  const index = Math.min(n - 1, Math.floor(share * n));
  let x = 640 - 40 - n * 8;
  for (let i = 0; i < n - 1; i += 1) x -= GAPS[i] ?? 3 + Math.floor(hash(n, i, 4) * 3);
  for (let i = 0; i < index; i += 1) x += 8 + (GAPS[i] ?? 3 + Math.floor(hash(n, i, 4) * 3));
  return x;
}

/** Chapter = a checkpoint flag pops over the current slot; its name types under the slots. */
export function drawCheckpoint(
  cv: IndexCanvas,
  spec: CheckpointSpec,
  progress: ProgressSpec | undefined,
  t: number,
  duration: number,
): void {
  if (t < spec.at || t >= spec.until) return;
  const x = progress === undefined ? 600 : currentSlotX(progress, spec.at, duration) + 3;
  const u = t - spec.at;
  const rise = u < 0.12 ? Math.round((1 - EASES.outBack(u / 0.12)) * 8) : 0;
  cv.rect(x, 8 + rise, 1, 13, C.GREY);
  const wave = Math.floor(t * 5) % 2;
  cv.rect(x + 1, 8 + rise, 6, 2, C.GOLD);
  cv.rect(x + 1, 10 + rise, 4 + wave, 2, C.GOLD);
  cv.rect(x + 1, 12 + rise, 2, 1, C.GOLD);
  const out = spec.until - t < 0.5 ? (spec.until - t) / 0.5 : 1;
  const n = Math.floor(typed(spec.label, t, spec.at + 0.15, 61, 20) * out);
  const text = spec.label.slice(0, n);
  if (text.length > 0) joy(cv, text, 600 - joyWidth(spec.label, 2), 40, 2, C.GOLD);
}

const HEART = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];

/** Hearts: lives of the one thing really under threat; a lost one blinks, then goes hollow. */
export function drawLives(cv: IndexCanvas, spec: LivesSpec, t: number): void {
  if (t < spec.at || t >= spec.until) return;
  let lives = spec.max;
  const lost: number[] = [];
  for (const [at, value] of spec.keys) {
    if (t < at) break;
    for (let i = Math.min(lives, spec.max) - 1; i >= value; i -= 1) lost[i] = at;
    lives = value;
  }
  const x0 = 40;
  const y0 = 44;
  const lw = joy(cv, spec.label, x0, y0, 2, C.TAN);
  for (let i = 0; i < spec.max; i += 1) {
    const hx = x0 + lw + 10 + i * 18;
    const since = lost[i] === undefined ? -1 : t - (lost[i] ?? 0);
    const blinking = since >= 0 && since < 0.5 && Math.floor(since * 12) % 2 === 0;
    const full = i < lives || blinking;
    HEART.forEach((row, r) => {
      for (let k = 0; k < row.length; k += 1) {
        if (row[k] !== '#') continue;
        const edge =
          r === 0 || k === 0 || k === row.length - 1 || row[k - 1] !== '#' || row[k + 1] !== '#';
        if (full || edge) cv.rect(hx + k * 2, y0 + r * 2, 2, 2, full ? C.CRIMSON : C.GREY_D);
      }
    });
  }
}
