/**
 * Paper of the one notebook: a seeded fibre tile (sparse short fibres and specks, texture level,
 * never noise), the page stocks (blank cartridge with tooth, lined with a printed margin, graph)
 * with the spiral binding on the left, and the inserts' sheet fill, printed lines and drop shadows.
 * Stocks are painted once per size and cached (pure functions of name and size).
 */
import { HARD, INK, type Remap } from '../inks.js';
import { InkCanvas, roundBrush } from './canvas.js';
import { at, hash } from './math.js';
import {
  ellipsePts,
  pixelPath,
  quad,
  smoothPath,
  type Placement,
  type Pts,
  type Xform,
} from './paths.js';

export const STOCK_NAMES = ['cartridge', 'lined', 'graph'] as const;
export type StockName = (typeof STOCK_NAMES)[number];

const TILE = 1024;
let fibres: Uint8Array | undefined;

/** The fibre tile: 0 = paper, 1 = fibre, 2 = speck. */
function fibreTile(): Uint8Array {
  if (fibres) return fibres;
  const tile = new Uint8Array(TILE * TILE);
  for (let i = 0; i < 2700; i += 1) {
    let x = hash(i, 1) * TILE;
    let y = hash(i, 2) * TILE;
    let a = hash(i, 3) * Math.PI * 2;
    const length = 2.5 + hash(i, 4) * 5.5;
    const bend = (hash(i, 5) - 0.5) * 0.5;
    for (let s = 0; s < length; s += 0.7) {
      tile[(Math.round(y) & (TILE - 1)) * TILE + (Math.round(x) & (TILE - 1))] = 1;
      x += Math.cos(a) * 0.7;
      y += Math.sin(a) * 0.7;
      a += bend * 0.3;
    }
  }
  for (let i = 0; i < 380; i += 1) {
    tile[((hash(i, 8) * TILE) | 0) * TILE + ((hash(i, 9) * TILE) | 0)] = 2;
  }
  fibres = tile;
  return tile;
}

export function fibreAt(u: number, v: number): number {
  return fibreTile()[((v | 0) & (TILE - 1)) * TILE + ((u | 0) & (TILE - 1))] ?? 0;
}

/** x of the page edge at the spiral (page px); the desk shows left of it. */
export const PAGE_X = 16;

function base(canvas: InkCanvas, ox: number, oy: number, tooth: number): void {
  const tile = fibreTile();
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const f = tile[((y + oy) & (TILE - 1)) * TILE + ((x + ox) & (TILE - 1))];
      let c = INK.PAPER;
      if (f === 1) c = INK.FIBRE;
      else if (f === 2) c = INK.SHADE;
      else if (tooth > 0 && hash(x, y, 91) < tooth) c = INK.FIBRE;
      canvas.data[y * canvas.width + x] = c;
    }
  }
}

function spiral(canvas: InkCanvas, s: number): void {
  const edge = Math.round(PAGE_X * s);
  const { width, height, data } = canvas;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < edge; x += 1) data[y * width + x] = INK.DESK;
    data[y * width + edge] = INK.SHADE;
    if (hash(y, 3) < 0.5) data[y * width + edge + 1] = INK.FIBRE;
  }
  const coils = Math.ceil(height / (25.5 * s));
  for (let k = 0; k < coils; k += 1) {
    const yk = 9 + k * 25.5;
    const p = (pts: Pts): Pts => pts.map((value) => value * s);
    // Punched hole: the next page shows through.
    canvas.fillPoly(p(ellipsePts(33, yk, 4.5, 3.6, 14)), INK.SHADE);
    canvas.fillPoly(p(ellipsePts(33, yk + 1, 3.2, 2.2, 12)), INK.GRAPH_L);
    // Wire coil from the hole over the edge.
    const wire = smoothPath(
      p([35, yk + 1, 31, yk - 5, 21, yk - 9, 9, yk - 8, 0, yk - 3, -4, yk + 2]),
      null,
      1.5,
    );
    const shadow = pixelPath(
      wire.map((value, i) => value + (i % 2 === 1 ? 4 : 2) * s),
      false,
    );
    canvas.remapped(HARD, () => {
      for (let i = 0; i < shadow.length; i += 2)
        canvas.stamp(at(shadow, i), at(shadow, i + 1), roundBrush(2), 0);
    });
    const pix = pixelPath(wire, false);
    for (let i = 0; i < pix.length; i += 2)
      canvas.stamp(at(pix, i), at(pix, i + 1), roundBrush(3), INK.GRAPHITE);
    const glint = pixelPath(
      wire.map((value, i) => value - (i % 2 === 1 ? 1 : 0)),
      true,
    );
    for (let i = 2; i < glint.length - 2; i += 2)
      canvas.put(at(glint, i), at(glint, i + 1), INK.GRAPH_L);
    canvas.put(Math.round(19 * s), Math.round((yk - 9) * s), INK.PAPER);
  }
}

function lined(canvas: InkCanvas, s: number): void {
  const { width, height, data } = canvas;
  const pitch = 26 * s;
  for (let row = 92 * s; row < height; row += pitch) {
    const y = Math.round(row);
    for (let x = Math.round((PAGE_X + 2) * s); x < width; x += 1) {
      if (data[y * width + x] !== INK.SHADE || hash(x, y) < 0.5) data[y * width + x] = INK.RULE;
    }
  }
  const margin = Math.round(122 * s);
  for (let y = 0; y < height; y += 1) {
    data[y * width + margin] = INK.MARGIN;
    if (hash(y, 12) < 0.12) data[y * width + margin + 1] = INK.MARGIN;
  }
}

function graph(canvas: InkCanvas, s: number): void {
  const { width, height, data } = canvas;
  const pitch = Math.max(4, Math.round(12 * s));
  const x0 = Math.round(58 * s);
  const y0 = Math.round(12 * s);
  for (let y = 0; y < height; y += 1) {
    for (let x = Math.round((PAGE_X + 4) * s); x < width; x += 1) {
      const gx = (x - x0) % pitch === 0;
      const gy = (y - y0) % pitch === 0;
      if (!gx && !gy) continue;
      const major = (gx && ((x - x0) / pitch) % 5 === 0) || (gy && ((y - y0) / pitch) % 5 === 0);
      if (major || (x + y) % 2 === 0) data[y * width + x] = INK.GRID;
    }
  }
}

const stocks = new Map<string, Uint8Array>();

/** The stock painted at this size (scale = width / 960), cached. */
export function stock(name: StockName, width: number, height: number): Uint8Array {
  const key = `${name}:${String(width)}x${String(height)}`;
  const cached = stocks.get(key);
  if (cached) return cached;
  const page = new InkCanvas(width, height);
  const s = width / 960;
  if (name === 'cartridge') base(page, 311, 87, 0.006);
  else base(page, name === 'graph' ? 640 : 120, name === 'graph' ? 400 : 512, 0);
  if (name === 'lined') lined(page, s);
  if (name === 'graph') graph(page, s);
  spiral(page, s);
  stocks.set(key, page.data);
  return page.data;
}

/** A sheet of paper with its own fibres (inserts: index cards, calendars, envelopes). */
export function paintSheet(
  canvas: InkCanvas,
  place: Placement,
  toScreen: Xform,
  width: number,
  height: number,
  options: { readonly fill: number; readonly fibre: number; readonly fibreOffset: number },
): void {
  const xf: Xform = (u, v) => {
    const [x, y] = place.toPage(u, v);
    return toScreen(x, y);
  };
  const poly = quad(xf, width, height);
  // Inverse map screen -> local is affine: evaluate it at three pixels, then step.
  const local = (sx: number, sy: number): readonly [number, number] => {
    const [px, py] = invert(toScreen, sx, sy);
    return place.toLocal(px, py);
  };
  const o0 = local(0.5, 0.5);
  const ox = local(1.5, 0.5);
  const oy = local(0.5, 1.5);
  const ux = ox[0] - o0[0];
  const vx = ox[1] - o0[1];
  const uy = oy[0] - o0[0];
  const vy = oy[1] - o0[1];
  canvas.fillPoly(poly, (x, y) => {
    const u = o0[0] + ux * x + uy * y;
    const v = o0[1] + vx * x + vy * y;
    const f = fibreAt(u + options.fibreOffset, v + 200);
    return f === 0 ? options.fill : options.fibre;
  });
  canvas.outline(poly, INK.SHADE);
}

/** Inverse of a scale-only page->screen map (the page view has no rotation). */
function invert(toScreen: Xform, sx: number, sy: number): readonly [number, number] {
  const [ax, ay] = toScreen(0, 0);
  const [bx, by] = toScreen(1, 1);
  return [(sx - ax) / (bx - ax), (sy - ay) / (by - ay)];
}

/** A printed straight line in a sheet's local coordinates (no boil); `skip` thins it. */
export function printLine(
  canvas: InkCanvas,
  xf: Xform,
  from: readonly [number, number],
  to: readonly [number, number],
  color: number,
  skip = 0,
): void {
  canvas.line(
    [...xf(from[0], from[1]), ...xf(to[0], to[1])],
    color,
    (x, y) => skip > 0 && hash(x, y, 5) <= skip,
  );
}

/** The shadow of a w x h local box, offset in screen px. */
export function dropShadow(
  canvas: InkCanvas,
  xf: Xform,
  width: number,
  height: number,
  ox: number,
  oy: number,
  table: Remap = HARD,
): void {
  const poly = quad(xf, width, height).map((value, i) => value + (i % 2 === 1 ? oy : ox));
  canvas.remapped(table, () => {
    canvas.fillPoly(poly, 0);
  });
}
