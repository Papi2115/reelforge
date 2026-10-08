/**
 * The index framebuffer of a Comic page (a port of the showcase's engine.js raster core): one
 * palette index per pixel, an optional clip mask (the panel being drawn), scanline polygons,
 * ellipses, square-brush Bresenham lines. Integer-exact, so a frame is bit-identical everywhere.
 */
import type { Remap } from '../inks.js';

/** A palette index, or a function of the pixel returning one (-1 = leave the pixel). */
export type Paint = number | ((x: number, y: number) => number);

/** Flat point list [x0, y0, x1, y1, ...]. */
export type Pts = readonly number[];

function at(list: readonly number[], index: number): number {
  return list[index] ?? 0;
}

export class ComicCanvas {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
  private clipMask: Uint8Array | null = null;
  private readonly crossings: number[] = [];
  private readonly pool: Uint8Array[] = [];

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Uint8Array(width * height);
  }

  clear(color: number): void {
    this.data.fill(color);
    this.clipMask = null;
  }

  get clip(): Uint8Array | null {
    return this.clipMask;
  }

  /** Runs `draw` with writes limited to `mask` (nested masks: pass an intersected one). */
  withClip(mask: Uint8Array | null, draw: () => void): void {
    const previous = this.clipMask;
    this.clipMask = mask;
    try {
      draw();
    } finally {
      this.clipMask = previous;
    }
  }

  /** A pixel mask of a polygon, intersected with the current clip; release it after use. */
  maskPoly(pts: Pts): Uint8Array {
    const mask = this.pool.pop() ?? new Uint8Array(this.width * this.height);
    mask.fill(0);
    this.scan(pts, (y, xa, xb) => {
      mask.fill(1, y * this.width + xa, y * this.width + xb + 1);
    });
    const clip = this.clipMask;
    if (clip) for (let i = 0; i < mask.length; i += 1) mask[i] = (mask[i] ?? 0) & (clip[i] ?? 0);
    return mask;
  }

  release(mask: Uint8Array): void {
    if (this.pool.length < 8) this.pool.push(mask);
  }

  remap(table: Remap): void {
    const { data } = this;
    for (let i = 0; i < data.length; i += 1) data[i] = table[data[i] ?? 0] ?? 0;
  }

  span(y: number, x0: number, x1: number, paint: Paint): void {
    if (y < 0 || y >= this.height) return;
    const xa = Math.max(0, x0);
    const xb = Math.min(this.width - 1, x1);
    const row = y * this.width;
    const clip = this.clipMask;
    const { data } = this;
    if (typeof paint === 'number') {
      for (let x = xa; x <= xb; x += 1) {
        if (clip === null || clip[row + x] === 1) data[row + x] = paint;
      }
      return;
    }
    for (let x = xa; x <= xb; x += 1) {
      if (clip !== null && clip[row + x] !== 1) continue;
      const color = paint(x, y);
      if (color >= 0) data[row + x] = color;
    }
  }

  plot(x: number, y: number, paint: Paint): void {
    const px = Math.round(x);
    const py = Math.round(y);
    if (px < 0 || py < 0 || px >= this.width || py >= this.height) return;
    this.span(py, px, px, paint);
  }

  rect(x: number, y: number, w: number, h: number, paint: Paint): void {
    const x0 = Math.round(x);
    const y0 = Math.round(y);
    const x1 = Math.round(x + w) - 1;
    const y1 = Math.round(y + h) - 1;
    for (let yy = y0; yy <= y1; yy += 1) this.span(yy, x0, x1, paint);
  }

  /** Even-odd scanline fill. */
  poly(pts: Pts, paint: Paint): void {
    this.scan(pts, (y, xa, xb) => {
      this.span(y, xa, xb, paint);
    });
  }

  private scan(pts: Pts, emit: (y: number, xa: number, xb: number) => void): void {
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
      const yc = y + 0.5;
      xs.length = 0;
      for (let i = 0; i < n; i += 1) {
        const j = (i + 1) % n;
        const ax = at(pts, i * 2);
        const ay = at(pts, i * 2 + 1);
        const bx = at(pts, j * 2);
        const by = at(pts, j * 2 + 1);
        if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) {
          xs.push(ax + ((yc - ay) / (by - ay)) * (bx - ax));
        }
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.max(0, Math.ceil(at(xs, k) - 0.5));
        const xb = Math.min(this.width - 1, Math.floor(at(xs, k + 1) - 0.5));
        if (xb >= xa) emit(y, xa, xb);
      }
    }
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, paint: Paint): void {
    if (rx <= 0 || ry <= 0) return;
    const y0 = Math.floor(cy - ry);
    const y1 = Math.ceil(cy + ry);
    for (let y = y0; y <= y1; y += 1) {
      const dy = (y + 0.5 - cy) / ry;
      if (dy < -1 || dy > 1) continue;
      const dx = rx * Math.sqrt(1 - dy * dy);
      const xa = Math.ceil(cx - dx - 0.5);
      const xb = Math.floor(cx + dx - 0.5);
      if (xb >= xa) this.span(y, xa, xb, paint);
    }
  }

  /** Bresenham line with a square brush of width w. */
  line(x0: number, y0: number, x1: number, y1: number, paint: Paint, w = 1): void {
    let x = Math.round(x0);
    let y = Math.round(y0);
    const xe = Math.round(x1);
    const ye = Math.round(y1);
    const dx = Math.abs(xe - x);
    const dy = -Math.abs(ye - y);
    const sx = x < xe ? 1 : -1;
    const sy = y < ye ? 1 : -1;
    let err = dx + dy;
    const width = Math.max(1, Math.round(w));
    const off = Math.floor((width - 1) / 2);
    for (let guard = 0; guard < 100_000; guard += 1) {
      if (width === 1) this.plot(x, y, paint);
      else this.rect(x - off, y - off, width, width, paint);
      if (x === xe && y === ye) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  }

  polyline(pts: Pts, paint: Paint, w = 1, closed = false): void {
    const n = pts.length >> 1;
    for (let i = 0; i < n - (closed ? 0 : 1); i += 1) {
      const j = (i + 1) % n;
      this.line(at(pts, i * 2), at(pts, i * 2 + 1), at(pts, j * 2), at(pts, j * 2 + 1), paint, w);
    }
  }

  /** Draws the first share p of a polyline's length (strokes that draw on). */
  strokeOn(pts: Pts, p: number, paint: Paint, w = 1): void {
    if (p <= 0) return;
    let total = 0;
    for (let i = 2; i < pts.length; i += 2) {
      total += Math.hypot(at(pts, i) - at(pts, i - 2), at(pts, i + 1) - at(pts, i - 1));
    }
    let left = total * Math.min(1, p);
    for (let i = 2; i < pts.length && left > 0; i += 2) {
      const ax = at(pts, i - 2);
      const ay = at(pts, i - 1);
      const bx = at(pts, i);
      const by = at(pts, i + 1);
      const length = Math.hypot(bx - ax, by - ay);
      const k = length <= 0 ? 1 : Math.min(1, left / length);
      this.line(ax, ay, ax + (bx - ax) * k, ay + (by - ay) * k, paint, w);
      left -= length;
    }
  }
}
