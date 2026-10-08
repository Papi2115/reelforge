/**
 * The manual page as a paper layer over the frame (the showcase's trans.js page slide and page
 * turn): it slides in from below over whatever the frame shows (a peek, a held beat, the slide,
 * an overshoot, the settle; tilted, with a cast shadow), and / or turns away from its
 * bottom-right corner (the flap shows the paper's back with the print through it, the fold casts
 * a shadow on what is under it). It reports which part of each row it covers, so the HUD prints
 * in paper ink there.
 */
import { IndexCanvas, quad } from '../core/canvas.js';
import { dith } from '../core/canvas.js';
import { EASES, lerp } from '../core/math.js';
import { C, DARK, SCAN } from '../palette.js';
import type { Cover, PaperLayer } from '../screen/model.js';
import { drawMarks, markCues } from './marks.js';
import { SLIDE, TURN, type ManualPlan } from './manual-plan.js';
import { buildPage, type Page } from './page.js';

const W = 640;
const H = 360;
const FULL: Cover = () => [0, W];

/** Peek (anticipation) -> hold -> slide -> overshoot -> settle; u = seconds into the slide. */
export function slidePose(u: number): { oy: number; angle: number } {
  if (u < 0.14) return { oy: lerp(390, 332, EASES.out(u / 0.14)), angle: 0.07 };
  if (u < 0.22) return { oy: 332, angle: 0.07 };
  if (u < 0.56) {
    const e = EASES.inOut((u - 0.22) / 0.34);
    return { oy: lerp(332, -10, e), angle: lerp(0.07, -0.012, e) };
  }
  if (u < 0.68) {
    const e = EASES.out((u - 0.56) / 0.12);
    return { oy: lerp(-10, 0, e), angle: lerp(-0.012, 0, e) };
  }
  return { oy: 0, angle: 0 };
}

/** The x of the fold in row y at turn progress k (0 < k < 1): paper left of it. */
export function foldAt(k: number, y: number): number {
  const e = EASES.inOut(k);
  const lead = 90 * Math.sin(Math.PI * k);
  return Math.round(W * (1 - e) - (y / H) * lead);
}

export class ManualLayer implements PaperLayer {
  private page: Page | undefined;
  private readonly sheet = new IndexCanvas(W, H);
  private readonly spans = new Int16Array(H * 2);

  constructor(readonly plan: ManualPlan) {}

  cues(): { t: number; name: string }[] {
    const plan = this.plan;
    return [
      ...(plan.enter === 'slide' ? [{ t: plan.at + 0.22, name: 'swoosh-in' }] : []),
      ...markCues(plan),
      ...(plan.exit === 'turn' ? [{ t: plan.until - TURN, name: 'paper' }] : []),
    ].sort((a, b) => a.t - b.t);
  }

  paint(frame: IndexCanvas, t: number): Cover | undefined {
    const plan = this.plan;
    if (t < plan.at || t >= plan.until) return undefined;
    this.page ??= buildPage(plan);
    const page = this.page;
    const u = t - plan.at;
    const turnAt = plan.exit === 'turn' ? plan.until - TURN : Number.POSITIVE_INFINITY;
    const sliding = plan.enter === 'slide' && u < SLIDE;
    frame.clip();
    if (!sliding && t < turnAt) {
      frame.d.set(page.pixels);
      drawMarks(frame, plan, page.marks, t);
      return FULL;
    }
    this.sheet.d.set(page.pixels);
    drawMarks(this.sheet, plan, page.marks, t);
    return sliding ? this.slide(frame, u) : this.turn(frame, (t - turnAt) / TURN);
  }

  private slide(frame: IndexCanvas, u: number): Cover | undefined {
    const { oy, angle } = slidePose(u);
    if (oy >= 380) return undefined;
    frame.poly(quad(W / 2 + 7, H / 2 + oy + 9, W, H, angle), 0, SCAN);
    const co = Math.cos(-angle);
    const si = Math.sin(-angle);
    const src = this.sheet.d;
    const spans = this.spans;
    const shift = Math.round(oy);
    for (let y = 0; y < H; y += 1) {
      const ry = y + 0.5 - (H / 2 + shift);
      let first = W;
      let last = -1;
      for (let x = 0; x < W; x += 1) {
        const rx = x + 0.5 - W / 2;
        const sx = Math.floor(rx * co - ry * si + W / 2);
        const sy = Math.floor(rx * si + ry * co + H / 2);
        if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
        frame.d[y * W + x] = src[sy * W + sx] ?? C.CREAM;
        first = Math.min(first, x);
        last = x;
      }
      spans[y * 2] = first;
      spans[y * 2 + 1] = last + 1;
    }
    return (y) => [spans[y * 2] ?? 0, spans[y * 2 + 1] ?? 0];
  }

  private turn(frame: IndexCanvas, k: number): Cover | undefined {
    if (k >= 1) return undefined;
    const page = this.sheet.d;
    const out = frame.d;
    const spans = this.spans;
    for (let y = 0; y < H; y += 1) {
      const p = foldAt(k, y);
      const flap = Math.round((W - p) * 0.55);
      const o = y * W;
      for (let x = 0; x < Math.min(W, p); x += 1) {
        if (x < p - flap) {
          out[o + x] = page[o + x] ?? C.CREAM;
          continue;
        }
        const mx = 2 * p - x;
        const v = mx < W ? (page[o + mx] ?? C.CREAM) : C.CREAM;
        const edge = x === p - flap || x === p - 1;
        const through = (DARK[v] === 1 || v === C.RUST || v === C.TEAK) && dith(x, y, 0.5);
        out[o + x] = edge ? C.WALNUT_D : through || x > p - 7 ? C.TAN : C.CREAM;
      }
      for (let x = Math.max(0, p); x < Math.min(W, p + 10); x += 1)
        if (x < p + 4 || dith(x, y, 0.5)) out[o + x] = SCAN[out[o + x] ?? 0] ?? 0;
      spans[y * 2] = 0;
      spans[y * 2 + 1] = Math.max(0, Math.min(W, p));
    }
    return (y) => [spans[y * 2] ?? 0, spans[y * 2 + 1] ?? 0];
  }
}
