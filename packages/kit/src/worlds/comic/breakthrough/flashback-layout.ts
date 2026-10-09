/**
 * Where a flashback's beats sit (page px): letterboxed rows stacked down the page with uneven
 * indents (showcase shot 3), a newspaper row of narrow panels with leaning gutters, a stair that
 * steps down in reading order, or a pile of old clippings at angles. All hand-ruled from a seed,
 * never a grid; panel size follows the beat's weight. Also the torn edge of a pasted strip.
 */
import { lerp, rndRange } from '../draw/math.js';
import { rotPts } from '../draw/shapes.js';
import type { Quad } from '../page/layouts.js';
import { isPortraitPage, LANDSCAPE_PAGE, type PageSize } from '../style.js';
import type { Box, FlashbackArrange } from './flashback-schema.js';

const GUTTER = 12;

/**
 * Default box per arrangement: the whole page for a page flashback, a band for a strip. On a
 * portrait page (360x640) the boxes keep to the safe middle of the frame (PLAN.md#13.18).
 */
export function defaultBox(
  arrange: FlashbackArrange,
  cover: 'page' | 'strip',
  page: PageSize = LANDSCAPE_PAGE,
): Box {
  const portrait = isPortraitPage(page);
  if (cover === 'page') return portrait ? [22, 64, 338, 540] : [26, 30, 614, 344];
  const boxes: Readonly<Record<FlashbackArrange, Box>> = portrait
    ? {
        rows: [30, 84, 330, 500],
        row: [20, 190, 340, 420],
        stair: [26, 80, 334, 500],
        pile: [26, 130, 334, 470],
      }
    : {
        rows: [178, 34, 470, 330],
        row: [40, 104, 600, 262],
        stair: [48, 44, 592, 318],
        pile: [44, 70, 598, 300],
      };
  return boxes[arrange];
}

function rect(x0: number, y0: number, x1: number, y1: number): Quad {
  return [x0, y0, x1, y0, x1, y1, x0, y1];
}

/** Every corner nudged up to `amp` px (ruled by hand). */
function nudge(quad: Quad, key: string, amp: number): Quad {
  return quad.map((value, i) => Math.round(value + rndRange(key, i, -amp, amp))) as Quad;
}

function shares(weights: readonly number[], total: number): number[] {
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  return weights.map((weight) => (weight / sum) * total);
}

function rows(box: Box, weights: readonly number[], key: string): Quad[] {
  const [x0, y0, x1, y1] = box;
  const heights = shares(weights, y1 - y0 - GUTTER * (weights.length - 1));
  let y = y0;
  return heights.map((h, i) => {
    // Indents alternate sides and differ in size, so the rows never line up like a table.
    const big = rndRange(key, i, 14, 34);
    const small = rndRange(key, i + 10, 0, 6);
    const [left, right] = i % 2 === 0 ? [small, big] : [big, small];
    const quad = rect(x0 + left, y, x1 - right, y + h);
    y += h + GUTTER;
    return nudge(quad, `${key}r${String(i)}`, 2);
  });
}

function row(box: Box, weights: readonly number[], key: string): Quad[] {
  const [x0, y0, x1, y1] = box;
  const widths = shares(weights, x1 - x0 - GUTTER * (weights.length - 1));
  let x = x0;
  const leans = widths.map((_, i) => rndRange(key, 20 + i, -5, 5));
  return widths.map((w, i) => {
    const leanL = i === 0 ? 0 : (leans[i - 1] ?? 0);
    const leanR = i === widths.length - 1 ? 0 : (leans[i] ?? 0);
    const top = y0 + rndRange(key, 30 + i, -4, 6);
    const bottom = y1 + rndRange(key, 40 + i, -6, 4);
    const quad: Quad = [
      x + leanL,
      top,
      x + w + leanR,
      top,
      x + w - leanR,
      bottom,
      x - leanL,
      bottom,
    ];
    x += w + GUTTER;
    return nudge(quad, `${key}c${String(i)}`, 1.5);
  });
}

function stair(box: Box, weights: readonly number[], key: string): Quad[] {
  const [x0, y0, x1, y1] = box;
  const n = weights.length;
  const mean = weights.reduce((a, b) => a + b, 0) / n;
  return weights.map((weight, i) => {
    const k = Math.sqrt(weight / mean);
    const pw = Math.min(x1 - x0, ((x1 - x0) / Math.max(1.6, n * 0.72)) * k);
    const ph = Math.min(y1 - y0, (y1 - y0) * (n === 1 ? 1 : 0.56) * k);
    const u = n === 1 ? 0.5 : i / (n - 1);
    const x = lerp(x0, x1 - pw, u) + rndRange(key, 50 + i, -6, 6);
    const y = lerp(y0, y1 - ph, u) + rndRange(key, 60 + i, -5, 5);
    return nudge(rect(x, y, x + pw, y + ph), `${key}s${String(i)}`, 2);
  });
}

function pile(box: Box, weights: readonly number[], key: string): Quad[] {
  const [x0, y0, x1, y1] = box;
  const n = weights.length;
  const mean = weights.reduce((a, b) => a + b, 0) / n;
  const slot = (x1 - x0) / n;
  return weights.map((weight, i) => {
    const k = Math.sqrt(weight / mean);
    const w = Math.min(x1 - x0, slot * (n === 1 ? 0.8 : 1.22) * k);
    const h = Math.min(y1 - y0, (y1 - y0) * 0.7 * k);
    const cx = x0 + slot * (i + 0.5) + rndRange(key, 70 + i, -8, 8);
    const cy =
      (y0 + y1) / 2 + (i % 2 === 0 ? -1 : 1) * (y1 - y0) * rndRange(key, 80 + i, 0.06, 0.14);
    const deg = (i % 2 === 0 ? -1 : 1) * rndRange(key, 90 + i, 1.5, 5);
    const quad = rotPts(
      rect(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2),
      cx,
      cy,
      (deg * Math.PI) / 180,
    );
    return nudge(quad as Quad, `${key}p${String(i)}`, 1);
  });
}

/** The beats' panels at rest, before the strip's tilt and motion. */
export function beatQuads(
  arrange: FlashbackArrange,
  box: Box,
  weights: readonly number[],
  key: string,
): Quad[] {
  const layout = { rows, row, stair, pile }[arrange];
  return layout(box, weights, key);
}

/** A torn sheet edge around `box` (padded): uneven notches, fibres pulled at the corners. */
export function tornSheet(box: Box, pad: number, key: string): number[] {
  const [x0, y0, x1, y1] = [box[0] - pad, box[1] - pad, box[2] + pad, box[3] + pad];
  const pts: number[] = [];
  const edge = (
    ax: number,
    ay: number,
    bx: number,
    by: number,
    nx: number,
    ny: number,
    base: number,
  ) => {
    const length = Math.hypot(bx - ax, by - ay);
    let s = 0;
    for (let i = 0; s < length; i += 1) {
      const d = rndRange(key, base + i, -3.2, 2.2) + (i % 3 === 0 ? -1.5 : 0);
      pts.push(lerp(ax, bx, s / length) + nx * d, lerp(ay, by, s / length) + ny * d);
      s += rndRange(key, base + 500 + i, 4, 10);
    }
  };
  edge(x0, y0, x1, y0, 0, 1, 0);
  edge(x1, y0, x1, y1, -1, 0, 1000);
  edge(x1, y1, x0, y1, 0, -1, 2000);
  edge(x0, y1, x0, y0, 1, 0, 3000);
  return pts;
}
