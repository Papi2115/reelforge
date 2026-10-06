/**
 * The index framebuffer of a Sketchbook page: one palette index per pixel, written through three
 * modes (normal, under-ink = only over paper-like pixels, remap = shade what is underneath with a
 * table). Scanline polygons, brush stamps and pixel paths are integer-exact, so a frame is a pure
 * function of what is drawn and bit-identical everywhere.
 */
import { PAPERLIKE, type Remap } from '../inks.js';
import { at } from './math.js';
import { pixelPath, type Pts } from './paths.js';

/** Colour of a fill: a palette index, or a function of the pixel (-1 = leave it). */
export type FillColor = number | ((x: number, y: number) => number);

/** Brush: flat [dx, dy, dx, dy, ...] offsets. */
export type Brush = readonly number[];

const brushCache = new Map<string, Brush>();

/** Round nib of width w (pixels). */
export function roundBrush(width: number): Brush {
  const key = `r${String(width)}`;
  const cached = brushCache.get(key);
  if (cached) return cached;
  const out: number[] = [];
  const centre = (width - 1) / 2;
  const half = Math.floor(width / 2);
  for (let j = 0; j < width; j += 1) {
    for (let i = 0; i < width; i += 1) {
      if ((i - centre) ** 2 + (j - centre) ** 2 <= (width / 2) ** 2 + 0.25)
        out.push(i - half, j - half);
    }
  }
  brushCache.set(key, out);
  return out;
}

/** Chisel nib: a `len` long, `thick` wide bar at `deg`. */
export function chiselBrush(len: number, deg: number, thick: number): Brush {
  const key = `c${String(len)},${String(deg)},${String(thick)}`;
  const cached = brushCache.get(key);
  if (cached) return cached;
  const angle = (deg * Math.PI) / 180;
  const seen = new Set<string>();
  const out: number[] = [];
  for (let s = -len / 2; s <= len / 2; s += 0.5) {
    for (let k = 0; k < thick; k += 1) {
      const across = k - (thick - 1) / 2;
      const x = Math.round(Math.cos(angle) * s - Math.sin(angle) * across);
      const y = Math.round(Math.sin(angle) * s + Math.cos(angle) * across);
      const id = `${String(x)},${String(y)}`;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(x, y);
    }
  }
  brushCache.set(key, out);
  return out;
}

export class InkCanvas {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
  private mode: 0 | 1 | 2 = 0;
  private map: Remap | undefined;
  private keep: ((x: number, y: number) => boolean) | undefined;
  private readonly crossings: number[] = [];

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Uint8Array(width * height);
  }

  /** Writes inside `draw` only touch paper-like pixels (highlighter, soft fills). */
  underInk(draw: () => void): void {
    this.withMode(1, undefined, draw);
  }

  /** Writes inside `draw` remap the pixel underneath through `table` (shadows, tape). */
  remapped(table: Remap, draw: () => void): void {
    this.withMode(2, table, draw);
  }

  /** Writes inside `draw` land only where `keep(x, y)` (ink blooming in, pixel by pixel). */
  sieve(keep: (x: number, y: number) => boolean, draw: () => void): void {
    const previous = this.keep;
    this.keep = keep;
    try {
      draw();
    } finally {
      this.keep = previous;
    }
  }

  private withMode(mode: 0 | 1 | 2, map: Remap | undefined, draw: () => void): void {
    const previous = [this.mode, this.map] as const;
    this.mode = mode;
    this.map = map;
    try {
      draw();
    } finally {
      [this.mode, this.map] = previous;
    }
  }

  put(x: number, y: number, color: number): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    if (this.keep && !this.keep(x, y)) return;
    const index = y * this.width + x;
    const current = this.data[index] ?? 0;
    if (this.mode === 0) this.data[index] = color;
    else if (this.mode === 1) {
      if (PAPERLIKE[current] === 1) this.data[index] = color;
    } else this.data[index] = this.map?.[current] ?? current;
  }

  fillRect(x0: number, y0: number, x1: number, y1: number, color: number): void {
    const xa = Math.max(0, Math.floor(x0));
    const ya = Math.max(0, Math.floor(y0));
    const xb = Math.min(this.width, Math.ceil(x1));
    const yb = Math.min(this.height, Math.ceil(y1));
    for (let y = ya; y < yb; y += 1) for (let x = xa; x < xb; x += 1) this.put(x, y, color);
  }

  /** Even-odd scanline fill of a flat polygon. */
  fillPoly(pts: Pts, color: FillColor): void {
    const n = pts.length >> 1;
    if (n < 3) return;
    let top = Infinity;
    let bottom = -Infinity;
    for (let i = 1; i < pts.length; i += 2) {
      top = Math.min(top, at(pts, i));
      bottom = Math.max(bottom, at(pts, i));
    }
    const y0 = Math.max(0, Math.floor(top));
    const y1 = Math.min(this.height - 1, Math.ceil(bottom));
    const xs = this.crossings;
    for (let y = y0; y <= y1; y += 1) {
      const sy = y + 0.5;
      xs.length = 0;
      for (let i = 0, j = n - 1; i < n; j = i, i += 1) {
        const ax = at(pts, 2 * i);
        const ay = at(pts, 2 * i + 1);
        const bx = at(pts, 2 * j);
        const by = at(pts, 2 * j + 1);
        if (ay > sy !== by > sy) xs.push(ax + ((sy - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.max(0, Math.ceil(at(xs, k) - 0.5));
        const xb = Math.min(this.width - 1, Math.floor(at(xs, k + 1) - 0.5));
        for (let x = xa; x <= xb; x += 1) {
          const c = typeof color === 'number' ? color : color(x, y);
          if (c >= 0) this.put(x, y, c);
        }
      }
    }
  }

  stamp(x: number, y: number, brush: Brush, color: number): void {
    for (let i = 0; i < brush.length; i += 2)
      this.put(x + at(brush, i), y + at(brush, i + 1), color);
  }

  /** A 1 px (thinned) line along a polyline. */
  line(pts: Pts, color: number, skip?: (x: number, y: number) => boolean): void {
    const pix = pixelPath(pts, true);
    for (let i = 0; i < pix.length; i += 2) {
      const x = at(pix, i);
      const y = at(pix, i + 1);
      if (skip?.(x, y) !== true) this.put(x, y, color);
    }
  }

  /** Closed 1 px outline of a polygon. */
  outline(poly: Pts, color: number): void {
    this.line([...poly, at(poly, 0), at(poly, 1)], color);
  }
}
