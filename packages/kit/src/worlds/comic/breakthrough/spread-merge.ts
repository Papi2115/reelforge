/**
 * The merge of a double-page spread (showcase shot 9): the picture starts as 2-4 panels, each a
 * few px out of register, with gutters, borders and a margin. The gutters close on their own
 * beats (horizontal first, so no sliver of paper floats), each panel slides into register as the
 * gutters beside it close, the borders thin 2 -> 1 -> 0 and the margin slides off the edges.
 * Page coordinates; everything is a function of the merge time.
 */
import { INK } from '../inks.js';
import type { ComicCanvas } from '../draw/canvas.js';
import { lerp, rndRange, seg } from '../draw/math.js';
import { boil } from '../draw/shapes.js';
import type { Place } from '../draw/place.js';
import type { PageSize } from '../style.js';

/** A gutter line: vertical (x at the top and bottom of [y0, y1]) or horizontal (y at x0, x1). */
interface Line {
  readonly kind: 'v' | 'h';
  readonly a: number;
  readonly b: number;
  /** The span it crosses (y for vertical, x for horizontal lines; -1 = the whole page). */
  readonly from: number;
  readonly to: number;
  readonly width: number;
  /** Closing window as shares of the merge. */
  readonly close: readonly [number, number];
}

export interface MergeGeometry {
  readonly lines: readonly Line[];
  /** Panel of a page point. */
  piece(x: number, y: number): number;
  /** Lines each panel borders. */
  readonly borders: readonly (readonly number[])[];
  readonly offsets: readonly (readonly [number, number])[];
  /** The page it is ruled on. */
  readonly page: PageSize;
}

function vx(line: Line, y: number, H: number): number {
  return lerp(line.a, line.b, y / H);
}

function hy(line: Line, x: number): number {
  return lerp(line.a, line.b, (x - line.from) / (line.to - line.from || 1));
}

export function mergeGeometry(
  pieces: 'grid' | 'columns' | 'halves',
  fold: number,
  key: string,
  page: PageSize,
): MergeGeometry {
  const { width: W, height: H } = page;
  const r = (i: number, min: number, max: number) => rndRange(key, i, min, max);
  const lean = (i: number) => r(i, 2, 4) * (r(i + 1, 0, 1) < 0.5 ? -1 : 1);
  const vertical = (
    x: number,
    i: number,
    width: number,
    close: readonly [number, number],
  ): Line => {
    const d = lean(i);
    return { kind: 'v', a: x + d, b: x - d, from: -1, to: -1, width, close };
  };
  const offsets = [0, 1, 2, 3].map((i): [number, number] => [
    Math.round(r(20 + i, 4, 11) * (i % 2 === 0 ? -1 : 1)),
    Math.round(r(30 + i, 3, 7) * (i % 3 === 0 ? 1 : -1)),
  ]);
  if (pieces === 'columns') {
    const v1 = vertical(W * r(40, 0.31, 0.36), 50, 11, [0, 0.72]);
    const v2 = vertical(W * r(41, 0.64, 0.69), 52, 9, [0.2, 1]);
    return {
      lines: [v1, v2],
      piece: (x, y) => (x < vx(v1, y, H) ? 0 : x < vx(v2, y, H) ? 1 : 2),
      borders: [[0], [0, 1], [1]],
      offsets,
      page,
    };
  }
  const v1 =
    pieces === 'halves'
      ? vertical(fold, 60, 12, [0.1, 0.9])
      : vertical(W * r(42, 0.3, 0.34), 60, 11, [0.07, 0.71]);
  const v2 = vertical(W * r(43, 0.61, 0.66), 62, 9, [0.19, 0.89]);
  const left = pieces === 'halves' ? fold : 0;
  const right = pieces === 'halves' ? W : 0;
  const yh = H * r(44, pieces === 'halves' ? 0.5 : 0.3, pieces === 'halves' ? 0.6 : 0.34);
  const tilt = r(45, -3, 3);
  const h: Line = {
    kind: 'h',
    a: yh - tilt,
    b: yh + tilt,
    from: pieces === 'halves' ? left : vx(v1, yh, H),
    to: pieces === 'halves' ? right : vx(v2, yh, H),
    width: 10,
    close: [0, 0.46],
  };
  if (pieces === 'halves') {
    return {
      lines: [h, v1],
      piece: (x, y) => (x < vx(v1, y, H) ? 0 : y < hy(h, x) ? 1 : 2),
      borders: [[1], [0, 1], [0, 1]],
      offsets,
      page,
    };
  }
  return {
    lines: [h, v1, v2],
    piece: (x, y) => (x < vx(v1, y, H) ? 0 : x >= vx(v2, y, H) ? 3 : y < hy(h, x) ? 1 : 2),
    borders: [[1], [0, 1, 2], [0, 1, 2], [2]],
    offsets,
    page,
  };
}

export interface MergeFrame {
  readonly canvas: ComicCanvas;
  readonly page: Place;
  /** Merge progress per share of the merge window (0..1). */
  readonly q: number;
  /** Eased overall progress. */
  readonly m: number;
  readonly scratch: Uint8Array;
  readonly key: string;
  readonly boilFrame: number;
  /** Paints newsprint (paper + fibres) wherever the current clip allows. */
  paper(): void;
}

/** Shifts each panel's pixels out of register, then cuts margin and gutters back to paper. */
export function drawMergeFurniture(geometry: MergeGeometry, frame: MergeFrame): void {
  const { canvas, page, q, m } = frame;
  const closed = geometry.lines.map((line) => seg(q, line.close[0], line.close[1], 'inOutCubic'));
  const reg = geometry.borders.map((lines) => Math.min(...lines.map((i) => closed[i] ?? 1)));
  const shift = geometry.offsets.map(([dx, dy], i) => {
    const k = 1 - (reg[i] ?? 1);
    return [Math.round(dx * k), Math.round(dy * k)] as const;
  });
  const { data, width: cw, height: ch } = canvas;
  const saved = frame.scratch;
  saved.set(data);
  const toPage = (sx: number, sy: number) =>
    [(sx - page.ox) / page.s, (sy - page.oy) / page.s] as const;
  for (let y = 0; y < ch; y += 1) {
    for (let x = 0; x < cw; x += 1) {
      const [px, py] = toPage(x, y);
      const [dx, dy] = shift[geometry.piece(px, py)] ?? [0, 0];
      if (dx === 0 && dy === 0) continue;
      const sx = Math.min(cw - 1, Math.max(0, x - dx));
      const sy = Math.min(ch - 1, Math.max(0, y - dy));
      data[y * cw + x] = saved[sy * cw + sx] ?? 0;
    }
  }
  const margin = Math.round(lerp(14, -3, m));
  const gutters = geometry.lines
    .map((line, i) => ({ line, g: line.width * (1 - (closed[i] ?? 1)) }))
    .filter(({ g }) => g > 1.2);
  const { width: W, height: H } = geometry.page;
  const [x0, y0, x1, y1] = [margin, margin, W - margin, H - margin];
  const band = (line: Line, g: number): number[] =>
    line.kind === 'v'
      ? [line.a - g / 2, y0, line.a + g / 2, y0, line.b + g / 2, y1, line.b - g / 2, y1]
      : [
          line.from,
          line.a - g / 2,
          line.to,
          line.b - g / 2,
          line.to,
          line.b + g / 2,
          line.from,
          line.a + g / 2,
        ];
  const keep = canvas.maskPoly(page.map([x0, y0, x1, y0, x1, y1, x0, y1]));
  const cuts = gutters.map(({ line, g }) => canvas.maskPoly(page.map(band(line, g))));
  try {
    for (let i = 0; i < keep.length; i += 1) {
      const cut = cuts.some((mask) => mask[i] === 1);
      keep[i] = keep[i] === 1 && !cut ? 0 : 1;
    }
    canvas.withClip(keep, () => {
      canvas.rect(0, 0, cw, ch, INK.PAPER);
      frame.paper();
    });
  } finally {
    canvas.release(keep);
    for (const mask of cuts) canvas.release(mask);
  }
  const border = m < 0.55 ? 2 : m < 0.85 ? 1 : 0;
  if (border > 0) {
    const frameLine = boil(
      page.map([x0, y0, x1, y0, x1, y1, x0, y1]),
      `${frame.key}frame`,
      0.4,
      frame.boilFrame,
    );
    canvas.polyline(frameLine, INK.INK, border, true);
  }
  for (const { line, g } of gutters) {
    const w = g > 3 ? 2 : 1;
    const pts = band(line, g);
    const edge = (i: number, j: number) => {
      canvas.line(
        page.x(pts[i] ?? 0),
        page.y(pts[i + 1] ?? 0),
        page.x(pts[j] ?? 0),
        page.y(pts[j + 1] ?? 0),
        INK.INK,
        w,
      );
    };
    if (line.kind === 'v') {
      edge(0, 6);
      edge(2, 4);
    } else {
      edge(0, 2);
      edge(6, 4);
    }
  }
}
