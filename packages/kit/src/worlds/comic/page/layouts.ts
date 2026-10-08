/**
 * Panel layout presets of the Comic page (QUALITY.md §6: uneven gutters, panel size =
 * importance, never a perfect grid). Each preset is hand-ruled from a seed: gutter widths vary
 * 7-14 px, vertical gutters lean (top and bottom x differ), horizontal gutters tilt and never line
 * up across columns, every corner is nudged up to 1.5 px. Page coordinates 640x360.
 */
import { rndRange } from '../draw/math.js';
import { PAGE_HEIGHT, PAGE_WIDTH } from '../style.js';

export const LAYOUT_NAMES = [
  'splash',
  '2-up',
  'strip',
  '3-up-l',
  '4-grid',
  '4-l',
  'splash-inset',
] as const;

export type LayoutName = (typeof LAYOUT_NAMES)[number];

/** Four corners [x0, y0, ...] clockwise from the top left. */
export type Quad = [number, number, number, number, number, number, number, number];

export interface LayoutOptions {
  /** Split fractions of the preset (first = the main split); default per preset. */
  readonly weights?: readonly number[] | undefined;
  /** Mirror left-right (the big panel on the right). */
  readonly mirror?: boolean | undefined;
  /** Page margin in px (default 12-14, seeded). */
  readonly margin?: number | undefined;
  /** Mean gutter width in px (default 10). */
  readonly gutter?: number | undefined;
  readonly seed: number;
}

const DEFAULT_WEIGHTS: Readonly<Record<LayoutName, readonly number[]>> = {
  splash: [],
  '2-up': [0.58],
  strip: [0.31, 0.6],
  '3-up-l': [0.42, 0.44],
  '4-grid': [0.56, 0.47, 0.58],
  '4-l': [0.4, 0.4, 0.37],
  'splash-inset': [0.3, 0.38],
};

/** A leaning vertical gutter: its centre x at the top and at the bottom of a band. */
interface Gutter {
  readonly top: number;
  readonly bottom: number;
  readonly half: number;
}

function xAt(gutter: Gutter, y: number, y0: number, y1: number): number {
  return gutter.top + ((gutter.bottom - gutter.top) * (y - y0)) / (y1 - y0 || 1);
}

export function layoutQuads(name: LayoutName, options: LayoutOptions): Quad[] {
  const key = `layout:${name}:${String(options.seed)}`;
  const r = (i: number, min: number, max: number) => rndRange(key, i, min, max);
  const weights = options.weights ?? DEFAULT_WEIGHTS[name];
  const w = (i: number) => weights[i] ?? DEFAULT_WEIGHTS[name][i] ?? 0.5;
  const margin = options.margin ?? Math.round(r(1, 12, 14.9));
  const meanGutter = options.gutter ?? 10;
  const gutterWidth = (i: number) => Math.max(5, meanGutter + r(10 + i, -3, 4));
  const [L, T, R, B] = [margin, margin, PAGE_WIDTH - margin, PAGE_HEIGHT - margin];
  const vertical = (fraction: number, i: number, y0 = T, y1 = B): Gutter => {
    const x = L + (R - L) * fraction;
    const lean = r(20 + i, 2, 7) * (r(30 + i, 0, 1) < 0.5 ? -1 : 1) * ((y1 - y0) / (B - T));
    return { top: x + lean, bottom: x - lean, half: gutterWidth(i) / 2 };
  };
  const horizontal = (fraction: number, i: number) => ({
    y: T + (B - T) * fraction,
    tilt: r(40 + i, -3, 3),
    half: gutterWidth(5 + i) / 2,
  });
  const quads: Quad[] = [];
  /** Panel between vertical gutters (or page edges) a/b and rows y0..y1 (with tilts). */
  const cell = (
    a: Gutter | null,
    b: Gutter | null,
    top: { y: number; tilt: number },
    bottom: { y: number; tilt: number },
  ) => {
    const left = (y: number) => (a === null ? L : xAt(a, y, T, B) + a.half);
    const right = (y: number) => (b === null ? R : xAt(b, y, T, B) - b.half);
    const yTop0 = top.y - top.tilt / 2;
    const yTop1 = top.y + top.tilt / 2;
    const yBot1 = bottom.y + bottom.tilt / 2;
    const yBot0 = bottom.y - bottom.tilt / 2;
    quads.push([left(yTop0), yTop0, right(yTop1), yTop1, right(yBot1), yBot1, left(yBot0), yBot0]);
  };
  const pageTop = { y: T, tilt: 0 };
  const pageBottom = { y: B, tilt: 0 };
  const below = (h: { y: number; tilt: number; half: number }) => ({
    y: h.y + h.half,
    tilt: h.tilt,
  });
  const above = (h: { y: number; tilt: number; half: number }) => ({
    y: h.y - h.half,
    tilt: h.tilt,
  });
  switch (name) {
    case 'splash':
      cell(null, null, pageTop, pageBottom);
      break;
    case '2-up': {
      const g = vertical(w(0), 0);
      cell(null, g, pageTop, pageBottom);
      cell(g, null, pageTop, pageBottom);
      break;
    }
    case 'strip': {
      const g1 = vertical(w(0), 0);
      const lean = -Math.sign(g1.top - g1.bottom) * r(21, 3, 7);
      const x2 = L + (R - L) * w(1);
      const g2 = { top: x2 + lean, bottom: x2 - lean, half: gutterWidth(1) / 2 };
      cell(null, g1, pageTop, pageBottom);
      cell(g1, g2, pageTop, pageBottom);
      cell(g2, null, pageTop, pageBottom);
      break;
    }
    case '3-up-l': {
      const g = vertical(w(0), 0);
      const h = horizontal(w(1), 0);
      cell(null, g, pageTop, pageBottom);
      cell(g, null, pageTop, above(h));
      cell(g, null, below(h), pageBottom);
      break;
    }
    case '4-grid': {
      const g = vertical(w(0), 0);
      const hl = horizontal(w(1), 0);
      // The right column's gutter never lines up with the left one.
      const offset = Math.abs(w(2) - w(1)) < 0.06 ? w(1) + 0.1 : w(2);
      const hr = horizontal(offset, 1);
      cell(null, g, pageTop, above(hl));
      cell(g, null, pageTop, above(hr));
      cell(null, g, below(hl), pageBottom);
      cell(g, null, below(hr), pageBottom);
      break;
    }
    case '4-l': {
      const g = vertical(w(0), 0);
      const h = horizontal(w(1), 0);
      const x2 = g.top + (R - g.top) * w(2);
      const g2 = { top: x2 + r(22, -2, 2), bottom: x2 + r(23, -2, 2), half: gutterWidth(2) / 2 };
      cell(null, g, pageTop, pageBottom);
      cell(g, null, pageTop, above(h));
      cell(g, g2, below(h), pageBottom);
      cell(g2, null, below(h), pageBottom);
      break;
    }
    case 'splash-inset': {
      cell(null, null, pageTop, pageBottom);
      // The inset sits low in a corner and breaks the page border by a few px.
      const iw = (R - L) * w(0);
      const ih = (B - T) * w(1);
      const x1 = R + r(50, 3, 6);
      const y1 = B + r(51, 2, 5);
      quads.push([
        x1 - iw,
        y1 - ih,
        x1,
        y1 - ih + r(52, -2, 2),
        x1,
        y1,
        x1 - iw + r(53, -2, 2),
        y1,
      ]);
      break;
    }
  }
  return quads.map((quad, index) => jitter(quad, `${key}:${String(index)}`, options.mirror));
}

/** Corners nudged up to 1.5 px (ruled by hand), optionally mirrored left-right. */
function jitter(quad: Quad, key: string, mirror = false): Quad {
  const out = quad.map((value, i) =>
    Math.round(value + rndRange(key, i, -1.5, 1.5)),
  ) as unknown as Quad;
  if (!mirror) return out;
  const [x0, y0, x1, y1, x2, y2, x3, y3] = out;
  const m = (x: number) => PAGE_WIDTH - x;
  return [m(x1), y1, m(x0), y0, m(x3), y3, m(x2), y2];
}
