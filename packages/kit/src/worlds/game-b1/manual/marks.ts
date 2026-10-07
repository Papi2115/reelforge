/**
 * Dad's marks on the manual page, the only things that depend on t: grainy pencil ticks beside
 * the rules as the narrator reaches them (short stroke down, long stroke up, each a different
 * size and lean), a pencil note in the margin, and the one red felt-tip correction: the pen
 * touches down, strikes the printed word in one firm stroke, a beat, writes his word above it
 * and loops a loose circle round it that overshoots its start. Crimson only here (the point).
 */
import type { IndexCanvas } from '../core/canvas.js';
import { hand, handStroke } from '../core/hand.js';
import { clamp01, EASES, hash } from '../core/math.js';
import { C } from '../palette.js';
import { correctionRadius, type ManualPlan } from './manual-plan.js';
import type { PageMarks } from './page.js';

/** Grainy graphite, 2 px, a few pixels skip where the paper's tooth catches. */
function pencil(
  cv: IndexCanvas,
  a: readonly [number, number],
  b: readonly [number, number],
  k: number,
  seed: number,
) {
  if (k <= 0) return;
  const [x0, y0] = a;
  const [x1, y1] = b;
  const bow = (hash(seed, 1, 1) - 0.5) * 2.4;
  const len = Math.hypot(x1 - x0, y1 - y0) || 1;
  const nx = -(y1 - y0) / len;
  const ny = (x1 - x0) / len;
  for (let i = 0; i <= len * 2 * k; i += 1) {
    const f = i / (len * 2);
    const bend = Math.sin(f * Math.PI) * bow;
    const x = Math.round(x0 + (x1 - x0) * f + nx * bend);
    const y = Math.round(y0 + (y1 - y0) * f + ny * bend);
    for (let q = 0; q < 2; q += 1) {
      const h = hash(seed, x * 7 + q, y);
      if (h >= 0.18) cv.px(x + q, y, h < 0.42 ? C.GREY : C.GREY_D);
    }
  }
}

function tick(cv: IndexCanvas, plan: ManualPlan, marks: PageMarks, i: number, t: number): void {
  const t0 = plan.ticks[i];
  const at = marks.ticks[i];
  if (t0 === undefined || at === undefined) return;
  const seed = plan.seed;
  const k = clamp01((t - t0) / (0.17 + hash(seed, i, 30) * 0.09));
  if (k <= 0) return;
  const size = 0.85 + hash(seed, i, 32) * 0.35;
  const [cx, cy] = at;
  const a = [cx - 6 * size, cy - 2 * size] as const;
  const b = [cx - 1, cy + 4 * size] as const;
  const e = [cx + 8 * size, cy - (10 + hash(seed, i, 33) * 4) * size] as const;
  pencil(cv, a, b, clamp01(k / 0.3), seed + i * 3);
  pencil(cv, b, e, clamp01((k - 0.3) / 0.7), seed + i * 3 + 1);
}

function correction(cv: IndexCanvas, plan: ManualPlan, marks: PageMarks, t: number): void {
  const c = plan.correction;
  const bad = marks.strike;
  if (c === undefined || bad === undefined || t < c.at) return;
  const seed = plan.seed;
  const a = [bad.x0 - 5, bad.y + 8] as const;
  const b = [bad.x1 + 5, bad.y + 5] as const;
  const strike = c.at + 0.15;
  const write = c.at + 0.58;
  const circle = c.at + 1.13;
  if (t < strike) {
    cv.rect(a[0] - 1, a[1] - 1, 3, 3, C.CRIMSON);
    return;
  }
  handStroke(cv, a, b, {
    colour: C.CRIMSON,
    seed: seed + 70,
    bow: 2,
    brush: 3,
    reveal: EASES.out(clamp01((t - strike) / 0.14)),
  });
  if (t < write) return;
  // above the struck word, or after the end of its line when the line above is in the way
  const [x, y] = c.place === 'above' ? [bad.x0 - 7, bad.y - 23] : [bad.end + 12, bad.endY - 4];
  hand(cv, c.write, {
    x,
    y,
    size: 3,
    angle: -0.06,
    seed: seed + 72,
    colour: C.CRIMSON,
    slant: 0.24,
    brush: 3,
    reveal: clamp01((t - write) / 0.45),
  });
  const kr = clamp01((t - circle) / 0.3);
  if (kr <= 0) return;
  const rx = correctionRadius(c.write);
  const cc = [x + c.write.length * 8 - 2, y + 9] as const;
  const n = 40;
  const turn = Math.PI * 2 * 1.14;
  let prev: readonly [number, number] | undefined;
  for (let i = 0; i <= Math.floor(n * EASES.inOut(kr)); i += 1) {
    const f = i / n;
    const ang = 2.6 + f * turn;
    const wob = 1 + (hash(seed + 75, i >> 2, 1) - 0.5) * 0.08 + f * 0.07;
    const p = [cc[0] + Math.cos(ang) * rx * wob, cc[1] + Math.sin(ang - 0.08) * 16 * wob] as const;
    if (prev !== undefined) cv.line(prev[0], prev[1], p[0], p[1], C.CRIMSON, 3);
    prev = p;
  }
}

function note(cv: IndexCanvas, plan: ManualPlan, t: number): void {
  const n = plan.note;
  if (n === undefined || t < n.at) return;
  hand(cv, n.text, {
    x: 36,
    y: 276,
    size: 2.2,
    angle: -0.04,
    seed: plan.seed + 90,
    colour: C.GREY_D,
    slant: 0.2,
    brush: 2,
    reveal: clamp01((t - n.at) / (0.12 * n.text.length + 0.2)),
  });
}

/** Every mark of the page at t, drawn on `cv` (a copy of the printed page). */
export function drawMarks(cv: IndexCanvas, plan: ManualPlan, marks: PageMarks, t: number): void {
  for (let i = 0; i < plan.ticks.length; i += 1) tick(cv, plan, marks, i, t);
  note(cv, plan, t);
  correction(cv, plan, marks, t);
}

/** Sound cues of the marks (pencil and felt-tip). */
export function markCues(plan: ManualPlan): { t: number; name: string }[] {
  const out = plan.ticks.map((t) => ({ t, name: 'scribble' }));
  if (plan.note !== undefined) out.push({ t: plan.note.at, name: 'scribble' });
  if (plan.correction !== undefined) out.push({ t: plan.correction.at + 0.15, name: 'scribble' });
  return out;
}
