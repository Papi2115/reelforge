/**
 * The high-score table on screen (the showcase's shots-hs.js): the attract screen redraws
 * top-down in uneven bursts over what the TV showed, the rows print one by one with 2600 flicker
 * (one row a unit off the grid), the hero slot empties for a beat of silence, its score slams in
 * gold with a squash and a decaying shake, the initials scroll in arcade-style at an irregular
 * cadence and blink with uneven holds, the prompt blinks at a machine's steady 0.6 s and is
 * burned into the phosphor. On the glass (after the CRT): Dad's grease-pencil ring that
 * overshoots its start, a word in his hand and the thumbprint of the hand that drew it.
 */
import { dith, type IndexCanvas } from '../core/canvas.js';
import { joy, joyCells, score } from '../core/fonts.js';
import { hand } from '../core/hand.js';
import { clamp01, EASES, frameOf, hash, shake, typed } from '../core/math.js';
import type { GlassTransform } from '../hud/note.js';
import { C, GHOST } from '../palette.js';
import { HERO_CELL, initialsDone, PROMPT_Y, type RowPlan, type TablePlan } from './table-plan.js';

export interface Cue {
  readonly t: number;
  readonly name: string;
}

/** The letters a slot scrolls through to reach `ch` (A up, or A then Z down; capped at 10). */
function scrollOf(ch: string): string[] {
  if (!/[A-Z]/.test(ch)) return ['A', ch];
  const code = ch.charCodeAt(0);
  const up = code <= 77;
  const seq = up
    ? Array.from({ length: code - 64 }, (_, i) => String.fromCharCode(65 + i))
    : ['A', '.', ...Array.from({ length: 91 - code }, (_, i) => String.fromCharCode(90 - i))];
  return seq.length > 10 ? [...seq.slice(0, 2), ...seq.slice(-8)] : seq;
}

function slotStart(plan: TablePlan, s: number): number {
  return plan.slam.at + 0.3 + s * 0.17 + hash(plan.seed, s, 4) * 0.08;
}

function initialsAt(plan: TablePlan, t: number): string {
  const who = plan.hero.who;
  if (plan.initials === 'none') return who;
  if (plan.initials === 'typed')
    return who.slice(0, typed(who, t, plan.slam.at + 0.3, plan.seed, 14));
  let out = '';
  for (let s = 0; s < who.length; s += 1) {
    const t0 = slotStart(plan, s);
    if (t < t0) break;
    const seq = scrollOf(who[s] ?? ' ');
    let at = t0;
    let ch = seq[0] ?? '';
    for (let k = 1; k < seq.length; k += 1) {
      at += (1 + (hash(plan.seed, s * 16 + k, 2) < 0.35 ? 1 : 0)) / 30;
      if (t >= at) ch = seq[k] ?? ch;
    }
    out += ch;
  }
  return out;
}

/** The new entry blinks three times with uneven holds once its letters are in. */
function entryHidden(plan: TablePlan, t: number): boolean {
  if (plan.initials !== 'arcade') return false;
  const settle = initialsDone(plan) - 0.7;
  return [
    [0, 0.08],
    [0.17, 0.24],
    [0.36, 0.42],
  ].some(([a = 0, b = 0]) => t >= settle + a && t < settle + b);
}

/** 2600 flicker while a row prints: alternate frames for a short, per-row time. */
function printing(plan: TablePlan, row: RowPlan, i: number, t: number): boolean {
  if (t < row.at) return false;
  const len = 0.17 + hash(plan.seed, i, 1) * 0.12;
  return t - row.at > len || frameOf(t) % 2 === 0;
}

function heroRow(cv: IndexCanvas, plan: TablePlan, t: number): void {
  const { hero, cols, slam } = plan;
  const base = hero.y + 30;
  joy(cv, hero.rank, cols.left, base - 12, 2, C.GREY);
  if (t < slam.at - 0.12) {
    joy(cv, '----', cols.score, base - 12, 2, C.GREY_D);
    return;
  }
  if (t < slam.at) return; // the beat of silence: the slot empties before the score lands
  const d = t - slam.at;
  const [cw, ch] = d < 0.067 ? [12, 7] : d < 0.134 ? [9, 5] : HERO_CELL;
  const sh = shake(t, slam.at + 0.07, slam.shake, 11, plan.seed + 3);
  score(cv, hero.score, cols.score + sh.x, base - 5 * ch + sh.y, cw, ch, C.GOLD);
  const initials = initialsAt(plan, t);
  if (initials.length > 0 && !entryHidden(plan, t))
    joy(cv, initials, cols.who, base - 18, 3, C.CREAM);
}

function prompt(cv: IndexCanvas, plan: TablePlan, t: number): void {
  const p = plan.prompt;
  if (p === undefined) return;
  const x = plan.cols.left + 4;
  // the burn-in ghost is always there; the live text blinks like a machine (regular)
  joyCells(p.text, x, PROMPT_Y, 2, (rx, ry, w, h) => {
    cv.remap(rx, ry, w, h, GHOST);
  });
  if (t >= p.at && (t - p.at) % 0.6 < 0.38) joy(cv, p.text, x, PROMPT_Y, 2, C.CREAM);
}

/** Attract mode redraws the screen top-down in nine uneven bursts; a playfield band is the beam. */
function drawIn(cv: IndexCanvas, under: Uint8Array, k: number, seed: number): void {
  const n = 9;
  const weights = Array.from({ length: n }, (_, i) => 0.55 + hash(seed, i, 1) * 0.9);
  const total = weights.reduce((a, b) => a + b, 0);
  let acc = 0;
  let front = cv.h;
  for (let i = 0; i < n; i += 1) {
    const w = weights[i] ?? 1;
    const a = acc / total;
    const b = (acc + w) / total;
    if (k < b) {
      front = Math.round((i + EASES.out((k - a) / (b - a))) * (cv.h / n));
      break;
    }
    acc += w;
  }
  if (front >= cv.h) return;
  cv.d.set(under.subarray(Math.max(0, front) * cv.w), Math.max(0, front) * cv.w);
  for (let b = 0; b < cv.w / 16; b += 1)
    cv.rect(b * 16, front, 16, 2, (b + Math.floor(front / 40)) % 3 !== 0 ? C.TEAL : C.AQUA);
}

export class ScoreTable {
  private under: Uint8Array | undefined;

  constructor(readonly plan: TablePlan) {}

  /** The table on the TV picture (an overlay: it covers what the painters drew). */
  readonly overlay = (cv: IndexCanvas, t: number): void => {
    const plan = this.plan;
    if (t < plan.at || t >= plan.until) return;
    const drawing = plan.drawIn !== undefined && t < plan.drawIn;
    if (drawing) {
      this.under ??= new Uint8Array(cv.d.length);
      this.under.set(cv.d);
    }
    cv.rect(0, 0, cv.w, 304, C.TUBE);
    cv.rect(0, 304, cv.w, 32, C.NIGHT);
    cv.rect(0, 336, cv.w, cv.h - 336, C.TUBE);
    prompt(cv, plan, t);
    if (t >= (plan.rows[0]?.at ?? plan.at) - 0.2)
      joy(cv, plan.title, plan.cols.left, 66, 2, C.TEAL);
    plan.rows.forEach((row, i) => {
      if (row.kind === 'hero') {
        if (t >= row.at) heroRow(cv, plan, t);
        return;
      }
      if (!printing(plan, row, i, t)) return;
      const y = row.y;
      joy(cv, row.rank, plan.cols.left + row.dx, y, 2, row.colour);
      joy(cv, row.who, plan.cols.who + row.dx, y, 2, row.colour);
      joy(cv, row.score, plan.cols.score + row.dx, y, 2, row.colour);
    });
    if (drawing && this.under !== undefined)
      drawIn(cv, this.under, (t - plan.at) / (plan.drawIn - plan.at), plan.seed);
  };

  /** Dad's grease pencil on the glass: the ring, his word, the thumbprint. */
  readonly glass = (cv: IndexCanvas, t: number, g: GlassTransform): void => {
    const plan = this.plan;
    const ring = plan.ring;
    if (ring === undefined || t < plan.at || t >= plan.until) return;
    const [bx, by, bw, bh] = plan.box;
    const geo = { cx: bx + bw / 2 + 2, cy: by + bh / 2 - 1, rx: bw / 2 + 17, ry: bh / 2 + 15 };
    const X = (x: number) => g.ox + x * g.kx;
    const Y = (y: number) => g.oy + y * g.ky;
    if (t >= ring.at + 0.2) thumbprint(cv, X(geo.cx + geo.rx - 5), Y(geo.cy + 34), g.ky);
    pencilRing(cv, geo, clamp01((t - ring.at) / 0.42), plan.seed, X, Y);
    if (ring.note === undefined) return;
    const reveal = clamp01((t - ring.at - 0.47) / 0.48);
    if (reveal <= 0) return;
    const [nx, ny] = notePlace(plan, ring.note, geo);
    hand(cv, ring.note, {
      x: X(nx),
      y: Y(ny),
      size: 3 * g.ky,
      angle: -0.11,
      seed: plan.seed + 21,
      colour: C.WHITE,
      brush: Math.max(1, Math.round(2 * g.ky)),
      slant: 0.24,
      reveal,
    });
  };

  cues(): Cue[] {
    const plan = this.plan;
    const out: Cue[] = plan.rows.map((row) => ({ t: row.at, name: 'blip' }));
    out.push({ t: plan.slam.at, name: 'hit' });
    if (plan.initials !== 'none')
      for (let s = 0; s < plan.hero.who.length; s += 1)
        if (plan.hero.who[s] !== ' ') out.push({ t: slotStart(plan, s), name: 'tick' });
    if (plan.ring !== undefined) {
      out.push({ t: plan.ring.at, name: 'scribble' });
      if (plan.ring.note !== undefined) out.push({ t: plan.ring.at + 0.47, name: 'scribble' });
    }
    if (plan.prompt !== undefined) out.push({ t: plan.prompt.at, name: 'blip-up' });
    return out.sort((a, b) => a.t - b.t);
  }
}

interface RingGeometry {
  readonly cx: number;
  readonly cy: number;
  readonly rx: number;
  readonly ry: number;
}

/** Where Dad writes his word: right of the ring when it fits, else above it. */
function notePlace(plan: TablePlan, note: string, geo: RingGeometry): readonly [number, number] {
  const width = note.length * 16; // Dad's hand at size 3: about 16 px a letter
  if (geo.cx + geo.rx + 11 + width <= 624) return [geo.cx + geo.rx + 11, geo.cy - 44];
  return [Math.max(plan.cols.left, geo.cx - width / 2), geo.cy - geo.ry - 44];
}

/** One loop round the score that overshoots its start and spirals out a little (an egg). */
function pencilRing(
  cv: IndexCanvas,
  geo: RingGeometry,
  k0: number,
  seed: number,
  X: (x: number) => number,
  Y: (y: number) => number,
): void {
  const k = EASES.inOut(k0);
  if (k <= 0) return;
  const tilt = -0.045;
  const [a0, turns, n] = [2.6, 1.12, 72];
  const h1 = hash(seed, 1, 9) * 6.28;
  const h2 = hash(seed, 2, 9) * 6.28;
  const co = Math.cos(tilt);
  const si = Math.sin(tilt);
  let prev: readonly [number, number] | undefined;
  for (let i = 0; i <= Math.ceil(n * k); i += 1) {
    const u = i / n;
    const a = a0 + u * turns * Math.PI * 2;
    const wob = 1 + 0.045 * Math.sin(a * 2 + h1) + 0.03 * Math.sin(a * 3 + h2) + u * 0.085;
    const lx = Math.cos(a) * geo.rx * wob + u * 7;
    const ly = Math.sin(a) * geo.ry * wob - u * 4;
    const p = [X(geo.cx + lx * co - ly * si), Y(geo.cy + lx * si + ly * co)] as const;
    if (prev !== undefined) cv.line(prev[0], prev[1], p[0], p[1], C.WHITE, u < 0.07 ? 1 : 2);
    prev = p;
  }
  // the flick where the pen leaves the glass
  if (k >= 1 && prev !== undefined) cv.line(prev[0], prev[1], prev[0] + 7, prev[1] + 3, C.WHITE, 1);
}

/** A greasy thumbprint: ridge rings with a slight swirl lift the dark glass one step. */
function thumbprint(cv: IndexCanvas, cx: number, cy: number, k: number): void {
  const [rx, ry, angle] = [11 * k, 14 * k, 0.5];
  const co = Math.cos(angle);
  const si = Math.sin(angle);
  const reach = Math.ceil(16 * k);
  for (let y = Math.round(cy) - reach; y <= Math.round(cy) + reach; y += 1)
    for (let x = Math.round(cx) - reach; x <= Math.round(cx) + reach; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      const u = (dx * co + dy * si) / rx;
      const v = (-dx * si + dy * co) / ry;
      const d = Math.hypot(u, v);
      if (d >= 1) continue;
      const ridge = (d * 6.5 + 0.2 * Math.sin(Math.atan2(v, u) * 2)) % 1;
      if (ridge < 0.5 && dith(x, y, 0.95 - d * 0.5)) cv.remap(x, y, 1, 1, GHOST);
    }
}
